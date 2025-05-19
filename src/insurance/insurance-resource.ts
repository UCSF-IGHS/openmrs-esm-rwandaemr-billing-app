import { openmrsFetch } from '@openmrs/esm-framework';

const BASE_API_URL = '/ws/rest/v1/mohbilling';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';
const BASE_APIS_URL = '/ws/rest/v1';

export async function fetchInsuranceFirms() {
  const params = new URLSearchParams({ report_id: 'insurance_firm_report' });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data?.results || !Array.isArray(data.results)) {
      console.error('Unexpected API response:', data);
      return [];
    }

    return data.results.map((item) => {
      const record = item.record;
      const idObj = record.find((i) => i.column === 'insurance_id');
      const nameObj = record.find((i) => i.column === 'name');

      return {
        value: idObj?.value ?? '',
        label: nameObj?.value ?? 'Unknown',
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
