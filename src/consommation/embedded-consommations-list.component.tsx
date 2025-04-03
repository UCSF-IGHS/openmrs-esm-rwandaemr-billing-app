import React, { useEffect, useState, useMemo, useCallback} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  DataTableSkeleton,
  Button,
  Checkbox,
} from '@carbon/react';
import { isDesktop, showToast, useLayoutType, useSession, usePagination } from '@openmrs/esm-framework';
import { getConsommationsByGlobalBillId, getConsommationItems, getConsommationById } from '../api/billing';
import { 
  isItemPaid, 
  isItemPartiallyPaid, 
  calculateTotalDueForSelected
} from '../utils/billing-calculations';
import { type ConsommationListResponse, type ConsommationItem, type RowData } from '../types';
import styles from './embedded-consommations-list.scss';
import PaymentForm from '../payment-form/payment-form.component';
import { Pagination } from '@carbon/react';
import { AddIcon } from '@openmrs/esm-framework';

interface EmbeddedConsommationsListProps {
  globalBillId: string;
  patientUuid?: string;
  insuranceCardNo?: string;
  onConsommationClick?: (consommationId: string) => void;
  onAddNewInvoice?: (globalBillId: string) => void;
  isGlobalBillClosed?: boolean;
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
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedConsommationItems, setSelectedConsommationItems] = useState<ConsommationItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  // Fetch consommations list
  const fetchConsommations = useCallback(async () => {
    if (!globalBillId) return;
    
    setIsLoading(true);
    try {
      const data = await getConsommationsByGlobalBillId(globalBillId);
      setConsommations(data);
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
  
  useEffect(() => {
    fetchConsommations();
  }, [fetchConsommations]);

  // Table headers
  const headers = [
    { key: 'select', header: '' },
    { key: 'index', header: '#' },
    { key: 'createdDate', header: t('date', 'Date') },
    { key: 'consommationId', header: t('id', 'ID') },
    { key: 'service', header: t('service', 'Service') },
    { key: 'createdBy', header: t('by', 'By') },
    { key: 'insuranceCardNo', header: t('cardNo', 'Card #') },
    { key: 'insuranceDue', header: t('insDue', 'Ins Due') },
    { key: 'thirdPartyDue', header: t('tpDue', 'TP Due') },
    { key: 'patientDue', header: t('patDue', 'Pat Due') },
    { key: 'paidAmount', header: t('paid', 'Paid') },
    { key: 'status', header: t('status', 'Status') },
  ];

  // Generate table rows data
  const rows = useMemo<RowData[]>(() => 
    consommations?.results?.map((item, index) => ({
      id: item.consommationId?.toString() || '',
      index: index + 1,
      createdDate: item.createdDate ? new Date(item.createdDate).toLocaleDateString() : '-',
      consommationId: item.consommationId?.toString() || '-',
      service: item?.department?.name || '-',
      createdBy: item?.insuranceBill?.creator?.person?.display || '-',
      insuranceCardNo: item.patientBill?.policyIdNumber || insuranceCardNo || '-',
      insuranceDue: Number(item.insuranceBill?.amount ?? 0).toFixed(2),
      thirdPartyDue: Number(item.thirdPartyBill?.amount ?? 0).toFixed(2),
      patientDue: Number(
        Math.max(
          0,
          (item.patientBill?.amount ?? 0) -
          (item.patientBill?.payments?.reduce((sum, p) => sum + (p.amountPaid || 0), 0) ?? 0)
        )
      ).toFixed(2),
      paidAmount: Number(
        item.patientBill?.payments?.reduce((sum, p) => sum + (p.amountPaid || 0), 0) ?? 0
      ).toFixed(2),
      status: (() => {
        const rawPatientDue = Number(item.patientBill?.amount ?? 0);
        const rawPaidAmount = Number(item.patientBill?.payments?.[0]?.amountPaid ?? 0);
        if (rawPaidAmount >= rawPatientDue && rawPatientDue > 0) {
          return t('fullyPaid', 'FULLY PAID');
        } else if (rawPaidAmount === 0) {
          return t('unpaid', 'UNPAID');
        } else if (rawPaidAmount > 0 && rawPaidAmount < rawPatientDue) {
          return t('partiallyPaid', 'PARTIALLY PAID');
        } else {
          return t('unpaid', 'UNPAID');
        }
      })(),
      rawPatientDue: Number(item.patientBill?.amount ?? 0),
      rawPaidAmount: Number(item.patientBill?.payments?.[0]?.amountPaid ?? 0),
  })) || [], [consommations?.results, insuranceCardNo, t]);

  const pageSize = 10;
  const { paginated, goTo, results: paginatedRows, currentPage } = usePagination(rows, pageSize);

  // Handle row click
  const handleRowClick = (row: RowData) => {
    if (onConsommationClick && row.id) {
      onConsommationClick(row.id);
    }
  };

  const handleAddNewInvoice = () => {
    if (onAddNewInvoice && globalBillId) {
      onAddNewInvoice(globalBillId.toString());
    }
  };

  // Payment reconciliation function
  const reconcilePaymentsWithItems = useCallback((consommationData) => {
    if (!consommationData || !consommationData.patientBill || !consommationData.patientBill.payments || !consommationData.billItems) {
      return consommationData.billItems || [];
    }

    const itemPriceMap = {};
    consommationData.billItems.forEach(item => {
      const price = item.unitPrice * (item.quantity || 1);
      const key = `${price.toFixed(2)}`;
      if (!itemPriceMap[key]) {
        itemPriceMap[key] = [];
      }
      itemPriceMap[key].push({
        item,
        paid: item.paid || false,
        originalRef: item
      });
    });
  
    consommationData.patientBill.payments.forEach(payment => {
      const amountPaid = payment.amountPaid || 0;
      const exactMatch = itemPriceMap[amountPaid.toFixed(2)];
      
      if (exactMatch && exactMatch.length > 0) {
        const unpaidItem = exactMatch.find(entry => !entry.paid);
        if (unpaidItem) {
          unpaidItem.paid = true;
          unpaidItem.originalRef.paid = true;
          unpaidItem.originalRef.paidQuantity = unpaidItem.originalRef.quantity || 1;
        }
      }
    });
    
    return consommationData.billItems;
  }, []);

  const checkSessionStorageForPayments = useCallback((items) => {
    if (!items || !Array.isArray(items)) return items;
    
    return items.map(item => {
      if (!item.patientServiceBillId) return item;
      
      const paymentKey = `payment_${item.patientServiceBillId}`;
      try {
        const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
        if (storedPayment.paid || storedPayment.paidAmount > 0) {
          // If the API says the item is paid, trust that over session storage
          if (item.paid) return item;
          
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = Math.max(storedPayment.paidAmount || 0, item.paidAmount || 0);
          const remainingAmount = Math.max(0, itemTotal - paidAmount);
          
          return {
            ...item,
            paid: storedPayment.paid || paidAmount >= itemTotal,
            partiallyPaid: (!storedPayment.paid && paidAmount > 0),
            paidAmount: paidAmount,
            remainingAmount: remainingAmount
          };
        }
      } catch (e) {
        console.warn('Error reading from sessionStorage:', e);
      }
      
      return item;
    });
  }, []);

  // Get accurate status text
  const getAccurateStatusText = useCallback((item) => {
    // First check if the item has session storage payment
    const paymentKey = `payment_${item.patientServiceBillId}`;
    try {
      const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
      if (storedPayment.paid) {
        return t('paid', 'Paid');
      } else if (storedPayment.paidAmount > 0) {
        return t('partiallyPaid', 'Partially Paid');
      }
    } catch (e) {
      // Ignore session storage errors
    }
    
    // Then check the item itself
    if (item.paid === true) {
      return t('paid', 'Paid');
    }
    
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const paidAmount = item.paidAmount || 0;
    
    if (paidAmount >= itemTotal) {
      return t('paid', 'Paid');
    } else if (paidAmount > 0) {
      return t('partiallyPaid', 'Partially Paid');
    }
    
    return t('unpaid', 'Unpaid');
  }, [t]);

  // Check if item is actually paid (considering all sources)
  const isActuallyPaid = useCallback((item: ConsommationItem): boolean => {
    // Check session storage
    try {
      const paymentKey = `payment_${item.patientServiceBillId}`;
      const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
      if (storedPayment.paid) {
        return true;
      }
    } catch (e) {
      // Ignore errors
    }
    
    // Then check server-reported status
    return isItemPaid(item);
  }, []);

  // Refresh consommation data
  const refreshConsommationData = async () => {
    try {
      // First refresh the overall consommations list 
      await fetchConsommations();
      
      // Then refresh the items for the selected consommation if any
      const selectedRow = selectedRows?.[0];
      if (selectedRow) {
        await fetchConsommationItems(selectedRow);
      }
    } catch (error) {
      console.error('Error refreshing data after payment:', error);
      showToast({
        title: t('refreshError', 'Refresh Error'),
        description: t('errorRefreshingData', 'Error refreshing data after payment. The payment was processed, but displayed information may not be up to date.'),
        kind: 'error',
      });
    }
  };

  // Enhanced fetch consommation items with reconciliation
  const fetchConsommationItems = useCallback(async (consommationId: string) => {
    try {
      setIsLoadingItems(true);
      const fullConsommationData = await getConsommationById(consommationId);
      
      // Reconcile payments with items before processing
      const reconciledItems = reconcilePaymentsWithItems(fullConsommationData);
      
      // Continue with API call to get consommation items 
      const items = await getConsommationItems(consommationId);
      
      // Map API returned items to match the reconciled status
      const enhancedItems = items.map(item => {
        // Find the corresponding billItem from the full consommation data
        const billItem = reconciledItems.find(bi => {
          // Match by patientServiceBillId from the links
          if (item.patientServiceBillId && bi.links) {
            const billItemId = bi.links.find(link => link.resourceAlias === 'patientServiceBill')?.uri;
            if (billItemId) {
              const idMatch = billItemId.match(/\/patientServiceBill\/(\d+)/);
              return idMatch && idMatch[1] && parseInt(idMatch[1]) === item.patientServiceBillId;
            }
          }
          
          // Fallback match by hopService name and price
          return bi.hopService?.name === item.itemName && 
                 Math.abs(bi.unitPrice - (item.unitPrice || 0)) < 0.01;
        });
        
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        
        // Use reconciled paid status if available, otherwise use the API status
        const isPaid = billItem ? billItem.paid : item.paid;
        
        // If the item is marked as paid, set the paidAmount to the total
        const paidAmount = isPaid ? itemTotal : (item.paidAmount || 0);
        
        const remainingAmount = Math.max(0, itemTotal - paidAmount);
        const isPartiallyPaid = !isPaid && paidAmount > 0;
        
        return {
          ...item,
          paidAmount: paidAmount,
          remainingAmount: remainingAmount,
          paid: isPaid,
          partiallyPaid: isPartiallyPaid,
          // Ensure paidQuantity is set appropriately
          paidQuantity: isPaid ? (item.quantity || 1) : (item.paidQuantity || 0)
        };
      });
  
      // Apply session storage enhancements
      const sessionStorageEnhancedItems = checkSessionStorageForPayments(enhancedItems);
      setSelectedConsommationItems(sessionStorageEnhancedItems || []);
    } catch (error) {
      console.error('Failed to fetch consommation items:', error);
      showToast({
        title: t('error', 'Error'),
        description: t('failedToLoadItems', 'Failed to load consommation items'),
        kind: 'error',
      });
      setSelectedConsommationItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [t, reconcilePaymentsWithItems, checkSessionStorageForPayments]);

  useEffect(() => {
    if (selectedRows.length > 0) {
      fetchConsommationItems(selectedRows[0]);
    }
  }, [selectedRows, fetchConsommationItems]);

  // Toggle row selection
  const toggleRowSelection = async (rowId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const newSelection = (prev: string[]) => {
      if (prev.includes(rowId)) {
        return prev.filter(id => id !== rowId);
      } else {
        return prev.length > 0 ? [rowId] : [...prev, rowId];
      }
    };
    
    const updatedSelection = newSelection(selectedRows);
    setSelectedRows(updatedSelection);
    
    if (updatedSelection.includes(rowId)) {
      if (isPaymentModalOpen) {
        setIsLoadingItems(true);
      }
      await fetchConsommationItems(rowId);
    } else {
      setSelectedConsommationItems([]);
    }
  };

  // Handle select all button
  const handleSelectAll = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedRows([]);
    setSelectedConsommationItems([]);
  };

  // Toggle selection of individual items
  const toggleItemSelection = (index: number) => {
    const item = selectedConsommationItems[index];
    if (!isActuallyPaid(item)) {
      setSelectedConsommationItems(prevItems => {
        const newItems = [...prevItems];
        newItems[index] = { 
          ...newItems[index], 
          selected: !newItems[index].selected 
        };
        return newItems;
      });
    }
  };

  // Open payment modal
  const openPaymentModal = () => {
    setIsPaymentModalOpen(true);
    
    // If we already have selected rows, set loading items
    if (selectedRows.length > 0) {
      setIsLoadingItems(true);
      // Re-fetch items to ensure fresh data
      fetchConsommationItems(selectedRows[0]);
    }
  };

  // Close payment modal
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
  };

  // Handle payment success
  const handlePaymentSuccess = async () => {
    await refreshConsommationData();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <DataTableSkeleton headers={headers} rowCount={5} />
      </div>
    );
  }

  // Prepare rows with checkboxes
  const rowsWithCheckboxes = paginatedRows.map(row => {
    const isSelected = selectedRows.includes(row.id);
    const anyRowSelected = selectedRows.length > 0;
    const isDisabled = anyRowSelected && !isSelected;
    
    return {
      ...row,
      select: (
        <Checkbox 
          id={`row-select-${row.id}`}
          checked={isSelected}
          onChange={(e: any) => toggleRowSelection(row.id, e)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          labelText=""
          disabled={isDisabled}
        />
      )
    };
  });

  return (
    <div className={styles.container}>
      <div className={styles.tableHeader}>
        <div className={styles.headerTitleContainer}>
          <div className={styles.headerTitleInfo}>
            <h4>
              {t('consommationsList', 'Consommations List for Global Bill')} #{globalBillId}
            </h4>
            {isGlobalBillClosed && (
              <span className={styles.closedBillNotice}>
                {t('closedBill', 'This bill is closed')}
              </span>
            )}
          </div>
          <Button
            kind="ghost"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            iconDescription={t('addInvoice', 'Add invoice')}
            onClick={handleAddNewInvoice}
            disabled={isGlobalBillClosed}
            title={isGlobalBillClosed ? t('closedBillNoAdd', 'Cannot add items to a closed bill') : ''}
          >
            {t('add', 'Add Item')}
          </Button>
        </div>
      </div>
      {rows && rows.length > 0 ? (
        <>
          <DataTable rows={rowsWithCheckboxes} headers={headers} size={responsiveSize} useZebraStyles useStaticWidth>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <Table {...getTableProps()} className={styles.table} useStaticWidth>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader key={header.key} {...getHeaderProps({ header })}>
                        {header.key === 'select' ? (
                          <Checkbox
                            id="select-all-rows"
                            checked={false}
                            indeterminate={selectedRows.length > 0}
                            onChange={(e: any) => handleSelectAll(e)}
                            labelText=""
                            disabled={selectedRows.length > 0}
                          />
                        ) : (
                          header.header
                        )}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      {...getRowProps({ row })}
                      onClick={() => handleRowClick(row)}
                      className={styles.clickableRow}
                    >
                      {row.cells.map((cell) => (
                        <TableCell
                          key={cell.id}
                          onClick={cell.info.header === 'select' ? (e: any) => e.stopPropagation() : undefined}
                        >
                          {cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
          {paginated && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={pageSize}
              totalItems={rows.length}
              pageSizes={[5, 10, 20, 50]}
              onChange={({ page }) => goTo(page)}
            />
          )}

          <div className={styles.actionsContainer}>
            <div className={styles.paymentActions}>
              <p className={styles.selectedSummary}>
                {selectedRows.length > 0
                  ? t('selectedItemsAmount', 'Selected Items Due: {{amount}}', {
                      amount: calculateTotalDueForSelected(rows, selectedRows).toFixed(2),
                    })
                  : t('noItemsSelected', 'No items selected')}
              </p>
              <Button kind="primary" disabled={selectedRows.length === 0} onClick={openPaymentModal}>
                {t('paySelected', 'Pay Selected')}
              </Button>
            </div>
          </div>

          {/* Use the PaymentForm component instead of inline Modal */}
          <PaymentForm
            isOpen={isPaymentModalOpen}
            onClose={closePaymentModal}
            onSuccess={handlePaymentSuccess}
            selectedRows={selectedRows}
            selectedConsommationItems={selectedConsommationItems}
            consommations={consommations}
            rows={rows}
            toggleItemSelection={toggleItemSelection}
            isLoadingItems={isLoadingItems}
          />
        </>
      ) : (
        <div className={styles.emptyStateContainer}>
          <p className={styles.noData}>{t('noConsommations', 'No consommations found for this global bill')}</p>
          <Button
            kind="primary"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
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
