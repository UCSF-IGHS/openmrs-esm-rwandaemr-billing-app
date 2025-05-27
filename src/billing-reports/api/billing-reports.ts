import { openmrsFetch } from '@openmrs/esm-framework';

import { formatToYMD } from '../../billing-reports/utils/download-utils';
import type { ReportRow } from '../payment-refund-report.component';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

export async function fetchRefundPaymentReport(
  startDate: string,
  endDate: string,
  collector: string,
  page_number = 1,
  page_size = 100,
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

export async function fetchAllRefundPaymentReport(
  startDate: string,
  endDate: string,
  collector: string,
  pageSize = 100,
): Promise<ReportRow[]> {
  let allResults: ReportRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchRefundPaymentReport(
      startDate,
      endDate,
      collector,
      currentPage,
      pageSize,
    );

    if (currentPage === 1) {
      total = newTotal;
    }

    allResults = allResults.concat(results);
    currentPage++;

    if (allResults.length >= total || results.length === 0) {
      done = true;
    }
  }

  return allResults;
}

export async function fetchConsommationReport(
  startDate: string,
  endDate: string,
  company: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'consommation_report',
    company,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  const url = `${BASE_MAMBA_API}?${params.toString()}`;

  try {
    const { data } = await openmrsFetch(url);

    if (!data || typeof data !== 'object') {
      console.error('Unexpected API response:', data);
      return { results: [], total: 0 };
    }

    return {
      results: Array.isArray(data.results) ? data.results : [],
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch consommation report page:', error);
    return { results: [], total: 0 };
  }
}

export async function fetchAllConsommationReport(
  startDate: string,
  endDate: string,
  company: string,
  pageSize = 100,
): Promise<ReportRow[]> {
  let allResults: ReportRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchConsommationReport(
      startDate,
      endDate,
      company,
      currentPage,
      pageSize,
    );

    if (currentPage === 1) {
      total = newTotal;
    }

    allResults = allResults.concat(results);
    currentPage++;

    if (allResults.length >= total || results.length === 0) {
      done = true;
    }
  }

  return allResults;
}
