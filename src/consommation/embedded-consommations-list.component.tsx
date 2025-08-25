import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  Button,
  Checkbox,
  Tag,
  Pagination,
  Accordion,
  AccordionItem,
  InlineLoading,
} from '@carbon/react';
import { isDesktop, showToast, useLayoutType, useSession, usePagination } from '@openmrs/esm-framework';
import {
  getConsommationsByGlobalBillId,
  getConsommationItems,
  getConsommationById,
  getConsommationRates,
  getMultipleConsommationStatuses,
  isConsommationPaid,
  getDepartments,
} from '../api/billing';
import { isItemPaid, isItemPartiallyPaid } from '../utils/billing-calculations';
import {
  type ConsommationListResponse,
  type ConsommationListItem,
  type ConsommationItem,
} from '../types';
import styles from './embedded-consommations-list.scss';
import PaymentForm from '../payment-form/payment-form.component';
import { printReceipt } from '../payment-receipt/print-receipt';
import { Add, Printer } from '@carbon/react/icons';
import GlobalBillInsuranceInfo from '../invoice/global-bill-insurance-info.component';

interface EmbeddedConsommationsListProps {
  globalBillId: string;
  patientUuid?: string;
  insuranceCardNo?: string;
  onConsommationClick?: (consommationId: string) => void;
  onAddNewInvoice?: (globalBillId: string) => void;
  isGlobalBillClosed?: boolean;
  onBillClosed?: () => void;
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

const EmbeddedConsommationsList = forwardRef<any, EmbeddedConsommationsListProps>(
  (
    {
      globalBillId,
      patientUuid,
      insuranceCardNo,
      onConsommationClick,
      onAddNewInvoice,
      isGlobalBillClosed = false,
      onBillClosed,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const session = useSession();

    const [isLoading, setIsLoading] = useState(true);
    const [consommations, setConsommations] = useState<ConsommationListResponse | null>(null);
    const [consommationsWithItems, setConsommationsWithItems] = useState<ConsommationWithItems[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<SelectedItemInfo[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [consommationStatuses, setConsommationStatuses] = useState<Record<string, string>>({});
    const [expandedConsommations, setExpandedConsommations] = useState<Set<string>>(new Set());

    const layout = useLayoutType();
    const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

    const pageSize = 10;
    const {
      paginated,
      goTo,
      results: paginatedConsommations,
      currentPage,
    } = usePagination(consommationsWithItems || [], pageSize);

    const getDepartmentName = useCallback(
      (consommationItem: any) => {
        if (consommationItem?.department?.name) {
          return consommationItem.department.name;
        }

        if (consommationItem?.department?.departmentId && departments.length > 0) {
          const dept = departments.find((d) => d.departmentId === consommationItem.department.departmentId);
          if (dept) {
            return dept.name;
          }
        }

        if (consommationItem?.billItems?.length > 0) {
          const firstItem = consommationItem.billItems[0];
          if (firstItem?.hopService?.name) {
            return firstItem.hopService.name;
          }
        }

        if (consommationItem?.consommationId) {
          return `Service ${consommationItem.consommationId}`;
        }

        return t('unknownService', 'Unknown Service');
      },
      [departments, t],
    );

    const updateConsommationStatus = useCallback(async (consommationId: string): Promise<string> => {
      try {
        const isPaid = await isConsommationPaid(consommationId);
        const status = isPaid ? 'PAID' : 'UNPAID';

        setConsommationStatuses((prev) => ({
          ...prev,
          [consommationId]: status,
        }));

        return status;
      } catch (error) {
        console.error(`Error updating consommation status for ${consommationId}:`, error);
        return 'UNPAID';
      }
    }, []);

    const loadConsommationStatuses = useCallback(async (consommationsList: ConsommationListItem[]) => {
      try {
        const consommationIds = consommationsList
          .map((consommation) => consommation.consommationId?.toString())
          .filter((id): id is string => Boolean(id));

        if (consommationIds.length === 0) {
          setConsommationStatuses({});
          return;
        }

        const statusMap = await getMultipleConsommationStatuses(consommationIds);

        const newStatusMap: Record<string, string> = {};
        Object.entries(statusMap).forEach(([consommationId, isPaid]) => {
          newStatusMap[consommationId] = isPaid ? 'PAID' : 'UNPAID';
        });

        setConsommationStatuses(newStatusMap);
      } catch (error) {
        console.error('Error loading consommation statuses from API:', error);
        const fallbackStatusMap: Record<string, string> = {};
        consommationsList.forEach((consommation) => {
          const consommationId = consommation.consommationId?.toString();
          if (consommationId) {
            fallbackStatusMap[consommationId] = 'UNPAID';
          }
        });
        setConsommationStatuses(fallbackStatusMap);
      }
    }, []);

    const fetchInsuranceRates = useCallback(
      async (consommationId: string) => {
        try {
          const rates = await getConsommationRates(consommationId, globalBillId);

          if (rates.insuranceRate + rates.patientRate !== 100) {
            console.warn(`Rate validation failed for consommation ${consommationId}:`, rates);
          }

          return rates;
        } catch (error) {
          console.error('Error fetching insurance rates:', error);
          return { insuranceRate: 0, patientRate: 100 };
        }
      },
      [globalBillId],
    );

    const fetchConsommations = useCallback(async () => {
      if (!globalBillId) return;

      setIsLoading(true);
      try {
        const [consommationData, departmentData] = await Promise.all([
          getConsommationsByGlobalBillId(globalBillId),
          getDepartments().catch(() => []),
        ]);

        setConsommations(consommationData);
        setDepartments(departmentData);

        if (consommationData?.results?.length > 0) {
          const consommationsWithItemsData: ConsommationWithItems[] = consommationData.results.map((consommation) => ({
            ...consommation,
            items: [],
            isLoadingItems: false,
            itemsLoaded: false,
            insuranceRates: {
              insuranceRate: 0,
              patientRate: 100,
            },
          }));

          setConsommationsWithItems(consommationsWithItemsData);

          // Load insurance rates for all consommations immediately
          consommationData.results.forEach(async (consommation) => {
            if (consommation.consommationId) {
              try {
                const rates = await fetchInsuranceRates(consommation.consommationId.toString());
                setConsommationsWithItems((prev) =>
                  prev.map((c) =>
                    c.consommationId?.toString() === consommation.consommationId?.toString()
                      ? { ...c, insuranceRates: rates }
                      : c,
                  ),
                );
              } catch (error) {
                console.error(`Failed to load initial rates for consommation ${consommation.consommationId}:`, error);
              }
            }
          });

          loadConsommationStatuses(consommationData.results);
        }
      } catch (error: any) {
        showToast({
          title: t('error', 'Error'),
          description: error?.message || String(error),
          kind: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    }, [globalBillId, t, loadConsommationStatuses, fetchInsuranceRates]);

    // Paid strictly from backend-derived fields
    const isActuallyPaid = useCallback((item: ConsommationItem): boolean => isItemPaid(item), []);

    // No local/session storage cleanup—no longer used
    const cleanupOldPaymentData = useCallback(() => {}, []);

    const syncWithServer = useCallback(async () => {
      try {
        if (!globalBillId) return;

        await fetchConsommations();

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
    }, [globalBillId, fetchConsommations, t]);

    const fetchConsommationItemsCb = useCallback(
      async (consommationId: string) => {
        try {
          const items = await getConsommationItems(consommationId);

          // Trust backend-calculated fields; do not override locally
          const enhancedItems = items.map((item) => ({ ...item, selected: false }));

          return enhancedItems;
        } catch (error) {
          console.error('Failed to fetch consommation items:', error);
          return [];
        }
      },
      [],
    );

    const updateConsommationStatusImmediately = useCallback(
      async (consommationId: string) => {
        try {
          const status = await updateConsommationStatus(consommationId);
          return status;
        } catch (error) {
          console.error(`Error updating consommation status immediately for ${consommationId}:`, error);
          return 'UNPAID';
        }
      },
      [updateConsommationStatus],
    );

    const loadConsommationItems = useCallback(
      async (consommationId: string) => {
        const consommation = consommationsWithItems.find((c) => c.consommationId?.toString() === consommationId);

        if (!consommation || consommation.itemsLoaded || consommation.isLoadingItems) {
          return;
        }

        setConsommationsWithItems((prev) =>
          prev.map((c) => (c.consommationId?.toString() === consommationId ? { ...c, isLoadingItems: true } : c)),
        );

        try {
          const [items, rates] = await Promise.all([
            fetchConsommationItemsCb(consommationId),
            fetchInsuranceRates(consommationId),
          ]);

          // If the parent consommation is paid, show all its items as fully paid
          const parentPaid = (consommationStatuses[consommationId] || '').toUpperCase() === 'PAID';

          const paidItems = items.map((item) => {
            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
            const effectivePaidAmt = parentPaid ? itemTotal : item.paidAmount || 0;
            const isPaid = parentPaid || isActuallyPaid(item);

            return {
              ...item,
              paid: isPaid,
              paidAmount: effectivePaidAmt,
              remainingAmount: Math.max(0, itemTotal - effectivePaidAmt),
              selected: isPaid,
            } as ConsommationItem & { selected?: boolean };
          });

          setConsommationsWithItems((prev) =>
            prev.map((c) =>
              c.consommationId?.toString() === consommationId
                ? {
                    ...c,
                    items: paidItems,
                    isLoadingItems: false,
                    itemsLoaded: true,
                    insuranceRates: rates,
                  }
                : c,
            ),
          );

          const currentConsommation = consommationsWithItems.find(
            (c) => c.consommationId?.toString() === consommationId,
          );
          const serviceName = getDepartmentName(currentConsommation);

          const paidItemsToSelect = paidItems
            .filter((item) => isActuallyPaid(item))
            .map((item) => ({
              item: { ...item, selected: true },
              consommationId,
              consommationService: serviceName,
            }));

          if (paidItemsToSelect.length > 0) {
            setSelectedItems((prev) => [...prev, ...paidItemsToSelect]);
          }

          updateConsommationStatusImmediately(consommationId);
        } catch (error) {
          console.error(`Error loading items for consommation ${consommationId}:`, error);
          setConsommationsWithItems((prev) =>
            prev.map((c) =>
              c.consommationId?.toString() === consommationId
                ? {
                    ...c,
                    items: [],
                    isLoadingItems: false,
                    itemsLoaded: true,
                  }
                : c,
            ),
          );

          try {
            const rates = await fetchInsuranceRates(consommationId);
            setConsommationsWithItems((prev) =>
              prev.map((c) =>
                c.consommationId?.toString() === consommationId
                  ? {
                      ...c,
                      insuranceRates: rates,
                    }
                  : c,
              ),
            );
          } catch (error) {
            console.error('Failed to fetch insurance rates:', error);
          }
        }
      },
      [
        consommationsWithItems,
        fetchConsommationItemsCb,
        fetchInsuranceRates,
        isActuallyPaid,
        updateConsommationStatusImmediately,
        getDepartmentName,
        consommationStatuses,
      ],
    );

    const handleAccordionChange = useCallback(
      (consommationId: string, isExpanded: boolean) => {
        if (isExpanded) {
          setExpandedConsommations((prev) => new Set([...prev, consommationId]));
          loadConsommationItems(consommationId);
        } else {
          setExpandedConsommations((prev) => {
            const newSet = new Set(prev);
            newSet.delete(consommationId);
            return newSet;
          });
        }
      },
      [loadConsommationItems],
    );

    useEffect(() => {
      cleanupOldPaymentData();
      fetchConsommations();
    }, [fetchConsommations, cleanupOldPaymentData]);

    // Refresh insurance rates for all consommations when global bill changes
    const refreshAllInsuranceRates = useCallback(async () => {
      if (consommationsWithItems.length === 0) return;

      const ratePromises = consommationsWithItems.map(async (consommation) => {
        if (consommation.consommationId) {
          try {
            const rates = await fetchInsuranceRates(consommation.consommationId.toString());
            return { consommationId: consommation.consommationId, rates };
          } catch (error) {
            console.error(`Failed to refresh rates for consommation ${consommation.consommationId}:`, error);
            return null;
          }
        }
        return null;
      });

      const results = await Promise.all(ratePromises);

      setConsommationsWithItems((prev) =>
        prev.map((c) => {
          const result = results.find((r) => r && r.consommationId === c.consommationId);
          return result ? { ...c, insuranceRates: result.rates } : c;
        }),
      );
    }, [consommationsWithItems, fetchInsuranceRates]);

    useEffect(() => {
      if (consommationsWithItems.length > 0) {
        refreshAllInsuranceRates();
      }
    }, [globalBillId, consommationsWithItems.length, refreshAllInsuranceRates]);

    const handleAddNewInvoice = () => {
      if (onAddNewInvoice && globalBillId) {
        onAddNewInvoice(globalBillId.toString());
      }
    };

    const handleItemSelection = useCallback(
      (consommationId: string, itemIndex: number) => {
        const consommation = consommationsWithItems.find((c) => c.consommationId?.toString() === consommationId);

        if (!consommation) return;

        const updatedConsommations = consommationsWithItems.map((c) => {
          if (c.consommationId?.toString() === consommationId) {
            const updatedItems = c.items.map((item, index) => {
              if (index === itemIndex) {
                const newSelected = !Boolean(item.selected);
                const serviceName = getDepartmentName(c);

                if (newSelected) {
                  setSelectedItems((prev) => [
                    ...prev,
                    {
                      item: { ...item, selected: true },
                      consommationId,
                      consommationService: serviceName,
                    },
                  ]);
                } else {
                  setSelectedItems((prev) =>
                    prev.filter(
                      (si) =>
                        !(
                          si.consommationId === consommationId &&
                          si.item.patientServiceBillId === item.patientServiceBillId
                        ),
                    ),
                  );
                }

                return { ...item, selected: newSelected };
              }
              return item;
            });

            setTimeout(async () => {
              await updateConsommationStatusImmediately(consommationId);
            }, 0);

            return { ...c, items: updatedItems };
          }
          return c;
        });

        setConsommationsWithItems(updatedConsommations);
      },
      [consommationsWithItems, getDepartmentName, updateConsommationStatusImmediately],
    );

    const computeItemPaymentStatus = useCallback(
      (item: ConsommationItem): string => (isItemPaid(item) ? 'PAID' : 'UNPAID'),
      [],
    );

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
      return selectedItems.some((selectedItem) => !isActuallyPaid(selectedItem.item));
    };

    const hasPaidSelectedItems = () => {
      return selectedItems.some((si) => isActuallyPaid(si.item));
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

        const paidSelectedItems = selectedItems.filter((si) => isActuallyPaid(si.item));

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
          policyNumber: '',
        };

        const groupedConsommationData: Record<string, any> = {};
        const uniqueConsommations = new Set(paidSelectedItems.map((item) => item.consommationId));

        uniqueConsommations.forEach((consommationId) => {
          const selectedItemsForConsommation = paidSelectedItems.filter(
            (item) => item.consommationId === consommationId,
          );
          if (selectedItemsForConsommation.length > 0) {
            groupedConsommationData[consommationId] = {
              service: selectedItemsForConsommation[0].consommationService,
              date: new Date().toLocaleDateString(),
            };
          }
        });

        const itemsForReceipt = paidSelectedItems.map((selectedItem) => {
          const item = selectedItem.item;
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const actualPaidAmount = Math.min(itemTotal, item.paidAmount || itemTotal); // display safeguard

          return {
            ...item,
            consommationId: selectedItem.consommationId,
            paidAmount: actualPaidAmount,
            paid: actualPaidAmount >= itemTotal,
            partiallyPaid: actualPaidAmount > 0 && actualPaidAmount < itemTotal,
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
      // After backend confirms payment, always re-sync from server so UI mirrors persisted state
      try {
        await fetchConsommations();

        // For any expanded panels, reload their items to pull fresh item-level statuses
        if (expandedConsommations.size > 0) {
          await Promise.all(Array.from(expandedConsommations).map((id) => loadConsommationItems(id)));
        }

        // Refresh badges
        const ids =
          (consommationsWithItems || [])
            .map((c) => c.consommationId?.toString())
            .filter((id): id is string => Boolean(id)) || [];

        if (ids.length > 0) {
          try {
            const statusMap = await getMultipleConsommationStatuses(ids);
            const updatedStatusMap: Record<string, string> = {};
            Object.entries(statusMap).forEach(([consommationId, isPaid]) => {
              updatedStatusMap[consommationId] = isPaid ? 'PAID' : 'UNPAID';
            });
            setConsommationStatuses((prev) => ({ ...prev, ...updatedStatusMap }));
          } catch (e) {
            console.error('Error updating consommation statuses after payment:', e);
          }
        }

        // Keep selection, mark paid ones as selected (purely UI)
        setSelectedItems((prev) => prev.map((si) => ({ ...si, item: { ...si.item, selected: true } })));
      } catch (e) {
        console.error('Post-payment refresh failed', e);
      }
    };

    useImperativeHandle(ref, () => ({
      mutate: fetchConsommations,
      refreshRates: refreshAllInsuranceRates,
    }));

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
            </div>
            <div className={styles.headerActions}>
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
        </div>

        {/* Insurance details */}
        <div className={styles.insuranceDetailsSection}>
          <GlobalBillInsuranceInfo globalBillId={globalBillId} />
        </div>

        {consommationsWithItems && consommationsWithItems.length > 0 ? (
          <>
            <div className={styles.accordionContainer}>
              <Accordion align="start">
                {paginatedConsommations.map((consommation) => {
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
                            <span className={styles.consommationService}>{getDepartmentName(consommation)}</span>
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
                                  {consommation.items.some((item) => item.drugFrequency) && (
                                    <th>{t('frequency', 'Frequency')}</th>
                                  )}
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
                                  const parentPaidForRow =
                                    (consommationStatuses[consommationId] || '').toUpperCase() === 'PAID';
                                  const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                                  const paidAmt = parentPaidForRow ? itemTotal : item.paidAmount || 0;
                                  const insuranceAmount = (itemTotal * consommation.insuranceRates.insuranceRate) / 100;
                                  const patientAmount = (itemTotal * consommation.insuranceRates.patientRate) / 100;
                                  const isPaidEffective =
                                    parentPaidForRow ||
                                    isItemPaid({ ...item, paidAmount: paidAmt, paid: parentPaidForRow || item.paid });

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
                                      <td>
                                        {item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : '-'}
                                      </td>
                                      <td title={item.itemName || '-'} className={styles.itemNameCell}>
                                        {item.itemName || '-'}
                                      </td>
                                      {consommation.items.some((i) => i.drugFrequency) && (
                                        <td>{item.drugFrequency || '-'}</td>
                                      )}
                                      <td>{item.quantity || '1'}</td>
                                      <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                                      <td>{Number(itemTotal).toFixed(2)}</td>
                                      <td>{insuranceAmount.toFixed(2)}</td>
                                      <td>{patientAmount.toFixed(2)}</td>
                                      <td>{Number(paidAmt).toFixed(2)}</td>
                                      <td>
                                        <Tag
                                          type={isPaidEffective ? 'green' : 'red'}
                                          className={isPaidEffective ? styles.paidStatus : styles.unpaidStatus}
                                        >
                                          {isPaidEffective ? 'PAID' : 'UNPAID'}
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
                      {t('selectedItems', 'Selected Items')}: {selectedItems.length} |{' '}
                      {hasUnpaidSelectedItems() ? (
                        <>
                          {t('unpaidAmount', 'Unpaid Amount')}: {calculateSelectedUnpaidItemsTotal().toFixed(2)} |{' '}
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
                    title={
                      selectedItems.length > 0 && !hasUnpaidSelectedItems()
                        ? t(
                            'onlyPaidItemsSelected',
                            'Only paid items are selected. Select unpaid items to make payment.',
                          )
                        : ''
                    }
                  >
                    {t('paySelected', 'Pay Selected')}
                  </Button>
                </div>
              </div>
            </div>

            {isPaymentModalOpen && (
              <PaymentForm
                isOpen={isPaymentModalOpen}
                onClose={closePaymentModal}
                onSuccess={handlePaymentSuccess}
                selectedItems={selectedItems.filter((item) => !isActuallyPaid(item.item))}
                onItemToggle={handleItemSelection}
                patientUuid={patientUuid}
                globalBillId={globalBillId}
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
  },
);

export default EmbeddedConsommationsList;
