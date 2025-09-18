import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWR, { mutate } from 'swr';

const BASE_API_URL = '/ws/rest/v1/mohbilling';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

export async function fetchInsuranceFirms() {
  const params = new URLSearchParams({ report_id: 'insurance_firm_report' });

  try {
    //const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);
    const { data } = await openmrsFetch(`${BASE_API_URL}/insurance?v=full`);

    if (!data?.results || !Array.isArray(data.results)) {
      console.error('Unexpected API response:', data);
      return [];
    }

    return data.results.map((item) => {
      return {
        value: item?.insuranceId ?? '',
        label: item?.name ?? 'Unknown',
      };
    });
  } catch (error) {
    console.error('Failed to fetch insurance firms:', error);
    return [];
  }
}

export async function createInsurancePolicy(payload, patientUuid): Promise<any> {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?patient=${patientUuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to create insurance policy';

      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (jsonErr) {
        const errorText = await response.text();
        console.error('Non-JSON error response:', errorText);
        if (errorText.startsWith('<!DOCTYPE')) {
          errorMessage = 'Received unexpected HTML response from server.';
        } else {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    // Return the global bill
    const swrKey = `${BASE_API_URL}/insurancePolicy?patient=${response.data.owner.person.uuid}&v=full`;
    mutate(swrKey);
    return response.json();
  } catch (err) {
    console.error('Error creating insurance policy:', err);
    throw err;
  }
}

export async function fetchInsurancePolicies(patientUuid: string) {
  const response = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?patient=${patientUuid}&v=full`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch insurance policies');
  }

  const data = await response.json();
  return data;
}

export async function loadInsurancePolicies(patientUuid: string) {
  const insurancePolicies = await fetchInsurancePolicies(patientUuid);
  return insurancePolicies;
}

export async function checkInsuranceEligibility(cardNumber: string, insuranceId: string) {
  try {
    const response = await openmrsFetch(
      `${restBaseUrl}/rwandaemr/insurance/eligibility?type=${insuranceId}&identifier=${cardNumber}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      try {
        const errorData = await response.json();
      } catch (jsonErr) {
        const errorText = await response.text();
        console.error('Non-JSON error response:', errorText);
      }
    }

    const data = await response.json();

    return { eligible: data?.responseEntity?.data, message: data?.responseEntity?.message };
  } catch (err) {
    console.error('Error checking insurance eligibility:', err);
    throw err;
  }
}

export function useCheckInsuranceType(type: string) {
  const customRepresentation = 'custom:(uuid,value,property)';

  const { data, error, isLoading } = useSWR<{ data: { results: Array<any> } }, Error>(
    `${restBaseUrl}/systemsetting?q=rwandaemr.insuranceEligibility.${type}&v=${customRepresentation}`,
    openmrsFetch,
  );

  return {
    data: data?.data?.results,
    isLoading,
    error,
  };
}

export function useInsuranceTypes() {
  const cbhiSpecialCase = useCheckInsuranceType('cbhi-special-case');
  const cbhi = useCheckInsuranceType('cbhi');
  const rama = useCheckInsuranceType('rama');

  const determineInsuranceType = (insuranceName: string): string | null => {
    // Check cbhi-special-case
    if (cbhiSpecialCase.data?.[0]?.value) {
      const cbhiSpecialIds = cbhiSpecialCase.data[0].value.split(',').map((id: string) => id.trim());
      if (cbhiSpecialIds.includes(insuranceName)) {
        return 'cbhi-special-case';
      }
    }

    // Check cbhi
    if (cbhi.data?.[0]?.value) {
      const cbhiIds = cbhi.data[0].value.split(',').map((id: string) => id.trim());
      if (cbhiIds.includes(insuranceName)) {
        return 'cbhi';
      }
    }

    // Check rama
    if (rama.data?.[0]?.value) {
      const ramaIds = rama.data[0].value.split(',').map((id: string) => id.trim());
      if (ramaIds.includes(insuranceName)) {
        return 'rama';
      }
    }

    return null;
  };

  return {
    cbhiSpecialCase,
    cbhi,
    rama,
    determineInsuranceType,
    isLoading: cbhiSpecialCase.isLoading || cbhi.isLoading || rama.isLoading,
    error: cbhiSpecialCase.error || cbhi.error || rama.error,
  };
}
