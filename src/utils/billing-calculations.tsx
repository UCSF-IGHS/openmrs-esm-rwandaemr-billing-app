/**
 * Billing Calculations Helper Functions
 *
 */

import { getConsommationItems } from '../api/billing';
import { type ConsommationItem } from '../types';

/**
 * Enhanced isItemPaid function with more robust payment status detection
 * @param {ConsommationItem} item - The item to check
 * @returns {boolean} True if the item is fully paid
 */
export const isItemPaid = (item: ConsommationItem): boolean => {
  // PRIMARY check: Check if payment amount equals or exceeds the total
  const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
  const paidAmount = item.paidAmount || 0;

  if (paidAmount >= itemTotal) {
    return true;
  }

  if (item.paid === true) {
    return true;
  }

  return false;
};

/**
 * Enhanced isItemPartiallyPaid function with more robust detection
 * @param {ConsommationItem} item - The item to check
 * @returns {boolean} True if the item is partially paid
 */
export const isItemPartiallyPaid = (item: ConsommationItem): boolean => {
  if (isItemPaid(item)) {
    return false;
  }

  if (item.partiallyPaid === true) {
    return true;
  }

  const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
  const paidAmount = item.paidAmount || 0;

  if (paidAmount > 0 && paidAmount < itemTotal) {
    return true;
  }

  if (
    item.paidQuantity !== undefined &&
    item.paidQuantity > 0 &&
    item.quantity !== undefined &&
    item.paidQuantity < item.quantity
  ) {
    return true;
  }

  return false;
};

/**
 * Calculates the remaining due amount
 * @param {number} patientDue - The total amount due
 * @param {number} paidAmount - The amount already paid
 * @returns {string} The remaining amount due as a formatted string
 */
export const calculateRemainingDue = (patientDue: number, paidAmount: number): string => {
  const remaining = Math.max(0, patientDue - paidAmount);
  return remaining.toFixed(2);
};

/**
 * Calculates the change amount from a cash payment
 * @param {string} receivedCash - The amount of cash received
 * @param {string} paymentAmount - The payment amount
 * @returns {string} The change amount as a formatted string
 */
export const calculateChange = (receivedCash: string, paymentAmount: string): string => {
  if (!receivedCash || !paymentAmount) return '-1.0';

  const received = parseFloat(receivedCash);
  const payment = parseFloat(paymentAmount);

  if (isNaN(received) || isNaN(payment) || received < payment) {
    return '-1.0';
  }

  return (received - payment).toFixed(2);
};

/**
 * Calculates the total of selected items that can be paid
 * @param {ConsommationItem[]} items - The array of items
 * @returns {number} The total amount for selected and unpaid items
 */
export const calculateSelectedItemsTotal = (items: ConsommationItem[]): number => {
  return items
    .filter((item) => item.selected && !isItemPaid(item))
    .reduce((sum, item) => {
      // For partially paid items, only count the remaining amount
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const paidAmount = item.paidAmount || 0;
      const amountToAdd = Math.max(0, itemTotal - paidAmount);
      return sum + amountToAdd;
    }, 0);
};

/**
 * Calculates the total remaining amount for all unpaid items
 * @param {ConsommationItem[]} items - The array of items
 * @returns {number} The total remaining amount for all unpaid items
 */
export const calculateTotalRemainingAmount = (items: ConsommationItem[]): number => {
  return items
    .filter((item) => !isItemPaid(item))
    .reduce((sum, item) => {
      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const paidAmount = item.paidAmount || 0;
      return sum + Math.max(0, itemTotal - paidAmount);
    }, 0);
};

/**
 * Checks if all selected items are paid
 * @param {ConsommationItem[]} items - The array of items
 * @returns {boolean} True if all selected items are paid
 */
export const areAllSelectedItemsPaid = (items: ConsommationItem[]): boolean => {
  const selectedItems = items.filter((item) => item.selected);
  return selectedItems.length > 0 && selectedItems.every((item) => isItemPaid(item));
};

