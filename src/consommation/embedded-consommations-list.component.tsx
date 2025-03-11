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
  Modal,
  Checkbox,
  Form,
  FormGroup,
  TextInput,
  NumberInput,
  InlineNotification,
} from '@carbon/react';
import { isDesktop, showToast, useLayoutType, useSession } from '@openmrs/esm-framework';
import { getConsommationsByGlobalBillId, getConsommationItems, getConsommationById, submitBillPayment } from '../api/billing';
import { 
  isItemPaid, 
  isItemPartiallyPaid, 
  calculateRemainingDue,
  calculateChange,
  calculateSelectedItemsTotal,
  calculateTotalRemainingAmount,
  areAllSelectedItemsPaid,
  getStatusClass,
  calculateTotalDueForSelected
} from '../utils/billing-calculations';
import { type ConsommationListResponse, type ConsommationItem, type RowData } from '../types';
import styles from './embedded-consommations-list.scss';

interface EmbeddedConsommationsListProps {
  globalBillId: string;
  patientUuid?: string;
  insuranceCardNo?: string;
  onConsommationClick?: (consommationId: string) => void;
}

const EmbeddedConsommationsList: React.FC<EmbeddedConsommationsListProps> = ({ 
  globalBillId, 
  patientUuid, 
  insuranceCardNo,
  onConsommationClick 
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const collectorUuid = session?.user?.uuid;

  const [isLoading, setIsLoading] = useState(true);
  const [consommations, setConsommations] = useState<ConsommationListResponse | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [selectedConsommationItems, setSelectedConsommationItems] = useState<ConsommationItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [receivedCash, setReceivedCash] = useState('');
  const [payWithDeposit, setPayWithDeposit] = useState(false);
  const [payWithCash, setPayWithCash] = useState(true);

  // Client-side payment tracking
  const [clientSidePaidItems, setClientSidePaidItems] = useState<Record<string, boolean>>({});
  
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
      patientDue: Number(item.patientBill?.amount ?? 0).toFixed(2),
      paidAmount: Number(item.patientBill?.payments?.[0]?.amountPaid ?? 0).toFixed(2),
      status: item.patientBill?.status || 'N/A',
      rawPatientDue: Number(item.patientBill?.amount ?? 0),
      rawPaidAmount: Number(item.patientBill?.payments?.[0]?.amountPaid ?? 0),
    })) || [], [consommations?.results, insuranceCardNo]);

  // Handle row click
  const handleRowClick = (row: RowData) => {
    if (onConsommationClick && row.id) {
      onConsommationClick(row.id);
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
  const getAccurateStatusText = (item) => {
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
  };

  // Check if item is actually paid (considering all sources)
  const isActuallyPaid = (item: ConsommationItem): boolean => {
    // Check client-side tracking first
    if (item.patientServiceBillId && clientSidePaidItems[item.patientServiceBillId]) {
      return true;
    }
    
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
  };

  // Helper function to get color class based on status
  const getStatusColorClass = (item: ConsommationItem): string => {
    const status = getAccurateStatusText(item);
    if (status === t('paid', 'Paid')) {
      return styles.paidStatus;
    } else if (status === t('partiallyPaid', 'Partially Paid')) {
      return styles.partiallyPaidStatus;
    } else {
      return styles.unpaidStatus;
    }
  };

  // Refresh consommation data
  const refreshConsommationData = async () => {
    try {
      // First refresh the overall consommations list 
      await fetchConsommations();
      
      // Then refresh the items for the selected consommation if any
      if (selectedRows.length > 0) {
        await fetchConsommationItems(selectedRows[0]);
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
    const totalDueForSelected = calculateTotalDueForSelected(rows, selectedRows);
    setPaymentAmount(totalDueForSelected.toString());
    setIsPaymentModalOpen(true);
  };

  // Close payment modal
  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setReferenceNumber('');
    setPaymentError('');
    setReceivedCash('');
    setPayWithDeposit(false);
    setPayWithCash(true);
  };

  // Handle payment submission
  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPaymentError('');
  
    try {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        throw new Error(t('invalidAmount', 'Please enter a valid payment amount'));
      }
  
      if (paymentMethod !== 'cash' && !referenceNumber) {
        throw new Error(t('referenceRequired', 'Reference number is required for non-cash payments'));
      }
      
      if (payWithCash && (!receivedCash || parseFloat(receivedCash) < parseFloat(paymentAmount))) {
        throw new Error(t('insufficientCash', 'Received cash amount must be equal to or greater than the payment amount'));
      }
      
      const selectedItemsTotal = calculateSelectedItemsTotal(selectedConsommationItems);
      const enteredAmount = parseFloat(paymentAmount);
      if (enteredAmount > selectedItemsTotal) {
        throw new Error(t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items'));
      }
      
      const selectedConsommation = consommations?.results?.find(
        c => c.consommationId?.toString() === selectedRows[0]
      );
      
      if (!selectedConsommation) {
        throw new Error(t('noConsommationSelected', 'No consommation selected'));
      }
      
      const fullConsommationData = await getConsommationById(selectedRows[0]);
      
      if (!fullConsommationData?.patientBill?.patientBillId) {
        throw new Error(t('noBillId', 'Could not retrieve patient bill ID'));
      }
      
      const selectedItems = selectedConsommationItems.filter(item => item.selected === true && !isActuallyPaid(item));
      
      if (selectedItems.length === 0) {
        throw new Error(t('noItemsSelected', 'No billable items selected'));
      }
      
      let remainingPayment = enteredAmount;
      const paidItems = [];
  
      const fullPayItems = selectedItems.map(item => {
        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
        const paidAmount = item.paidAmount || 0;
        const itemCost = Math.max(0, itemTotal - paidAmount);
        
        return {
          ...item,
          itemCost
        };
      });
  
      const sortedItems = [...fullPayItems].sort((a, b) => a.itemCost - b.itemCost);
      
      for (const item of sortedItems) {
        if (remainingPayment <= 0) break;
        
        if (remainingPayment >= item.itemCost) {
          paidItems.push({
            billItem: { patientServiceBillId: item.patientServiceBillId },
            paidQty: item.quantity || 1 // Always use full quantity for full payments
          });
          remainingPayment -= item.itemCost;
        }
      }
  
      if (remainingPayment > 0) {
        const unpaidItems = sortedItems.filter(item => 
          !paidItems.some(paid => paid.billItem.patientServiceBillId === item.patientServiceBillId)
        );
        
        if (unpaidItems.length > 0) {
          const itemToPartiallyPay = unpaidItems[0];
          
          // Calculate what portion of the item we can pay
          const itemQuantity = itemToPartiallyPay.quantity || 1;
          const itemUnitPrice = itemToPartiallyPay.unitPrice || 0;
          
          if (itemQuantity > 1 && itemUnitPrice > 0) {
            const wholePaidQty = Math.floor(remainingPayment / itemUnitPrice);
            if (wholePaidQty >= 1) {
              paidItems.push({
                billItem: { patientServiceBillId: itemToPartiallyPay.patientServiceBillId },
                paidQty: wholePaidQty
              });
            }
          } else {
            // If we can't pay whole units, pay for the entire item
            paidItems.push({
              billItem: { patientServiceBillId: itemToPartiallyPay.patientServiceBillId },
              paidQty: 1  // Always send integer quantities
            });
          }
        }
      }
      
      const amountPaidAsFloat = parseFloat(enteredAmount.toFixed(2));
      
      if (!collectorUuid) {
        throw new Error(t('noCollectorUuid', 'Unable to retrieve collector UUID. Please ensure you are logged in.'));
      }
      
      const paymentPayload = {
        amountPaid: amountPaidAsFloat,
        patientBill: { 
          patientBillId: fullConsommationData.patientBill.patientBillId,
          creator: collectorUuid
        },
        dateReceived: new Date().toISOString(),
        collector: { uuid: collectorUuid },
        paidItems: paidItems
      };
      
      try {
        const paymentResponse = await submitBillPayment(paymentPayload);
        
        // Update UI immediately and save to session storage
        setSelectedConsommationItems(prevItems => 
          prevItems.map(item => {
            const paidItem = paidItems.find(pi => pi.billItem.patientServiceBillId === item.patientServiceBillId);
            if (!paidItem) return item;
            
            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
            const previousPaidAmount = item.paidAmount || 0;
            const additionalPaidAmount = paidItem.paidQty * (item.unitPrice || 0);
            const newPaidAmount = previousPaidAmount + additionalPaidAmount;
            const newRemainingAmount = Math.max(0, itemTotal - newPaidAmount);
            
            const isNowFullyPaid = newPaidAmount >= itemTotal || newRemainingAmount <= 0;
            const isNowPartiallyPaid = !isNowFullyPaid && newPaidAmount > 0;
            
            // Store payment in sessionStorage for persistence
            const paymentKey = `payment_${item.patientServiceBillId}`;
            try {
              const existingPaymentData = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
              const updatedPaymentData = {
                ...existingPaymentData,
                paid: isNowFullyPaid,
                partiallyPaid: isNowPartiallyPaid,
                paidAmount: newPaidAmount,
                timestamp: new Date().toISOString()
              };
              sessionStorage.setItem(paymentKey, JSON.stringify(updatedPaymentData));
            } catch (e) {
              console.warn('Failed to save payment to sessionStorage:', e);
            }
            
            // Also update client-side tracking
            if (isNowFullyPaid) {
              setClientSidePaidItems(prev => ({
                ...prev,
                [item.patientServiceBillId]: true
              }));
            }
            
            return {
              ...item,
              paidAmount: newPaidAmount,
              remainingAmount: newRemainingAmount,
              paid: isNowFullyPaid,
              partiallyPaid: isNowPartiallyPaid,
              paidQuantity: (item.paidQuantity || 0) + paidItem.paidQty,
              selected: false // Deselect the item after payment
            };
          })
        );
      
        // Show success message
        showToast({
          title: t('paymentSuccess', 'Payment Successful'),
          description: t('paymentProcessed', 'Payment has been processed successfully'),
          kind: 'success',
        });
        closePaymentModal();
        
        // Refresh data after a short delay
        setTimeout(async () => {
          await fetchConsommations();
          
          if (selectedRows.length > 0) {
            await fetchConsommationItems(selectedRows[0]);
          }
        }, 500);
        
      } catch (paymentError) {
        console.error('Payment API error:', paymentError);
        throw new Error(t('paymentFailed', 'Payment processing failed. Please try again.'));
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message);
    } finally {
      setIsSubmitting(false);
    }
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
const rowsWithCheckboxes = rows.map(row => {
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

// SINGLE return statement containing everything
return (
  <div className={styles.container}>
    <div className={styles.tableHeader}>
      <h4>
        {t('consommationsList', 'Consommations List for Global Bill')} #{globalBillId}
      </h4>
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

        <div className={styles.actionsContainer}>
          <div className={styles.totals}>
            <p>
              {t('totalDueAmount', 'Total Due Amount')}: {(consommations?.totalDueAmount ?? 0).toFixed(2)}
            </p>
            <p>
              {t('totalPaidAmount', 'Total Paid Amount')}: {(consommations?.totalPaidAmount ?? 0).toFixed(2)}
            </p>
          </div>

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

        {/* Modal must be inside this return statement */}
        <Modal
          open={isPaymentModalOpen}
          modalHeading={t('paymentForm', 'Payment Form')}
          primaryButtonText={t('confirmPayment', 'Confirm Payment')}
          secondaryButtonText={t('cancel', 'Cancel')}
          onRequestClose={closePaymentModal}
          onRequestSubmit={handlePaymentSubmit}
          primaryButtonDisabled={
            isSubmitting ||
            selectedConsommationItems.filter((item) => item.selected && !isActuallyPaid(item)).length === 0
          }
          size="md"
        >
          <Form>
            {paymentError && (
              <InlineNotification
                kind="error"
                title={t('error', 'Error')}
                subtitle={paymentError}
                className={styles.errorNotification}
              />
            )}

            <div className={styles.paymentFormGrid}>
              {/* Left side - Collector & Payment Info */}
              <div className={styles.paymentFormColumn}>
                <FormGroup legendText="">
                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('collector', 'Collector')}</div>
                    <div className={styles.formInput}>
                      <TextInput id="collector-name" value={session?.user?.display || 'Unknown'} readOnly />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('receivedDate', 'Received Date')}</div>
                    <div className={styles.formInput}>
                      <TextInput id="received-date" type="date" value={new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('payWithDeposit', 'Pay with deposit')}</div>
                    <div className={styles.formInput}>
                      <Checkbox
                        id="pay-with-deposit"
                        labelText=""
                        checked={payWithDeposit}
                        onChange={() => setPayWithDeposit(!payWithDeposit)}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('payWithCash', 'Pay with cash')}</div>
                    <div className={styles.formInput}>
                      <Checkbox
                        id="pay-with-cash"
                        labelText=""
                        checked={payWithCash}
                        onChange={() => setPayWithCash(!payWithCash)}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('receivedCash', 'Received Cash')}</div>
                    <div className={styles.formInput}>
                      <NumberInput
                        id="received-cash"
                        value={receivedCash}
                        onChange={(e) => setReceivedCash(e.target.value)}
                        min={0}
                        step={0.01}
                        disabled={!payWithCash}
                      />
                    </div>
                  </div>
                </FormGroup>
              </div>

              <div className={styles.paymentFormColumn}>
                <FormGroup legendText="">
                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('amountPaid', 'Amount Paid')}</div>
                    <div className={styles.formInput}>
                      <NumberInput
                        id="amount-paid"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className={`${styles.amountInput} ${parseFloat(paymentAmount) > calculateSelectedItemsTotal(selectedConsommationItems) ? styles.invalidAmount : ''}`}
                        min={0}
                        max={calculateSelectedItemsTotal(selectedConsommationItems)}
                        step={0.01}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('paidByThirdParty', 'Paid by Third Party')}</div>
                    <div className={styles.formInput}>
                      <NumberInput id="third-party-payment" value="" min={0} step={0.01} />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('rest', 'Rest')}</div>
                    <div className={styles.formInput}>
                      <TextInput
                        id="rest-amount"
                        value={calculateChange(receivedCash, paymentAmount)}
                        className={`${styles.restInput} ${parseFloat(calculateChange(receivedCash, paymentAmount)) < 0 ? styles.negativeRest : ''}`}
                        readOnly
                      />
                    </div>
                  </div>
                </FormGroup>
              </div>
            </div>

            <div className={styles.selectedItemsDetails}>
              <h5>{t('selectedConsommation', 'Selected Consommation')}</h5>
              <table className={styles.selectedItemsTable}>
                <thead>
                  <tr>
                    <th>{t('consomId', 'Consom ID')}</th>
                    <th>{t('service', 'Service')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((row) => selectedRows.includes(row.id))
                    .map((row) => (
                      <tr key={row.id}>
                        <td>{row.consommationId}</td>
                        <td>{row.service}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <h5 className={styles.itemsListHeader}>{t('consommationItems', 'Consommation Items')}</h5>
              {isLoadingItems ? (
                <div className={styles.loadingItems}>{t('loadingItems', 'Loading items...')}</div>
              ) : selectedConsommationItems.length > 0 ? (
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t('serviceDate', 'Date')}</th>
                      <th>{t('itemName', 'Item Name')}</th>
                      <th>{t('quantity', 'Qty')}</th>
                      <th>{t('unitPrice', 'Unit Price')}</th>
                      <th>{t('itemTotal', 'Total')}</th>
                      <th>{t('paidAmt', 'Paid Amount')}</th>
                      <th>{t('status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedConsommationItems.map((item, index) => {
                      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                      const paidAmt = item.paidAmount || 0;
                      const isPaid = isActuallyPaid(item);
                      const isPartiallyPaid = isItemPartiallyPaid(item);

                      return (
                        <tr key={index} className={item.selected ? styles.selectedItem : ''}>
                          <td>
                            <Checkbox
                              id={`item-select-${index}`}
                              checked={item.selected || false}
                              onChange={() => toggleItemSelection(index)}
                              labelText=""
                              disabled={isPaid} // Use enhanced paid status check
                            />
                          </td>
                          <td>{item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : '-'}</td>
                          <td>{item.itemName || '-'}</td>
                          <td>{item.quantity || '1'}</td>
                          <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                          <td>{Number(itemTotal).toFixed(2)}</td>
                          <td>{Number(paidAmt).toFixed(2)}</td>
                          <td>
                            <span
                              className={`${styles.statusBadge} ${
                                getAccurateStatusText(item) === t('paid', 'Paid')
                                  ? styles.paidStatus
                                  : getAccurateStatusText(item) === t('partiallyPaid', 'Partially Paid')
                                    ? styles.partiallyPaidStatus
                                    : styles.unpaidStatus
                              }`}
                            >
                              {getAccurateStatusText(item)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6}>
                        <strong>{t('selectedItemsTotal', 'Selected Items Total')}</strong>
                      </td>
                      <td colSpan={2}>
                        <strong>{calculateSelectedItemsTotal(selectedConsommationItems).toFixed(2)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={6}>
                        <strong>{t('totalAmountToPay', 'Total Amount to be paid')}</strong>
                      </td>
                      <td colSpan={2}>
                        <strong>
                          {calculateTotalRemainingAmount(selectedConsommationItems).toFixed(2)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className={styles.noItems}>
                  {selectedRows.length > 0
                    ? t('noItemsFound', 'No items found for this consommation')
                    : t('selectConsommation', 'Select a consommation to view items')}
                </div>
              )}

              <div className={styles.paymentTotals}>
                <div className={styles.paymentTotalRow}>
                  <span>{t('total', 'Total to Pay')}:</span>
                  <strong>{calculateSelectedItemsTotal(selectedConsommationItems).toFixed(2)}</strong>
                </div>
                {parseFloat(paymentAmount) > calculateSelectedItemsTotal(selectedConsommationItems) && (
                  <div className={styles.paymentError}>
                    {t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items')}
                  </div>
                )}
              </div>
            </div>
          </Form>
        </Modal>
      </>
    ) : (
      <p className={styles.noData}>{t('noConsommations', 'No consommations found for this global bill')}</p>
    )}
  </div>
);
};

export default EmbeddedConsommationsList;