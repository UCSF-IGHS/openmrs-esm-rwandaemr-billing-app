import { type ConsommationItem } from '../types';
import { isItemPaid } from '../utils/billing-calculations';

export interface StoredPayment {
  paid: boolean;
  partiallyPaid?: boolean;
  paidAmount?: number;
  timestamp?: string;
}

export const getStoredPayment = (patientServiceBillId: string): StoredPayment | null => {
  try {
    const paymentKey = `payment_${patientServiceBillId}`;
    const stored = sessionStorage.getItem(paymentKey);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to retrieve payment from sessionStorage:', e);
    return null;
  }
};

export const setStoredPayment = (patientServiceBillId: string, data: StoredPayment): void => {
  try {
    const paymentKey = `payment_${patientServiceBillId}`;
    sessionStorage.setItem(paymentKey, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save payment to sessionStorage:', e);
  }
};

export const isActuallyPaid = (
    item: ConsommationItem,
    clientSidePaidItems: Record<string, boolean>
  ): boolean => {
    if (item.patientServiceBillId && clientSidePaidItems[item.patientServiceBillId]) {
      return true;
    }
  
    const storedPayment = getStoredPayment(item.patientServiceBillId.toString());
    if (storedPayment?.paid) {
      return true;
    }
  
    return isItemPaid(item);
  };

export const hasPaidItems = (
  selectedItems: ConsommationItem[],
  clientSidePaidItems: Record<string, boolean>
): boolean => {
  return selectedItems.some(item => isActuallyPaid(item, clientSidePaidItems));
};
