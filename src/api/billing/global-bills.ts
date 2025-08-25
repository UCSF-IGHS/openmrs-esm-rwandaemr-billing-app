import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';
import type { GlobalBill, GlobalBillSummary, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

// Type definitions
export type GlobalBillResponse = ApiResponse<GlobalBill>;

/**
 * Fetches global bill by identifier
 * @param billIdentifier - The bill identifier
 * @returns Promise with global bill data
 */
export const getGlobalBillByIdentifier = async (billIdentifier: string): Promise<GlobalBillResponse> => {
  const response = await openmrsFetch<GlobalBillResponse>(
    `${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}`,
  );
  return response.data;
};

/**
 * Fetches global bill by ID
 * @param globalBillId - The global bill ID
 * @returns Promise with global bill data
 */
export const getGlobalBillById = async (globalBillId: string | number) => {
  return errorHandler.wrapAsync(
    async () => {
      const response = await openmrsFetch(`${BASE_API_URL}/globalBill/${globalBillId}?v=full`);
      return response.data;
    },
    { component: 'billing-api', action: 'getGlobalBillById', metadata: { globalBillId } },
    commonErrorMessages.fetchError,
  );
};

/**
 * Fetches global bills by patient UUID
 *
 * @param patientUuid - The patient UUID
 * @returns Promise with the API response data
 */
export const fetchGlobalBillsByPatient = async (patientUuid: string) => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`);
        return response.data || { results: [] };
      },
      { component: 'billing-api', action: 'fetchGlobalBillsByPatient', metadata: { patientUuid } },
      commonErrorMessages.fetchError,
    ) || { results: [] }
  );
};

/**
 * Fetches global bill summary statistics
 * @returns Promise with global bill summary data
 */
export const getGlobalBillSummary = async (): Promise<GlobalBillSummary> => {
  const response = await openmrsFetch<GlobalBillSummary>(`${BASE_API_URL}/globalBill/summary`);
  return response.data;
};

/**
 * Creates a global bill directly using the required payload format
 * @param globalBillData - Object containing details for global bill creation
 * @returns Promise with the created global bill
 */
export const createDirectGlobalBill = async (globalBillData: {
  admissionDate: Date;
  insurancePolicyId: number;
  admissionType: number;
}): Promise<any> => {
  try {
    const payload = {
      admission: {
        admissionDate: globalBillData.admissionDate.toISOString(),
        insurancePolicy: {
          insurancePolicyId: globalBillData.insurancePolicyId,
        },
        admissionType: globalBillData.admissionType || 1,
      },
    };

    const response = await openmrsFetch(`${BASE_API_URL}/globalBill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.data;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'createDirectGlobalBill', metadata: { globalBillData } },
      { title: 'Error creating global bill', kind: 'error' },
    );
    throw error;
  }
};

/**
 * Closes a global bill
 * @param globalBillId - The global bill ID to close
 * @param closingReason - The reason for closing the bill
 * @param paymentStatus - Optionally specify payment status ('FULLY PAID', 'PARTIALLY PAID', 'UNPAID')
 * @returns Promise with the updated global bill data
 */
export const closeGlobalBill = async (
  globalBillId: string | number,
  closingReason: string = 'Bill closed by user',
  paymentStatus?: 'FULLY PAID' | 'PARTIALLY PAID' | 'UNPAID',
) => {
  return errorHandler.wrapAsync(
    async () => {
      const makePayload = (includePaymentStatus: boolean) => ({
        closed: true,
        closingReason: closingReason,
        closingDate: new Date().toISOString(),
        ...(includePaymentStatus && paymentStatus ? { paymentStatus } : {}),
      });

      const postOnce = async (includePaymentStatus: boolean) => {
        const payload: any = makePayload(includePaymentStatus);
        const res = await openmrsFetch(`${BASE_API_URL}/globalBill/${globalBillId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // If openmrsFetch exposes ok/status, prefer that; otherwise rely on thrown errors
        // Some implementations still return data on non-2xx – guard here
        // @ts-ignore
        if (typeof res.ok !== 'undefined' && !res.ok) {
          // @ts-ignore
          const msg = (res?.data && (res.data.error?.message || res.data.message)) || `HTTP ${res.status}`;
          throw new Error(msg);
        }
        return res.data;
      };

      return postOnce(true).catch((e: any) => {
        if (paymentStatus) {
          return postOnce(false);
        }
        throw e;
      });
    },
    { component: 'billing-api', action: 'closeGlobalBill', metadata: { globalBillId, closingReason, paymentStatus } },
    commonErrorMessages.saveError,
  );
};
