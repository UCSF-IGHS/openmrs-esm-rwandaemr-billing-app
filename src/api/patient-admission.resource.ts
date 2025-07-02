import useSWR, { mutate } from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';

const BASE_API_URL = '/ws/rest/v1/mohbilling';

// Interfaces for admission data
export interface Admission {
  admissionId: number;
  uuid: string;
  patient: {
    uuid: string;
    display: string;
    person: {
      display: string;
    };
  };
  isAdmitted: boolean;
  admissionDate: string;
  dischargingDate: string | null;
  admissionType: number; // 1 for Ordinary, 2 for DCP
  diseaseType: {
    uuid: string;
    display: string;
  };
  insurancePolicy: {
    insurancePolicyId: number;
    owner: {
      uuid: string;
      display: string;
    };
    insuranceCardNo: string;
    insurance: {
      insuranceId: number;
      name: string;
    };
  };
  globalBill: {
    globalBillId: number;
    billIdentifier: string;
    closed: boolean;
  };
  createdDate: string;
  creator: {
    uuid: string;
    display: string;
  };
}

export interface AdmissionDisplay {
  id: string;
  uuid: string;
  patientName: string;
  billIdentifier: string;
  insuranceName: string;
  cardNumber: string;
  admissionType: string;
  admissionDate: string;
  admissionTypeDetail: string;
  globalBillId: string;
  isClosed: boolean;
}

export interface AdmissionsResponse {
  admissions: Array<AdmissionDisplay>;
  isLoading: boolean;
  error: Error | null;
  isValidating: boolean;
  mutate: () => void;
}

/**
 * Helper function to extract insurance policy ID from the response
 * @param policyResponse - The response from the policy endpoint
 * @returns The policy ID if found, null otherwise
 */
