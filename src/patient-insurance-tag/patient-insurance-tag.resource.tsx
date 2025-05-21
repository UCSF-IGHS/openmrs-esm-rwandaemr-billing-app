import useSWR from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import type { InsurancePolicy } from '../types';
import { BASE_API_URL } from '../constants';

export function usePatientInsurancePolicies(patientUuid: string) {
  const url = `${BASE_API_URL}/insurancePolicy?patient=${patientUuid}&v=full`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    data: { results: Array<InsurancePolicy>; totalCount };
  }>(url, openmrsFetch);

  return {
    data: data?.data.results ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
    totalCount: data?.data.totalCount ?? 0,
  };
}
