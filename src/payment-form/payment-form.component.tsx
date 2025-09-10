import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { submitBillPayment, getConsommationById } from '../api/billing';
import {
  isItemPaid,
  isItemPartiallyPaid,
  calculateChange,
  computePaymentStatus,
  getPaymentStatusClass,
  getPaymentStatusTagType,
} from '../utils/billing-calculations';
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
  onSuccess: (receivedCashAmount?: string, paidItemIds?: number[]) => void;
  selectedItems: SelectedItemInfo[];
  onItemToggle: (consommationId: string, itemIndex: number) => void;
  patientUuid?: string;
  globalBillId?: string;
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
  patientRate?: number;
  insuranceName?: string;
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
  globalBillId,
}) => {
  const { t } = useTranslation();
  const session = useSession();
  const collectorUuid = session?.user?.uuid;

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'deposit'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [depositBalance, setDepositBalance] = useState('1100.00'); // TODO: wire to real deposit balance if you have it
  const [localSelectedItems, setLocalSelectedItems] = useState<SelectedItemInfo[]>([]);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [groupedConsommationData, setGroupedConsommationData] = useState<Record<string, ConsommationInfo> | null>(null);
  const [paidItems, setPaidItems] = useState<ConsommationItem[]>([]);
  const [thirdPartyAmount, setThirdPartyAmount] = useState('0.00');
  const [patientBalance, setPatientBalance] = useState(0);
  const [lastReceivedCashAmount, setLastReceivedCashAmount] = useState<string>('');

  // form refs/state to avoid jitter on open
  const [isFormReady, setIsFormReady] = useState(false);
  const userModifiedFormRef = useRef(false);
  const formInitializedRef = useRef(false);
  const modalOpenedRef = useRef(false);

  const { data: insurancePolicies } = usePatientInsurancePolicies(patientUuid || '');

  // Insurance state
  const [insuranceInfo, setInsuranceInfo] = useState<{
    rate: number;
    patientRate: number;
    name: string;
    isLoading: boolean;
  }>({
    rate: 0,
    patientRate: 100,
    name: '',
    isLoading: true,
  });

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

  const isActuallyPaid = useCallback(
    (item: ConsommationItem & { selected?: boolean }): boolean => isItemPaid(item),
    [],
  );

  // Calculate selected items total (remaining to be paid)
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

  const countSelectedItems = useCallback(
    () => localSelectedItems.filter((i) => i.item.selected === true && !isActuallyPaid(i.item)).length,
    [localSelectedItems, isActuallyPaid],
  );

  // Fetch insurance rates using the same method as embedded consommations
  useEffect(() => {
    const fetchInsuranceRates = async () => {
      if (!globalBillId || !isOpen) return;

      setInsuranceInfo((prev) => ({ ...prev, isLoading: true }));
      try {
        const { getConsommationRates } = await import('../api/billing');

        // Get the first consommation to determine insurance rates
        // This uses the same logic as embedded consommations
        const { getConsommationsByGlobalBillId } = await import('../api/billing');
        const consommationsResponse = await getConsommationsByGlobalBillId(globalBillId);

        if (consommationsResponse?.results?.length > 0) {
          const firstConsommation = consommationsResponse.results[0];
          const rates = await getConsommationRates(firstConsommation.consommationId.toString(), globalBillId);

          setInsuranceInfo({
            rate: rates.insuranceRate,
            patientRate: rates.patientRate,
            name: rates.insuranceName || '',
            isLoading: false,
          });
        } else {
          // Fallback to global bill method if no consommations found
          const { getGlobalBillById, getInsuranceById } = await import('../api/billing');
          const gb = await getGlobalBillById(globalBillId);
          let insuranceRate = 0;
          let insuranceName = '';

          if (gb?.admission?.insurancePolicy?.insurance?.insuranceId) {
            const ins = await getInsuranceById(gb.admission.insurancePolicy.insurance.insuranceId);
            if (ins && ins.rate !== null && ins.rate !== undefined) {
              insuranceRate = Number(ins.rate);
              insuranceName = ins.name || '';
            }
          } else if (gb?.insurance) {
            if (gb.insurance.rate !== null && gb.insurance.rate !== undefined) {
              insuranceRate = Number(gb.insurance.rate);
              insuranceName = gb.insurance.name || '';
            }
          }

          setInsuranceInfo({
            rate: insuranceRate,
            patientRate: 100 - insuranceRate,
            name: insuranceName,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error fetching insurance rates:', error);
        setInsuranceInfo({ rate: 0, patientRate: 100, name: '', isLoading: false });
      }
    };

    if (isOpen) fetchInsuranceRates();
  }, [globalBillId, isOpen]);

  // Initialize modal state when opened
  useEffect(() => {
    if (isOpen && !paymentSuccess && !modalOpenedRef.current) {
      modalOpenedRef.current = true;
      formInitializedRef.current = false;
      userModifiedFormRef.current = false;

      setPaymentMethod('cash');
      setPaymentError('');
      setIsFormReady(false);

      const unpaidItemsWithSelectedState = selectedItems
        .filter((s) => !isActuallyPaid(s.item))
        .map((s) => ({ ...s, item: { ...s.item, selected: true } }));

      setLocalSelectedItems(unpaidItemsWithSelectedState);

      if (unpaidItemsWithSelectedState.length > 0) {
        const total = unpaidItemsWithSelectedState.reduce((sum, s) => {
          const item = s.item;
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = item.paidAmount || 0;
          return sum + Math.max(0, itemTotal - paidAmount);
        }, 0);

        reset({ paymentAmount: total.toFixed(2), receivedCash: '', deductedAmount: '' });
        setIsFormReady(true);
        formInitializedRef.current = true;
      }
    } else if (!isOpen) {
      modalOpenedRef.current = false;
      formInitializedRef.current = false;
      userModifiedFormRef.current = false;
      setPaymentSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, paymentSuccess, reset, isActuallyPaid]);

  // Keep totals & patient portion in sync with insurance rate
  useEffect(() => {
    if (isFormReady && formInitializedRef.current) {
      const unpaid = selectedItems
        .filter((s) => !isActuallyPaid(s.item))
        .map((s) => ({ ...s, item: { ...s.item, selected: true } }));

      setLocalSelectedItems(unpaid);

      if (!userModifiedFormRef.current && unpaid.length > 0) {
        const total = unpaid.reduce((sum, s) => {
          const it = s.item;
          const itemTotal = (it.quantity || 1) * (it.unitPrice || 0);
          const paidAmount = it.paidAmount || 0;
          return sum + Math.max(0, itemTotal - paidAmount);
        }, 0);

        if (insuranceInfo.rate > 0) {
          const insurancePays = Math.round(((total * insuranceInfo.rate) / 100) * 100) / 100;
          const patientPays = Math.round((total - insurancePays) * 100) / 100;
          setThirdPartyAmount(insurancePays.toFixed(2));
          setPatientBalance(patientPays);
          setValue('paymentAmount', patientPays.toFixed(2), { shouldValidate: false });
        } else {
          setThirdPartyAmount('0.00');
          setPatientBalance(total);
          setValue('paymentAmount', total.toFixed(2), { shouldValidate: false });
        }
      }
    }
  }, [selectedItems, isFormReady, insuranceInfo, setValue, isActuallyPaid]);

  useEffect(() => {
    if (
      isFormReady &&
      !insuranceInfo.isLoading &&
      !paymentSuccess &&
      formInitializedRef.current &&
      !userModifiedFormRef.current
    ) {
      const total = calculateSelectedItemsTotal();

      if (insuranceInfo.rate > 0) {
        const insurancePays = Math.round(((total * insuranceInfo.rate) / 100) * 100) / 100;
        const patientPays = Math.round((total - insurancePays) * 100) / 100;
        setThirdPartyAmount(insurancePays.toFixed(2));
        setPatientBalance(patientPays);
        setValue('paymentAmount', patientPays.toFixed(2), { shouldValidate: false });
      } else {
        setThirdPartyAmount('0.00');
        setPatientBalance(total);
        setValue('paymentAmount', total.toFixed(2), { shouldValidate: false });
      }
    }
  }, [isFormReady, insuranceInfo.isLoading, insuranceInfo.rate, calculateSelectedItemsTotal, setValue, paymentSuccess]);

  const handleUserInput = useCallback(
    (_: string) => {
      if (isFormReady && formInitializedRef.current) userModifiedFormRef.current = true;
    },
    [isFormReady],
  );

  useEffect(() => {
    if (!paymentSuccess && isFormReady && !insuranceInfo.isLoading) {
      if (paymentMethod === 'cash' && receivedCash && paymentAmount) {
        const cashAmount = parseFloat(receivedCash);
        const amountToPay = parseFloat(paymentAmount);
        setPaymentError(
          !isNaN(cashAmount) && !isNaN(amountToPay) && cashAmount <= 0
            ? t('noCashReceived', 'Please enter the amount of cash received')
            : '',
        );
      } else if (paymentMethod === 'deposit' && deductedAmount && paymentAmount) {
        const deductAmount = parseFloat(deductedAmount);
        const amountToPay = parseFloat(paymentAmount);
        const balance = parseFloat(depositBalance);

        if (deductAmount > balance) {
          setPaymentError(t('insufficientBalance', 'Deducted amount exceeds available balance'));
        } else {
          setPaymentError('');
        }
      } else {
        setPaymentError('');
      }
    }
  }, [
    paymentMethod,
    receivedCash,
    deductedAmount,
    paymentAmount,
    depositBalance,
    t,
    paymentSuccess,
    isFormReady,
    insuranceInfo.isLoading,
  ]);

  const groupedAllItems = localSelectedItems.reduce(
    (groups, s) => {
      const { consommationId, consommationService } = s;
      if (!groups[consommationId]) {
        groups[consommationId] = {
          consommationId,
          consommationService,
          items: [] as (ConsommationItem & { selected?: boolean })[],
        };
      }
      groups[consommationId].items.push(s.item);
      return groups;
    },
    {} as Record<
      string,
      { consommationId: string; consommationService: string; items: (ConsommationItem & { selected?: boolean })[] }
    >,
  );

  const computeItemPaymentStatusLocal = (item: ConsommationItem & { selected?: boolean }): string => {
    const status = computePaymentStatus(item);
    return status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : status;
  };

  const handleLocalItemToggle = (consommationId: string, patientServiceBillId: number) => {
    setLocalSelectedItems((prev) =>
      prev.map((entry) =>
        entry.consommationId === consommationId && entry.item.patientServiceBillId === patientServiceBillId
          ? { ...entry, item: { ...entry.item, selected: entry.item.selected === false ? true : false } }
          : entry,
      ),
    );
  };

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

      const itemsWithConsommationInfo = paidItems.map((item) => ({
        ...item,
        consommationId: localSelectedItems.find((s) => s.item.patientServiceBillId === item.patientServiceBillId)
          ?.consommationId,
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
      const paidItemIds = paidItems
        .map((item) => item.patientServiceBillId)
        .filter((id) => id !== undefined) as number[];
      onSuccess(lastReceivedCashAmount, paidItemIds);
    }
    onClose();
  };

  const isFormValid = () => {
    if (!isValid || paymentError || paymentSuccess || insuranceInfo.isLoading || !isFormReady) return false;
    const hasSelectedItems = localSelectedItems.some((s) => s.item.selected === true);
    return hasSelectedItems && !isSubmitting;
  };

  const onSubmit = async (data: PaymentFormValues) => {
    if (insuranceInfo.isLoading) {
      setPaymentError(t('waitForInsuranceRates', 'Please wait for insurance rates to load before submitting payment.'));
      return;
    }

    setIsSubmitting(true);
    setPaymentError('');

    try {
      const selectedItemsTotal = calculateSelectedItemsTotal();
      const enteredAmount = parseFloat(data.paymentAmount);

      if (paymentMethod === 'cash' && (!data.receivedCash || parseFloat(data.receivedCash) <= 0)) {
        throw new Error(t('noCashReceived', 'Please enter the amount of cash received'));
      }

      if (paymentMethod === 'deposit') {
        if (!data.deductedAmount || parseFloat(data.deductedAmount) <= 0) {
          throw new Error(t('invalidDeductedAmount', 'Please enter a valid deducted amount'));
        }
        if (parseFloat(data.deductedAmount) > parseFloat(depositBalance)) {
          throw new Error(t('insufficientBalance', 'Deducted amount exceeds available balance'));
        }
      }

      if (!collectorUuid) {
        throw new Error(t('noCollectorUuid', 'Unable to retrieve collector UUID. Please ensure you are logged in.'));
      }

      const maxAllowedAmount = insuranceInfo.rate > 0 ? patientBalance : selectedItemsTotal;
      if (enteredAmount > maxAllowedAmount) {
        const coverageInfo =
          insuranceInfo.rate > 0 ? `${insuranceInfo.rate}% insurance coverage` : 'no insurance coverage';
        const errorMessage =
          insuranceInfo.rate > 0
            ? t(
                'amountExceedsPatientBalance',
                `Payment amount cannot exceed patient balance (${maxAllowedAmount.toFixed(2)}) with ${coverageInfo}`,
              )
            : t('amountExceedsTotal', 'Payment amount cannot exceed the total of selected items');
        throw new Error(errorMessage);
      }

      const actuallySelected = localSelectedItems.filter((s) => s.item.selected === true);

      // Group selected by consommation
      const groups = actuallySelected.reduce(
        (acc, s) => {
          if (!acc[s.consommationId]) {
            acc[s.consommationId] = {
              consommationId: s.consommationId,
              consommationService: s.consommationService,
              items: [] as ConsommationItem[],
            };
          }
          acc[s.consommationId].items.push(s.item);
          return acc;
        },
        {} as Record<string, { consommationId: string; consommationService: string; items: ConsommationItem[] }>,
      );

      let remainingPayment = enteredAmount;
      const paymentPromises: Array<{
        payload: any;
        consommationId: string;
        consommationData: any;
      }> = [];
      const allPaidItems: ConsommationItem[] = [];

      const actualReceivedAmount =
        paymentMethod === 'cash'
          ? parseFloat(data.receivedCash || '0')
          : parseFloat(data.deductedAmount || data.paymentAmount || '0');

      for (const consommationGroup of Object.values(groups)) {
        if (remainingPayment <= 0) break;

        const full = await getConsommationById(consommationGroup.consommationId);
        if (!full?.patientBill?.patientBillId) {
          console.warn(`No patientBillId for consommation ${consommationGroup.consommationId}`);
          continue;
        }

        const consommationTotalDue = consommationGroup.items.reduce((total, item) => {
          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = item.paidAmount || 0;
          return total + Math.max(0, itemTotal - paidAmount);
        }, 0);

        const payThisCons = Math.min(remainingPayment, consommationTotalDue);
        remainingPayment -= payThisCons;

        let remain = payThisCons;
        const paidItemsForPayload: Array<{ billItem: { patientServiceBillId: number }; paidQty: number }> = [];

        const sorted = [...consommationGroup.items].sort((a, b) => {
          const aCost = Math.max(0, (a.quantity || 1) * (a.unitPrice || 0) - (a.paidAmount || 0));
          const bCost = Math.max(0, (b.quantity || 1) * (b.unitPrice || 0) - (b.paidAmount || 0));
          return aCost - bCost;
        });

        for (const item of sorted) {
          if (remain <= 0) break;

          const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
          const paidAmount = item.paidAmount || 0;
          const itemCost = Math.max(0, itemTotal - paidAmount);

          if (remain >= itemCost) {
            paidItemsForPayload.push({
              billItem: { patientServiceBillId: item.patientServiceBillId },
              paidQty: item.quantity || 1,
            });
            allPaidItems.push({ ...item, paidAmount: actualReceivedAmount });
            remain -= itemCost;
          } else {
            // attempt partial by quantity if possible
            const itemQty = item.quantity || 1;
            const unit = item.unitPrice || 0;

            if (itemQty > 1 && unit > 0) {
              const wholePaidQty = Math.floor(remain / unit);
              if (wholePaidQty >= 1) {
                paidItemsForPayload.push({
                  billItem: { patientServiceBillId: item.patientServiceBillId },
                  paidQty: wholePaidQty,
                });
                allPaidItems.push({ ...item, paidAmount: actualReceivedAmount });
                remain -= wholePaidQty * unit;
              }
            } else {
              // pay one unit
              paidItemsForPayload.push({
                billItem: { patientServiceBillId: item.patientServiceBillId },
                paidQty: 1,
              });
              // For single unit payment, show exactly what user entered in Received Cash field
              allPaidItems.push({ ...item, paidAmount: actualReceivedAmount });
              remain = 0;
            }
          }
        }

        if (paidItemsForPayload.length > 0) {
          const amountToRecord =
            paymentMethod === 'cash'
              ? Math.min(parseFloat(data.receivedCash || '0'), payThisCons)
              : Math.min(parseFloat(data.deductedAmount || '0'), payThisCons);

          const payload = {
            amountPaid: parseFloat(amountToRecord.toFixed(2)),
            patientBill: {
              patientBillId: full.patientBill.patientBillId,
              creator: collectorUuid,
            },
            dateReceived: new Date().toISOString(),
            collector: { uuid: collectorUuid },
            paidItems: paidItemsForPayload,
          };
          paymentPromises.push({ payload, consommationId: consommationGroup.consommationId, consommationData: full });
        }
      }

      const results = await Promise.all(
        paymentPromises.map(async ({ payload, consommationId, consommationData }) => {
          try {
            const response = await submitBillPayment(payload);
            return { success: true, consommationId, response, consommationData };
          } catch (error) {
            console.error(`Payment failed for consommation ${consommationId}:`, error);
            return { success: false, consommationId, error };
          }
        }),
      );

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      if (successful.length > 0) {
        const first = successful[0];
        const details = first.consommationData;

        const activeInsurancePolicy = insurancePolicies?.find((policy) => new Date(policy.expirationDate) > new Date());
        const insuranceProviderName = activeInsurancePolicy?.insurance?.name || '';

        const receiptPaymentData: PaymentData = {
          amountPaid: actualReceivedAmount.toFixed(2), // Use actual received amount for partial payments
          receivedCash: data.receivedCash || '',
          change: calculateChange(data.receivedCash, data.paymentAmount),
          paymentMethod,
          deductedAmount: paymentMethod === 'deposit' ? data.deductedAmount : '',
          dateReceived: new Date().toISOString().split('T')[0],
          collectorName: session?.user?.display || 'Unknown',
          patientName: details?.patientBill?.beneficiaryName || 'Unknown',
          policyNumber: details?.patientBill?.policyIdNumber || '',
          thirdPartyAmount: thirdPartyAmount,
          thirdPartyProvider: insuranceProviderName,
          totalAmount: selectedItemsTotal.toFixed(2),
          insuranceRate: insuranceInfo.rate,
          patientRate: insuranceInfo.patientRate,
          insuranceName: insuranceInfo.name,
        };

        const receiptGrouped: Record<string, ConsommationInfo> = {};
        Object.values(groups).forEach((g) => {
          receiptGrouped[g.consommationId] = { service: g.consommationService, date: new Date().toLocaleDateString() };
        });

        setPaymentData(receiptPaymentData);
        setGroupedConsommationData(receiptGrouped);
        setPaidItems(allPaidItems);
        // Store the received cash amount for passing to parent component
        setLastReceivedCashAmount(data.receivedCash || data.paymentAmount || '0');
        // Do NOT refresh parent or close modal immediately; show success view with Print Receipt.
        // Parent refresh is triggered only when the user closes the modal (see handleCloseModal).
        setPaymentSuccess(true);

        const isPartialPayment = actualReceivedAmount < selectedItemsTotal;
        showToast({
          title: t('paymentSuccess', 'Payment Successful'),
          description:
            failed.length > 0
              ? t('partialPaymentSuccess', 'Some payments were processed successfully')
              : isPartialPayment
                ? t('partialPaymentProcessed', 'Partial payment has been processed successfully')
                : t('paymentProcessed', 'Payment has been processed successfully'),
          kind: failed.length > 0 ? 'warning' : 'success',
        });
      } else {
        throw new Error(t('allPaymentsFailed', 'All payment attempts failed. Please try again.'));
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message ?? String(error));
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
            <span>{t('amountPaid', 'Amount To Be Paid')}:</span>
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

            {insuranceInfo.isLoading && (
              <InlineNotification
                kind="info"
                title={t('loadingInsurance', 'Loading Insurance Information')}
                subtitle={t('loadingInsuranceMessage', 'Please wait while the insurance rates calculate...')}
                className={styles.infoNotification}
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
                        readOnly
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
                              onChange={(e) => {
                                handleUserInput('receivedCash');
                                field.onChange((e.target as HTMLInputElement).value);
                              }}
                              onFocus={() => handleUserInput('receivedCash')}
                              min={0}
                              step={0.01}
                              invalid={!!errors.receivedCash}
                              invalidText={errors.receivedCash?.message}
                              disabled={insuranceInfo.isLoading || !isFormReady}
                              helperText={t(
                                'partialPaymentsAllowed',
                                'Enter amount received - partial payments are allowed',
                              )}
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
                                onChange={(e) => {
                                  handleUserInput('deductedAmount');
                                  field.onChange((e.target as HTMLInputElement).value);
                                }}
                                onFocus={() => handleUserInput('deductedAmount')}
                                min={0}
                                max={parseFloat(depositBalance)}
                                step={0.01}
                                invalid={!!errors.deductedAmount}
                                invalidText={errors.deductedAmount?.message}
                                disabled={insuranceInfo.isLoading || !isFormReady}
                                helperText={t(
                                  'partialPaymentsAllowed',
                                  'Enter amount to deduct - partial payments are allowed',
                                )}
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
                    <div className={styles.formLabel}>{t('amountPaid', 'Amount To Be Paid')}</div>
                    <div className={styles.formInput}>
                      <Controller
                        name="paymentAmount"
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            id="amount-paid"
                            value={field.value}
                            onChange={(e) => {
                              handleUserInput('paymentAmount');
                              field.onChange((e.target as HTMLInputElement).value);
                            }}
                            onFocus={() => handleUserInput('paymentAmount')}
                            min={0}
                            max={insuranceInfo.rate > 0 ? patientBalance : calculateSelectedItemsTotal()}
                            step={0.01}
                            invalid={!!errors.paymentAmount}
                            invalidText={errors.paymentAmount?.message}
                            helperText={
                              insuranceInfo.isLoading
                                ? t('calculatingPatientAmount', 'Calculating patient amount...')
                                : insuranceInfo.rate > 0
                                  ? `Patient portion (${insuranceInfo.patientRate}%) - Partial payments allowed`
                                  : t('fullPatientPayment', 'Full patient payment (100%) - Partial payments allowed')
                            }
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
                        helperText={
                          insuranceInfo.isLoading
                            ? t('loadingInsuranceRates', 'Loading insurance rates...')
                            : insuranceInfo.rate > 0
                              ? `${insuranceInfo.name} (${insuranceInfo.rate}%)`
                              : t('noInsuranceCoverage', 'No insurance coverage')
                        }
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
                  {Object.values(groupedAllItems).map((group) => {
                    const selectedCount = group.items.filter((i) => i.selected === true).length;

                    return (
                      <AccordionItem
                        key={group.consommationId}
                        title={
                          <div className={styles.consommationGroupTitle}>
                            <span className={styles.consommationId}>#{group.consommationId}</span>
                            <span className={styles.consommationService}>{group.consommationService}</span>
                            <span className={styles.itemCount}>
                              ({selectedCount} of {group.items.length} {t('itemsSelected', 'items selected')})
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
                                {group.items.some((it) => it.drugFrequency) && <th>{t('frequency', 'Frequency')}</th>}
                                <th>{t('quantity', 'Qty')}</th>
                                <th>{t('unitPrice', 'Unit Price')}</th>
                                <th>{t('itemTotal', 'Total')}</th>
                                <th>{t('paidAmt', 'Paid')}</th>
                                <th>{t('remaining', 'Remaining')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item) => {
                                const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                                const paidAmt = item.paidAmount || 0;
                                const remainingAmount = Math.max(0, itemTotal - paidAmt);

                                return (
                                  <tr
                                    key={item.patientServiceBillId}
                                    className={item.selected ? styles.selectedItem : ''}
                                  >
                                    <td>
                                      <Checkbox
                                        id={`payment-item-${group.consommationId}-${item.patientServiceBillId}`}
                                        checked={item.selected || false}
                                        onChange={() =>
                                          handleLocalItemToggle(group.consommationId, item.patientServiceBillId || 0)
                                        }
                                        labelText=""
                                      />
                                    </td>
                                    <td title={item.itemName || '-'}>{item.itemName || '-'}</td>
                                    {group.items.some((i) => i.drugFrequency) && <td>{item.drugFrequency || '-'}</td>}
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
                                <td colSpan={group.items.some((i) => i.drugFrequency) ? 8 : 7}>
                                  <strong>{t('consommationTotal', 'Consommation Selected Total')}</strong>
                                </td>
                                <td colSpan={1}>
                                  <strong>
                                    {group.items
                                      .filter((i) => i.selected)
                                      .reduce((total, it) => {
                                        const itTotal = (it.quantity || 1) * (it.unitPrice || 0);
                                        const paidAmt = it.paidAmount || 0;
                                        return total + Math.max(0, itTotal - paidAmt);
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
