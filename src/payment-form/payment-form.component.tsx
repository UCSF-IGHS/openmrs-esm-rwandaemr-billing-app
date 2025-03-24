import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Checkbox,
  Form,
  FormGroup,
  TextInput,
  NumberInput,
  InlineNotification,
  Button,
} from '@carbon/react';
import { Printer } from '@carbon/react/icons';
import { showToast, useSession } from '@openmrs/esm-framework';
import { submitBillPayment, getConsommationById } from '../api/billing';
import { 
  isItemPaid, 
  isItemPartiallyPaid, 
  calculateRemainingDue,
  calculateChange,
  calculateSelectedItemsTotal,
  calculateTotalRemainingAmount,
  areAllSelectedItemsPaid,
  getStatusClass,
  calculateTotalDueForSelected,
  computePaymentStatus
} from '../utils/billing-calculations';
import { printReceipt } from '../payment-receipt/print-receipt';
import { type ConsommationListResponse, type ConsommationItem, type RowData } from '../types';
import styles from './payment-form.scss';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedRows: string[];
  selectedConsommationItems: ConsommationItem[];
  consommations: ConsommationListResponse | null;
  rows: RowData[];
  toggleItemSelection: (index: number) => void;
  isLoadingItems: boolean;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  selectedRows,
  selectedConsommationItems,
  consommations,
  rows,
  toggleItemSelection,
  isLoadingItems
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const collectorUuid = session?.user?.uuid;

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [receivedCash, setReceivedCash] = useState('');
  const [deductedAmount, setDeductedAmount] = useState('');
  const [depositBalance, setDepositBalance] = useState('1100.00'); // Mock value for demonstration
  const [clientSidePaidItems, setClientSidePaidItems] = useState<Record<string, boolean>>({});
  const [paymentSuccessful, setPaymentSuccessful] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPaymentSuccessful(false);
      
      const totalDueForSelected = calculateTotalDueForSelected(rows, selectedRows);
      setPaymentAmount(totalDueForSelected.toString());
      setPaymentMethod('cash');
      setReferenceNumber('');
      setPaymentError('');
      setReceivedCash('');
      setDeductedAmount('');
    }
  }, [isOpen, rows, selectedRows]);

  const isActuallyPaid = (item: ConsommationItem): boolean => {
    if (item.patientServiceBillId && clientSidePaidItems[item.patientServiceBillId]) {
      return true;
    }
    
    try {
      const paymentKey = `payment_${item.patientServiceBillId}`;
      const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
      if (storedPayment.paid) {
        return true;
      }
    } catch (e) {
      // Ignore errors
    }
    
    return isItemPaid(item);
  };

  const getAccurateStatusText = (item) => {
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

  const hasPaidItems = () => {
    return selectedConsommationItems.some(item => isActuallyPaid(item));
  };

const handlePrintReceipt = async () => {
  try {
    const selectedConsommation = rows.find(row => selectedRows.includes(row.id));
    
    if (!selectedConsommation) return;
    
    const allItems = [...selectedConsommationItems];
    
    if (allItems.length === 0) {
      showToast({
        title: t('noItems', 'No Items'),
        description: t('noItemsDescription', 'There are no items to print a receipt for'),
        kind: 'warning',
      });
      return;
    }
    
    const totalPaidAmount = allItems.reduce((total, item) => {
      return total + (item.paidAmount || 0);
    }, 0);
    
    let patientName = 'Unknown';
    let policyNumber = '';
    
    try {
      const consommationDetails = await getConsommationById(selectedConsommation.consommationId);

      if (consommationDetails && consommationDetails.patientBill) {
        patientName = consommationDetails.patientBill.beneficiaryName || 'Unknown';
        policyNumber = consommationDetails.patientBill.policyIdNumber || ''
      }
    } catch (error) {
      console.error('Error fetching consommation details:', error);
    }
    
    const paymentData = {
      amountPaid: totalPaidAmount.toFixed(2),
      receivedCash: paymentSuccessful ? receivedCash : '',
      change: paymentSuccessful ? calculateChange(receivedCash, paymentAmount) : '0.00',
      paymentMethod: paymentMethod,
      deductedAmount: paymentSuccessful && paymentMethod === 'deposit' ? deductedAmount : '',
      dateReceived: new Date().toISOString().split('T')[0],
      collectorName: session?.user?.display || 'Unknown',
      patientName: patientName,
      policyNumber: policyNumber
    };
    
    const consommationData = {
      consommationId: selectedConsommation.consommationId,
      service: selectedConsommation.service
    };
    
    printReceipt(paymentData, consommationData, allItems);
  } catch (error) {
    console.error('Error preparing receipt:', error);
    showToast({
      title: t('printError', 'Print Error'),
      description: t('printErrorDescription', 'There was an error preparing the receipt'),
      kind: 'error',
    });
  }
};

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPaymentError('');
  
    try {
      if (!paymentAmount || Number(paymentAmount) <= 0) {
        throw new Error(t('invalidAmount', 'Please enter a valid payment amount'));
      }
      
      if (paymentMethod === 'cash') {
        if (!receivedCash || parseFloat(receivedCash) < parseFloat(paymentAmount)) {
          throw new Error(t('insufficientCash', 'Received cash amount must be equal to or greater than the payment amount'));
        }
      } else if (paymentMethod === 'deposit') {
        if (!deductedAmount || parseFloat(deductedAmount) <= 0) {
          throw new Error(t('invalidDeductedAmount', 'Please enter a valid deducted amount'));
        }
        
        if (parseFloat(deductedAmount) > parseFloat(depositBalance)) {
          throw new Error(t('insufficientBalance', 'Deducted amount exceeds available balance'));
        }
        
        if (parseFloat(deductedAmount) < parseFloat(paymentAmount)) {
          throw new Error(t('insufficientDeduction', 'Deducted amount must be equal to or greater than the payment amount'));
        }
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
            paidQty: item.quantity || 1
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
            paidItems.push({
              billItem: { patientServiceBillId: itemToPartiallyPay.patientServiceBillId },
              paidQty: 1
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
        
        paidItems.forEach(paidItem => {
          const selectedItem = selectedConsommationItems.find(
            item => item.patientServiceBillId === paidItem.billItem.patientServiceBillId
          );
          
          if (selectedItem) {
            const paymentKey = `payment_${selectedItem.patientServiceBillId}`;
            try {
              const itemTotal = (selectedItem.quantity || 1) * (selectedItem.unitPrice || 0);
              const previousPaidAmount = selectedItem.paidAmount || 0;
              const additionalPaidAmount = paidItem.paidQty * (selectedItem.unitPrice || 0);
              const newPaidAmount = previousPaidAmount + additionalPaidAmount;
              const isNowFullyPaid = newPaidAmount >= itemTotal;
              
              const existingPaymentData = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
              const updatedPaymentData = {
                ...existingPaymentData,
                paid: isNowFullyPaid,
                partiallyPaid: !isNowFullyPaid && newPaidAmount > 0,
                paidAmount: newPaidAmount,
                timestamp: new Date().toISOString()
              };
              sessionStorage.setItem(paymentKey, JSON.stringify(updatedPaymentData));
            } catch (e) {
              console.warn('Failed to save payment to sessionStorage:', e);
            }
          }
        });
      
        setPaymentSuccessful(true);
        
        showToast({
          title: t('paymentSuccess', 'Payment Successful'),
          description: t('paymentProcessed', 'Payment has been processed successfully'),
          kind: 'success',
        });
        
        onSuccess();
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

  return (
    <Modal
      open={isOpen}
      modalHeading={paymentSuccessful ? t('paymentComplete', 'Payment Complete') : t('paymentForm', 'Payment Form')}
      primaryButtonText={paymentSuccessful ? t('close', 'Close') : t('confirmPayment', 'Confirm Payment')}
      secondaryButtonText={paymentSuccessful ? t('printReceipt', 'Print Receipt') : t('cancel', 'Cancel')}
      onRequestClose={onClose}
      onRequestSubmit={paymentSuccessful ? onClose : handlePaymentSubmit}
      onSecondarySubmit={paymentSuccessful ? handlePrintReceipt : onClose}
      primaryButtonDisabled={
        isSubmitting ||
        (!paymentSuccessful &&
          selectedConsommationItems.filter((item) => item.selected && !isActuallyPaid(item)).length === 0)
      }
      size="md"
    >
      {paymentSuccessful ? (
        <div className={styles.successMessage}>
          <div className={styles.successIcon}>✓</div>
          <h3>{t('paymentSuccessful', 'Payment Successful!')}</h3>
          <p>{t('paymentProcessedSuccessfully', 'Your payment has been processed successfully.')}</p>
          <Button
            kind="tertiary"
            renderIcon={(props) => <Printer size={16} {...props} />}
            onClick={handlePrintReceipt}
            className={styles.printButton}
          >
            {t('printReceipt', 'Print Receipt')}
          </Button>
        </div>
      ) : (
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
                  <div className={styles.formLabel}>{t('paymentMethod', 'Payment Method')}</div>
                  <div className={styles.formInput}>
                    <div className={styles.radioGroup}>
                      <div className={styles.radioOption}>
                        <input
                          type="radio"
                          id="pay-with-deposit"
                          name="payment-method"
                          value="deposit"
                          checked={paymentMethod === 'deposit'}
                          onChange={() => setPaymentMethod('deposit')}
                        />
                        <label htmlFor="pay-with-deposit">{t('payWithDeposit', 'Pay with deposit')}</label>
                      </div>
                      <div className={styles.radioOption}>
                        <input
                          type="radio"
                          id="pay-with-cash"
                          name="payment-method"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={() => setPaymentMethod('cash')}
                        />
                        <label htmlFor="pay-with-cash">{t('payWithCash', 'Pay with cash')}</label>
                      </div>
                    </div>
                  </div>
                </div>

                {paymentMethod === 'cash' && (
                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('receivedCash', 'Received Cash')}</div>
                    <div className={styles.formInput}>
                      <NumberInput
                        id="received-cash"
                        value={receivedCash}
                        onChange={(e) => setReceivedCash(e.target.value)}
                        min={0}
                        step={0.01}
                        className={styles.errorInput}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'deposit' && (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formLabel}>{t('deductedAmount', 'Deducted Amount')}</div>
                      <div className={styles.formInput}>
                        <NumberInput
                          id="deducted-amount"
                          value={deductedAmount}
                          onChange={(e) => setDeductedAmount(e.target.value)}
                          min={0}
                          max={parseFloat(depositBalance)}
                          step={0.01}
                          className={styles.errorInput}
                        />
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formLabel}>{t('balance', 'Balance')}</div>
                      <div className={styles.formInput}>
                        <TextInput id="deposit-balance" value={depositBalance} readOnly />
                      </div>
                    </div>
                  </>
                )}
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
                    <NumberInput
                      id="third-party-payment"
                      value=""
                      min={0}
                      step={0.01}
                      readOnly
                      className={styles.readOnlyInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formLabel}>{t('rest', 'Rest')}</div>
                  <div className={styles.formInput}>
                    <TextInput
                      id="rest-amount"
                      value={
                        paymentMethod === 'cash'
                          ? calculateChange(receivedCash, paymentAmount)
                          : (parseFloat(deductedAmount || '0') - parseFloat(paymentAmount || '0')).toFixed(2)
                      }
                      className={`${styles.restInput} ${styles.readOnlyInput} ${
                        (paymentMethod === 'cash' && parseFloat(calculateChange(receivedCash, paymentAmount)) < 0) ||
                        (paymentMethod === 'deposit' &&
                          parseFloat(deductedAmount || '0') - parseFloat(paymentAmount || '0') < 0)
                          ? styles.negativeRest
                          : ''
                      }`}
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

            <div className={styles.sectionHeaderWithActions}>
              <h5>{t('consommationItems', 'Consommation Items')}</h5>
              <div className={styles.headerActions}>
                {isLoadingItems && <span className={styles.loadingIndicator}>{t('loading', '(Loading...)')}</span>}
                {hasPaidItems() && (
                  <Button 
                  kind="ghost"
                  renderIcon={Printer}
                  iconDescription={t('printReceipt', 'Print Receipt')}
                  onClick={handlePrintReceipt}
                  className={styles.printReceiptButton}
                  tooltipPosition="left"
                >
                  {t('printReceipt', 'Print Receipt')}
                </Button>
                )}
              </div>
            </div>
            {isLoadingItems ? (
              <div className={styles.loadingItems}>
                <div className={styles.loadingSpinner}></div>
                <p>{t('loadingItems', 'Loading consommation items...')}</p>
              </div>
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
                              computePaymentStatus(item) === 'PAID'
                                ? styles.paidStatus
                                : computePaymentStatus(item) === 'PARTIAL'
                                  ? styles.partiallyPaidStatus
                                  : styles.unpaidStatus
                            }`}
                          >
                            {computePaymentStatus(item)}
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
                      <strong>{calculateTotalRemainingAmount(selectedConsommationItems).toFixed(2)}</strong>
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
              {parseFloat(paymentAmount) > calculateSelectedItemsTotal(selectedConsommationItems) && (
                <div className={styles.paymentError}>
                  {t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items')}
                </div>
              )}
            </div>
          </div>
        </Form>
      )}
    </Modal>
  );
};

export default PaymentForm;
