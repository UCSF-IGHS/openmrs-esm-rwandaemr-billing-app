import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';
import type { HopService, ServiceCategory, BillableService, FacilityServicePrice, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

// Type definitions
export type ServiceResponse = ApiResponse<HopService>;
export type ServiceCategoryResponse = ApiResponse<ServiceCategory>;
export type BillableServiceResponse = ApiResponse<BillableService>;

export interface FacilityServicePriceResponse {
  results: Array<FacilityServicePrice>;
}

export interface PaginatedFacilityServicePriceResponse extends FacilityServicePriceResponse {
  links?: Array<{ rel: string; uri: string }>;
  totalCount?: number;
}

/**
 * Fetches all services
 * @returns Promise containing array of services
 */
export const getServices = async (): Promise<Array<HopService>> => {
  const response = await openmrsFetch<ServiceResponse>(`${BASE_API_URL}/hopService`);
  return response.data.results;
};

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

/**
 * Fetches facility service prices with pagination
 *
 * @param startIndex - Starting index for pagination
 * @param limit - Number of items per page
 * @returns Promise with paginated facility service prices
 */
export const getFacilityServicePrices = async (
  startIndex: number = 0,
  limit: number = 20,
): Promise<PaginatedFacilityServicePriceResponse> => {
  const response = await openmrsFetch<PaginatedFacilityServicePriceResponse>(
    `${BASE_API_URL}/facilityServicePrice?startIndex=${startIndex}&limit=${limit}`,
  );
  return response.data;
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

      errorHandler.handleWarning(
        'No serviceId found in billable service response',
        { billableService },
        { component: 'billing-api', action: 'getBillableServiceId' }
      );
      return null;
    } else {
      errorHandler.handleWarning(
        'No billable services found for the selected combination',
        { serviceCategoryId, facilityServicePriceId },
        { component: 'billing-api', action: 'getBillableServiceId' }
      );
      return null;
    }
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getBillableServiceId', metadata: { serviceCategoryId, facilityServicePriceId } },
      { title: 'Error fetching billable service', kind: 'error' }
    );
    return null;
  }
};
