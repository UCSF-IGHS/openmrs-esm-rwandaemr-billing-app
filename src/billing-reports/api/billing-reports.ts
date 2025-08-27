import { openmrsFetch } from '@openmrs/esm-framework';

import { formatToYMD } from '../../billing-reports/utils/download-utils';
import type { ReportRow } from '../payment-refund-report.component';
const BASE_MAMBA_API = '/ws/rest/v1/mamba/report';

export async function fetchRefundPaymentReport(
  startDate: string,
  endDate: string,
  collector: string,
  page_number = 1,
  page_size = 50,
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

// Service Revenue Report API functions
export interface ServiceRevenueRow {
  id: string;
  service: string;
  chirurgie: number;
  consommables: number;
  dermatologie: number;
  echographie: number;
  formalitesAdministratives: number;
  hospitalisation: number;
  kinestherapie: number;
  laboratoire: number;
  maternite: number;
  medecineInterne: number;
  medicaments: number;
  ophtalmologie: number;
  orl: number;
  oxygenotherapie: number;
  pediatrie: number;
  radiologie: number;
  soinsInfirmiers: number;
  soinsTherapeutiques: number;
  stomatologie: number;
  autres: number;
  consultation: number;
  ambulance: number;
  total: number;
}

export async function fetchServiceRevenueReport(
  startDate: string,
  endDate: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'servicerevenue_report',
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

    const transformedResults = data.results?.map((item: any) => {
      const record: any = {};
      
      item.record?.forEach((field: any) => {
        record[field.column] = field.value;
      });

      return {
        id: item.serialId?.toString() || Math.random().toString(),
        service: record.service || '',
        chirurgie: record.CHIRURGIE || record.SURGERY || 0,
        consommables: record.CONSOMMABLES || 0,
        dermatologie: record.DERMATOLOGY || 0,
        echographie: record.ECHOGRAPHIE || 0,
        formalitesAdministratives: record.FORMALITES_ADMINISTRATIVES || 0,
        hospitalisation: record.HOSPITALISATION || 0,
        kinestherapie: record.KINESTHERAPIE || 0,
        laboratoire: record.LABORATOIRE || 0,
        maternite: record.MATERNITE || record.OBSTETRICS_GYNECOLOGY || 0,
        medecineInterne: record.MEDECINE_INTERNE || record.INTERNAL_MEDECINE || 0,
        medicaments: record.MEDICAMENTS || 0,
        ophtalmologie: record.OPHTALMOLOGIE || record.OPHTHALMOLOGY || 0,
        orl: record.ORL || record.OTORHINOLARYNGOLOGIE || 0,
        oxygenotherapie: record.OXYGENOTHERAPIE || 0,
        pediatrie: record.PEDIATRIE || record.PEDIATRICS || 0,
        radiologie: record.RADIOLOGIE || 0,
        soinsInfirmiers: record.SOINS_INFIRMIERS || 0,
        soinsTherapeutiques: record.SOINS_THERAPEUTIQUES || 0,
        stomatologie: record.STOMATOLOGIE || record.STOMATOLOGY || 0,
        autres: record.AUTRES || record.APPAREILLAGE_ORTHOPEDIQUE || 0,
        consultation: record.CONSULTATION || 0,
        ambulance: record.AMBULANCE || 0,
        total: calculateRowTotal(record),
      };
    }) || [];

    return {
      results: transformedResults,
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch service revenue report page:', error);
    return {
      results: [],
      total: 0,
    };
  }
}

// Helper function to calculate total for each row
function calculateRowTotal(record: any): number {
  const columns = [
    'CHIRURGIE', 'SURGERY', 'CONSOMMABLES', 'DERMATOLOGY', 'ECHOGRAPHIE',
    'FORMALITES_ADMINISTRATIVES', 'HOSPITALISATION', 'KINESTHERAPIE',
    'LABORATOIRE', 'MATERNITE', 'OBSTETRICS_GYNECOLOGY', 'MEDECINE_INTERNE',
    'INTERNAL_MEDECINE', 'MEDICAMENTS', 'OPHTALMOLOGIE', 'OPHTHALMOLOGY',
    'ORL', 'OTORHINOLARYNGOLOGIE', 'OXYGENOTHERAPIE', 'PEDIATRIE', 'PEDIATRICS',
    'RADIOLOGIE', 'SOINS_INFIRMIERS', 'SOINS_THERAPEUTIQUES', 'STOMATOLOGIE',
    'STOMATOLOGY', 'AUTRES', 'APPAREILLAGE_ORTHOPEDIQUE', 'CONSULTATION',
    'AMBULANCE', 'ANESTHESIE'
  ];

  return columns.reduce((sum, column) => {
    const value = record[column] || 0;
    return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
  }, 0);
}

export async function fetchAllServiceRevenueReport(
  startDate: string,
  endDate: string,
  pageSize = 100,
): Promise<ServiceRevenueRow[]> {
  let allResults: ServiceRevenueRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchServiceRevenueReport(
      startDate,
      endDate,
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

// Third Party Report API functions
export interface ThirdPartyReportRow {
  id: string;
  no: number;
  date: string;
  cardNumber: string;
  age: string;
  gender: string;
  beneficiaryName: string;
  insurance: string;
  consultation: number;
  hospitalization: number;
  pharmacy: number;
  laboratory: number;
  radiology: number;
  consommables: number;
  formalitesAdministratives: number;
  ambulance: number;
  oxygenotherapie: number;
  proced: number;
  medicine: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  amount100Percent: number;
  insuranceAmount: number;
  thirdPartyAmount: number;
}

export async function fetchThirdPartyReport(
  startDate: string,
  endDate: string,
  insuranceName: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'thirdparty_report',
    insurance_name: insuranceName,
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

    const transformedResults = data.results?.map((item: any, index: number) => {
      const record: any = {};
      
      item.record?.forEach((field: any) => {
        record[field.column] = field.value;
      });

      return {
        id: item.serialId?.toString() || Math.random().toString(),
        no: index + 1 + (page_number - 1) * page_size,
        date: record.admission_date ? formatDateFromArray(record.admission_date) : '',
        cardNumber: record.card_number || '',
        age: record.age?.toString() || '',
        gender: record.gender || '',
        beneficiaryName: record.beneficiary_name || '',
        insurance: record.company_name || insuranceName,
        consultation: parseFloat(record.CONSULTATION || 0),
        hospitalization: parseFloat(record.HOSPITALISATION || 0),
        pharmacy: parseFloat(record.MEDICAMENTS || 0),
        laboratory: parseFloat(record.LABORATOIRE || 0),
        radiology: parseFloat(record.IMAGING || 0),
        consommables: parseFloat(record.CONSOMMABLES || 0),
        formalitesAdministratives: parseFloat(record.FORMALITES_ADMINISTRATIVES || 0),
        ambulance: parseFloat(record.AMBULANCE || 0),
        oxygenotherapie: parseFloat(record.OXYGENOTHERAPIE || 0),
        proced: parseFloat(record.PROCED || 0),
        medicine: parseFloat(record.MEDICAMENTS || 0),
        totalAmount: parseFloat(record.amount_100_percent || 0),
        paidAmount: parseFloat(record.insurance_amount || 0),
        balance: parseFloat(record.third_party_amount || 0),
        // Financial detail columns
        amount100Percent: parseFloat(record.amount_100_percent || 0),
        insuranceAmount: parseFloat(record.insurance_amount || 0),
        thirdPartyAmount: parseFloat(record.third_party_amount || 0),
      };
    }) || [];

    return {
      results: transformedResults,
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch third party report page:', error);
    return {
      results: [],
      total: 0,
    };
  }
}

// Helper function to format date from array format [year, month, day, hour, minute, second]
function formatDateFromArray(dateArray: number[]): string {
  if (!Array.isArray(dateArray) || dateArray.length < 3) return '';
  
  try {
    const [year, month, day] = dateArray;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-GB'); 
    }
    return '';
  } catch (error) {
    console.error('Error formatting date array:', error);
    return '';
  }
}

export async function fetchAllThirdPartyReport(
  startDate: string,
  endDate: string,
  insuranceName: string,
  pageSize = 100,
): Promise<ThirdPartyReportRow[]> {
  let allResults: ThirdPartyReportRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchThirdPartyReport(
      startDate,
      endDate,
      insuranceName,
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

// Cashier Report API functions
export interface CashierReportRow {
  id: string;
  firstDateId?: number;
  date: string;
  billPaymentId: number;
  patientBillId: number;
  patientName: string;
  globalBillId: number;
  medicaments: number;
  consultation: number;
  hospitalisation: number;
  laboratoire: number;
  formalitesAdministratives: number;
  ambulance: number;
  consommables: number;
  oxygenotherapie: number;
  echographie: number;
  radiologie: number;
  stomatologie: number;
  chirurgie: number;
  maternite: number;
  soinsInfirmiers: number;
  ophtalmologie: number;
  kinesitherapie: number;
  totalAmount: number;
}

export async function fetchCashierReport(
  startDate: string,
  endDate: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'cashier_report',
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data || typeof data !== 'object') {
      console.error('Unexpected API response:', data);
      return { results: [], total: 0 };
    }

    const transformedResults: CashierReportRow[] = (data.results || []).map((item: any) => {
      const record: Record<string, any> = {};
      item.record?.forEach((field: any) => (record[field.column] = field.value));

      const services = {
        medicaments: Number(record.MEDICAMENTS || 0),
        consultation: Number(record.CONSULTATION || 0),
        hospitalisation: Number(record.HOSPITALISATION || 0),
        laboratoire: Number(record.LABORATOIRE || 0),
        formalitesAdministratives: Number(record['FORMALITES ADMINISTRATIVES'] || 0),
        ambulance: Number(record.AMBULANCE || 0),
        consommables: Number(record.CONSOMMABLES || 0),
        oxygenotherapie: Number(record.OXYGENOTHERAPIE || 0),
        echographie: Number(record.ECHOGRAPHIE || 0),
        radiologie: Number(record.RADIOLOGIE || 0),
        stomatologie: Number(record.STOMATOLOGIE || 0),
        chirurgie: Number(record.CHIRURGIE || 0),
        maternite: Number(record.MATERNITE || 0),
        soinsInfirmiers: Number(record['SOINS INFIRMIERS'] || 0),
        ophtalmologie: Number(record.OPHTALMOLOGIE || 0),
        kinesitherapie: Number(record.KINESITHERAPIE || 0),
      };

      const totalAmount = Object.values(services).reduce(
        (sum, n) => sum + (typeof n === 'number' ? n : parseFloat(String(n)) || 0),
        0,
      );

      return {
        id: item.serialId?.toString() || Math.random().toString(),
        firstDateId: Number(record.first_date_id || record.firstDateId || 0) || undefined,
        date: Array.isArray(record.date) ? formatDateFromArray(record.date) : (record.date || ''),
        billPaymentId: Number(record.bill_payment_id || 0),
        patientBillId: Number(record.patient_bill_id || 0),
        patientName: record.patient_name || '',
        globalBillId: Number(record.global_bill_id || 0),
        ...services,
        totalAmount,
      } as CashierReportRow;
    });

    return {
      results: transformedResults,
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch cashier report page:', error);
    return { results: [], total: 0 };
  }
}

export async function fetchAllCashierReport(
  startDate: string,
  endDate: string,
  pageSize = 100,
): Promise<CashierReportRow[]> {
  let allResults: CashierReportRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchCashierReport(
      startDate,
      endDate,
      currentPage,
      pageSize,
    );

    if (currentPage === 1) total = newTotal;
    allResults = allResults.concat(results);
    currentPage++;

    if (allResults.length >= total || results.length === 0) done = true;
  }

  return allResults;
}


// Deposits Report API functions
export interface DepositReportRow {
  id: string;
  date: string;
  collector: string;
  personNameShort: string;
  amount: number;
  reason: string;
}

export async function fetchDepositsReport(
  startDate: string,
  endDate: string,
  collector: string,
  type: string,
  page_number = 1,
  page_size = 50,
) {
  const formattedStart = formatToYMD(startDate);
  const formattedEnd = formatToYMD(endDate);

  const params = new URLSearchParams({
    report_id: 'deposits_report',
    collector,
    type,
    start_date: formattedStart,
    end_date: formattedEnd,
    page_number: String(page_number),
    page_size: String(page_size),
  });

  try {
    const { data } = await openmrsFetch(`${BASE_MAMBA_API}?${params.toString()}`);

    if (!data || typeof data !== 'object') {
      console.error('Unexpected API response:', data);
      return { results: [], total: 0 };
    }

    const transformedResults: DepositReportRow[] = (data.results || []).map((item: any) => {
      const record: Record<string, any> = {};
      item.record?.forEach((field: any) => (record[field.column] = field.value));

      return {
        id: item.serialId?.toString() || Math.random().toString(),
        date: Array.isArray(record.date) ? formatDateFromArray(record.date) : (record.date || ''),
        collector: record.collector || '',
        personNameShort: record.person_name_short || '',
        amount: Number(record.amount || 0),
        reason: record.reason || '',
      } as DepositReportRow;
    });

    return {
      results: transformedResults,
      total: data.pagination?.totalRecords || 0,
    };
  } catch (error) {
    console.error('Failed to fetch deposits report page:', error);
    return { results: [], total: 0 };
  }
}

export async function fetchAllDepositsReport(
  startDate: string,
  endDate: string,
  collector: string,
  type: string,
  pageSize = 100,
): Promise<DepositReportRow[]> {
  let allResults: DepositReportRow[] = [];
  let currentPage = 1;
  let total = 0;
  let done = false;

  while (!done) {
    const { results, total: newTotal } = await fetchDepositsReport(
      startDate,
      endDate,
      collector,
      type,
      currentPage,
      pageSize,
    );

    if (currentPage === 1) total = newTotal;
    allResults = allResults.concat(results);
    currentPage++;

    if (allResults.length >= total || results.length === 0) done = true;
  }

  return allResults;
}
