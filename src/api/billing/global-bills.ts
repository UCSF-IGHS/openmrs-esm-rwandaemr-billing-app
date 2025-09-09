import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';
import type { GlobalBill, GlobalBillSummary, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

export type GlobalBillResponse = ApiResponse<GlobalBill>;

/**
 * Search patients by query string (name, identifier, etc).
 * Returns an array of patient objects (with uuid, display, etc).
 */
export async function searchPatients(query: string): Promise<any[]> {
  if (!query) return [];
  try {
    const url = `/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=default&limit=10`;
    const { data } = await openmrsFetch(url);
    return Array.isArray(data?.results) ? data.results : [];
  } catch (e) {
    return [];
  }
}

/**
 * Resolve a single patient UUID from a query string.
 * If exactly one patient matches, returns its uuid; else returns undefined.
 */
export async function resolveSinglePatientUuid(query: string): Promise<string | undefined> {
  const results = await searchPatients(query);
  if (results.length === 1) return results[0].uuid;
  return undefined;
}

/**
 * Fetch global bills by patient query (searches patient, then fetches global bills for matching patients).
 * Returns paginated/enriched results as in fetchRecentGlobalBills.
 */
export const fetchGlobalBillsByPatientQuery = async (params: {
  query: string;
  limit?: number;
  page?: number;
  includeTotals?: boolean;
}) => {
  const { query, limit = 10, page = 1, includeTotals = false } = params || {};
  const patients = await searchPatients(query);
  if (!patients.length) {
    return { results: [], totalCount: 0, hasNext: false, nextStartIndex: undefined };
  }
  const startIndex = Math.max(0, (page - 1) * limit);
  const pagedPatients = patients.slice(startIndex, startIndex + limit);
  const billsArrays = await Promise.all(
    pagedPatients.map(async (p) => {
      try {
        const resp = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${p.uuid}&v=full`);
        return Array.isArray(resp?.data?.results) ? resp.data.results : [];
      } catch {
        return [];
      }
    }),
  );
  const raw = billsArrays.flat();
  if (!includeTotals) {
    return {
      results: raw,
      totalCount: raw.length,
      hasNext: false,
      nextStartIndex: undefined,
    };
  }
  const enriched = await Promise.all(
    raw.map(async (gb: any) => {
      const globalBillId = gb?.globalBillId ?? gb?.id ?? gb?.uuid;
      const policyNumber = gb?.policyNumber ?? gb?.admission?.insurancePolicy?.insuranceCardNo ?? gb?.insuranceCardNo;
      const admissionDate = gb?.admissionDate ?? gb?.admission?.admissionDate ?? gb?.createdDate ?? gb?.dateCreated;
      const billIdentifier = gb?.billIdentifier ?? gb?.identifier ?? gb?.billId;
      let dueAmount = 0;
      let paidAmount = 0;
      let status: string | undefined = gb?.status;
      try {
        const totals = await fetchConsommationTotals(globalBillId);
        dueAmount = totals.dueAmount ?? 0;
        paidAmount = totals.paidAmount ?? 0;
        status = gb?.closed ? 'CLOSED' : totals.status || status || 'OPEN';
      } catch (_) {
        dueAmount = Number(gb?.globalAmount ?? 0);
        paidAmount = 0;
        status = gb?.closed ? 'CLOSED' : status || 'OPEN';
      }
      return {
        globalBillId,
        billIdentifier,
        patientName: getPatientNameFromGlobalBill(gb),
        policyNumber,
        admissionDate,
        dueAmount,
        paidAmount,
        status,
        closed: Boolean(gb?.closed),
      };
    }),
  );
  return {
    results: enriched,
    totalCount: enriched.length,
    hasNext: false,
    nextStartIndex: undefined,
  };
};

/**
 * Fetch global bills by insurance policy ID (insuranceCardNo).
 * Returns paginated/enriched results as in fetchRecentGlobalBills.
 */
export const fetchGlobalBillsByPolicyId = async (params: {
  policyId: string;
  limit?: number;
  page?: number;
  includeTotals?: boolean;
}) => {
  const { policyId, limit = 10, page = 1, includeTotals = false } = params || {};
  const qs = new URLSearchParams();
  qs.set('ipCardNumber', policyId);
  qs.set('insuranceCardNo', policyId);
  qs.set('limit', String(limit));
  qs.set('startIndex', String(Math.max(0, (page - 1) * limit)));
  qs.set('orderBy', 'admissionDate');
  qs.set('orderDirection', 'desc');
  qs.set('fallbackOrderBy', 'createdDate');
  qs.set('fallbackDirection', 'desc');
  const url = `${BASE_API_URL}/globalBill?${qs.toString()}&v=full`;
  const response = await openmrsFetch(url);
  const data: any = response?.data || { results: [] };
  const raw: any[] = Array.isArray(data?.results) ? data.results : [];
  const nextStartIndex = parseNextStartIndex(data?.links);
  const paging = {
    hasNext: typeof nextStartIndex === 'number',
    nextStartIndex,
  };
  if (!includeTotals) {
    return {
      results: raw,
      totalCount: (data?.totalCount ?? data?.size ?? raw.length) as number,
      ...paging,
    };
  }
  const enriched = await Promise.all(
    raw.map(async (gb: any) => {
      const globalBillId = gb?.globalBillId ?? gb?.id ?? gb?.uuid;
      const policyNumber = gb?.policyNumber ?? gb?.admission?.insurancePolicy?.insuranceCardNo ?? gb?.insuranceCardNo;
      const admissionDate = gb?.admissionDate ?? gb?.admission?.admissionDate ?? gb?.createdDate ?? gb?.dateCreated;
      const billIdentifier = gb?.billIdentifier ?? gb?.identifier ?? gb?.billId;
      let dueAmount = 0;
      let paidAmount = 0;
      let status: string | undefined = gb?.status;
      try {
        const totals = await fetchConsommationTotals(globalBillId);
        dueAmount = totals.dueAmount ?? 0;
        paidAmount = totals.paidAmount ?? 0;
        status = gb?.closed ? 'CLOSED' : totals.status || status || 'OPEN';
      } catch (_) {
        dueAmount = Number(gb?.globalAmount ?? 0);
        paidAmount = 0;
        status = gb?.closed ? 'CLOSED' : status || 'OPEN';
      }
      return {
        globalBillId,
        billIdentifier,
        patientName: getPatientNameFromGlobalBill(gb),
        policyNumber,
        admissionDate,
        dueAmount,
        paidAmount,
        status,
        closed: Boolean(gb?.closed),
      };
    }),
  );
  return {
    results: enriched,
    totalCount: (data?.totalCount ?? data?.size ?? enriched.length) as number,
    ...paging,
  };
};

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

/**
 * Reverts a global bill to unpaid status
 * @param globalBillId - The global bill ID to revert
 * @param reason - The reason for reverting the bill
 * @returns Promise with the updated global bill data
 */
export const revertGlobalBill = async (globalBillId: string | number, reason: string = 'Bill reverted by user') => {
  return errorHandler.wrapAsync(
    async () => {
      const res = await openmrsFetch(`${BASE_API_URL}/globalBill/${globalBillId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      // If openmrsFetch exposes ok/status, prefer that; otherwise rely on thrown errors
      // @ts-ignore
      if (typeof res.ok !== 'undefined' && !res.ok) {
        // @ts-ignore
        const msg = (res?.data && (res.data.error?.message || res.data.message)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return res.data;
    },
    { component: 'billing-api', action: 'revertGlobalBill', metadata: { globalBillId, reason } },
    commonErrorMessages.saveError,
  );
};

/**
 * Lists recent global bills with pagination and optional date range filters.
 * Supports: startDate, endDate, limit, startIndex
 */
function parseNextStartIndex(links: any[] | undefined) {
  const next = (links || []).find((l: any) => l?.rel === 'next' && typeof l?.uri === 'string');
  if (!next) return undefined;
  try {
    const u = new URL(next.uri);
    const si = u.searchParams.get('startIndex');
    return si ? Number(si) : undefined;
  } catch {
    return undefined;
  }
}

export const fetchRecentGlobalBills = async (params: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  startIndex?: number;
  includeTotals?: boolean;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  fallbackOrderBy?: string;
  fallbackDirection?: 'asc' | 'desc';
}) => {
  const {
    startDate,
    endDate,
    includeTotals = false,
    orderBy: _orderBy,
    orderDirection: _orderDirection,
    fallbackOrderBy: _fallbackOrderBy,
    fallbackDirection: _fallbackDirection,
  } = params || {};
  let url: string;
  if (!startDate && !endDate) {
    url = `${BASE_API_URL}/globalBill`;
  } else {
    const qs = new URLSearchParams();
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    qs.set('orderBy', String(params?.orderBy ?? 'admissionDate'));
    qs.set('orderDirection', String(params?.orderDirection ?? 'desc'));
    qs.set('fallbackOrderBy', String(params?.fallbackOrderBy ?? 'createdDate'));
    qs.set('fallbackDirection', String(params?.fallbackDirection ?? 'desc'));
    url = `${BASE_API_URL}/globalBill?${qs.toString()}`;
  }
  const response = await openmrsFetch(url);
  const data: any = response?.data || { results: [] };
  const raw: any[] = Array.isArray(data?.results) ? data.results : [];

  const nextStartIndex = parseNextStartIndex(data?.links);
  const paging = {
    hasNext: typeof nextStartIndex === 'number',
    nextStartIndex,
  };

  if (!includeTotals) {
    return {
      results: raw,
      totalCount: (data?.totalCount ?? data?.size ?? raw.length) as number,
      ...paging,
    };
  }

  const enriched = await Promise.all(
    raw.map(async (gb: any) => {
      const globalBillId = gb?.globalBillId ?? gb?.id ?? gb?.uuid;
      const policyNumber = gb?.policyNumber ?? gb?.admission?.insurancePolicy?.insuranceCardNo ?? gb?.insuranceCardNo;
      const admissionDate = gb?.admissionDate ?? gb?.admission?.admissionDate ?? gb?.createdDate ?? gb?.dateCreated;
      const billIdentifier = gb?.billIdentifier ?? gb?.identifier ?? gb?.billId;

      let dueAmount = 0;
      let paidAmount = 0;
      let status: string | undefined = gb?.status;
      try {
        const totals = await fetchConsommationTotals(globalBillId);
        dueAmount = totals.dueAmount ?? 0;
        paidAmount = totals.paidAmount ?? 0;
        status = gb?.closed ? 'CLOSED' : totals.status || status || 'OPEN';
      } catch (_) {
        dueAmount = Number(gb?.globalAmount ?? 0);
        paidAmount = 0;
        status = gb?.closed ? 'CLOSED' : status || 'OPEN';
      }

      return {
        globalBillId,
        billIdentifier,
        patientName: getPatientNameFromGlobalBill(gb),
        policyNumber,
        admissionDate,
        dueAmount,
        paidAmount,
        status,
        closed: Boolean(gb?.closed),
      };
    }),
  );

  return {
    results: enriched,
    totalCount: (data?.totalCount ?? data?.size ?? enriched.length) as number,
    ...paging,
  };
};

/**
 * Computes Due and Paid totals for a Global Bill by summarizing consommations.
 * Falls back gracefully if the payload is partial.
 */
export const fetchConsommationTotals = async (
  globalBillId: string | number,
): Promise<{ dueAmount: number; paidAmount: number; status?: string }> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const url = `${BASE_API_URL}/consommation?globalBillId=${globalBillId}&v=full`;
        const { data } = await openmrsFetch(url);

        const results: any[] = (data && (data as any).results) || [];

        const totalBilled = results.reduce((sum, cons: any) => {
          const items: any[] = cons?.billItems || [];
          const sub = items.reduce((s, it) => {
            const qty = Number(it?.quantity ?? 0);
            const price = Number(it?.unitPrice ?? 0);
            return s + qty * price;
          }, 0);
          return sum + sub;
        }, 0);

        const totalPaid = results.reduce((sum, cons: any) => {
          const pb = cons?.patientBill;
          const payments: any[] = pb?.payments || [];
          const paid = payments.reduce((s, p) => s + Number(p?.amountPaid ?? 0), 0);
          return sum + paid;
        }, 0);

        const status: string | undefined = (() => {
          const first = results.find(Boolean);
          return first?.paymentStatus || first?.patientBill?.status;
        })();

        const patientBillTotals = results
          .map((r) => Number(r?.patientBill?.amount ?? 0))
          .filter((v) => !Number.isNaN(v) && v > 0);
        const referenceTotal = patientBillTotals.length ? patientBillTotals.reduce((a, b) => a + b, 0) : totalBilled;

        const dueAmount = Math.max(0, referenceTotal - totalPaid);
        return { dueAmount, paidAmount: totalPaid, status };
      },
      { component: 'billing-api', action: 'fetchConsommationTotals', metadata: { globalBillId } },
      commonErrorMessages.fetchError,
    ) || { dueAmount: 0, paidAmount: 0 }
  );
};

/**
 * Helper to extract a human-friendly patient name from a GlobalBill payload.
 */
export const getPatientNameFromGlobalBill = (bill: any): string => {
  const byOwner = bill?.admission?.insurancePolicy?.owner?.display as string | undefined;
  if (byOwner) {
    const parts = byOwner.split(' - ');
    if (parts.length > 1) return parts[1];
    return byOwner;
  }
  return bill?.beneficiaryName || bill?.patientName || bill?.patient?.display || bill?.patient?.name || '--';
};

/**
 * Fetch a single page of global bills using startIndex-based pagination.
 * This makes exactly ONE request. It assumes the backend returns items
 * already sorted newest→oldest (see Resource change), so page=1 shows newest.
 */
export const fetchGlobalBillsPage = async (params: { limit?: number; page?: number; includeTotals?: boolean }) => {
  const { limit = 10, page = 1, includeTotals = false } = params || {};
  const resp = await fetchRecentGlobalBills({ includeTotals });
  const all = Array.isArray(resp.results) ? resp.results : [];
  const start = Math.max(0, (page - 1) * limit);
  const sliced = all.slice(start, start + limit);
  return {
    results: sliced,
    totalCount: all.length,
    hasNext: start + limit < all.length,
    nextStartIndex: start + limit < all.length ? start + limit : undefined,
  };
};
