import { openmrsFetch } from '@openmrs/esm-framework';
import { formatToYMD } from '../../billing-reports/utils/download-utils';
import { API_CONFIG } from '../../constants';
import { errorHandler } from '../../utils/error-handler';

const BASE_MAMBA_API = API_CONFIG.BASE_MAMBA_URL;

/**
 * Fetches insurance firms for reporting
 * @returns Promise with array of insurance firms
 */
export async function fetchInsuranceFirms() {
  const params = new URLSearchParams({ report_id: 'insurance_firm_report' });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data?.results || !Array.isArray(data.results)) {
      errorHandler.handleError(
        new Error('Unexpected API response structure'),
        { component: 'billing-api', action: 'fetchInsuranceFirms', metadata: { data } },
        { title: 'Failed to fetch insurance firms', kind: 'error' },
      );
      return [];
    }

    return data.results.map((item: any) => {
      const record = item.record;
      const idObj = record.find((i: any) => i.column === 'insurance_id');
      const nameObj = record.find((i: any) => i.column === 'name');

      return {
        value: idObj?.value ?? '',
        label: nameObj?.value ?? 'Unknown',
      };
    });
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'fetchInsuranceFirms' },
      { title: 'Failed to fetch insurance firms', kind: 'error' },
    );
    return [];
  }
}

/**
 * Fetches all insurance report data with pagination
 * @param startDate - Start date for the report
 * @param endDate - End date for the report
 * @param insuranceId - Insurance ID to filter by
 * @returns Promise with all insurance report data
 */
export async function fetchAllInsuranceReportData(startDate: string, endDate: string, insuranceId: string) {
  let page = 1;
  const pageSize = 50;
  let allResults: any[] = [];
  let hasMore = true;

  try {
    while (hasMore) {
      const { results, total } = await fetchInsuranceReport(startDate, endDate, insuranceId, page, pageSize);
      if (!Array.isArray(results)) {
        errorHandler.handleError(
          new Error('Unexpected results format'),
          { component: 'billing-api', action: 'fetchAllInsuranceReportData', metadata: { results } },
          { title: 'Invalid report data format', kind: 'error' },
        );
        break;
      }

      allResults = [...allResults, ...results];
      page++;
      hasMore = allResults.length < total;
    }

    return allResults;
  } catch (error) {
    errorHandler.handleError(
      error,
      {
        component: 'billing-api',
        action: 'fetchAllInsuranceReportData',
        metadata: { startDate, endDate, insuranceId },
      },
      { title: 'Failed to fetch insurance report data', kind: 'error' },
    );
    return [];
  }
}

/**
 * Fetches insurance report data with pagination
 * @param startDate - Start date for the report
 * @param endDate - End date for the report
 * @param insuranceId - Insurance ID to filter by
 * @param page_number - Page number for pagination
 * @param page_size - Number of items per page
 * @returns Promise with paginated insurance report data
 */
export async function fetchInsuranceReport(
  startDate: string,
  endDate: string,
  insuranceId: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'insurance_bill',
    insurance_identifier: insuranceId,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data || typeof data !== 'object') {
      errorHandler.handleError(
        new Error('Unexpected API response'),
        { component: 'billing-api', action: 'fetchInsuranceReport', metadata: { data } },
        { title: 'Invalid insurance report response', kind: 'error' },
      );
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
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'fetchInsuranceReport', metadata: { startDate, endDate, insuranceId } },
      { title: 'Failed to fetch insurance report page', kind: 'error' },
    );
    return {
      results: [],
      total: 0,
    };
  }
}
