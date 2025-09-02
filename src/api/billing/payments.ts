import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG, HTTP_STATUS } from '../../constants';
import type { PatientBill, BillPaymentRequest, BillPaymentResponse, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

export type PatientBillResponse = ApiResponse<PatientBill>;

/**
 * Fetches patient bills with optional date filtering
 * @param startDate - Start date for filtering
 * @param endDate - End date for filtering
 * @param startIndex - Starting index for pagination
 * @param limit - Number of items per page
 * @returns Promise with patient bills data
 */
export const getPatientBills = async (
  startDate: string,
  endDate: string,
  startIndex: number = 0,
  limit: number = 20,
): Promise<PatientBillResponse> => {
  const response = await openmrsFetch<PatientBillResponse>(`${BASE_API_URL}/patientBill?limit=${limit}`);
  return response.data;
};

/** Fetch a single patient bill by ID with full details (including payments) */
export const getPatientBillById = async (patientBillId: number | string): Promise<PatientBill> => {
  const url = `${BASE_API_URL}/patientBill/${patientBillId}?v=full`;
  const response = await openmrsFetch<PatientBill>(url);
  return response.data as unknown as PatientBill;
};

/**
 * Fetch recent patient bills and hydrate each with its full details (payments etc.)
 * Falls back gracefully if any detail call fails.
 */
export const getPatientBillsDetailed = async (
  startDate: string,
  endDate: string,
  startIndex: number = 0,
  limit: number = 20,
): Promise<PatientBillResponse> => {
  const summary = await getPatientBills(startDate, endDate, startIndex, limit);
  const results = await Promise.all(
    (summary.results || []).map(async (b: any) => {
      try {
        const full = await getPatientBillById(b.patientBillId);
        return { ...b, ...full };
      } catch {
        return b;
      }
    }),
  );
  return { ...summary, results } as PatientBillResponse;
};

/**
 * Submits a bill payment
 * @param paymentData - The payment data to submit
 * @returns Promise with the payment response
 */
export const submitBillPayment = async (paymentData: BillPaymentRequest): Promise<BillPaymentResponse> => {
  try {
    let amountPaidAsString: string;
    if (typeof paymentData.amountPaid === 'string') {
      amountPaidAsString = parseFloat(paymentData.amountPaid).toFixed(2);
    } else {
      amountPaidAsString = paymentData.amountPaid.toFixed(2);
    }

    const validatedPaidItems = paymentData.paidItems.map((item) => ({
      ...item,
      paidQty: Math.floor(item.paidQty),
    }));

    const payloadWithStringAmount = {
      ...paymentData,
      amountPaid: amountPaidAsString,
      paidItems: validatedPaidItems,
    };

    let jsonPayload = JSON.stringify(payloadWithStringAmount);

    jsonPayload = jsonPayload.replace(/"amountPaid":"(\d+\.\d+)"/, '"amountPaid":$1');

    const response = await openmrsFetch<BillPaymentResponse>(`${BASE_API_URL}/billPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: jsonPayload,
    });

    if (response.status >= 400) {
      throw new Error(`Payment failed with status ${response.status}`);
    }

    return response.data;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'submitBillPayment' },
      commonErrorMessages.saveError,
    );
    throw error;
  }
};

/**
 * Creates a simple patient bill with only amount and isPaid properties
 *
 * @param amount - Initial amount for the bill (defaults to 0)
 * @param isPaid - Payment status (defaults to false)
 * @returns Promise with the created patient bill
 */
export const createSimplePatientBill = async (amount: number = 0, isPaid: boolean = false): Promise<PatientBill> => {
  return errorHandler.wrapAsync(
    async () => {
      const patientBillPayload = {
        amount: amount,
        isPaid: isPaid,
      };

      const response = await openmrsFetch<PatientBill>(`${BASE_API_URL}/patientBill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientBillPayload),
      });

      if (response.status >= HTTP_STATUS.BAD_REQUEST) {
        throw new Error(`API returned status ${response.status}`);
      }

      return response.data;
    },
    { component: 'billing-api', action: 'createSimplePatientBill', metadata: { amount, isPaid } },
    commonErrorMessages.saveError,
  );
};
