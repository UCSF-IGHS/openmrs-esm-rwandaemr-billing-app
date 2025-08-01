import React, { useState, useEffect, useCallback } from 'react';
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
  Accordion,
  AccordionItem,
} from '@carbon/react';
import { Printer, CheckmarkFilled } from '@carbon/react/icons';
import { showToast, useSession } from '@openmrs/esm-framework';
import { submitBillPayment, getConsommationById, getConsommationRates } from '../api/billing';
import { isItemPaid, isItemPartiallyPaid, calculateChange, computePaymentStatus } from '../utils/billing-calculations';
import { printReceipt } from '../payment-receipt/print-receipt';
import { type ConsommationItem } from '../types';
import { usePatientInsurancePolicies } from '../patient-insurance-tag/patient-insurance-tag.resource';

import styles from './payment-form.scss';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

const paymentFormSchema = z.object({
  receivedCash: z
    .string()
    .refine((value) => value === '' || /^(\d+(\.\d*)?|\.\d+)$/.test(value), {
      message: 'Must be a valid number',
    })
    .refine((value) => value === '' || parseFloat(value) >= 0, {
      message: 'Amount must be a positive number',
    }),
  deductedAmount: z
    .string()
    .refine((value) => value === '' || /^(\d+(\.\d*)?|\.\d+)$/.test(value), {
      message: 'Must be a valid number',
    })
    .refine((value) => value === '' || parseFloat(value) >= 0, {
      message: 'Amount must be a positive number',
    }),
  paymentAmount: z
    .string()
    .refine((value) => /^(\d+(\.\d*)?|\.\d+)$/.test(value), {
      message: 'Must be a valid number',
    })
    .refine((value) => parseFloat(value) > 0, {
      message: 'Amount must be greater than zero',
    }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface SelectedItemInfo {
  item: ConsommationItem & { selected?: boolean };
  consommationId: string;
  consommationService: string;
}

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedItems: SelectedItemInfo[];
  onItemToggle: (consommationId: string, itemIndex: number) => void;
  patientUuid?: string;
}

interface PaymentData {
  amountPaid: string;
  receivedCash?: string;
  change?: string;
  paymentMethod: string;
  deductedAmount?: string;
  dateReceived: string;
  collectorName: string;
  patientName?: string;
  policyNumber?: string;
  thirdPartyAmount?: string;
  thirdPartyProvider?: string;
  totalAmount?: string;
  insuranceRate?: number;
}

interface ConsommationInfo {
  service: string;
  date?: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedItems,
  onItemToggle,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const collectorUuid = session?.user?.uuid;

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [depositBalance, setDepositBalance] = useState('1100.00'); // Mock value for demonstration
  const [localSelectedItems, setLocalSelectedItems] = useState<SelectedItemInfo[]>([]);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [groupedConsommationData, setGroupedConsommationData] = useState<Record<string, ConsommationInfo> | null>(null);
  const [paidItems, setPaidItems] = useState<ConsommationItem[]>([]);
  const [thirdPartyAmount, setThirdPartyAmount] = useState('0.00');
  const [patientBalance, setPatientBalance] = useState(0);
  const [insuranceRate, setInsuranceRate] = useState<number | null>(null);

  const { data: insurancePolicies } = usePatientInsurancePolicies(patientUuid || '');

  useEffect(() => {
    const getInsuranceRateFromConsommations = async () => {
      if (localSelectedItems.length > 0) {
        try {
          const firstItem = localSelectedItems[0];
          const consommationId = firstItem.consommationId;

          const rates = await getConsommationRates(consommationId);

          if (rates?.insuranceRate !== undefined) {
            setInsuranceRate(rates.insuranceRate);
          } else {
            setInsuranceRate(null);
          }
        } catch (error) {
          console.error('Failed to fetch insurance rate from consommation:', error);
          setInsuranceRate(null);
        }
      } else {
        setInsuranceRate(null);
      }
    };

    getInsuranceRateFromConsommations();
  }, [localSelectedItems]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: 'onChange',
    defaultValues: {
      paymentAmount: '',
      receivedCash: '',
      deductedAmount: '',
    },
  });

  const paymentAmount = watch('paymentAmount');
  const receivedCash = watch('receivedCash');
  const deductedAmount = watch('deductedAmount');

  // Memoized calculation functions to fix lint warnings
  const calculateSelectedItemsTotal = useCallback(() => {
    return localSelectedItems.reduce((total, selectedItemInfo) => {
      const item = selectedItemInfo.item;
      if (item.selected === false) return total;

      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const paidAmount = item.paidAmount || 0;
      const remainingAmount = Math.max(0, itemTotal - paidAmount);
      return total + remainingAmount;
    }, 0);
  }, [localSelectedItems]);

  const countSelectedItems = useCallback(() => {
    return localSelectedItems.filter((item) => item.item.selected === true && !isActuallyPaid(item.item)).length;
  }, [localSelectedItems]);

  const groupedAllItems = localSelectedItems.reduce(
    (groups, selectedItemInfo) => {
      const { consommationId, consommationService } = selectedItemInfo;
      if (!groups[consommationId]) {
        groups[consommationId] = {
          consommationId,
          consommationService,
          items: [],
        };
      }
      groups[consommationId].items.push(selectedItemInfo.item);
      return groups;
    },
    {} as Record<
      string,
      { consommationId: string; consommationService: string; items: (ConsommationItem & { selected?: boolean })[] }
    >,
  );

  const isActuallyPaid = (item: ConsommationItem & { selected?: boolean }): boolean => {
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

  const computeItemPaymentStatus = (item: ConsommationItem & { selected?: boolean }): string => {
    try {
      const paymentKey = `payment_${item.patientServiceBillId}`;
      const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
      if (storedPayment.paid) {
        return 'PAID';
      } else if (storedPayment.paidAmount > 0) {
        return 'PARTIAL';
      }
    } catch (e) {
      // Ignore session storage errors
    }

    return computePaymentStatus(item);
  };

  useEffect(() => {
    if (isOpen) {
      const unpaidItemsWithSelectedState = selectedItems
        .filter((item) => !isActuallyPaid(item.item))
        .map((item) => ({
          ...item,
          item: {
            ...item.item,
            selected: true,
          },
        }));

      setLocalSelectedItems(unpaidItemsWithSelectedState);
      setPaymentSuccess(false);
      setPaymentData(null);
      setGroupedConsommationData(null);
      setPaidItems([]);
    }
  }, [isOpen, selectedItems]);

  const handleLocalItemToggle = (consommationId: string, itemId: number) => {
    setLocalSelectedItems((prev) => {
      return prev.map((item) => {
        if (item.consommationId === consommationId && item.item.patientServiceBillId === itemId) {
          return {
            ...item,
            item: {
              ...item.item,
              selected: item.item.selected === false ? true : false,
            },
          };
        }
        return item;
      });
    });
  };

  useEffect(() => {
    if (isOpen && !paymentSuccess) {
      const totalDue = calculateSelectedItemsTotal();
      setValue('paymentAmount', totalDue.toString());
    }
  }, [localSelectedItems, isOpen, setValue, paymentSuccess, calculateSelectedItemsTotal]);

  useEffect(() => {
    if (isOpen && !paymentSuccess) {
      setPaymentMethod('cash');
      setPaymentError('');

      const totalDue = calculateSelectedItemsTotal();
      reset({
        paymentAmount: totalDue.toString(),
        receivedCash: '',
        deductedAmount: '',
      });
    }
  }, [isOpen, localSelectedItems, reset, paymentSuccess, calculateSelectedItemsTotal]);

  useEffect(() => {
    if (paymentMethod === 'cash' && receivedCash && paymentAmount && !paymentSuccess) {
      const cashAmount = parseFloat(receivedCash);
      const amountToPay = parseFloat(paymentAmount);

      if (cashAmount < amountToPay) {
        setPaymentError(t('insufficientCash', 'Received cash must be equal to or greater than the payment amount'));
      } else {
        setPaymentError('');
      }
    } else if (paymentMethod === 'deposit' && deductedAmount && paymentAmount && !paymentSuccess) {
      const deductAmount = parseFloat(deductedAmount);
      const amountToPay = parseFloat(paymentAmount);
      const balance = parseFloat(depositBalance);

      if (deductAmount < amountToPay) {
        setPaymentError(
          t('insufficientDeduction', 'Deducted amount must be equal to or greater than the payment amount'),
        );
      } else if (deductAmount > balance) {
        setPaymentError(t('insufficientBalance', 'Deducted amount exceeds available balance'));
      } else {
        setPaymentError('');
      }
    }
  }, [paymentMethod, receivedCash, deductedAmount, paymentAmount, depositBalance, t, paymentSuccess]);

  useEffect(() => {
    if (paymentAmount && !paymentSuccess) {
      const amountToPay = parseFloat(paymentAmount);
      const maxAllowedAmount =
        insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100
          ? patientBalance
          : calculateSelectedItemsTotal();

      if (amountToPay > maxAllowedAmount) {
        const coverageInfo = insuranceRate !== null ? `${insuranceRate}% insurance coverage` : 'no insurance coverage';

        const errorMessage =
          insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100
            ? t(
                'amountExceedsPatientBalance',
                `Payment amount cannot exceed patient balance (${maxAllowedAmount.toFixed(2)}) with ${coverageInfo}`,
              )
            : t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items');
        setPaymentError(errorMessage);
      } else {
        setPaymentError('');
      }
    }
  }, [paymentAmount, t, paymentSuccess, calculateSelectedItemsTotal, patientBalance, insuranceRate]);

  // Calculate insurance coverage amounts and patient balance (CROSS-CUTTING for all insurance percentages)
  useEffect(() => {
    if (localSelectedItems.length > 0) {
      const total = calculateSelectedItemsTotal();

      if (insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100) {
        const insurancePays = Math.round(((total * insuranceRate) / 100) * 100) / 100;
        const patientPays = Math.round((total - insurancePays) * 100) / 100;

        const safeInsurancePays = Math.max(0, insurancePays);
        const safePatientPays = Math.max(0, patientPays);

        setThirdPartyAmount(safeInsurancePays.toFixed(2));
        setPatientBalance(safePatientPays);

        setValue('paymentAmount', safePatientPays.toFixed(2));
      } else {
        setThirdPartyAmount('0.00');
        setPatientBalance(total);
        setValue('paymentAmount', total.toFixed(2));
      }
    } else {
      setThirdPartyAmount('0.00');
      setPatientBalance(0);
    }
  }, [insuranceRate, localSelectedItems, calculateSelectedItemsTotal, setValue]);

  const handlePrintReceipt = async () => {
    try {
      if (!paymentData || !groupedConsommationData || !paidItems || paidItems.length === 0) {
        showToast({
          title: t('printError', 'Print Error'),
          description: t('noPrintData', 'No payment data available for printing'),
          kind: 'warning',
        });
        return;
      }

      // Add consommation info to paid items
      const itemsWithConsommationInfo = paidItems.map((item) => ({
        ...item,
        consommationId: localSelectedItems.find(
          (selectedItem) => selectedItem.item.patientServiceBillId === item.patientServiceBillId,
        )?.consommationId,
      }));

      printReceipt(paymentData, groupedConsommationData, itemsWithConsommationInfo);
    } catch (error) {
      console.error('Error printing receipt:', error);
      showToast({
        title: t('printError', 'Print Error'),
        description: t('printErrorDescription', 'There was an error preparing the receipt'),
        kind: 'error',
      });
    }
  };

  const handleCloseModal = () => {
    if (paymentSuccess) {
      onSuccess();
    }
    onClose();
  };

  const isFormValid = () => {
    if (!isValid || paymentError || paymentSuccess) return false;

    const hasSelectedItems = localSelectedItems.some((selectedItemInfo) => selectedItemInfo.item.selected === true);

    return hasSelectedItems && !isSubmitting;
  };

  const onSubmit = async (data: PaymentFormValues) => {
    setIsSubmitting(true);
    setPaymentError('');

    try {
      const selectedItemsTotal = calculateSelectedItemsTotal();
      const enteredAmount = parseFloat(data.paymentAmount);

      // Additional validation checks
      if (paymentMethod === 'cash' && (!data.receivedCash || parseFloat(data.receivedCash) < enteredAmount)) {
        throw new Error(
          t('insufficientCash', 'Received cash amount must be equal to the payment amount'),
        );
      }

      if (paymentMethod === 'deposit') {
        if (!data.deductedAmount || parseFloat(data.deductedAmount) <= 0) {
          throw new Error(t('invalidDeductedAmount', 'Please enter a valid deducted amount'));
        }

        if (parseFloat(data.deductedAmount) > parseFloat(depositBalance)) {
          throw new Error(t('insufficientBalance', 'Deducted amount exceeds available balance'));
        }

        if (parseFloat(data.deductedAmount) < enteredAmount) {
          throw new Error(
            t('insufficientDeduction', 'Deducted amount must be equal to or greater than the payment amount'),
          );
        }
      }

      const maxAllowedAmount =
        insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100 ? patientBalance : selectedItemsTotal;

      if (enteredAmount > maxAllowedAmount) {
        const coverageInfo = insuranceRate !== null ? `${insuranceRate}% insurance coverage` : 'no insurance coverage';

        const errorMessage =
          insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100
            ? t(
                'amountExceedsPatientBalance',
                `Payment amount cannot exceed patient balance (${maxAllowedAmount.toFixed(2)}) with ${coverageInfo}`,
              )
            : t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items');
        throw new Error(errorMessage);
      }

      if (!collectorUuid) {
        throw new Error(t('noCollectorUuid', 'Unable to retrieve collector UUID. Please ensure you are logged in.'));
      }

      const paymentPromises = [];
      let remainingPayment = enteredAmount;
      const allPaidItems: ConsommationItem[] = [];

      const actuallySelectedItems = localSelectedItems.filter((item) => item.item.selected === true);

      // Group by consommation
      const selectedByConsommation = actuallySelectedItems.reduce(
        (groups, item) => {
          if (!groups[item.consommationId]) {
            groups[item.consommationId] = {
              consommationId: item.consommationId,
              consommationService: item.consommationService,
              items: [],
            };
          }
          groups[item.consommationId].items.push(item.item);
          return groups;
        },
        {} as Record<
          string,
          { consommationId: string; consommationService: string; items: (ConsommationItem & { selected?: boolean })[] }
        >,
      );

      for (const consommationGroup of Object.values(selectedByConsommation)) {
        if (remainingPayment <= 0) break;

        const consommationItems = consommationGroup.items;
        if (consommationItems.length === 0) continue;

        const fullConsommationData = await getConsommationById(consommationGroup.consommationId);

        if (!fullConsommationData?.patientBill?.patientBillId) {
          console.warn(`Could not retrieve patient bill ID for consommation ${consommationGroup.consommationId}`);
          continue;
        }

        const consommationTotalDue = consommationItems.reduce((total, item) => {
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = item.paidAmount || 0;
          return total + Math.max(0, itemTotal - paidAmount);
        }, 0);

        const paymentForThisConsommation = Math.min(remainingPayment, consommationTotalDue);
        remainingPayment -= paymentForThisConsommation;

        let consommationRemainingPayment = paymentForThisConsommation;
        const paidItems = [];

        const sortedItems = [...consommationItems].sort((a, b) => {
          const aCost = Math.max(0, (a.quantity || 1) * (a.unitPrice || 0) - (a.paidAmount || 0));
          const bCost = Math.max(0, (b.quantity || 1) * (b.unitPrice || 0) - (b.paidAmount || 0));
          return aCost - bCost;
        });

        for (const item of sortedItems) {
          if (consommationRemainingPayment <= 0) break;

          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = item.paidAmount || 0;
          const itemCost = Math.max(0, itemTotal - paidAmount);

          if (consommationRemainingPayment >= itemCost) {
            paidItems.push({
              billItem: { patientServiceBillId: item.patientServiceBillId },
              paidQty: item.quantity || 1,
            });
            allPaidItems.push({ ...item, paidAmount: itemTotal });
            consommationRemainingPayment -= itemCost;
          } else {
            const itemQuantity = item.quantity || 1;
            const itemUnitPrice = item.unitPrice || 0;

            if (itemQuantity > 1 && itemUnitPrice > 0) {
              const wholePaidQty = Math.floor(consommationRemainingPayment / itemUnitPrice);
              if (wholePaidQty >= 1) {
                paidItems.push({
                  billItem: { patientServiceBillId: item.patientServiceBillId },
                  paidQty: wholePaidQty,
                });
                allPaidItems.push({ ...item, paidAmount: (paidAmount || 0) + wholePaidQty * itemUnitPrice });
                consommationRemainingPayment -= wholePaidQty * itemUnitPrice;
              }
            } else {
              paidItems.push({
                billItem: { patientServiceBillId: item.patientServiceBillId },
                paidQty: 1,
              });
              allPaidItems.push({ ...item, paidAmount: itemTotal });
              consommationRemainingPayment = 0;
            }
          }
        }

        if (paidItems.length > 0) {
          const paymentPayload = {
            amountPaid: parseFloat(paymentForThisConsommation.toFixed(2)),
            patientBill: {
              patientBillId: fullConsommationData.patientBill.patientBillId,
              creator: collectorUuid,
            },
            dateReceived: new Date().toISOString(),
            collector: { uuid: collectorUuid },
            paidItems: paidItems,
          };

          paymentPromises.push({
            payload: paymentPayload,
            consommationId: consommationGroup.consommationId,
            paidItems: paidItems,
            consommationData: fullConsommationData,
          });
        }
      }

      const paymentResults = await Promise.all(
        paymentPromises.map(async ({ payload, consommationId, paidItems, consommationData }) => {
          try {
            const response = await submitBillPayment(payload);

            paidItems.forEach((paidItem) => {
              const paymentKey = `payment_${paidItem.billItem.patientServiceBillId}`;
              try {
                const existingPaymentData = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
                const updatedPaymentData = {
                  ...existingPaymentData,
                  paid: true,
                  timestamp: new Date().toISOString(),
                };
                sessionStorage.setItem(paymentKey, JSON.stringify(updatedPaymentData));
              } catch (e) {
                console.warn('Failed to save payment to sessionStorage:', e);
              }
            });

            return { success: true, consommationId, response, consommationData };
          } catch (error) {
            console.error(`Payment failed for consommation ${consommationId}:`, error);
            return { success: false, consommationId, error };
          }
        }),
      );

      const successfulPayments = paymentResults.filter((result) => result.success);
      const failedPayments = paymentResults.filter((result) => !result.success);

      if (successfulPayments.length > 0) {
        const firstSuccessfulPayment = successfulPayments[0];
        const consommationDetails = firstSuccessfulPayment.consommationData;

        const activeInsurancePolicy = insurancePolicies?.find((policy) => {
          const isNotExpired = new Date(policy.expirationDate) > new Date();
          return isNotExpired;
        });

        let insuranceProviderName = '';
        if (activeInsurancePolicy?.insurance?.name) {
          insuranceProviderName = activeInsurancePolicy.insurance.name;
        }

        const receiptPaymentData: PaymentData = {
          amountPaid: enteredAmount.toFixed(2),
          receivedCash: data.receivedCash || '',
          change: calculateChange(data.receivedCash, data.paymentAmount),
          paymentMethod: paymentMethod,
          deductedAmount: paymentMethod === 'deposit' ? data.deductedAmount : '',
          dateReceived: new Date().toISOString().split('T')[0],
          collectorName: session?.user?.display || 'Unknown',
          patientName: consommationDetails?.patientBill?.beneficiaryName || 'Unknown',
          policyNumber: consommationDetails?.patientBill?.policyIdNumber || '',
          thirdPartyAmount: thirdPartyAmount,
          thirdPartyProvider: insuranceProviderName,
          totalAmount: selectedItemsTotal.toFixed(2),
          insuranceRate: insuranceRate,
        };

        // Prepare grouped consommation data for receipt
        const receiptGroupedConsommationData: Record<string, ConsommationInfo> = {};
        Object.values(selectedByConsommation).forEach((consommationGroup) => {
          receiptGroupedConsommationData[consommationGroup.consommationId] = {
            service: consommationGroup.consommationService,
            date: new Date().toLocaleDateString(),
          };
        });

        setPaymentData(receiptPaymentData);
        setGroupedConsommationData(receiptGroupedConsommationData);
        setPaidItems(allPaidItems);
        setPaymentSuccess(true);

        showToast({
          title: t('paymentSuccess', 'Payment Successful'),
          description:
            failedPayments.length > 0
              ? t('partialPaymentSuccess', 'Some payments were processed successfully')
              : t('paymentProcessed', 'Payment has been processed successfully'),
          kind: failedPayments.length > 0 ? 'warning' : 'success',
        });
      } else {
        throw new Error(t('allPaymentsFailed', 'All payment attempts failed. Please try again.'));
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SuccessView = () => (
    <div className={styles.successMessage}>
      <div className={styles.successIcon}>
        <CheckmarkFilled size={32} />
      </div>
      <h3>{t('paymentSuccessful', 'Payment Successful!')}</h3>
      <p>{t('paymentProcessedSuccessfully', 'Your payment has been processed successfully.')}</p>

      <div className={styles.successActions}>
        <Button kind="secondary" renderIcon={Printer} onClick={handlePrintReceipt} className={styles.printButton}>
          {t('printReceipt', 'Print Receipt')}
        </Button>
      </div>

      {paymentData && (
        <div className={styles.paymentSummary}>
          <h4>{t('paymentSummary', 'Payment Summary')}</h4>
          <div className={styles.summaryRow}>
            <span>{t('amountPaid', 'Amount Paid')}:</span>
            <span className={styles.amount}>{paymentData.amountPaid}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('paymentMethod', 'Payment Method')}:</span>
            <span>{paymentData.paymentMethod === 'cash' ? t('cash', 'Cash') : t('deposit', 'Deposit')}</span>
          </div>
          {paymentData.receivedCash && (
            <div className={styles.summaryRow}>
              <span>{t('change', 'Change')}:</span>
              <span className={styles.amount}>{paymentData.change}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={isOpen}
      modalHeading={paymentSuccess ? t('paymentComplete', 'Payment Complete') : t('paymentForm', 'Payment Form')}
      primaryButtonText={paymentSuccess ? t('close', 'Close') : t('confirmPayment', 'Confirm Payment')}
      secondaryButtonText={paymentSuccess ? undefined : t('cancel', 'Cancel')}
      onRequestClose={handleCloseModal}
      onRequestSubmit={paymentSuccess ? handleCloseModal : handleSubmit(onSubmit)}
      onSecondarySubmit={paymentSuccess ? undefined : onClose}
      primaryButtonDisabled={paymentSuccess ? false : isSubmitting || !isFormValid()}
      size="lg"
    >
      <div className={styles.modalContent}>
        {paymentSuccess ? (
          <SuccessView />
        ) : (
          <Form onSubmit={handleSubmit(onSubmit)}>
            {paymentError && (
              <InlineNotification
                kind="error"
                title={t('error', 'Error')}
                subtitle={paymentError}
                className={styles.errorNotification}
              />
            )}

            <div className={styles.paymentFormGrid}>
              <div className={styles.paymentFormColumn}>
                <FormGroup legendText="">
                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('collector', 'Collector')}</div>
                    <div className={styles.formInput}>
                      <TextInput
                        id="collector-name"
                        labelText={t('collector', 'Collector')}
                        value={session?.user?.display || 'Unknown'}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('receivedDate', 'Received Date')}</div>
                    <div className={styles.formInput}>
                      <TextInput
                        id="received-date"
                        labelText={t('receivedDate', 'Received Date')}
                        type="date"
                        value={new Date().toISOString().split('T')[0]}
                      />
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
                        <Controller
                          name="receivedCash"
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              id="received-cash"
                              value={field.value}
                              onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                              min={0}
                              step={0.01}
                              invalid={!!errors.receivedCash}
                              invalidText={errors.receivedCash?.message}
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'deposit' && (
                    <>
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>{t('deductedAmount', 'Deducted Amount')}</div>
                        <div className={styles.formInput}>
                          <Controller
                            name="deductedAmount"
                            control={control}
                            render={({ field }) => (
                              <NumberInput
                                id="deducted-amount"
                                value={field.value}
                                onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                                min={0}
                                max={parseFloat(depositBalance)}
                                step={0.01}
                                invalid={!!errors.deductedAmount}
                                invalidText={errors.deductedAmount?.message}
                              />
                            )}
                          />
                        </div>
                      </div>
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>{t('balance', 'Balance')}</div>
                        <div className={styles.formInput}>
                          <TextInput
                            id="deposit-balance"
                            labelText={t('balance', 'Balance')}
                            value={depositBalance}
                            readOnly
                          />
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
                      <Controller
                        name="paymentAmount"
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            id="amount-paid"
                            value={field.value}
                            onChange={(e) => field.onChange((e.target as HTMLInputElement).value)}
                            min={0}
                            max={
                              insuranceRate !== null && insuranceRate >= 0 && insuranceRate <= 100
                                ? patientBalance
                                : calculateSelectedItemsTotal()
                            }
                            step={0.01}
                            invalid={!!errors.paymentAmount}
                            invalidText={errors.paymentAmount?.message}
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formLabel}>{t('paidByInsurance', 'Paid by Insurance')}</div>
                    <div className={styles.formInput}>
                      <NumberInput
                        id="third-party-payment"
                        value={thirdPartyAmount}
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
                        labelText={t('rest', 'Rest')}
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
              <h5>
                {t('selectedItems', 'Items from Multiple Consommations')}
                <span className={styles.itemCount}>
                  ({countSelectedItems()} {t('itemsSelected', 'items selected for payment')})
                </span>
              </h5>

              {Object.keys(groupedAllItems).length > 0 ? (
                <Accordion align="start">
                  {Object.values(groupedAllItems).map((consommationGroup) => {
                    const selectedItemsCount = consommationGroup.items.filter((item) => item.selected === true).length;

                    return (
                      <AccordionItem
                        key={consommationGroup.consommationId}
                        title={
                          <div className={styles.consommationGroupTitle}>
                            <span className={styles.consommationId}>#{consommationGroup.consommationId}</span>
                            <span className={styles.consommationService}>{consommationGroup.consommationService}</span>
                            <span className={styles.itemCount}>
                              ({selectedItemsCount} of {consommationGroup.items.length}{' '}
                              {t('itemsSelected', 'items selected')})
                            </span>
                          </div>
                        }
                        open={true}
                      >
                        <div className={styles.responsiveTableWrapper}>
                          <table className={styles.itemsTable}>
                            <thead>
                              <tr>
                                <th></th>
                                <th>{t('itemName', 'Item Name')}</th>
                                {consommationGroup.items.some((item) => item.drugFrequency) && (
                                  <th>{t('frequency', 'Frequency')}</th>
                                )}
                                <th>{t('quantity', 'Qty')}</th>
                                <th>{t('unitPrice', 'Unit Price')}</th>
                                <th>{t('itemTotal', 'Total')}</th>
                                <th>{t('paidAmt', 'Paid')}</th>
                                <th>{t('remaining', 'Remaining')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consommationGroup.items.map((item, index) => {
                                const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                                const paidAmt = item.paidAmount || 0;
                                const remainingAmount = Math.max(0, itemTotal - paidAmt);
                                const isPaid = isActuallyPaid(item);

                                return (
                                  <tr key={index} className={item.selected ? styles.selectedItem : ''}>
                                    <td>
                                      <Checkbox
                                        id={`payment-item-${consommationGroup.consommationId}-${item.patientServiceBillId}`}
                                        checked={item.selected || false}
                                        onChange={() =>
                                          handleLocalItemToggle(
                                            consommationGroup.consommationId,
                                            item.patientServiceBillId || 0,
                                          )
                                        }
                                        labelText=""
                                      />
                                    </td>
                                    <td title={item.itemName || '-'}>{item.itemName || '-'}</td>
                                    {consommationGroup.items.some((item) => item.drugFrequency) && (
                                      <td>{item.drugFrequency || '-'}</td>
                                    )}
                                    <td>{item.quantity || '1'}</td>
                                    <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                                    <td>{Number(itemTotal).toFixed(2)}</td>
                                    <td>{Number(paidAmt).toFixed(2)}</td>
                                    <td>{Number(remainingAmount).toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={consommationGroup.items.some((item) => item.drugFrequency) ? 8 : 7}>
                                  <strong>{t('consommationTotal', 'Consommation Selected Total')}</strong>
                                </td>
                                <td colSpan={1}>
                                  <strong>
                                    {consommationGroup.items
                                      .filter((item) => item.selected)
                                      .reduce((total, item) => {
                                        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                                        const paidAmt = item.paidAmount || 0;
                                        const remainingAmount = Math.max(0, itemTotal - paidAmt);
                                        return total + remainingAmount;
                                      }, 0)
                                      .toFixed(2)}
                                  </strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className={styles.noItems}>{t('noItemsSelected', 'No items selected')}</div>
              )}

              <div className={styles.grandTotal}>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>
                    <strong>{t('grandTotal', 'Grand Total Amount to be Paid')}</strong>
                  </span>
                  <span className={styles.totalAmount}>
                    <strong>{calculateSelectedItemsTotal().toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </Form>
        )}
      </div>
    </Modal>
  );
};

export default PaymentForm;
