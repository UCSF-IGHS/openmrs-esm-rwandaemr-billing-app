import { openmrsFetch } from '@openmrs/esm-framework';

const BASE_API_URL = '/ws/rest/v1/mohbilling';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

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