/**
 * Gets the CSS class for payment status
 * @param {ConsommationItem} item - The item to check
 * @param {Object} styles - The styles object
 * @returns {string} The CSS class name
 */
export const getStatusClass = (item: ConsommationItem, styles: any): string => {
  if (isItemPaid(item)) {
    return styles.itemPaid;
  } else if (isItemPartiallyPaid(item)) {
    return styles.itemPartiallyPaid;
  } else {
    return styles.itemUnpaid;
  }
};

/**
 * Calculates the total due amount for selected rows
 * @param {Array} rows - The rows data
 * @param {string[]} selectedRows - Array of selected row IDs
 * @returns {number} The total due amount for selected rows
 */
export const calculateTotalDueForSelected = (rows: any[], selectedRows: string[]): number => {
  let total = 0;
  rows.forEach((row) => {
    if (selectedRows.includes(row.id)) {
      const remainingDue = Math.max(0, row.rawPatientDue - row.rawPaidAmount);
      total += remainingDue;
    }
  });
  return Number(total.toFixed(2));
};

export const computePaymentStatus = (item: ConsommationItem): 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' => {
  const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
  const paidAmount = item.paidAmount || 0;

  if (paidAmount >= itemTotal) return 'PAID';
  if (paidAmount > 0 && paidAmount < itemTotal) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

/**
 * Computes payment status for a consommation based on its items
 * @param {ConsommationItem[]} items - Array of consommation items
 * @returns {string} Payment status: 'PAID', 'PARTIALLY_PAID', or 'UNPAID'
 */
export const computeConsommationPaymentStatus = (items: ConsommationItem[]): string => {
  if (!items || items.length === 0) return 'UNPAID';

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.quantity || 1) * (item.unitPrice || 0);
  }, 0);

  const paidAmount = items.reduce((sum, item) => {
    return sum + (item.paidAmount || 0);
  }, 0);

  if (paidAmount >= totalAmount) return 'PAID';
  if (paidAmount > 0 && paidAmount < totalAmount) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

/**
 * Gets the appropriate CSS class for payment status
 * @param {string} status - Payment status
 * @param {Object} styles - The styles object
 * @returns {string} The CSS class name
 */
export const getPaymentStatusClass = (status: string, styles: any): string => {
  switch (status.toUpperCase()) {
    case 'PAID':
      return styles.paidStatus;
    case 'PARTIALLY_PAID':
    case 'PARTIALLY PAID':
      return styles.partiallyPaidStatus;
    case 'UNPAID':
    default:
      return styles.unpaidStatus;
  }
};

/**
 * Gets the appropriate Tag type for payment status
 * @param {string} status - Payment status
 * @returns {string} The Tag type
 */
export const getPaymentStatusTagType = (status: string): 'green' | 'cyan' | 'red' => {
  switch (status.toUpperCase()) {
    case 'PAID':
      return 'green';
    case 'PARTIALLY_PAID':
    case 'PARTIALLY PAID':
      return 'cyan';
    case 'UNPAID':
    default:
      return 'red';
  }
};

export const areAllItemsPaid = async (consommationId: string) => {
  try {
    const items = await getConsommationItems(consommationId);

    if (!items || items.length === 0) {
      return false;
    }

    return items.every((item) => {
      try {
        const paymentKey = `payment_${item.patientServiceBillId}`;
        const storedPayment = JSON.parse(sessionStorage.getItem(paymentKey) || '{}');
        if (storedPayment.paid) {
          return true;
        }
      } catch (e) {
        // Ignore errors
      }

      if (item.paid) {
        return true;
      }

      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
      const paidAmount = item.paidAmount || 0;
      return paidAmount >= itemTotal;
    });
  } catch (error) {
    console.error('Error checking item payment status:', error);
    return false;
  }
};
