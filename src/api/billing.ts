import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import { formatToYMD } from '../billing-reports/utils/download-utils';
import { errorHandler, commonErrorMessages } from '../utils/error-handler';
import { API_CONFIG, BILLING_CONSTANTS, INSURANCE_CONSTANTS, ADMISSION_CONSTANTS, HTTP_STATUS } from '../constants';
import type {
  Department,
  HopService,
  ServiceCategory,
  BillableService,
  FacilityServicePrice,
  Insurance,
  User,
  ThirdParty,
  PatientBill,
  GlobalBill,
  Consommation,
  BillPaymentRequest,
  BillPaymentResponse,
  ConsommationItem,
  ConsommationRates,
  GlobalBillSummary,
  ConsommationListResponse,
  ConsommationStatusResponse,
  ApiResponse,
  PaginatedResponse,
} from './types';

export type {
  Department,
  HopService,
  ServiceCategory,
  BillableService,
  FacilityServicePrice,
  Insurance,
  User,
  ThirdParty,
  PatientBill,
  GlobalBill,
  Consommation,
  BillPaymentRequest,
  BillPaymentResponse,
  ConsommationItem,
  ConsommationRates,
  GlobalBillSummary,
  ConsommationListResponse,
  ConsommationStatusResponse,
  ApiResponse,
  PaginatedResponse,
} from './types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;
const BASE_MAMBA_API = API_CONFIG.BASE_MAMBA_URL;

export type DepartmentResponse = ApiResponse<Department>;

export const getDepartments = async (): Promise<Array<Department>> => {
  const response = await openmrsFetch<DepartmentResponse>(`${BASE_API_URL}/department`);
  return response.data.results;
};

export type ServiceResponse = ApiResponse<HopService>;

export const getServices = async (): Promise<Array<HopService>> => {
  const response = await openmrsFetch<ServiceResponse>(`${BASE_API_URL}/hopService`);
  return response.data.results;
};

export type ServiceCategoryResponse = ApiResponse<ServiceCategory>;

/**
 * Fetches service categories for a specific department
 *
 * @param departmentId - The department ID
 * @param ipCardNumber - The insurance policy card number
 * @returns Promise with service categories
 */
export const getServiceCategories = async (
  departmentId: string,
  ipCardNumber: string = '0',
): Promise<ServiceCategoryResponse> => {
  const handler = errorHandler.createComponentHandler('billing-api');

  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<ServiceCategoryResponse>(
          `${BASE_API_URL}/serviceCategory?departmentId=${departmentId}&ipCardNumber=${ipCardNumber}`,
        );
        return response.data;
      },
      { component: 'billing-api', action: 'getServiceCategories', metadata: { departmentId, ipCardNumber } },
      commonErrorMessages.fetchError,
    ) || { results: [] }
  );
};

export type BillableServiceResponse = ApiResponse<BillableService>;

/**
 * Fetches billable services for a specific service category
 *
 * @param serviceCategoryId - The service category ID
 * @returns Promise with billable services
 */
export const getBillableServices = async (serviceCategoryId: string): Promise<BillableServiceResponse> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<BillableServiceResponse>(
          `${BASE_API_URL}/billableService?serviceCategoryId=${serviceCategoryId}`,
        );
        return response.data;
      },
      { component: 'billing-api', action: 'getBillableServices', metadata: { serviceCategoryId } },
      commonErrorMessages.fetchError,
    ) || { results: [] }
  );
};

// Legacy interface for facility service price - keeping for backward compatibility
export interface FacilityServicePriceResponse {
  results: Array<FacilityServicePrice>;
}

export interface PaginatedFacilityServicePriceResponse extends FacilityServicePriceResponse {
  links?: Array<{ rel: string; uri: string }>;
  totalCount?: number;
}

export const getFacilityServicePrices = async (
  startIndex: number = 0,
  limit: number = 20,
): Promise<PaginatedFacilityServicePriceResponse> => {
  const response = await openmrsFetch<PaginatedFacilityServicePriceResponse>(
    `${BASE_API_URL}/facilityServicePrice?startIndex=${startIndex}&limit=${limit}`,
  );
  return response.data;
};

export type InsuranceResponse = ApiResponse<Insurance>;
export type UserResponse = ApiResponse<User>;

/**
 * Fetches all insurance providers
 * @returns Promise containing array of insurance providers
 */
