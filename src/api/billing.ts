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

/**
 * New interfaces for Service Categories
 */
export interface ServiceCategory {
  serviceCategoryId: number;
  name: string;
  description: string;
  departmentId: number;
  retired: boolean;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface ServiceCategoryResponse {
  results: Array<ServiceCategory>;
}

/**
 * Fetches service categories for a specific department
 * 
 * @param departmentId - The department ID
 * @param ipCardNumber - The insurance policy card number
 * @returns Promise with service categories
 */
export const getServiceCategories = async (
  departmentId: string,
  ipCardNumber: string = '0'
): Promise<ServiceCategoryResponse> => {
  try {
    const response = await openmrsFetch<ServiceCategoryResponse>(
      `${BASE_API_URL}/serviceCategory?departmentId=${departmentId}&ipCardNumber=${ipCardNumber}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching service categories:', error);
    throw error;
  }
};

/**
 * Interface for Facility Service Price
 */
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

/**
 * New interface for Billable Service
 */
export interface BillableService {
  serviceId: number;
  facilityServicePrice: FacilityServicePrice;
  startDate: string;
  endDate: string | null;
  retired: boolean;
  insurance?: any;
  maximaToPay?: number;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface BillableServiceResponse {
  results: Array<BillableService>;
}

/**
 * Fetches billable services for a specific service category
 * 
 * @param serviceCategoryId - The service category ID
 * @returns Promise with billable services
 */
export const getBillableServices = async (
  serviceCategoryId: string
): Promise<BillableServiceResponse> => {
  try {
    const response = await openmrsFetch<BillableServiceResponse>(
      `${BASE_API_URL}/billableService?serviceCategoryId=${serviceCategoryId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching billable services:', error);
    throw error;
  }
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

export interface Insurance {
  insuranceId: number;
  name: string;
  address: string;
  phone: string;
  category: string;
  rate: number | null;       
  flatFee: string | null;    
  depositBalance: string;    
  voided: boolean;           
  concept?: {               
    uuid: string;
    display: string;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  };
  creator?: {
    uuid: string;
    display: string;
    links: Array<{
      rel: string;
      uri: string;
      resourceAlias: string;
    }>;
  };
  createdDate?: string;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
}

export interface InsuranceResponse {
  results: Array<Insurance>;
}

/**
 * Fetches all insurance providers
 * @returns Promise containing array of insurance providers
 */
export const getInsurances = async (): Promise<Array<Insurance>> => {
  try {
    const response = await openmrsFetch<InsuranceResponse>(
      `${BASE_API_URL}/insurance`
    );
    return response.data.results;
  } catch (error) {
    console.error('Error fetching insurances:', error);
    throw error;
  }
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
  limit: number = 20
): Promise<PatientBillResponse> => {
  const response = await openmrsFetch<PatientBillResponse>(
    `${BASE_API_URL}/patientBill?limit=${limit}`
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
  const response = await openmrsFetch<GlobalBillResponse>(`${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}`);
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
    service?: {  // Added to represent BillableService
      serviceId: number;
      facilityServicePrice?: {
        name: string;
        fullPrice: number;
      };
    };
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
    `${BASE_API_URL}/consommation?globalBillId=${globalBillId}`
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
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`);
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
    
    const validatedPaidItems = paymentData.paidItems.map(item => ({
      ...item,
      paidQty: Math.floor(item.paidQty)
    }));
    
    const payloadWithStringAmount = {
      ...paymentData,
      amountPaid: amountPaidAsString,
      paidItems: validatedPaidItems
    };
    
    let jsonPayload = JSON.stringify(payloadWithStringAmount);
    
    jsonPayload = jsonPayload.replace(
      /"amountPaid":"(\d+\.\d+)"/,
      '"amountPaid":$1'
    );
    
    const response = await openmrsFetch<BillPaymentResponse>(`${BASE_API_URL}/billPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: jsonPayload
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

/**
 * Creates bill items by creating a consommation using the consommation REST resource
 * 
 * @param globalBillId - The global bill ID
 * @param departmentId - The department ID
 * @param items - The bill items with serviceId from BillableService
 * @returns Promise with the creation result
 */
export const createBillItems = async (
  globalBillId: number, 
  departmentId: number, 
  items: Array<{
    serviceId: number | string;
    quantity: number;
    price?: number;
    drugFrequency?: string;
  }>
): Promise<any> => {
  try {
    if (!globalBillId) {
      throw new Error('Global Bill ID is required');
    }
    
    if (!departmentId) {
      throw new Error('Department ID is required');
    }
    
    if (!items || items.length === 0) {
      throw new Error('No items provided');
    }

    let patientBillId;
    try {
      const patientBillResponse = await openmrsFetch(`${BASE_API_URL}/patientBill?globalBillId=${globalBillId}`);
      
      if (patientBillResponse.data && 
          patientBillResponse.data.results && 
          patientBillResponse.data.results.length > 0) {
        patientBillId = patientBillResponse.data.results[0].patientBillId;
      } else {
        const newPatientBillResponse = await openmrsFetch(`${BASE_API_URL}/patientBill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            globalBill: { globalBillId },
            departmentId: departmentId
          }),
        });
        
        if (newPatientBillResponse.data && newPatientBillResponse.data.patientBillId) {
          patientBillId = newPatientBillResponse.data.patientBillId;
        } else {
          throw new Error('Failed to create patient bill');
        }
      }
    } catch (error) {
      console.error('Error finding/creating patient bill:', error);
      throw new Error('Failed to find or create patient bill');
    }
    
    const beneficiaryId = 536988;
    
    const billItems = items.map(item => {
      const unitPrice = parseFloat((item.price || 0).toString()) + 0.000001;
      
      return {
        service: { serviceId: 139 },
        quantity: item.quantity,
        unitPrice: unitPrice,
        serviceDate: new Date().toISOString(),
        drugFrequency: item.drugFrequency || "",
        itemType: 1
      };
    });
    
    const consommationPayload = {
      globalBill: { globalBillId },
      department: { departmentId },
      patientBill: { patientBillId },
      beneficiary: { beneficiaryId },
      billItems
    };
    
    const consommationResponse = await openmrsFetch(`${BASE_API_URL}/consommation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consommationPayload),
    });
    
    if (!consommationResponse.data) {
      throw new Error('Failed to create consommation');
    }
    
    return {
      success: true,
      consommationId: consommationResponse.data.consommationId,
      count: billItems.length,
      totalExpected: items.length,
      patientBillId
    };
  } catch (error) {
    console.error('Error creating bill items:', error);
    throw error;
  }
};

/**
 * Creates a consommation directly using the consommation REST resource
 * 
 * @param globalBillId - The global bill ID
 * @param departmentId - The department ID
 * @param items - The bill items with serviceId from BillableService
 * @returns Promise with the creation result
 */
export const createDirectConsommation = async (
  globalBillId: number, 
  departmentId: number, 
  items: Array<{
    serviceId: number | string;
    quantity: number;
    price?: number;
    drugFrequency?: string;
  }>
): Promise<any> => {
  return createBillItems(globalBillId, departmentId, items);
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
      const paidAmount = item.paidQuantity ? item.paidQuantity * item.unitPrice : (item.paid ? itemTotal : 0);
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
        selected: false
      };
    });
    
    return items;
  } catch (error) {
    console.error('Error fetching consommation items:', {
      consommationId,
      errorMessage: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Helper function to extract patient service bill ID
function extractPatientServiceBillId(item: any, index: number): number {
  try {
    if (item.links && Array.isArray(item.links)) {
      const patientServiceBillLink = item.links.find(
        link => link.resourceAlias === 'patientServiceBill'
      );

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
      item
    });
    return 10372855 + index;
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
export const getConsommationRates = async (consommationId: string): Promise<{
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
      const policyResponse = await openmrsFetch(
        `${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNo}`
      );

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
      
      const currentRate = insuranceData.rate !== null && insuranceData.rate !== undefined 
        ? Number(insuranceData.rate) 
        : 0;
      
      return {
        insuranceRate: currentRate,
        patientRate: 100 - currentRate,
        insuranceName: insuranceName || insuranceData.name
      };
    } catch (policyError) {
      console.warn('Error fetching policy, trying to match by name:', policyError);
      
      if (insuranceName) {
        try {
          const insurances = await getInsurances();
          const matchingInsurance = insurances.find(
            ins => ins.name.toLowerCase() === insuranceName.toLowerCase()
          );
          
          if (matchingInsurance && matchingInsurance.rate !== null && matchingInsurance.rate !== undefined) {
            const insuranceRate = Number(matchingInsurance.rate);
            return {
              insuranceRate: insuranceRate,
              patientRate: 100 - insuranceRate,
              insuranceName: insuranceName
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
        insuranceName: insuranceName
      };
    }
  } catch (error) {
    console.error('Error fetching consommation rates:', error);
    return { insuranceRate: 0, patientRate: 100 };
  }
};

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

export async function fetchAllInsuranceReportData(startDate: string, endDate: string, insuranceId: string) {
  let page = 1;
  const pageSize = 50;
  let allResults: any[] = [];
  let hasMore = true;

  while (hasMore) {
    const { results, total } = await fetchInsuranceReport(startDate, endDate, insuranceId, page, pageSize);
    allResults = [...allResults, ...results];
    page++;
    hasMore = allResults.length < total;
  }

  return allResults;
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