const extractInsurancePolicyId = (policyResponse: any): number | null => {
  try {
    if (policyResponse?.results && policyResponse.results.length > 0) {
      const policy = policyResponse.results[0];

      // First check if policy has insurancePolicyId property
      if (policy.insurancePolicyId) {
        return policy.insurancePolicyId;
      }

      // If not, try to extract from links
      if (policy.links && policy.links.length > 0) {
        const selfLink = policy.links.find((link) => link.rel === 'self');
        if (selfLink && selfLink.uri) {
          const matches = selfLink.uri.match(/\/insurancePolicy\/(\d+)/);
          if (matches && matches[1]) {
            return parseInt(matches[1]);
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting insurance policy ID:', error);
    return null;
  }
};

/**
 * Hook to fetch disease types from concept dictionary
 * @returns Disease types with uuid and display properties
 */
export function useDiseaseType() {
  const config = useConfig();
  const diseaseTypeConceptUuid = config.diseaseType.diseaseTypeConcept;
  const url = `${restBaseUrl}/concept/${diseaseTypeConceptUuid}?v=custom:(answers:(uuid,display))`;

  const { data, error, isLoading } = useSWR<{ data }>(url, openmrsFetch);

  return {
    diseaseType: data?.data.answers ?? [],
    error,
    isLoading,
  };
}

/**
 * Custom hook to fetch patient admissions using the globalBill endpoint
 * @param patientUuid The patient UUID
 * @returns Patient admission data with loading and error states
 */
export const usePatientAdmissions = (patientUuid: string): AdmissionsResponse => {
  // Using the globalBill endpoint since the admission endpoint returns empty
  const apiUrl = `${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`;

  const { data, error, isValidating, mutate } = useSWR<{ data: any }>(patientUuid ? apiUrl : null, openmrsFetch, {
    errorRetryCount: 2,
    revalidateOnFocus: true,
  });

  // Map the global bill data to the AdmissionDisplay interface
  const mapAdmissions = (rawData): Array<AdmissionDisplay> => {
    if (!rawData?.results || !Array.isArray(rawData.results)) {
      return [];
    }

    return rawData.results.map((bill): AdmissionDisplay => {
      // Map admission type (numeric) to string representation
      const admissionTypeMap = {
        1: 'Ordinary Admission',
        2: 'DCP Admission',
      };

      // Extract data from the global bill's admission information
      const admission = bill.admission || {};
      const insurancePolicy = admission?.insurancePolicy || {};
      const insurance = bill.insurance || insurancePolicy.insurance || {};
      const admissionType = admission?.admissionType || 1;
      const patient = admission?.patient || {};

      return {
        id: bill.globalBillId?.toString() || '',
        uuid: bill.uuid || '',
        patientName: patient?.person?.display || insurancePolicy?.owner?.display || '',
        billIdentifier: bill.billIdentifier || '',
        insuranceName: insurance?.name || '',
        cardNumber: insurancePolicy?.insuranceCardNo || '',
        admissionType: admissionTypeMap[admissionType] || `Type ${admissionType}`,
        admissionDate: admission.admissionDate || bill.createdDate || '',
        admissionTypeDetail: admission?.diseaseType?.display || 'Ordinary Clinic',
        globalBillId: bill.globalBillId?.toString() || '',
        isClosed: bill.closed || false,
      };
    });
  };

  return {
    admissions: data ? mapAdmissions(data.data) : [],
    isLoading: !error && !data,
    error: error,
    isValidating,
    mutate,
  };
};

/**
 * Fetches insurance policy details by card number
 * Also extracts the policy ID from the links if not directly available
 * @param insuranceCardNumber - The insurance card number
 * @returns Promise with insurance policy details including policy ID
 */
export const getInsurancePolicyByCardNumber = async (insuranceCardNumber: string): Promise<any> => {
  try {
    const response = await openmrsFetch(
      `${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNumber}&v=full`,
    );

    if (response.data?.results && response.data.results.length > 0) {
      const policy = response.data.results[0];

      if (!policy.insurancePolicyId && policy.links && policy.links.length > 0) {
        const selfLink = policy.links.find((link) => link.rel === 'self');
        if (selfLink && selfLink.uri) {
          const matches = selfLink.uri.match(/\/insurancePolicy\/(\d+)/);
          if (matches && matches[1]) {
            policy.insurancePolicyId = parseInt(matches[1]);
          }
        }
      }
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching insurance policy:', error);
    throw error;
  }
};

/**
 * Checks if a patient has any open global bills (where closed = false)
 * @param patientUuid - The patient's UUID
 * @returns Promise with open global bill or null if none exists
 */
export const checkOpenGlobalBills = async (patientUuid: string): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`);

    if (response.data?.results && response.data.results.length > 0) {
      const openGlobalBill = response.data.results.find((bill) => bill.closed === false);
      return openGlobalBill || null;
    }

    return null;
  } catch (error) {
    console.error('Error checking open global bills:', error);
    return null;
  }
};

/**
 * Creates a global bill directly using the exact payload format required by the API:
 * {
 *   "admission": {
 *     "admissionDate": "2025-04-24T10:25:47.000+0000",
 *     "insurancePolicy": {
 *       "insurancePolicyId": 28999
 *     },
 *     "admissionType": 1
 *   }
 * }
 * @param data - Insurance policy ID, admission date, and type
 */
export const createDirectGlobalBill = async (data: any): Promise<any> => {
  try {
    if (data.patientUuid) {
      const openGlobalBill = await checkOpenGlobalBills(data.patientUuid);
      if (openGlobalBill) {
        return openGlobalBill;
      }
    }

    const payload = {
      admission: {
        admissionDate: data.admissionDate?.toISOString(),
        insurancePolicy: {
          insurancePolicyId: data.insurancePolicyId,
        },
        admissionType: data.admissionType || 1,
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
    console.error('Error creating direct global bill:', error);
    throw error;
  }
};

/**
 * Creates an admission with a linked global bill in one operation
 * @param data - Combined data for admission and global bill
 */
export const createAdmissionWithGlobalBill = async (data: any): Promise<any> => {
  try {
    let insurancePolicyId = data.insurancePolicyId;

    if (!insurancePolicyId && data.insuranceCardNumber) {
      try {
        const policyResponse = await getInsurancePolicyByCardNumber(data.insuranceCardNumber);
        insurancePolicyId = extractInsurancePolicyId(policyResponse);
      } catch (err) {
        console.error('Error getting policy ID from card number:', err);
      }
    }

    if (!insurancePolicyId) {
      throw new Error('Insurance policy ID is required for global bill creation');
    }

    if (data.patientUuid) {
      const openGlobalBill = await checkOpenGlobalBills(data.patientUuid);
      if (openGlobalBill) {
        return { globalBill: openGlobalBill };
      }
    }

    const globalBill = await createDirectGlobalBill({
      patientUuid: data.patientUuid,
      admissionDate: data.admissionDate,
      insurancePolicyId: insurancePolicyId,
      admissionType: data.admissionType,
    });

    // Return the global bill
    const swrKey = `${BASE_API_URL}/insurancePolicy?patient=${data.patientUuid}&v=full`;
    mutate(swrKey);
    return {
      globalBill,
    };
  } catch (error) {
    console.error('Error creating admission with global bill:', error);
    throw error;
  }
};

/**
 * Fetches global bills by patient UUID
 * @param patientUuid - The patient's UUID
 */
export const getGlobalBillsByPatient = async (patientUuid: string): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`);
    return response.data;
  } catch (error) {
    console.error('Error fetching global bills by patient:', error);
    throw error;
  }
};

/**
 * Fetches a specific global bill by identifier
 * @param billIdentifier - The bill identifier
 */
export const getGlobalBillByIdentifier = async (billIdentifier: string): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}&v=full`);
    return response.data;
  } catch (error) {
    console.error('Error fetching global bill by identifier:', error);
    throw error;
  }
};

/**
 * Creates a discharge for the specified admission
 * @param admissionId The admission ID to discharge
 * @param dischargeDate The discharge date
 * @returns Promise with discharge result
 */
export const dischargePatient = async (admissionId: string, dischargeDate: Date): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/admission/${admissionId}/discharge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { dischargeDate: dischargeDate.toISOString() },
    });

    return response.data;
  } catch (error) {
    console.error('Error discharging patient:', error);
    throw error;
  }
};

/**
 * Fetches patient visits within a specified date range
 * @param patientUuid - The patient's UUID
 * @param fromDate - The start date to check for visits (optional)
 * @param toDate - The end date to check for visits (optional)
 * @returns Promise with patient visits data
 */
export const getPatientVisits = async (patientUuid: string, fromDate?: Date, toDate?: Date): Promise<any> => {
  try {
    let url = `${restBaseUrl}/visit?patient=${patientUuid}&includeInactive=false&v=full`;

    if (fromDate) {
      url += `&fromStartDate=${fromDate.toISOString()}`;
    }

    if (toDate) {
      url += `&toStartDate=${toDate.toISOString()}`;
    }

    const response = await openmrsFetch(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching patient visits:', error);
    throw error;
  }
};
