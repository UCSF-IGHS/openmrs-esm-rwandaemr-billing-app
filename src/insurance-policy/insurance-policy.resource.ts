import { formatDate, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { InsurancePolicy, InsurancePolicyRecord, InsurancePolicyUpdatePayload } from '../types';

interface MappedInsurancePolicy {
  insuranceCardNo: string;
  coverageStartDate: string;
  expirationDate: string;
  ownerName: string;
  ownerUuid: string;
  gender: string;
  age: number;
  patientName: string;
  patientUuid: string;
  insurance: string;
  insuranceId: number;
  birthdate: string;
  insurancePolicyNo: string;
}

const mapInsurancePolicyProperties = (policy: InsurancePolicy): MappedInsurancePolicy => {
  return {
    insuranceCardNo: policy.insuranceCardNo,
    coverageStartDate: formatDate(new Date(policy.coverageStartDate)),
    patientName: policy.owner.person.preferredName.display,
    patientUuid: policy.owner.person.uuid,
    expirationDate: formatDate(new Date(policy.expirationDate)),
    ownerName: policy.owner.person.display,
    ownerUuid: policy.owner.uuid,
    gender: policy.owner.person.gender,
    age: policy.owner.person.age,
    insurance: policy.insurance.name,
    insuranceId: policy.insurance.insuranceId,
    birthdate: formatDate(new Date(policy.owner.person.birthdate)),
    insurancePolicyNo: policy.insurancePolicyId ?? '--',
  };
};

export const useInsurancePolicy = (
  startDate?: string,
  endDate?: string,
  searchTerm?: string,
  pagesize?: number,
  page?: number,
) => {
  const startIndex = page - 1;

  const url = `/ws/rest/v1/mohbilling/insurancePolicy?v=full&totalCount=true&limit=${pagesize}&startIndex=${startIndex}`;
  const urlWithSearchTerm = `/ws/rest/v1/mohbilling/insurancePolicy?v=full&totalCount=true&limit=${pagesize}&startIndex=${startIndex}&insuranceCardNo=${searchTerm}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    data: { results: Array<InsurancePolicy>; totalCount };
  }>(searchTerm ? urlWithSearchTerm : url, openmrsFetch);

  const mappedResults = data?.data.results?.map((policy) => {
    return mapInsurancePolicyProperties(policy);
  });

  return {
    data: mappedResults ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
    totalCount: data?.data.totalCount ?? 0,
  };
};

export const updateInsurancePolicy = async (insurancePolicy: InsurancePolicyUpdatePayload, policyId) => {
  const url = `/ws/rest/v1/mohbilling/insurancePolicy/${policyId}`;
  const response = await openmrsFetch(url, {
    method: 'POST',
    body: JSON.stringify(insurancePolicy),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to update insurance policy');
  }

  return response.json();
};
