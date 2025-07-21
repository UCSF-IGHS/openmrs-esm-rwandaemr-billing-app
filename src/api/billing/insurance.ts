import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';
import type { Insurance, User, ThirdParty, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

// Type definitions
export type InsuranceResponse = ApiResponse<Insurance>;
export type UserResponse = ApiResponse<User>;
export type ThirdPartyResponse = ApiResponse<ThirdParty>;

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

/**
 * Fetches all third parties
 * @returns Promise containing array of third parties
 */
export const getThirdParties = async (): Promise<Array<ThirdParty>> => {
  const response = await openmrsFetch<ThirdPartyResponse>(`${BASE_API_URL}/thirdParty`);
  return response.data.results;
};

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
        errorHandler.handleWarning(
          'Insurance data retrieved but rate is undefined',
          { insuranceData: response.data },
          { component: 'billing-api', action: 'getInsuranceById' },
        );
        return response.data;
      }
    }

    errorHandler.handleWarning(
      'Failed to retrieve insurance data',
      { response },
      { component: 'billing-api', action: 'getInsuranceById' },
    );
    return null;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getInsuranceById', metadata: { insuranceId } },
      { title: `Error fetching insurance ID ${insuranceId}`, kind: 'error' },
    );
    return null;
  }
};

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
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getInsurancePolicyByCardNumber', metadata: { insuranceCardNumber } },
      { title: 'Error fetching insurance policy by card number', kind: 'error' },
    );
    throw error;
  }
};

/**
 * Fetches global bills by insurance card number
 * @param insuranceCardNumber - The insurance card number
 * @returns Promise with global bills data
 */
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

/**
 * Fetches insurance policies by patient UUID
 * @param patientUuid - The patient UUID
 * @returns Promise containing array of insurance policies
 */
export const getInsurancePoliciesByPatient = async (patientUuid: string): Promise<any[]> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?patient=${patientUuid}`);
    return response.data?.results || [];
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getInsurancePoliciesByPatient', metadata: { patientUuid } },
      { title: `Failed to fetch insurance policies for patient ${patientUuid}`, kind: 'error' },
    );
    return [];
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
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'findBeneficiaryByPolicyNumber', metadata: { insurancePolicyNumber } },
      { title: `Error finding beneficiary for policy number ${insurancePolicyNumber}`, kind: 'error' },
    );
    return null;
  }
};
