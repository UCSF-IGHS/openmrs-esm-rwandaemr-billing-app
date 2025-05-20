import { formatDate, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR from 'swr';
import type { InsurancePolicy } from '../types';
import { useEffect, useState } from 'react';
import useSWRInfinite from 'swr';

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

export const useInsurancePolicy = (startDate: string, endDate: string, pagesize: number, page: number) => {
  const startIndex = page - 1;

  const url = `/ws/rest/v1/mohbilling/insurancePolicy?v=full&totalCount=true&limit=${pagesize}&startIndex=${startIndex}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    data: { results: Array<InsurancePolicy>; totalCount };
  }>(url, openmrsFetch);

  const mappedResults = data?.data.results?.map((policy) => mapInsurancePolicyProperties(policy));

  return {
    data: mappedResults ?? [],
    error,
    isLoading,
    isValidating,
    mutate,
    totalCount: data?.data.totalCount ?? 0,
  };
};
