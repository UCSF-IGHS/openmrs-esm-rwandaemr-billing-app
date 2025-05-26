import React, { useEffect, useState, useMemo, useCallback} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  Button,
  Checkbox,
  Tag,
  Pagination,
  Accordion,
  AccordionItem,
  InlineLoading
} from '@carbon/react';
import { isDesktop, showToast, useLayoutType, useSession, usePagination } from '@openmrs/esm-framework';
import { getConsommationsByGlobalBillId, getConsommationItems, getConsommationById, getConsommationRates } from '../api/billing';
import { 
  isItemPaid, 
  isItemPartiallyPaid, 
  calculateTotalDueForSelected,
  areAllItemsPaid,
  computePaymentStatus
} from '../utils/billing-calculations';
import { type ConsommationListResponse, type ConsommationListItem, type ConsommationItem, type RowData } from '../types';
import styles from './embedded-consommations-list.scss';
import PaymentForm from '../payment-form/payment-form.component';
import { printReceipt } from '../payment-receipt/print-receipt';
import { Add, Printer } from '@carbon/react/icons';

interface EmbeddedConsommationsListProps {
  globalBillId: string;
  patientUuid?: string;
  insuranceCardNo?: string;
  onConsommationClick?: (consommationId: string) => void;
  onAddNewInvoice?: (globalBillId: string) => void;
  isGlobalBillClosed?: boolean;
}

interface ConsommationWithItems extends ConsommationListItem {
  items: ConsommationItem[];
  isLoadingItems: boolean;
  itemsLoaded: boolean;
  insuranceRates: {
    insuranceRate: number;
    patientRate: number;
  };
}

interface SelectedItemInfo {
  item: ConsommationItem & { selected?: boolean };
  consommationId: string;
  consommationService: string;
}

