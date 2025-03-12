import { useMemo } from 'react';

// This would come from the API
export function useBillMetrics(bills: Array<any> = []) {
  return useMemo(() => {
    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return {
        cumulativeBills: 0,
        pendingBills: 0,
        paidBills: 0
      };
    }

    // Calculate for all bills....
    const cumulativeBills = bills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
    
    // Calculate pending bills -- incomplete payments
    const pendingBills = bills
      .filter(bill => !bill.paymentConfirmedDate || bill.status !== 'Paid')
      .reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
    
    // Calculate paid --- those with confirmed payments
    const paidBills = bills
      .filter(bill => bill.paymentConfirmedDate && bill.status === 'Paid')
      .reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);

    return {
      cumulativeBills,
      pendingBills,
      paidBills
    };
  }, [bills]);
}

/**
 * Formats a number as RWF currency with thousands separators
 * 
 * @param value - The numeric value to format
 * @param currency - The currency code (defaults to RWF)
 * @returns Formatted currency string
 */
export const formatNumberCurrency = (value: number, currency: string = 'RWF'): string => {
  if (isNaN(value)) return `${currency} 0.00`;
  
  // Format with thousands separator and 2 decimal places
  return `${currency} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};