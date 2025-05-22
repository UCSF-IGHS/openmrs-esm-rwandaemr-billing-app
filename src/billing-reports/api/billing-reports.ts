import { openmrsFetch } from '@openmrs/esm-framework';
import { formatToYMD } from '../../billing-reports/utils/download-utils';

const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

export async function fetchRefundPaymentReport(
  startDate: string,
  endDate: string,
  collector: string,
  page_number = 1,
  page_size = 10,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'payment_refund_report',
    collector,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data || typeof data !== 'object') {
      console.error('Unexpected API response:', data);
      return {
        results: [],
        total: 0,
      };
    }

    return {
      results: Array.isArray(data.results) ? data.results : [],
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch refund payment report page:', error);
    return {
      results: [],
      total: 0,
    };
  }
}