export const getInsurances = async (): Promise<Array<Insurance>> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<InsuranceResponse>(`${BASE_API_URL}/insurance`);
        return response.data.results;
      },
      { component: 'billing-api', action: 'getInsurances' },
      commonErrorMessages.fetchError,
    ) || []
  );
};

/**
 * Fetches all users/providers who can be collectors
 * @returns Promise containing array of users
 */
export const getUsers = async (): Promise<Array<User>> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<UserResponse>(`${restBaseUrl}/user?v=default`);
        return response.data.results;
      },
      { component: 'billing-api', action: 'getUsers' },
      commonErrorMessages.fetchError,
    ) || []
  );
};

export type ThirdPartyResponse = ApiResponse<ThirdParty>;

export const getThirdParties = async (): Promise<Array<ThirdParty>> => {
  const response = await openmrsFetch<ThirdPartyResponse>(`${BASE_API_URL}/thirdParty`);
  return response.data.results;
};

export async function fetchGlobalBillsByInsuranceCard(insuranceCardNumber: string) {
  return errorHandler.wrapAsync(
    async () => {
      const response = await openmrsFetch(
        `${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNumber}&v=full`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch data');
      }

      return await response.json();
    },
    { component: 'billing-api', action: 'fetchGlobalBillsByInsuranceCard', metadata: { insuranceCardNumber } },
    commonErrorMessages.fetchError,
  );
}

export type PatientBillResponse = ApiResponse<PatientBill>;

export const getPatientBills = async (
  startDate: string,
  endDate: string,
  startIndex: number = 0,
  limit: number = 20,
): Promise<PatientBillResponse> => {
  const response = await openmrsFetch<PatientBillResponse>(`${BASE_API_URL}/patientBill?limit=${limit}`);
  return response.data;
};

export type GlobalBillResponse = ApiResponse<GlobalBill>;

export const getGlobalBillByIdentifier = async (billIdentifier: string): Promise<GlobalBillResponse> => {
  const response = await openmrsFetch<GlobalBillResponse>(
    `${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}`,
  );
  return response.data;
};


export const getConsommationById = async (consommationId: string): Promise<Consommation> => {
  const response = await openmrsFetch<Consommation>(`${BASE_API_URL}/consommation/${consommationId}`);
  return response.data;
};