const EmbeddedConsommationsList: React.FC<EmbeddedConsommationsListProps> = ({ 
  globalBillId, 
  patientUuid, 
  insuranceCardNo,
  onConsommationClick,
  onAddNewInvoice,
  isGlobalBillClosed = false
}) => {
  const { t } = useTranslation();
  const session = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [consommations, setConsommations] = useState<ConsommationListResponse | null>(null);
  const [consommationsWithItems, setConsommationsWithItems] = useState<ConsommationWithItems[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItemInfo[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [consommationStatuses, setConsommationStatuses] = useState<Record<string, string>>({});
  const [expandedConsommations, setExpandedConsommations] = useState<Set<string>>(new Set());
  
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  const pageSize = 10;
  const { paginated, goTo, results: paginatedConsommations, currentPage } = usePagination(consommationsWithItems || [], pageSize);

  const persistPaymentStatus = useCallback((key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Error persisting payment status:', error);
    }
  }, []);

  const getPersistedPaymentStatus = useCallback((key: string) => {
    try {
      let stored = localStorage.getItem(key);
      if (!stored) {
        stored = sessionStorage.getItem(key);
      }
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Error retrieving payment status:', error);
      return {};
    }
  }, []);

  const updateConsommationStatus = useCallback((consommationId: string, items: ConsommationItem[]) => {
    if (!items || items.length === 0) return 'UNPAID';

    const allItemsStatus = items.map(item => {
      const paymentKey = `payment_${item.patientServiceBillId}`;
      const storedPayment = getPersistedPaymentStatus(paymentKey);
      return storedPayment.paid || isItemPaid(item);
    });

    const allItemsPaid = allItemsStatus.every(isPaid => isPaid);
    
    let status = 'UNPAID';
    
    if (allItemsPaid) {
      status = 'PAID';
    }

    const consommationKey = `consommation_status_${consommationId}`;
    persistPaymentStatus(consommationKey, { 
      paid: allItemsPaid, 
      timestamp: new Date().toISOString(),
      globalBillId: globalBillId
    });

    return status;
  }, [getPersistedPaymentStatus, persistPaymentStatus, globalBillId]);

  const fetchConsommations = useCallback(async () => {
    if (!globalBillId) return;
    
    setIsLoading(true);
    try {
      const data = await getConsommationsByGlobalBillId(globalBillId);
      setConsommations(data);
      
      if (data && data.results && data.results.length > 0) {
        const consommationsWithItemsData: ConsommationWithItems[] = data.results.map(consommation => ({
          ...consommation,
          items: [],
          isLoadingItems: false,
          itemsLoaded: false,
          insuranceRates: {
            insuranceRate: 0,
            patientRate: 100
          }
        }));
        
        setConsommationsWithItems(consommationsWithItemsData);
        
        loadConsommationStatuses(data.results);
      }
    } catch (error) {
      showToast({
        title: t('error', 'Error'),
        description: error.message,
        kind: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [globalBillId, t]);

  const loadConsommationStatuses = async (consommationsList: ConsommationListItem[]) => {
    const statusPromises = consommationsList.map(async (consommation) => {
      const consommationId = consommation.consommationId?.toString() || '';
      if (!consommationId) return { consommationId, status: 'UNPAID' };

      try {
        const consommationKey = `consommation_status_${consommationId}`;
        const storedStatus = getPersistedPaymentStatus(consommationKey);
        if (storedStatus.paid) {
          return { consommationId, status: 'PAID' };
        }

        const rawPatientDue = Number(consommation.patientBill?.amount ?? 0);
        const rawPaidAmount = Number(
          consommation.patientBill?.payments?.reduce((sum, p) => sum + (p.amountPaid || 0), 0) ?? 0
        );
        
        if (rawPaidAmount >= rawPatientDue && rawPatientDue > 0) {
          return { consommationId, status: 'PAID' };
        } else {
          return { consommationId, status: 'UNPAID' };
        }
      } catch (error) {
        console.error(`Error getting status for consommation ${consommationId}:`, error);
        return { consommationId, status: 'UNPAID' };
      }
    });

    try {
      const results = await Promise.all(statusPromises);
      const newStatusMap: Record<string, string> = {};
      results.forEach(({ consommationId, status }) => {
        newStatusMap[consommationId] = status;
      });
      setConsommationStatuses(newStatusMap);
    } catch (error) {
      console.error('Error loading consommation statuses:', error);
    }
  };

  const isActuallyPaid = useCallback((item: ConsommationItem): boolean => {
    const paymentKey = `payment_${item.patientServiceBillId}`;
    const storedPayment = getPersistedPaymentStatus(paymentKey);
    if (storedPayment.paid) {
      return true;
    }
    
    return isItemPaid(item);
  }, [getPersistedPaymentStatus]);

  const cleanupOldPaymentData = useCallback(() => {
    try {
      const currentTime = new Date().getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; 
      
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('payment_') || key.startsWith('consommation_status_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}');
            if (data.timestamp) {
              const dataTime = new Date(data.timestamp).getTime();
              if (currentTime - dataTime > maxAge) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        }
      });
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('payment_') || key.startsWith('consommation_status_')) {
          try {
            const data = JSON.parse(sessionStorage.getItem(key) || '{}');
            if (data.timestamp) {
              const dataTime = new Date(data.timestamp).getTime();
              if (currentTime - dataTime > maxAge) {
                sessionStorage.removeItem(key);
              }
            }
          } catch (e) {
            sessionStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Error cleaning up old payment data:', error);
    }
  }, []);

  const syncWithServer = useCallback(async () => {
    try {
      if (!globalBillId) return;
      
      const freshData = await getConsommationsByGlobalBillId(globalBillId);
      if (freshData && freshData.results) {
        for (const consommation of freshData.results) {
          const consommationId = consommation.consommationId?.toString();
          if (!consommationId) continue;
          
          try {
            const freshItems = await getConsommationItems(consommationId);
            
            for (const item of freshItems) {
              const paymentKey = `payment_${item.patientServiceBillId}`;
              const localPayment = getPersistedPaymentStatus(paymentKey);
              const serverPaid = isItemPaid(item);
              
              if (localPayment.paid !== serverPaid) {
                const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                persistPaymentStatus(paymentKey, {
                  paid: serverPaid,
                  paidAmount: serverPaid ? itemTotal : (item.paidAmount || 0),
                  timestamp: new Date().toISOString(),
                  consommationId: consommationId,
                  globalBillId: globalBillId,
                  syncedFromServer: true
                });
              }
            }
          } catch (error) {
            console.error(`Error syncing consommation ${consommationId}:`, error);
          }
        }
      }
      
      fetchConsommations();
      
      showToast({
        title: t('syncComplete', 'Sync Complete'),
        description: t('syncCompleteDescription', 'Payment statuses have been synchronized with the server'),
        kind: 'success',
      });
    } catch (error) {
      console.error('Error syncing with server:', error);
      showToast({
        title: t('syncError', 'Sync Error'),
        description: t('syncErrorDescription', 'There was an error synchronizing with the server'),
        kind: 'error',
      });
    }
  }, [globalBillId, getPersistedPaymentStatus, persistPaymentStatus, fetchConsommations, t]);

  const fetchInsuranceRates = useCallback(async (consommationId: string) => {
    try {
      return await getConsommationRates(consommationId);
    } catch (error) {
      console.error('Error fetching insurance rates:', error);
      return { insuranceRate: 0, patientRate: 100 };
    }
  }, []);

  const fetchConsommationItems = useCallback(async (consommationId: string) => {
    try {
      const items = await getConsommationItems(consommationId);
      
      const enhancedItems = items.map(item => {
        const paymentKey = `payment_${item.patientServiceBillId}`;
        const storedPayment = getPersistedPaymentStatus(paymentKey);
        
        if (storedPayment.paid || storedPayment.paidAmount > 0) {
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = Math.max(storedPayment.paidAmount || 0, item.paidAmount || 0);
          const remainingAmount = Math.max(0, itemTotal - paidAmount);
          
          return {
            ...item,
            paid: storedPayment.paid || paidAmount >= itemTotal,
            partiallyPaid: (!storedPayment.paid && paidAmount > 0),
            paidAmount: paidAmount,
            remainingAmount: remainingAmount,
            selected: false
          };
        }
        
        return {
          ...item,
          selected: false
        };
      });

      return enhancedItems;
    } catch (error) {
      console.error('Failed to fetch consommation items:', error);
      return [];
    }
  }, [getPersistedPaymentStatus]);

  const updateConsommationStatusImmediately = useCallback((consommationId: string, items: ConsommationItem[]) => {
    const status = updateConsommationStatus(consommationId, items);
    setConsommationStatuses(prev => ({
      ...prev,
      [consommationId]: status
    }));
    return status;
  }, [updateConsommationStatus]);

  const loadConsommationItems = useCallback(async (consommationId: string) => {
    const consommation = consommationsWithItems.find(c => 
      c.consommationId?.toString() === consommationId
    );
    
    if (!consommation || consommation.itemsLoaded || consommation.isLoadingItems) {
      return;
    }

    setConsommationsWithItems(prev => 
      prev.map(c => 
        c.consommationId?.toString() === consommationId 
          ? { ...c, isLoadingItems: true }
          : c
      )
    );

    try {
      const [items, rates] = await Promise.all([
        fetchConsommationItems(consommationId),
        fetchInsuranceRates(consommationId)
      ]);

      const paidItems = items.map(item => {
        const isPaid = isActuallyPaid(item);
        return {
          ...item,
          selected: isPaid
        };
      });

      setConsommationsWithItems(prev => 
        prev.map(c => 
          c.consommationId?.toString() === consommationId 
            ? { 
                ...c, 
                items: paidItems, 
                isLoadingItems: false, 
                itemsLoaded: true,
                insuranceRates: rates 
              }
            : c
        )
      );

      const currentConsommation = consommationsWithItems.find(c =>
        c.consommationId?.toString() === consommationId
      );
      const serviceName = currentConsommation?.department?.name || `Service ${consommationId}`;
      
      // Filter out only the paid items to add to selected items
      const paidItemsToSelect = paidItems
        .filter(item => isActuallyPaid(item))
        .map(item => ({
          item: { ...item, selected: true },
          consommationId,
          consommationService: serviceName,
        }));
      
      if (paidItemsToSelect.length > 0) {
        setSelectedItems(prev => [...prev, ...paidItemsToSelect]);
      }

      const status = updateConsommationStatusImmediately(consommationId, paidItems);

    } catch (error) {
      console.error(`Error loading items for consommation ${consommationId}:`, error);
      setConsommationsWithItems(prev => 
        prev.map(c => 
          c.consommationId?.toString() === consommationId 
            ? { 
                ...c, 
                items: [], 
                isLoadingItems: false, 
                itemsLoaded: true,
                insuranceRates: { insuranceRate: 0, patientRate: 100 } 
              }
            : c
        )
      );
    }
  }, [consommationsWithItems, fetchConsommationItems, fetchInsuranceRates, isActuallyPaid, updateConsommationStatusImmediately]);

  const handleAccordionChange = useCallback((consommationId: string, isExpanded: boolean) => {
    if (isExpanded) {
      setExpandedConsommations(prev => new Set([...prev, consommationId]));
      loadConsommationItems(consommationId);
    } else {
      setExpandedConsommations(prev => {
        const newSet = new Set(prev);
        newSet.delete(consommationId);
        return newSet;
      });
    }
  }, [loadConsommationItems]);
  
  useEffect(() => {
    cleanupOldPaymentData();
    
    fetchConsommations();
  }, [fetchConsommations, cleanupOldPaymentData]);

  const handleAddNewInvoice = () => {
    if (onAddNewInvoice && globalBillId) {
      onAddNewInvoice(globalBillId.toString());
    }
  };

  const handleItemSelection = (consommationId: string, itemIndex: number) => {
    const consommation = consommationsWithItems.find(
      c => c.consommationId?.toString() === consommationId
    );
    
    if (!consommation) return;
    
    const item = consommation.items[itemIndex];
    
    const updatedConsommations = consommationsWithItems.map(consommation => {
      if (consommation.consommationId?.toString() === consommationId) {
        const updatedItems = consommation.items.map((item, index) => {
          if (index === itemIndex) {
            const isCurrentlySelected = item.selected || false;
            const newSelectedState = !isCurrentlySelected;
            
            if (newSelectedState) {
              const selectedItemInfo: SelectedItemInfo = {
                item: { ...item, selected: true },
                consommationId: consommationId,
                consommationService: consommation.department?.name || `Service ${consommationId}`
              };
              setSelectedItems(prev => [...prev, selectedItemInfo]);
            } else {
              setSelectedItems(prev => prev.filter(selectedItem => 
                !(selectedItem.consommationId === consommationId && 
                  selectedItem.item.patientServiceBillId === item.patientServiceBillId)
              ));
            }
            
            return { ...item, selected: newSelectedState };
          }
          return item;
        });
        
        setTimeout(() => {
          updateConsommationStatusImmediately(consommationId, updatedItems);
        }, 0);
        
        return { ...consommation, items: updatedItems };
      }
      return consommation;
    });
    
    setConsommationsWithItems(updatedConsommations);
  };

  const computeItemPaymentStatus = useCallback((item: ConsommationItem): string => {
    const paymentKey = `payment_${item.patientServiceBillId}`;
    const storedPayment = getPersistedPaymentStatus(paymentKey);
    if (storedPayment.paid) {
      return 'PAID';
    }
    
    return isItemPaid(item) ? 'PAID' : 'UNPAID';
  }, [getPersistedPaymentStatus]);

  const calculateSelectedUnpaidItemsTotal = () => {
    return selectedItems.reduce((total, selectedItem) => {
      const item = selectedItem.item;
      if (isActuallyPaid(item)) return total;
      
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const paidAmount = item.paidAmount || 0;
      const remainingAmount = Math.max(0, itemTotal - paidAmount);
      return total + remainingAmount;
    }, 0);
  };

  const calculateSelectedItemsTotal = () => {
    return selectedItems.reduce((total, selectedItem) => {
      const item = selectedItem.item;
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      return total + itemTotal;
    }, 0);
  };

  const hasUnpaidSelectedItems = () => {
    return selectedItems.some(selectedItem => !isActuallyPaid(selectedItem.item));
  };

  const hasPaidSelectedItems = () => {
    return selectedItems.some(si => isActuallyPaid(si.item));
  };

  const handlePrintReceiptForSelected = async () => {
    try {
      if (selectedItems.length === 0) {
        showToast({
          title: t('noItems', 'No Items'),
          description: t('noItemsSelected', 'No items selected for printing'),
          kind: 'warning',
        });
        return;
      }

      const paidSelectedItems = selectedItems.filter(si => isActuallyPaid(si.item));

      if (paidSelectedItems.length === 0) {
        showToast({
          title: t('noPaidItems', 'No Paid Items'),
          description: t('noPaidItemsSelected', 'No paid items selected for printing'),
          kind: 'warning',
        });
        return;
      }

      const totalPaidAmount = paidSelectedItems.reduce((total, selectedItem) => {
        const item = selectedItem.item;
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        return total + itemTotal;
      }, 0);

      const paymentData = {
        amountPaid: totalPaidAmount.toFixed(2),
        receivedCash: '',
        change: '0.00',
        paymentMethod: 'N/A', 
        deductedAmount: '',
        dateReceived: new Date().toISOString().split('T')[0],
        collectorName: session?.user?.display || 'Unknown',
        patientName: 'Patient', 
        policyNumber: ''
      };

      const groupedConsommationData: Record<string, any> = {};
      const uniqueConsommations = new Set(paidSelectedItems.map(item => item.consommationId));
      
      uniqueConsommations.forEach(consommationId => {
        const selectedItemsForConsommation = paidSelectedItems.filter(item => item.consommationId === consommationId);
        if (selectedItemsForConsommation.length > 0) {
          groupedConsommationData[consommationId] = {
            service: selectedItemsForConsommation[0].consommationService,
            date: new Date().toLocaleDateString()
          };
        }
      });

      const itemsForReceipt = paidSelectedItems.map(selectedItem => {
        const item = selectedItem.item;
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        let actualPaidAmount = item.paidAmount || 0;
        
        const paymentKey = `payment_${item.patientServiceBillId}`;
        const storedPayment = getPersistedPaymentStatus(paymentKey);
        if (storedPayment.paid) {
          actualPaidAmount = itemTotal; 
        } else if (storedPayment.paidAmount > 0) {
          actualPaidAmount = Math.max(storedPayment.paidAmount, actualPaidAmount);
        }

        return {
          ...item,
          consommationId: selectedItem.consommationId,
          paidAmount: actualPaidAmount,
          paid: actualPaidAmount >= itemTotal,
          partiallyPaid: actualPaidAmount > 0 && actualPaidAmount < itemTotal
        };
      });

      printReceipt(paymentData, groupedConsommationData, itemsForReceipt);
    } catch (error) {
      console.error('Error printing receipt for selected items:', error);
      showToast({
        title: t('printError', 'Print Error'),
        description: t('printErrorDescription', 'There was an error preparing the receipt'),
        kind: 'error',
      });
    }
  };

  const openPaymentModal = () => {
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
  };

  const handlePaymentSuccess = async () => {
    const unpaidSelectedItems = selectedItems.filter(item => !isActuallyPaid(item.item));
    const affectedConsommations = new Set(unpaidSelectedItems.map(item => item.consommationId));
    
    unpaidSelectedItems.forEach(selectedItem => {
      const item = selectedItem.item;
      const paymentKey = `payment_${item.patientServiceBillId}`;
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      
      persistPaymentStatus(paymentKey, {
        paid: true,
        paidAmount: itemTotal,
        timestamp: new Date().toISOString(),
        consommationId: selectedItem.consommationId,
        globalBillId: globalBillId
      });
    });
    
    const updatedConsommationsWithItems = consommationsWithItems.map(consommation => {
      const consommationId = consommation.consommationId?.toString() || '';
      
      if (affectedConsommations.has(consommationId)) {
        const updatedItems = consommation.items.map(item => {
          const wasSelected = unpaidSelectedItems.some(selectedItem => 
            selectedItem.consommationId === consommationId && 
            selectedItem.item.patientServiceBillId === item.patientServiceBillId
          );
          
          if (wasSelected) {
            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
            return {
              ...item,
              paid: true,
              partiallyPaid: false,
              paidAmount: itemTotal,
              remainingAmount: 0,
              selected: true
            };
          }
          return item;
        });
        
        return {
          ...consommation,
          items: updatedItems
        };
      }
      return consommation;
    });
    
    const updatedStatusMap = { ...consommationStatuses };
    
    for (const consommationId of affectedConsommations) {
      const updatedConsommation = updatedConsommationsWithItems.find(c => 
        c.consommationId?.toString() === consommationId
      );
      
      if (updatedConsommation && updatedConsommation.items.length > 0) {
        const status = updateConsommationStatus(consommationId, updatedConsommation.items);
        updatedStatusMap[consommationId] = status;
      }
    }
    
    setConsommationsWithItems(updatedConsommationsWithItems);
    setConsommationStatuses(updatedStatusMap);
    
    setSelectedItems(prev => {
      const itemsToKeep = prev.filter(item => 
        !unpaidSelectedItems.some(unpaidItem => 
          unpaidItem.consommationId === item.consommationId && 
          unpaidItem.item.patientServiceBillId === item.item.patientServiceBillId
        )
      );
      
      const newlyPaidItems = unpaidSelectedItems.map(item => {
        const itemTotal = (item.item.quantity || 1) * (item.item.unitPrice || 0);
        return {
          ...item,
          item: {
            ...item.item,
            paid: true,
            partiallyPaid: false,
            paidAmount: itemTotal,
            remainingAmount: 0,
            selected: true
          }
        };
      });
      
      return [...itemsToKeep, ...newlyPaidItems];
    });

    setTimeout(() => {
      affectedConsommations.forEach(consommationId => {
        getConsommationById(consommationId).then(consommationData => {
          // if (consommationData) {
          //   console.log(`Verified consommation ${consommationId} data with server`);
          // }
        }).catch(err => {
          console.error(`Error verifying consommation ${consommationId}:`, err);
        });
      });
    }, 1000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <DataTableSkeleton headers={[]} rowCount={5} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableHeader}>
        <div className={styles.headerTitleContainer}>
          <div className={styles.headerTitleInfo}>
            <h4>
              {t('consommationsList', 'Consommations List for Global Bill')} #{globalBillId}
            </h4>
            {isGlobalBillClosed && (
              <span className={styles.closedBillNotice}>{t('closedBill', 'This bill is closed')}</span>
            )}
          </div>
          <Button
            kind="ghost"
            renderIcon={(props) => <Add size={16} {...props} />}
            iconDescription={t('addInvoice', 'Add invoice')}
            onClick={handleAddNewInvoice}
            disabled={isGlobalBillClosed}
            title={isGlobalBillClosed ? t('closedBillNoAdd', 'Cannot add items to a closed bill') : ''}
          >
            {t('add', 'Add Item')}
          </Button>
        </div>
      </div>

      {consommationsWithItems && consommationsWithItems.length > 0 ? (
        <>
          <div className={styles.accordionContainer}>
            <Accordion align="start">
              {paginatedConsommations.map((consommation, index) => {
                const consommationId = consommation.consommationId?.toString() || '';
                const statusText = consommationStatuses[consommationId] || 'UNPAID';
                const isExpanded = expandedConsommations.has(consommationId);
                
                return (
                  <AccordionItem
                    key={consommationId}
                    title={
                      <div className={styles.accordionTitle}>
                        <div className={styles.consommationInfo}>
                          <span className={styles.consommationId}>#{consommationId}</span>
                          <span className={styles.consommationService}>
                            {consommation.department?.name || `Service ${consommationId}`}
                          </span>
                          <span className={styles.consommationDate}>
                            {consommation.createdDate ? new Date(consommation.createdDate).toLocaleDateString() : '-'}
                          </span>
                        </div>
                        <div className={styles.consommationStatus}>
                          <Tag
                            type={statusText === 'PAID' ? 'green' : 'red'}
                            className={statusText === 'PAID' ? styles.paidStatus : styles.unpaidStatus}
                          >
                            {statusText}
                          </Tag>
                        </div>
                      </div>
                    }
                    open={isExpanded}
                    onHeadingClick={() => handleAccordionChange(consommationId, !isExpanded)}
                  >
                    <div className={styles.consommationItems}>
                      {consommation.isLoadingItems ? (
                        <div className={styles.loadingItems}>
                          <InlineLoading description={t('loadingItems', 'Loading items...')} />
                        </div>
                      ) : consommation.itemsLoaded && consommation.items.length > 0 ? (
                        <div className={styles.itemsTable}>
                          <table className={styles.itemsDataTable}>
                            <thead>
                              <tr>
                                <th></th>
                                <th>{t('serviceDate', 'Date')}</th>
                                <th>{t('itemName', 'Item Name')}</th>
                                <th>{t('quantity', 'Qty')}</th>
                                <th>{t('unitPrice', 'Unit Price')}</th>
                                <th>{t('itemTotal', 'Total')}</th>
                                <th>{t('insuranceAmount', `Ins.(${consommation.insuranceRates.insuranceRate}%)`)}</th>
                                <th>{t('patientAmount', `Pat.(${consommation.insuranceRates.patientRate}%)`)}</th>
                                <th>{t('paidAmt', 'Paid')}</th>
                                <th>{t('status', 'Status')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consommation.items.map((item, itemIndex) => {
                                const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                                const paidAmt = item.paidAmount || 0;
                                const isPaid = isActuallyPaid(item);
                                const isPartiallyPaid = isItemPartiallyPaid(item);
                                
                                const insuranceAmount = (itemTotal * consommation.insuranceRates.insuranceRate / 100);
                                const patientAmount = (itemTotal * consommation.insuranceRates.patientRate / 100);
                                
                                return (
                                  <tr key={itemIndex} className={item.selected ? styles.selectedItemRow : ''}>
                                    <td>
                                      <Checkbox
                                        id={`item-${consommationId}-${itemIndex}`}
                                        checked={item.selected || false}
                                        onChange={() => handleItemSelection(consommationId, itemIndex)}
                                        labelText=""
                                      />
                                    </td>
                                    <td>{item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : '-'}</td>
                                    <td title={item.itemName || '-'} className={styles.itemNameCell}>
                                      {item.itemName || '-'}
                                    </td>
                                    <td>{item.quantity || '1'}</td>
                                    <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                                    <td>{Number(itemTotal).toFixed(2)}</td>
                                    <td>{insuranceAmount.toFixed(2)}</td>
                                    <td>{patientAmount.toFixed(2)}</td>
                                    <td>{Number(paidAmt).toFixed(2)}</td>
                                    <td>
                                      <Tag
                                        type={computeItemPaymentStatus(item) === 'PAID' ? 'green' : 'red'}
                                        className={computeItemPaymentStatus(item) === 'PAID' ? styles.paidStatus : styles.unpaidStatus}
                                      >
                                        {computeItemPaymentStatus(item)}
                                      </Tag>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : consommation.itemsLoaded && consommation.items.length === 0 ? (
                        <div className={styles.noItems}>
                          {t('noItemsFound', 'No items found for this consommation')}
                        </div>
                      ) : (
                        <div className={styles.loadingItems}>
                          <span>{t('clickToLoadItems', 'Click to load items...')}</span>
                        </div>
                      )}
                    </div>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {paginated && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={pageSize}
              totalItems={consommationsWithItems.length}
              pageSizes={[5, 10, 20, 50]}
              onChange={({ page }) => goTo(page)}
            />
          )}

          <div className={styles.actionsContainer}>
            <div className={styles.paymentActions}>
              <p className={styles.selectedSummary}>
                {selectedItems.length > 0 ? (
                  <>
                    {t('selectedItems', 'Selected Items')}: {selectedItems.length} | {' '}
                    {hasUnpaidSelectedItems() ? (
                      <>
                        {t('unpaidAmount', 'Unpaid Amount')}: {calculateSelectedUnpaidItemsTotal().toFixed(2)} | {' '}
                      </>
                    ) : null}
                    {t('totalAmount', 'Total Amount')}: {calculateSelectedItemsTotal().toFixed(2)}
                  </>
                ) : (
                  t('noItemsSelected', 'No items selected')
                )}
              </p>
              <div className={styles.actionButtons}>
                <Button 
                  kind="ghost" 
                  onClick={syncWithServer}
                  title={t('syncWithServer', 'Sync payment statuses with server')}
                >
                  {t('sync', 'Sync')}
                </Button>
                <Button 
                  kind="secondary" 
                  renderIcon={Printer}
                  disabled={!hasPaidSelectedItems()}
                  onClick={handlePrintReceiptForSelected}
                  title={!hasPaidSelectedItems() ? t('noPaidItems', 'No paid items available for printing') : ''}
                >
                  {t('printReceipt', 'Print Receipt')}
                </Button>
                <Button 
                  kind="primary" 
                  disabled={!hasUnpaidSelectedItems()}
                  onClick={openPaymentModal}
                  title={selectedItems.length > 0 && !hasUnpaidSelectedItems() ?
                    t('onlyPaidItemsSelected', 'Only paid items are selected. Select unpaid items to make payment.') :
                    ''
                  }
                >
                  {t('paySelected', 'Pay Selected')}
                </Button>
              </div>
            </div>
          </div>

          {/* Pass only unpaid items to the payment form */}
          {isPaymentModalOpen && (
            <PaymentForm
              isOpen={isPaymentModalOpen}
              onClose={closePaymentModal}
              onSuccess={handlePaymentSuccess}
              selectedItems={selectedItems.filter(item => !isActuallyPaid(item.item))}
              onItemToggle={handleItemSelection}
            />
          )}
        </>
      ) : (
        <div className={styles.emptyStateContainer}>
          <p className={styles.noData}>{t('noConsommations', 'No consommations found for this global bill')}</p>
          <Button
            kind="primary"
            renderIcon={(props) => <Add size={16} {...props} />}
            onClick={handleAddNewInvoice}
            disabled={isGlobalBillClosed}
            title={isGlobalBillClosed ? t('closedBillNoAdd', 'Cannot add items to a closed bill') : ''}
          >
            {t('createFirstConsommation', 'Create First Consommation')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmbeddedConsommationsList;
