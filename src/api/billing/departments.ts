import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';
import type { Department, ApiResponse } from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

// Type definitions
export type DepartmentResponse = ApiResponse<Department>;

/**
 * Fetches all departments
 * @returns Promise containing array of departments
 */
export const getDepartments = async (): Promise<Array<Department>> => {
  const response = await openmrsFetch<DepartmentResponse>(`${BASE_API_URL}/department`);
  return response.data.results;
};