export const getConsommationsByGlobalBillId = async (globalBillId: string): Promise<ConsommationListResponse> => {
  const response = await openmrsFetch<ConsommationListResponse>(
    `${BASE_API_URL}/consommation?globalBillId=${globalBillId}`,
  );
  return response.data;
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

// GlobalBillSummary interface moved to ./types.ts

export const getGlobalBillSummary = async (): Promise<GlobalBillSummary> => {
  const response = await openmrsFetch<GlobalBillSummary>(`${BASE_API_URL}/globalBill/summary`);
  return response.data;
};

// BillPaymentItem, BillPaymentRequest, and BillPaymentResponse interfaces moved to ./types.ts

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
 * Utility to extract service name from a bill item
 * Updated to work with the new BillableService structure
 */
function extractServiceName(billItem, departmentName = 'Unknown') {
  if (billItem.service && billItem.service.facilityServicePrice && billItem.service.facilityServicePrice.name) {
    return billItem.service.facilityServicePrice.name;
  } else if (billItem.serviceOtherDescription) {
    return billItem.serviceOtherDescription;
  } else if (billItem.serviceOther) {
    return billItem.serviceOther;
  } else {
    return `${departmentName} Service Item`;
  }
}

/**
 * Fetches detailed items for a specific consommation with improved service name display
 * Updated to handle BillableService structure
 * @param consommationId - The ID of the consommation to fetch items for
 * @returns Promise containing the items for the specified consommation
 */
export async function getConsommationItems(consommationId: string) {
  try {
    const consommationData = await getConsommationById(consommationId);

    const departmentName = consommationData.department?.name || 'Unknown Department';

    const items = consommationData.billItems.map((item, index) => {
      const itemName = extractServiceName(item, departmentName);

      const itemTotal = item.quantity * item.unitPrice;
      const paidAmount = item.paidQuantity ? item.paidQuantity * item.unitPrice : item.paid ? itemTotal : 0;
      const remainingAmount = Math.max(0, itemTotal - paidAmount);

      const isFullyPaid = item.paid || remainingAmount <= 0;
      const isPartiallyPaid = !isFullyPaid && paidAmount > 0;

      return {
        itemId: index + 1,
        itemCode: `ITEM-${index + 1}`,
        itemName: itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        serviceDate: item.serviceDate,
        itemType: item.itemType,
        paid: isFullyPaid,
        partiallyPaid: isPartiallyPaid,
        paidQuantity: item.paidQuantity || 0,
        drugFrequency: item.drugFrequency,
        patientServiceBillId: extractPatientServiceBillId(item, index),
        serviceId: item.service?.serviceId,
        selected: false,
      };
    });

    return items;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getConsommationItems', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    );
    throw error;
  }
}

// Helper function to extract patient service bill ID
function extractPatientServiceBillId(item: any, index: number): number {
  try {
    if (item.links && Array.isArray(item.links)) {
      const patientServiceBillLink = item.links.find((link) => link.resourceAlias === 'patientServiceBill');

      if (patientServiceBillLink && patientServiceBillLink.uri) {
        const idMatch = patientServiceBillLink.uri.match(/\/patientServiceBill\/(\d+)/);
        if (idMatch && idMatch[1]) {
          return parseInt(idMatch[1]);
        }
      }
    }

    return BILLING_CONSTANTS.DEFAULT_PATIENT_SERVICE_BILL_ID_BASE + index;
  } catch (error) {
    errorHandler.handleWarning(
      'Error extracting patient service bill ID',
      { error: error.message, item },
      { component: 'billing-api', action: 'extractPatientServiceBillId' },
    );
    return BILLING_CONSTANTS.DEFAULT_PATIENT_SERVICE_BILL_ID_BASE + index;
  }
}

/**
 * Fetches detailed information for a specific insurance by ID
 * @param insuranceId - The ID of the insurance to fetch
 * @returns Promise with the insurance details
 */
export const getInsuranceById = async (insuranceId: number): Promise<Insurance | null> => {
  try {
    const url = `${BASE_API_URL}/insurance/${insuranceId}`;
    const response = await openmrsFetch<Insurance>(url);

    if (response.ok && response.data) {
      if (response.data.rate !== undefined) {
        return response.data;
      } else {
        console.warn('Insurance data retrieved but rate is undefined', response.data);
        return response.data;
      }
    }

    console.warn('Failed to retrieve insurance data', response);
    return null;
  } catch (error) {
    console.error(`Error fetching insurance ID ${insuranceId}:`, error);
    return null;
  }
};

/**
 * Gets the insurance rates for a consommation from its related insurance policy
 * @param {string} consommationId - The consommation ID
 * @returns {Promise<Object>} - The rates object with insurance and patient percentages
 */
export const getConsommationRates = async (
  consommationId: string,
): Promise<{
  insuranceRate: number;
  patientRate: number;
  insuranceName?: string;
}> => {
  try {
    // Get consommation details
    const consommation = await getConsommationById(consommationId);

    if (!consommation?.patientBill?.policyIdNumber) {
      console.warn('Insurance card number not found in consommation');
      return { insuranceRate: 0, patientRate: 100 };
    }

    const insuranceCardNo = consommation.patientBill.policyIdNumber;
    const insuranceName = consommation.patientBill.insuranceName || '';

    try {
      const policyResponse = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNo}`);

      if (!policyResponse.ok || !policyResponse.data?.results?.length) {
        throw new Error(`No insurance policy found for card number: ${insuranceCardNo}`);
      }

      const policy = policyResponse.data.results[0];

      if (!policy.insurance || !policy.insurance.insuranceId) {
        throw new Error('Insurance information missing from policy');
      }

      // Get the insurance details with rate
      const insuranceId = policy.insurance.insuranceId;
      const insuranceData = await getInsuranceById(insuranceId);

      if (!insuranceData) {
        throw new Error(`Failed to fetch insurance details for ID: ${insuranceId}`);
      }

      const currentRate =
        insuranceData.rate !== null && insuranceData.rate !== undefined ? Number(insuranceData.rate) : 0;

      return {
        insuranceRate: currentRate,
        patientRate: 100 - currentRate,
        insuranceName: insuranceName || insuranceData.name,
      };
    } catch (policyError) {
      console.warn('Error fetching policy, trying to match by name:', policyError);

      if (insuranceName) {
        try {
          const insurances = await getInsurances();
          const matchingInsurance = insurances.find((ins) => ins.name.toLowerCase() === insuranceName.toLowerCase());

          if (matchingInsurance && matchingInsurance.rate !== null && matchingInsurance.rate !== undefined) {
            const insuranceRate = Number(matchingInsurance.rate);
            return {
              insuranceRate: insuranceRate,
              patientRate: 100 - insuranceRate,
              insuranceName: insuranceName,
            };
          }
        } catch (err) {
          console.error('Error fetching insurances for fallback:', err);
        }
      }

      // Last resort default
      return {
        insuranceRate: 0,
        patientRate: 100,
        insuranceName: insuranceName,
      };
    }
  } catch (error) {
    console.error('Error fetching consommation rates:', error);
    return { insuranceRate: 0, patientRate: 100 };
  }
};

export async function fetchInsuranceFirms() {
  const params = new URLSearchParams({ report_id: 'insurance_firm_report' });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data?.results || !Array.isArray(data.results)) {
      console.error('Unexpected API response:', data);
      return [];
    }

    return data.results.map((item) => {
      const record = item.record;
      const idObj = record.find((i) => i.column === 'insurance_id');
      const nameObj = record.find((i) => i.column === 'name');

      return {
        value: idObj?.value ?? '',
        label: nameObj?.value ?? 'Unknown',
      };
    });
  } catch (error) {
    console.error('Failed to fetch insurance firms:', error);
    return [];
  }
}

export async function fetchAllInsuranceReportData(startDate: string, endDate: string, insuranceId: string) {
  let page = 1;
  const pageSize = 50;
  let allResults: any[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const { results, total } = await fetchInsuranceReport(startDate, endDate, insuranceId, page, pageSize);
      if (!Array.isArray(results)) {
        console.error('Unexpected results format:', results);
        break;
      }

      allResults = [...allResults, ...results];
      page++;
      hasMore = allResults.length < total;
    }

    return allResults;
  } catch (error) {
    console.error('Failed to fetch insurance report data:', error);
    return [];
  }
}

export async function fetchInsuranceReport(
  startDate: string,
  endDate: string,
  insuranceId: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'insurance_bill',
    insurance_identifier: insuranceId,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data || typeof data !== 'object') {
      console.error('Unexpected API response:', data);
      return {
        results: [],
        total: 0,
      };
    }

    return {
      results: Array.isArray(data.results) ? data.results : [],
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch insurance report page:', error);
    return {
      results: [],
      total: 0,
    };
  }
}

/**
 * Fetches insurance policy details by card number
 * @param insuranceCardNumber - The insurance card number
 * @returns Promise with insurance policy details
 */
export const getInsurancePolicyByCardNumber = async (insuranceCardNumber: string): Promise<any> => {
  try {
    const response = await openmrsFetch(
      `${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNumber}&v=full`,
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching insurance policy by card number:', error);
    throw error;
  }
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
    console.error('Error creating global bill:', error);
    throw error;
  }
};

/**
 * Find a beneficiary ID using insurance policy number (card number)
 *
 * @param insurancePolicyNumber - Insurance policy number (card number)
 * @returns Promise with the beneficiary ID if found, null otherwise
 */
export const findBeneficiaryByPolicyNumber = async (insurancePolicyNumber: string): Promise<number | null> => {
  if (!insurancePolicyNumber) {
    return null;
  }

  try {
    const beneficiaryResponse = await openmrsFetch(
      `${BASE_API_URL}/beneficiary?insurancePolicyNumber=${insurancePolicyNumber}`,
    );

    if (beneficiaryResponse.data && beneficiaryResponse.data.results && beneficiaryResponse.data.results.length > 0) {
      const beneficiary = beneficiaryResponse.data.results[0];
      return beneficiary.beneficiaryId;
    }

    return null;
  } catch (error) {
    console.error(`Error finding beneficiary for policy number ${insurancePolicyNumber}:`, error);
    return null;
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

/**
 * Creates a consommation directly with beneficiary
 * With proper unitPrice handling to ensure Double values
 * Includes client-side workaround to fetch all bill items
 *
 * @param globalBillId - The global bill ID
 * @param departmentId - The department ID
 * @param beneficiaryId - The beneficiary ID
 * @param items - The bill items
 * @returns Promise with the complete consommation including all bill items
 */
export const createDirectConsommationWithBeneficiary = async (
  globalBillId: number,
  departmentId: number,
  beneficiaryId: number,
  items: Array<{
    serviceId?: number | string;
    quantity: number;
    price?: number;
    drugFrequency?: string;
    hopServiceId?: number;
  }>,
): Promise<any> => {
  try {
    let patientBillId;
    try {
      const patientBillResponse = await openmrsFetch(`${BASE_API_URL}/patientBill?globalBillId=${globalBillId}`);

      if (patientBillResponse.data && patientBillResponse.data.results && patientBillResponse.data.results.length > 0) {
        patientBillId = patientBillResponse.data.results[0].patientBillId;
      } else {
        const initialAmount = 0;
        const isPaid = false;

        const newPatientBill = await createSimplePatientBill(initialAmount, isPaid);

        if (!newPatientBill || !newPatientBill.patientBillId) {
          throw new Error('Failed to create patient bill: Invalid response from API');
        }

        patientBillId = newPatientBill.patientBillId;
      }
    } catch (error) {
      console.error('Error getting or creating patient bill:', error);
      throw new Error(`Failed to get or create patient bill: ${error.message}`);
    }

    const billItems = items.map((item) => {
      const unitPrice = parseFloat((item.price || 0).toString()) + 0.000001;
      const serviceIdForPayload = parseInt(item.serviceId?.toString() || '0', 10);

      return {
        service: {
          serviceId: serviceIdForPayload,
        },
        hopService: {
          serviceId: item.hopServiceId || departmentId,
        },
        unitPrice: unitPrice,
        quantity: item.quantity,
        drugFrequency: item.drugFrequency || '',
      };
    });

    const expectedItemCount = billItems.length;
    const consommationPayload = {
      globalBill: { globalBillId },
      department: { departmentId },
      beneficiary: { beneficiaryId },
      patientBill: { patientBillId },
      billItems,
    };

    let response;
    let consommationId;

    try {
      response = await openmrsFetch(`${BASE_API_URL}/consommation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consommationPayload),
      });

      if (!response.ok) {
        console.error('Consommation creation failed:', response);
        throw new Error(`API returned status ${response.status}`);
      }

      consommationId = response.data?.consommationId;
    } catch (error) {
      // Handle the specific paymentStatus serialization error
      const isPaymentStatusError =
        error.message &&
        (error.message.includes('paymentStatus') ||
          error.message.includes('ConversionException') ||
          error.message.includes('NullPointerException'));

      // Also check for 500 status which might indicate backend serialization error
      const isSerializationError = error.status === 500 && error.responseText;

      if (isPaymentStatusError || isSerializationError) {
        errorHandler.handleWarning(
          'Consommation creation likely succeeded but response serialization failed due to paymentStatus issue',
          { error: error.message, status: error.status },
          { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
        );

        // Try to find the most recently created consommation for this global bill
        try {
          const recentConsommationsResponse = await openmrsFetch(
            `${BASE_API_URL}/consommation?globalBillId=${globalBillId}&limit=1&sort=createdDate:desc`,
          );

          if (recentConsommationsResponse.ok && recentConsommationsResponse.data?.results?.length > 0) {
            const recentConsommation = recentConsommationsResponse.data.results[0];
            consommationId = recentConsommation.consommationId;
            errorHandler.handleInfo(
              'Found recently created consommation',
              { consommationId },
              { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
            );
          } else {
            // Try alternative approach - get all consommations for this global bill
            const allConsommationsResponse = await openmrsFetch(
              `${BASE_API_URL}/consommation?globalBillId=${globalBillId}&v=default`,
            );

            if (allConsommationsResponse.ok && allConsommationsResponse.data?.results?.length > 0) {
              // Find the most recent one by sorting by ID (assuming higher IDs are newer)
              const sortedConsommations = allConsommationsResponse.data.results.sort(
                (a, b) => b.consommationId - a.consommationId,
              );
              consommationId = sortedConsommations[0].consommationId;
              errorHandler.handleInfo(
                'Found consommation using alternative method',
                { consommationId },
                { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
              );
            }
          }
        } catch (fetchError) {
          errorHandler.handleError(
            fetchError,
            { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
            { title: 'Failed to fetch recent consommations', kind: 'error' },
          );
        }
      }

      if (!consommationId) {
        console.error('Error creating consommation:', error);
        throw error;
      }
    }

    if (!consommationId) {
      console.error('No consommation ID found in response');
      return {
        ...response?.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: 0,
      };
    }

    try {
      const completeConsommationResponse = await openmrsFetch(`${BASE_API_URL}/consommation/${consommationId}?v=full`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!completeConsommationResponse.ok) {
        console.warn(`Failed to fetch complete consommation: ${completeConsommationResponse.status}`);
        return {
          ...response.data,
          _itemsCount: expectedItemCount,
          _actualItemsReturned: 0,
        };
      }

      const actualItemsReturned = completeConsommationResponse.data.billItems?.length || 0;
      return {
        ...completeConsommationResponse.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: actualItemsReturned,
      };
    } catch (fetchError) {
      console.error('Error fetching complete consommation:', fetchError);
      return {
        ...response.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: 0,
      };
    }
  } catch (error) {
    console.error('Error creating consommation:', error);
    throw error;
  }
};

/**
 * Gets the billable service ID by querying with facilityServicePriceId and serviceCategoryId
 *
 * @param serviceCategoryId - The service category ID
 * @param facilityServicePriceId - The facility service price ID
 * @returns Promise with the billable service ID if found, null otherwise
 */
export const getBillableServiceId = async (
  serviceCategoryId: string | number,
  facilityServicePriceId: string | number,
): Promise<number | null> => {
  try {
    const url = `${BASE_API_URL}/billableService?facilityServicePriceId=${facilityServicePriceId}&serviceCategoryId=${serviceCategoryId}`;
    const response = await openmrsFetch(url);

    if (response.data && response.data.results && response.data.results.length > 0) {
      const billableService = response.data.results[0];

      if (billableService.serviceId !== undefined) {
        return billableService.serviceId;
      }

      console.warn('No serviceId found in billable service response:', billableService);
      return null;
    } else {
      console.warn('No billable services found for the selected combination');
      return null;
    }
  } catch (error) {
    console.error('Error fetching billable service:', error);
    return null;
  }
};

export const getInsurancePoliciesByPatient = async (patientUuid: string): Promise<any[]> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?patient=${patientUuid}`);
    return response.data?.results || [];
  } catch (error) {
    console.error(`Failed to fetch insurance policies for patient ${patientUuid}:`, error);
    return [];
  }
};

/**
 * ConsommationStatusResponse interface moved to ./types.ts
 */

/**
 * Fetches the real-time consommation status from the server using the isPaid flag
 * @param consommationId - The consommation ID to check status for
 * @returns Promise with the consommation status response containing isPaid status
 */
export const getConsommationStatus = async (consommationId: string): Promise<ConsommationStatusResponse | null> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<ConsommationStatusResponse>(
          `${BASE_API_URL}/consommation/${consommationId}?v=custom:(department,billItems,patientBill:(isPaid))`,
        );
        return response.data;
      },
      { component: 'billing-api', action: 'getConsommationStatus', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    ) || null
  );
};

/**
 * Checks if a consommation is paid based on the server-side isPaid flag
 * @param consommationId - The consommation ID to check
 * @returns Promise with boolean indicating if the consommation is paid
 */
export const isConsommationPaid = async (consommationId: string): Promise<boolean> => {
  try {
    const statusResponse = await getConsommationStatus(consommationId);
    return statusResponse?.patientBill?.isPaid === true;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'isConsommationPaid', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    );
    return false;
  }
};

/**
 * Fetches payment status for multiple consommations
 * @param consommationIds - Array of consommation IDs to check
 * @returns Promise with a map of consommation ID to payment status
 */
export const getMultipleConsommationStatuses = async (consommationIds: string[]): Promise<Record<string, boolean>> => {
  const statusPromises = consommationIds.map(async (id) => {
    const isPaid = await isConsommationPaid(id);
    return { id, isPaid };
  });

  try {
    const results = await Promise.all(statusPromises);
    const statusMap: Record<string, boolean> = {};
    results.forEach(({ id, isPaid }) => {
      statusMap[id] = isPaid;
    });
    return statusMap;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getMultipleConsommationStatuses' },
      commonErrorMessages.fetchError,
    );
    return {};
  }
};
