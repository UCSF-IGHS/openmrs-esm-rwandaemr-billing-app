import { openmrsFetch } from '@openmrs/esm-framework';
import dayjs from 'dayjs';

const BASE_API_URL = '/ws/rest/v1/mohbilling';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

export interface Department {
  departmentId: number;
  name: string;
  description: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface DepartmentResponse {
  results: Array<Department>;
}

export const getDepartments = async (): Promise<Array<Department>> => {
  const response = await openmrsFetch<DepartmentResponse>(`${BASE_API_URL}/department`);
  return response.data.results;
};

export interface HopService {
  serviceId: number;
  name: string;
  description: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface ServiceResponse {
  results: Array<HopService>;
}

export const getServices = async (): Promise<Array<HopService>> => {
  const response = await openmrsFetch<ServiceResponse>(`${BASE_API_URL}/hopService`);
  return response.data.results;
};

export interface FacilityServicePrice {
  facilityServicePriceId: number;
  name: string;
  shortName: string;
  description: string;
  category: string;
  fullPrice: number;
  itemType: number;
  hidden: boolean;
  concept?: {
    uuid: string;
    display: string;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  };
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

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

export interface Insurance {
  insuranceId: number;
  name: string;
  address: string;
  phone: string;
  category: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface InsuranceResponse {
  results: Array<Insurance>;
}

export const getInsurances = async (): Promise<Array<Insurance>> => {
  const response = await openmrsFetch<InsuranceResponse>(`${BASE_API_URL}/insurance`);
  return response.data.results;
};

export interface ThirdParty {
  thirdPartyId: number;
  name: string;
  rate: number;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface ThirdPartyResponse {
  results: Array<ThirdParty>;
}

export const getThirdParties = async (): Promise<Array<ThirdParty>> => {
  const response = await openmrsFetch<ThirdPartyResponse>(`${BASE_API_URL}/thirdParty`);
  return response.data.results;
};

export async function fetchGlobalBillsByInsuranceCard(insuranceCardNumber: string) {
  try {
    const response = await openmrsFetch(
      `${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNumber}&v=full`,
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch data');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching global bills:', error);
    throw new Error(error.message || 'An unknown error occurred');
  }
}

export interface PatientBill {
  patientBillId: number;
  amount: number;
  createdDate: string;
  status: string | null;
  voided: boolean;
  payments: Array<{
    amountPaid: number;
    dateReceived: string;
    collector: {
      uuid: string;
      display: string;
    };
  }>;
  phoneNumber: string | null;
  transactionStatus: string | null;
  paymentConfirmedBy: any | null;
  paymentConfirmedDate: string | null;
  creator: string;
  departmentName: string;
  policyIdNumber: string;
  beneficiaryName: string;
  insuranceName: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface PatientBillResponse {
  results: Array<PatientBill>;
}

export const getPatientBills = async (
  startDate: string,
  endDate: string,
  startIndex: number = 0,
  limit: number = 20,
): Promise<PatientBillResponse> => {
  const response = await openmrsFetch<PatientBillResponse>(
    `${BASE_API_URL}/patientBill?startDate=${startDate}&endDate=${endDate}&startIndex=${startIndex}&limit=${limit}&orderBy=createdDate&order=desc`,
  );
  return response.data;
};

export interface GlobalBill {
  globalBillId: number;
  billIdentifier: string;
  globalAmount: number;
  createdDate: string;
  closingDate: string | null;
  closed: boolean;
  closingReason: string;
  admission: {
    insurancePolicy: {
      insuranceCardNo: string;
      owner: {
        display: string;
      };
    };
    admissionDate: string;
    dischargingDate: string | null;
  };
  creator: {
    display: string;
  };
}

export interface GlobalBillResponse {
  results: Array<GlobalBill>;
}

export const getGlobalBillByIdentifier = async (billIdentifier: string): Promise<GlobalBillResponse> => {
  const response = await openmrsFetch<GlobalBillResponse>(
    `${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}`,
  );
  return response.data;
};

export interface Consommation {
  consommationId: number;
  department: {
    departmentId: number;
    name: string;
    description: string;
  };
  billItems: Array<{
    serviceDate: string;
    unitPrice: number;
    quantity: number;
    paidQuantity: number;
    paid: boolean;
    serviceOther: string | null;
    serviceOtherDescription: string | null;
    drugFrequency: string;
    itemType: number;
    links?: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  }>;
  patientBill: {
    patientBillId: number;
    amount: number;
    createdDate: string;
    payments: Array<{
      amountPaid: number;
      dateReceived: string;
      collector: {
        uuid: string;
        display: string;
      };
    }>;
    creator: string;
    departmentName: string;
    policyIdNumber: string;
    beneficiaryName: string;
    insuranceName: string;
  };
  insuranceBill: {
    amount: number;
    creator: {
      person: {
        display: string;
      };
    };
    createdDate: string;
  };
}

export const getConsommationById = async (consommationId: string): Promise<Consommation> => {
  const response = await openmrsFetch<Consommation>(`${BASE_API_URL}/consommation/${consommationId}`);
  return response.data;
};

/**
 * Extracts a meaningful service name from a bill item
 * @param {object} billItem - The bill item from the API
 * @param {string} departmentName - The department name for fallback
 * @returns {string} The service name to display
 */
function extractServiceName(billItem, departmentName = 'Unknown') {
  if (billItem.hopService && billItem.hopService.name) {
    return billItem.hopService.name;
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
 * @param consommationId - The ID of the consommation to fetch items for
 * @returns Promise containing the items for the specified consommation
 */
export async function getConsommationItems(consommationId: string) {
  try {
    // Fetch the specific consommation data
    const consommationData = await getConsommationById(consommationId);

    // Ensure we have a department name, defaulting to 'Unknown' if not provided
    const departmentName = consommationData.department?.name || 'Unknown Department';

    // Map bill items to a more detailed and user-friendly format
    const items = consommationData.billItems.map((item, index) => {
      // Extract the most detailed service name possible
      const itemName = extractServiceDetailedName(item, departmentName);

      // Calculate total and payment-related values
      const itemTotal = item.quantity * item.unitPrice;
      const paidAmount = item.paidQuantity ? item.paidQuantity * item.unitPrice : item.paid ? itemTotal : 0;
      const remainingAmount = Math.max(0, itemTotal - paidAmount);

      // Determine payment status
      const isFullyPaid = item.paid || remainingAmount <= 0;
      const isPartiallyPaid = !isFullyPaid && paidAmount > 0;

      // Create a detailed item object
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
        selected: false,
      };
    });

    return items;
  } catch (error) {
    console.error('Error fetching consommation items:', {
      consommationId,
      errorMessage: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export interface ConsommationListItem {
  consommationId: number;
  createdDate: string;
  service: string;
  createdBy: string;
  insuranceCardNo: string;
  insuranceDue: number;
  thirdPartyDue: number;
  patientDue: number;
  paidAmount: number;
  status: string;
}

export interface ConsommationListResponse {
  results: Array<ConsommationListItem>;
  totalDueAmount: number;
  totalPaidAmount: number;
}

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
  try {
    const response = await openmrsFetch(`/ws/rest/v1/mohbilling/globalBill?patient=${patientUuid}&v=full`);
    return response.data || { results: [] };
  } catch (error) {
    console.error('Error fetching global bills by patient UUID:', error);
    throw error;
  }
};

export interface GlobalBillSummary {
  total: number;
  closed: number;
  open: number;
}

export const getGlobalBillSummary = async (): Promise<GlobalBillSummary> => {
  const response = await openmrsFetch<GlobalBillSummary>(`${BASE_API_URL}/globalBill/summary`);
  return response.data;
};

export interface BillPaymentItem {
  billItem: {
    patientServiceBillId: number;
  };
  paidQty: number;
}

export interface BillPaymentRequest {
  amountPaid: number | string;
  patientBill: {
    patientBillId: number;
  };
  dateReceived: string;
  collector: {
    uuid: string;
  };
  paidItems: BillPaymentItem[];
}

export interface BillPaymentResponse {
  billPaymentId: number;
  amountPaid: number;
  dateReceived: string;
  status: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}
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
    console.error('Payment submission error:', error);
    throw error;
  }
};
//   globalBillId: number;
//   departmentId: number;
//   billItems: Array<{
//     serviceId: number;
//     quantity: number;
//     unitPrice: number;
//     drugFrequency?: string;
//     itemType: number;
//   }>;
//   patientBill: {
//     amount: number;
//     createdDate: string;
//     creator: string;
//     departmentName: string;
//     policyIdNumber: string;
//     beneficiaryName: string;
//     insuranceName: string;
//   };
//   insuranceBill: {
//     amount: number;
//     creator: {
//       person: {
//         display: string;
//       };
//     };
//     createdDate: string;
//   };
// }

// export const createConsommation = async (consommationData: ConsommationRequest): Promise<Consommation> => {
//   try {
//     const response = await openmrsFetch<Consommation>(`${BASE_API_URL}/consommation`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Accept': 'application/json',
//       },
//       body: JSON.stringify(consommationData),
//     });

//     if (response.status >= 400) {
//       throw new Error(`Failed to create consommation with status ${response.status}`);
//     }

//     return response.data;
//   } catch (error) {
//     console.error('Error creating consommation:', error);
//     throw error;
//   }
// };

/**
 * Creates bill items (PatientServiceBill entities) directly
 *
 * Based on the API errors and structure, it seems the consommation workflow requires:
 * 1. Bill items to be created directly
 * 2. These seem to be automatically associated with the appropriate global bill
 *
 * @param {number} globalBillId - The global bill ID
 * @param {number} departmentId - The department ID
 * @param {Array} items - The bill items
 * @returns {Promise<Object>} - Result of the operation with created items
 */
export const createBillItems = async (globalBillId: number, departmentId: number, items: Array<any>): Promise<any> => {
  try {
    // Create bill items directly with minimal but sufficient data
    const createdItems = [];
    const currentDate = new Date().toISOString();

    for (const item of items) {
      try {
        const billItemData = {
          // Direct reference to the required fields based on API structure
          globalBillId: globalBillId,
          departmentId: departmentId,
          facilityServicePriceId: item.facilityServicePriceId,
          quantity: item.quantity,
          unitPrice: item.price || item.unitPrice,
          drugFrequency: item.drugFrequency || '',
          serviceDate: currentDate,
        };

        const response = await openmrsFetch(`${BASE_API_URL}/patientServiceBill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(billItemData),
        });

        createdItems.push(response.data);
      } catch (error) {
        console.error('Failed to create bill item:', error);
        // Continue with next item instead of stopping
      }
    }

    if (createdItems.length === 0) {
      throw new Error('Failed to create any bill items');
    }

    return {
      success: true,
      count: createdItems.length,
      totalExpected: items.length,
      items: createdItems,
    };
  } catch (error) {
    console.error('Error creating bill items:', error);
    throw error;
  }
};

function extractServiceDetailedName(item: any, departmentName: string): string {
  try {
    if (item.service?.facilityServicePrice?.name) {
      return item.service.facilityServicePrice.name;
    }

    if (item.service?.name) {
      return item.service.name;
    }

    if (item.serviceOtherDescription) {
      return item.serviceOtherDescription;
    }

    if (item.serviceOther) {
      return item.serviceOther;
    }

    return `${departmentName} Service Item`;
  } catch (error) {
    console.warn('Error extracting service name:', {
      error: error.message,
      item,
    });
    return `${departmentName} Service Item`;
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

    return 10372855 + index;
  } catch (error) {
    console.warn('Error extracting patient service bill ID:', {
      error: error.message,
      item,
    });
    return 10372855 + index;
  }
}

export async function fetchInsuranceFirms() {
  const params = new URLSearchParams({ report_id: 'insurance_firm_report' });

  const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);
  return data.results.map((item) => {
    const record = item.record;
    const idObj = record.find((i) => i.column === 'insurance_id');
    const nameObj = record.find((i) => i.column === 'name');
    return {
      value: idObj?.value,
      label: nameObj?.value,
    };
  });
}

export async function fetchInsuranceReport(
  startDate: string,
  endDate: string,
  insuranceId: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = dayjs(startDate).format('YYYY-MM-DD');
  const formattedEnd = dayjs(endDate).format('YYYY-MM-DD');

  const params = new URLSearchParams({
    report_id: 'insurance_bill',
    insurance_identifier: insuranceId,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);
  return {
    results: data.results || [],
    total: data.pagination?.totalRecords || 0,
  };
}
