import { formatDate, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { InsurancePolicy } from '../types';

interface MappedInsurancePolicy {
  insuranceCardNo: string;
  coverageStartDate: string;
  expirationDate: string;
  ownerName: string;
  ownerUuid: string;
  gender: string;
  age: number;
  patientName: string;
  insurance: string;
  birthdate: string;
}

const mapInsurancePolicyProperties = (policy: InsurancePolicy): MappedInsurancePolicy => {
  return {
    insuranceCardNo: policy.insuranceCardNo,
    coverageStartDate: formatDate(new Date(policy.coverageStartDate)),
    expirationDate: formatDate(new Date(policy.expirationDate)),
    ownerName: policy.owner.person.display,
    ownerUuid: policy.owner.uuid,
    gender: policy.owner.person.gender,
    age: policy.owner.person.age,
    patientName: policy.owner.person.preferredName.display,
    insurance: '--',
    birthdate: formatDate(new Date(policy.owner.person.birthdate)),
  };
};

export const useInsurancePolicy = (startDate: string, endDate: string) => {
  const url = `/ws/rest/v1/mohbilling/insurancePolicy?v=full`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ data: { results: Array<InsurancePolicy> } }>(
    url,
    openmrsFetch,
  );

  const mappedResults = data?.data.results?.map((policy) => mapInsurancePolicyProperties(policy));

  return {
    data: mappedResults ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
};
