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
  Dropdown,
} from '@carbon/react';
import { Printer, CheckmarkFilled } from '@carbon/react/icons';
import { showToast, useSession } from '@openmrs/esm-framework';
import { submitBillPayment, getConsommationById, fetchPatientPhoneNumber } from '../api/billing';
import { isItemPaid, calculateChange, computePaymentStatus } from '../utils/billing-calculations';
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
  iremboPayAmount: z
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
  // Irembo Pay specific fields
  phoneNumber?: string;
  invoiceNumber?: string;
  paymentReference?: string;
  // Multiple payment method details
  cashAmount?: string;
  depositAmount?: string;
  iremboPayAmount?: string;
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

  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<Set<'cash' | 'deposit' | 'irembopay'>>(
    new Set(),
  );
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

  // Irembo Pay specific state
  const [iremboPayPhoneNumber, setIremboPayPhoneNumber] = useState('');
  const [isPaymentPrompting, setIsPaymentPrompting] = useState(false);
  const [paymentPromptStatus, setPaymentPromptStatus] = useState<
    'idle' | 'prompting' | 'pending' | 'success' | 'failed'
  >('idle');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  // Payment state
  const [patientPhoneNumber, setPatientPhoneNumber] = useState('');
  const [totalAmountToPay, setTotalAmountToPay] = useState(0);

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

  // Fetch patient phone number
  const fetchPatientPhoneNumberData = useCallback(async () => {
    if (!patientUuid) return;

    try {
      const result = await fetchPatientPhoneNumber(patientUuid);

      if (result.success) {
        setPatientPhoneNumber(result.phoneNumber);
        setIremboPayPhoneNumber(result.phoneNumber);
      } else {
        // Fallback to empty if no phone number found
        setPatientPhoneNumber('');
        setIremboPayPhoneNumber('');
        if (result.error) {
          console.warn('Phone number fetch warning:', result.error);
        }
      }
    } catch (error) {
      console.error('Error fetching patient phone number:', error);
      // Fallback to empty if API call fails
      setPatientPhoneNumber('');
      setIremboPayPhoneNumber('');
    }
  }, [patientUuid]);

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

  // Calculate total amount to be paid
  const calculateTotalAmountToPay = useCallback(() => {
    const selectedItemsTotal = calculateSelectedItemsTotal();
    const maxAllowedAmount = insuranceInfo.rate > 0 ? patientBalance : selectedItemsTotal;
    return maxAllowedAmount;
  }, [insuranceInfo.rate, patientBalance, calculateSelectedItemsTotal]);

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
      iremboPayAmount: '',
    },
  });

  // Auto-fill payment amounts when form opens
  const autoFillPaymentAmounts = useCallback(() => {
    const totalAmount = calculateTotalAmountToPay();
    setTotalAmountToPay(totalAmount);

    // Auto-fill all payment fields with the total amount
    setValue('receivedCash', totalAmount.toFixed(2));
    setValue('deductedAmount', totalAmount.toFixed(2));
    setValue('iremboPayAmount', totalAmount.toFixed(2));
    setValue('paymentAmount', totalAmount.toFixed(2));
  }, [calculateTotalAmountToPay, setValue]);

  // Handle payment method selection
  const togglePaymentMethod = useCallback(
    (method: 'cash' | 'deposit' | 'irembopay') => {
      setSelectedPaymentMethods((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(method)) {
          newSet.delete(method);
          // Clear the amount for this method when unselected
          if (method === 'cash') setValue('receivedCash', '');
          if (method === 'deposit') setValue('deductedAmount', '');
          if (method === 'irembopay') setValue('iremboPayAmount', '');
        } else {
          newSet.add(method);
          // Auto-fill with total amount when selected
          const totalAmount = totalAmountToPay;
          if (method === 'cash') setValue('receivedCash', totalAmount.toFixed(2));
          if (method === 'deposit') setValue('deductedAmount', totalAmount.toFixed(2));
          if (method === 'irembopay') setValue('iremboPayAmount', totalAmount.toFixed(2));
        }
        return newSet;
      });
    },
    [setValue, totalAmountToPay],
  );

  // Get selected payment methods as text
  const getSelectedPaymentMethodsText = useCallback(() => {
    const methods = Array.from(selectedPaymentMethods);
    if (methods.length === 0) return t('noPaymentMethodsSelected', 'No payment methods selected');
    if (methods.length === 1) {
      const methodNames = {
        cash: t('payWithCash', 'Pay with cash'),
        deposit: t('payWithDeposit', 'Pay with deposit'),
        irembopay: t('payWithIremboPay', 'Pay with Irembo Pay'),
      };
      return methodNames[methods[0]];
    }
    return t('multiplePaymentMethods', 'Multiple payment methods selected');
  }, [selectedPaymentMethods, t]);

  const paymentAmount = watch('paymentAmount');
  const receivedCash = watch('receivedCash');
  const deductedAmount = watch('deductedAmount');

  const isActuallyPaid = useCallback(
    (item: ConsommationItem & { selected?: boolean }): boolean => isItemPaid(item),
    [],
  );

  const countSelectedItems = useCallback(
    () => localSelectedItems.filter((i) => i.item.selected === true && !isActuallyPaid(i.item)).length,
    [localSelectedItems, isActuallyPaid],
  );

  // Fetch insurance rates based on global bill
  useEffect(() => {
    const fetchInsuranceRates = async () => {
      if (!globalBillId || !isOpen) return;

      setInsuranceInfo((prev) => ({ ...prev, isLoading: true }));
      try {
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
      } catch (error) {
        console.error('Error fetching global bill insurance rates:', error);
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

      setSelectedPaymentMethods(new Set());
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

        reset({
          paymentAmount: total.toFixed(2),
          receivedCash: '',
          deductedAmount: '',
          iremboPayAmount: '',
        });
        setTotalAmountToPay(total);
        fetchPatientPhoneNumberData();
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
          setTotalAmountToPay(patientPays);
          setValue('paymentAmount', patientPays.toFixed(2), { shouldValidate: false });
        } else {
          setThirdPartyAmount('0.00');
          setPatientBalance(total);
          setTotalAmountToPay(total);
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
        setTotalAmountToPay(patientPays);
        setValue('paymentAmount', patientPays.toFixed(2), { shouldValidate: false });
      } else {
        setThirdPartyAmount('0.00');
        setPatientBalance(total);
        setTotalAmountToPay(total);
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

  // Calculate total payment from selected methods only
  const calculateTotalPayment = useCallback(
    (data: PaymentFormValues) => {
      let total = 0;

      if (selectedPaymentMethods.has('cash')) {
        total += parseFloat(data.receivedCash || '0');
      }
      if (selectedPaymentMethods.has('deposit')) {
        total += parseFloat(data.deductedAmount || '0');
      }
      if (selectedPaymentMethods.has('irembopay')) {
        total += parseFloat(data.iremboPayAmount || '0');
      }

      return total;
    },
    [selectedPaymentMethods],
  );

  // Inline validation for payment method specifics
  useEffect(() => {
    if (!paymentSuccess && isFormReady && !insuranceInfo.isLoading) {
      const formValues = watch();
      const totalPayment = calculateTotalPayment(formValues);
      const requiredAmount = totalAmountToPay;

      // Check if individual payment methods have issues
      if (selectedPaymentMethods.has('cash')) {
        const cashAmount = parseFloat(formValues.receivedCash || '0');
        if (cashAmount < 0) {
          setPaymentError(t('invalidCashAmount', 'Cash amount cannot be negative'));
          return;
        }
      }

      if (selectedPaymentMethods.has('deposit')) {
        const depositAmount = parseFloat(formValues.deductedAmount || '0');
        const balance = parseFloat(depositBalance);

        if (depositAmount < 0) {
          setPaymentError(t('invalidDeductedAmount', 'Please enter a valid deducted amount'));
          return;
        }
        if (depositAmount > balance) {
          setPaymentError(t('insufficientBalance', 'Deducted amount exceeds available balance'));
          return;
        }
      }

      if (selectedPaymentMethods.has('irembopay')) {
        const iremboPayAmount = parseFloat(formValues.iremboPayAmount || '0');
        if (iremboPayAmount < 0) {
          setPaymentError(t('invalidIremboPayAmount', 'Irembo Pay amount cannot be negative'));
          return;
        }
      }

      // Check if total payment covers the required amount
      const paymentCoversAmount = Math.abs(totalPayment - requiredAmount) < 0.01;
      if (totalPayment > 0 && !paymentCoversAmount) {
        if (totalPayment < requiredAmount) {
          setPaymentError(t('insufficientPayment', 'Total payment amount is insufficient'));
        } else {
          setPaymentError(t('overpayment', 'Total payment amount exceeds required amount'));
        }
      } else {
        setPaymentError('');
      }
    }
  }, [
    selectedPaymentMethods,
    receivedCash,
    deductedAmount,
    depositBalance,
    t,
    paymentSuccess,
    isFormReady,
    insuranceInfo.isLoading,
    totalAmountToPay,
    calculateTotalPayment,
    watch,
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

  const computeItemPaymentStatusLocal = (item: ConsommationItem & { selected?: boolean }): string =>
    computePaymentStatus(item);

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
      onSuccess(); // safety: ensure parent refreshed even if user closes first
    }
    onClose();
  };

  // Simple phone number validation
  const validateRwandanPhoneNumber = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return /^07\d{9}$/.test(cleaned);
  };

  const handleIremboPayPrompt = async () => {
    if (!iremboPayPhoneNumber) {
      setPaymentError(t('phoneNumberRequired', 'Phone number is required for Irembo Pay'));
      return;
    }

    // Validate phone number
    if (!validateRwandanPhoneNumber(iremboPayPhoneNumber)) {
      setPaymentError(t('invalidPhoneNumber', 'Please enter a valid Rwandan phone number (e.g., 0781234567)'));
      return;
    }

    setIsPaymentPrompting(true);
    setPaymentPromptStatus('prompting');
    setPaymentError('');

    try {
      // TODO: Replace with actual backend API calls when ready
      // For now, simulate the API call
      const totalAmount = calculateSelectedItemsTotal();

      // Simulate creating invoice
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const mockInvoiceNumber = `INV-${Date.now()}`;
      setInvoiceNumber(mockInvoiceNumber);

      // Simulate sending payment prompt
      setPaymentPromptStatus('pending');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate payment success (in real implementation, this would be polled)
      setPaymentPromptStatus('success');
      setPaymentReference(`REF-${Date.now()}`);

      showToast({
        title: t('paymentPromptSent', 'Payment Prompt Sent'),
        description: t(
          'paymentPromptSentDescription',
          'A payment prompt has been sent to the phone number. Please wait for payment confirmation.',
        ),
        kind: 'success',
      });
    } catch (error) {
      setPaymentPromptStatus('failed');
      showToast({
        title: t('paymentPromptFailed', 'Failed to send payment prompt'),
        description: t('paymentPromptFailedDescription', 'Please try again or contact support if the issue persists.'),
        kind: 'error',
      });
      console.error('Irembo Pay error:', error);
    } finally {
      setIsPaymentPrompting(false);
    }
  };

  // Check for insufficient cash and suggest other payment methods
  const getInsufficientCashWarning = useCallback(() => {
    const formValues = watch();
    const cashAmount = parseFloat(formValues.receivedCash || '0');
    const totalPayment = calculateTotalPayment(formValues);
    const requiredAmount = totalAmountToPay;
    const remainingAmount = requiredAmount - totalPayment;

    if (selectedPaymentMethods.has('cash') && cashAmount > 0 && remainingAmount > 0) {
      // Check if there are other payment methods available that aren't currently selected
      const availableMethods = ['deposit', 'irembopay'].filter((method) => {
        if (method === 'deposit') return parseFloat(depositBalance) > 0;
        if (method === 'irembopay') return true;
        return false;
      });

      if (availableMethods.length > 0) {
        const methodNames = {
          deposit: t('payWithDeposit', 'Pay with deposit'),
          irembopay: t('payWithIremboPay', 'Pay with Irembo Pay'),
        };
        const availableMethodText = availableMethods.map((method) => methodNames[method]).join(' or ');
        return t(
          'insufficientCashSuggestion',
          `Insufficient cash. You can pay the remaining ${remainingAmount.toFixed(2)} RWF using ${availableMethodText}.`,
        );
      }
    }
    return null;
  }, [selectedPaymentMethods, watch, calculateTotalPayment, totalAmountToPay, depositBalance, t]);

  const isFormValid = () => {
    if (!isValid || paymentError || paymentSuccess || insuranceInfo.isLoading || !isFormReady) return false;
    const hasSelectedItems = localSelectedItems.some((s) => s.item.selected === true);

    if (!hasSelectedItems || isSubmitting || selectedPaymentMethods.size === 0) return false;

    // Get current form values
    const formValues = watch();
    const requiredAmount = totalAmountToPay;

    // Calculate total payment only from selected payment methods
    let totalPayment = 0;

    if (selectedPaymentMethods.has('cash')) {
      totalPayment += parseFloat(formValues.receivedCash || '0');
    }
    if (selectedPaymentMethods.has('deposit')) {
      totalPayment += parseFloat(formValues.deductedAmount || '0');
    }
    if (selectedPaymentMethods.has('irembopay')) {
      totalPayment += parseFloat(formValues.iremboPayAmount || '0');
    }

    // Check if total payment covers the required amount
    const paymentCoversAmount = Math.abs(totalPayment - requiredAmount) < 0.01; // Allow for small rounding differences

    // For Irembo Pay, also check if payment has been successful
    if (selectedPaymentMethods.has('irembopay') && parseFloat(formValues.iremboPayAmount || '0') > 0) {
      return paymentCoversAmount && paymentPromptStatus === 'success';
    }

    return paymentCoversAmount;
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

      // Calculate combined total from all selected payment methods
      const combinedPaymentTotal = calculateTotalPayment(data);
      const enteredAmount = combinedPaymentTotal;

      // Validate individual payment methods
      if (selectedPaymentMethods.has('cash')) {
        const cashAmount = parseFloat(data.receivedCash || '0');
        if (cashAmount < 0) {
          throw new Error(t('invalidCashAmount', 'Cash amount cannot be negative'));
        }
      }

      if (selectedPaymentMethods.has('deposit')) {
        const depositAmount = parseFloat(data.deductedAmount || '0');
        if (depositAmount <= 0) {
          throw new Error(t('invalidDeductedAmount', 'Please enter a valid deducted amount'));
        }
        if (depositAmount > parseFloat(depositBalance)) {
          throw new Error(t('insufficientBalance', 'Deducted amount exceeds available balance'));
        }
      }

      if (selectedPaymentMethods.has('irembopay')) {
        const iremboPayAmount = parseFloat(data.iremboPayAmount || '0');
        if (iremboPayAmount < 0) {
          throw new Error(t('invalidIremboPayAmount', 'Irembo Pay amount cannot be negative'));
        }
      }

      if (selectedPaymentMethods.has('irembopay')) {
        if (!iremboPayPhoneNumber) {
          throw new Error(t('phoneNumberRequired', 'Phone number is required for Irembo Pay'));
        }
        if (paymentPromptStatus !== 'success') {
          throw new Error(t('paymentNotConfirmed', 'Please complete the Irembo Pay payment process first'));
        }
      }

      if (!collectorUuid) {
        throw new Error(t('noCollectorUuid', 'Unable to retrieve collector UUID. Please ensure you are logged in.'));
      }

      // Do not let patients overpay the patient portion when insurance applies
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
            allPaidItems.push({ ...item, paidAmount: itemTotal });
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
                allPaidItems.push({ ...item, paidAmount: (paidAmount || 0) + wholePaidQty * unit });
                remain -= wholePaidQty * unit;
              }
            } else {
              // pay one unit
              paidItemsForPayload.push({
                billItem: { patientServiceBillId: item.patientServiceBillId },
                paidQty: 1,
              });
              allPaidItems.push({ ...item, paidAmount: itemTotal });
              remain = 0;
            }
          }
        }

        if (paidItemsForPayload.length > 0) {
          const payload = {
            amountPaid: parseFloat(payThisCons.toFixed(2)),
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

        // Calculate individual payment amounts for receipt
        const cashAmount = selectedPaymentMethods.has('cash') ? parseFloat(data.receivedCash || '0') : 0;
        const depositAmount = selectedPaymentMethods.has('deposit') ? parseFloat(data.deductedAmount || '0') : 0;
        const iremboPayAmount = selectedPaymentMethods.has('irembopay') ? parseFloat(data.iremboPayAmount || '0') : 0;

        const receiptPaymentData: PaymentData = {
          amountPaid: enteredAmount.toFixed(2),
          receivedCash: cashAmount.toFixed(2),
          change: calculateChange(data.receivedCash, data.paymentAmount),
          paymentMethod: Array.from(selectedPaymentMethods).join(', '),
          deductedAmount: depositAmount.toFixed(2),
          dateReceived: new Date().toISOString().split('T')[0],
          collectorName: session?.user?.display || 'Unknown',
          patientName: details?.patientBill?.beneficiaryName || 'Unknown',
          policyNumber: details?.patientBill?.policyIdNumber || '',
          thirdPartyAmount: thirdPartyAmount,
          thirdPartyProvider: insuranceProviderName,
          totalAmount: selectedItemsTotal.toFixed(2),
          insuranceRate: insuranceInfo.rate,
          // Irembo Pay specific fields
          phoneNumber: selectedPaymentMethods.has('irembopay') ? iremboPayPhoneNumber : undefined,
          invoiceNumber: selectedPaymentMethods.has('irembopay') ? invoiceNumber : undefined,
          paymentReference: selectedPaymentMethods.has('irembopay') ? paymentReference : undefined,
          // Multiple payment method details
          cashAmount: cashAmount.toFixed(2),
          depositAmount: depositAmount.toFixed(2),
          iremboPayAmount: iremboPayAmount.toFixed(2),
        };

        const receiptGrouped: Record<string, ConsommationInfo> = {};
        Object.values(groups).forEach((g) => {
          receiptGrouped[g.consommationId] = { service: g.consommationService, date: new Date().toLocaleDateString() };
        });

        setPaymentData(receiptPaymentData);
        setGroupedConsommationData(receiptGrouped);
        setPaidItems(allPaidItems);
        // Do NOT refresh parent or close modal immediately; show success view with Print Receipt.
        // Parent refresh is triggered only when the user closes the modal (see handleCloseModal).
        setPaymentSuccess(true);

        showToast({
          title: t('paymentSuccess', 'Payment Successful'),
          description:
            failed.length > 0
              ? t('partialPaymentSuccess', 'Some payments were processed successfully')
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
            <span>{paymentData.paymentMethod}</span>
          </div>

          {/* Multiple Payment Method Breakdown */}
          {paymentData.cashAmount && parseFloat(paymentData.cashAmount) > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('cashAmount', 'Cash Amount')}:</span>
              <span className={styles.amount}>{paymentData.cashAmount} RWF</span>
            </div>
          )}
          {paymentData.depositAmount && parseFloat(paymentData.depositAmount) > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('depositAmount', 'Deposit Amount')}:</span>
              <span className={styles.amount}>{paymentData.depositAmount} RWF</span>
            </div>
          )}
          {paymentData.iremboPayAmount && parseFloat(paymentData.iremboPayAmount) > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('iremboPayAmount', 'Irembo Pay Amount')}:</span>
              <span className={styles.amount}>{paymentData.iremboPayAmount} RWF</span>
            </div>
          )}

          {paymentData.receivedCash && (
            <div className={styles.summaryRow}>
              <span>{t('change', 'Change')}:</span>
              <span className={styles.amount}>{paymentData.change}</span>
            </div>
          )}
          {paymentData.phoneNumber && (
            <div className={styles.summaryRow}>
              <span>{t('phoneNumber', 'Phone Number')}:</span>
              <span>{paymentData.phoneNumber}</span>
            </div>
          )}
          {paymentData.invoiceNumber && (
            <div className={styles.summaryRow}>
              <span>{t('invoiceNumber', 'Invoice Number')}:</span>
              <span>{paymentData.invoiceNumber}</span>
            </div>
          )}
          {paymentData.paymentReference && (
            <div className={styles.summaryRow}>
              <span>{t('paymentReference', 'Payment Reference')}:</span>
              <span>{paymentData.paymentReference}</span>
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
                    <div className={styles.formLabel}>{t('paymentMethods', 'Payment Methods')}</div>
                    <div className={styles.formInput}>
                      <div className={styles.paymentMethodsContainer}>
                        <div className={styles.paymentMethodHeader}>
                          <span>{t('totalAmountToPay', 'Total Amount to Pay')}:</span>
                          <span className={styles.totalAmount}>{totalAmountToPay.toFixed(2)} RWF</span>
                        </div>

                        {/* Payment Method Selection Dropdown */}
                        <div className={styles.paymentMethodDropdown}>
                          <Dropdown
                            id="payment-methods"
                            titleText=""
                            label={getSelectedPaymentMethodsText()}
                            items={['cash', 'deposit', 'irembopay']}
                            itemToString={(item) => {
                              const methodNames = {
                                cash: t('payWithCash', 'Pay with cash'),
                                deposit: t('payWithDeposit', 'Pay with deposit'),
                                irembopay: t('payWithIremboPay', 'Pay with Irembo Pay'),
                              };
                              return methodNames[item] || '';
                            }}
                            onChange={({ selectedItem }) => {
                              if (selectedItem && ['cash', 'deposit', 'irembopay'].includes(selectedItem)) {
                                togglePaymentMethod(selectedItem as 'cash' | 'deposit' | 'irembopay');
                              }
                            }}
                            selectedItem={Array.from(selectedPaymentMethods)[0] || ''}
                            size="md"
                            type="default"
                          />
                        </div>

                        {/* Selected Payment Methods with Remove Buttons */}
                        {selectedPaymentMethods.size > 0 && (
                          <div className={styles.selectedPaymentMethods}>
                            {Array.from(selectedPaymentMethods).map((method) => {
                              const methodNames = {
                                cash: t('payWithCash', 'Pay with cash'),
                                deposit: t('payWithDeposit', 'Pay with deposit'),
                                irembopay: t('payWithIremboPay', 'Pay with Irembo Pay'),
                              };
                              return (
                                <div key={method} className={styles.selectedMethodTag}>
                                  <span>{methodNames[method]}</span>
                                  <Button
                                    kind="ghost"
                                    size="sm"
                                    hasIconOnly
                                    iconDescription={t('remove', 'Remove')}
                                    onClick={() => togglePaymentMethod(method)}
                                    className={styles.removeButton}
                                  >
                                    ×
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Dynamic Payment Fields */}
                        {selectedPaymentMethods.size > 0 && (
                          <div className={styles.paymentFieldsContainer}>
                            {selectedPaymentMethods.has('cash') && (
                              <div className={styles.paymentFieldSection}>
                                <div className={styles.paymentFieldLabel}>{t('payWithCash', 'Pay with cash')}</div>
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
                                      placeholder="0.00"
                                    />
                                  )}
                                />
                              </div>
                            )}

                            {selectedPaymentMethods.has('deposit') && (
                              <div className={styles.paymentFieldSection}>
                                <div className={styles.paymentFieldLabel}>
                                  {t('payWithDeposit', 'Pay with deposit')}
                                </div>
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
                                      placeholder="0.00"
                                    />
                                  )}
                                />
                              </div>
                            )}

                            {selectedPaymentMethods.has('irembopay') && (
                              <div className={styles.paymentFieldSection}>
                                <div className={styles.paymentFieldLabel}>
                                  {t('payWithIremboPay', 'Pay with Irembo Pay')}
                                </div>
                                <Controller
                                  name="iremboPayAmount"
                                  control={control}
                                  render={({ field }) => (
                                    <NumberInput
                                      id="irembo-pay-amount"
                                      value={field.value}
                                      onChange={(e) => {
                                        handleUserInput('iremboPayAmount');
                                        field.onChange((e.target as HTMLInputElement).value);
                                      }}
                                      onFocus={() => handleUserInput('iremboPayAmount')}
                                      min={0}
                                      step={0.01}
                                      invalid={!!errors.iremboPayAmount}
                                      invalidText={errors.iremboPayAmount?.message}
                                      disabled={insuranceInfo.isLoading || !isFormReady}
                                      placeholder="0.00"
                                    />
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Irembo Pay Instructions */}
                        {selectedPaymentMethods.has('irembopay') && (
                          <div className={styles.iremboPayInstructions}>
                            <InlineNotification
                              kind="info"
                              title={t('iremboPayInstructions', 'Irembo Pay Instructions')}
                              subtitle={t(
                                'iremboPayInstructionsText',
                                'Click "Send Payment Prompt" to initiate payment. The "Confirm Payment" button will be enabled only after successful payment.',
                              )}
                              hideCloseButton
                            />
                          </div>
                        )}

                        {/* Insufficient Cash Warning */}
                        {getInsufficientCashWarning() && (
                          <div className={styles.insufficientCashWarning}>
                            <InlineNotification
                              kind="warning"
                              title={t('insufficientCash', 'Insufficient Cash')}
                              subtitle={getInsufficientCashWarning()}
                              hideCloseButton
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Irembo Pay specific fields - only show when Irembo Pay is selected */}
                  {selectedPaymentMethods.has('irembopay') && (
                    <>
                      <div className={styles.formRow}>
                        <div className={styles.formLabel}>{t('phoneNumber', 'Phone Number')}</div>
                        <div className={styles.formInput}>
                          <TextInput
                            id="irembo-pay-phone"
                            labelText={t('phoneNumber', 'Phone Number')}
                            value={iremboPayPhoneNumber}
                            onChange={(e) => setIremboPayPhoneNumber(e.target.value)}
                            placeholder="0781234567"
                            disabled={isPaymentPrompting || !isFormReady}
                            invalid={
                              selectedPaymentMethods.has('irembopay') &&
                              !iremboPayPhoneNumber &&
                              userModifiedFormRef.current
                            }
                            invalidText={t('phoneNumberRequired', 'Phone number is required for Irembo Pay')}
                          />
                        </div>
                      </div>

                      <div className={styles.formRow}>
                        <div className={styles.formLabel}></div>
                        <div className={styles.formInput}>
                          <Button
                            kind="primary"
                            onClick={handleIremboPayPrompt}
                            disabled={!iremboPayPhoneNumber || isPaymentPrompting || paymentPromptStatus === 'success'}
                            className={styles.promptButton}
                          >
                            {isPaymentPrompting
                              ? t('sendingPrompt', 'Sending Prompt...')
                              : t('sendPaymentPrompt', 'Send Payment Prompt')}
                          </Button>
                        </div>
                      </div>

                      {paymentPromptStatus !== 'idle' && (
                        <div className={styles.formRow}>
                          <div className={styles.formLabel}>{t('paymentStatus', 'Payment Status')}</div>
                          <div className={styles.formInput}>
                            <div className={styles.paymentStatusContainer}>
                              {paymentPromptStatus === 'prompting' && (
                                <div className={styles.paymentStatus}>
                                  <div className={styles.spinner}></div>
                                  <span>{t('sendingPaymentPrompt', 'Sending payment prompt...')}</span>
                                </div>
                              )}
                              {paymentPromptStatus === 'pending' && (
                                <div className={styles.paymentStatus}>
                                  <div className={styles.spinner}></div>
                                  <span>{t('waitingForPayment', 'Waiting for payment confirmation...')}</span>
                                </div>
                              )}
                              {paymentPromptStatus === 'success' && (
                                <div className={styles.paymentStatusSuccess}>
                                  <CheckmarkFilled size={16} />
                                  <span>{t('paymentSuccessful', 'Payment successful!')}</span>
                                </div>
                              )}
                              {paymentPromptStatus === 'failed' && (
                                <div className={styles.paymentStatusError}>
                                  <span>{t('paymentFailed', 'Payment failed. Please try again.')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {invoiceNumber && (
                        <div className={styles.formRow}>
                          <div className={styles.formLabel}>{t('invoiceNumber', 'Invoice Number')}</div>
                          <div className={styles.formInput}>
                            <TextInput
                              id="invoice-number"
                              labelText={t('invoiceNumber', 'Invoice Number')}
                              value={invoiceNumber}
                              readOnly
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Deposit balance - only show when deposit is selected */}
                  {selectedPaymentMethods.has('deposit') && (
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
                                  ? `Patient portion (${insuranceInfo.patientRate}%)`
                                  : t('fullPatientPayment', 'Full patient payment (100%)')
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
                          selectedPaymentMethods.has('cash')
                            ? calculateChange(receivedCash, paymentAmount)
                            : (parseFloat(deductedAmount || '0') - parseFloat(paymentAmount || '0')).toFixed(2)
                        }
                        className={`${styles.restInput} ${styles.readOnlyInput} ${
                          (selectedPaymentMethods.has('cash') &&
                            parseFloat(calculateChange(receivedCash, paymentAmount)) < 0) ||
                          (selectedPaymentMethods.has('deposit') &&
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
