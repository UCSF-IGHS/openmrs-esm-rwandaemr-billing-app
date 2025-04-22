import React, { useState, useEffect } from 'react';
import ReportFilterForm from './report-filter-form.component';
import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Modal,
  Pagination,
} from '@carbon/react';
import { fetchAllInsuranceReportData, fetchInsuranceFirms, fetchInsuranceReport } from '../api/billing';
import dayjs from 'dayjs';
import { exportSingleRecordToPDF, exportToExcel, formatValue } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@carbon/react';
import { TableContainer } from '@carbon/react';

interface ReportRecord {
  column: string;
  value: string | string[];
}

interface ReportRow {
  record: ReportRecord[];
}

interface Filters {
  startDate: string;
  endDate: string;
  insurance: string;
}

const InsuranceReport: React.FC = () => {
  const { t } = useTranslation();

  const [results, setResults] = useState<ReportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [insuranceOptions, setInsuranceOptions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState<ReportRecord[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleView = (record: ReportRecord[]) => setSelectedRecord(record);

  const closeModal = () => setSelectedRecord(null);

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };

  const handleSearch = async (filters: Filters, pageNum = 1, pageSize = 50) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const formattedStart = dayjs(filters.startDate).format('YYYY-MM-DD');
      const formattedEnd = dayjs(filters.endDate).format('YYYY-MM-DD');
      const { results, total } = await fetchInsuranceReport(
        formattedStart,
        formattedEnd,
        filters.insurance,
        pageNum,
        pageSize,
      );

      if (results.length > 0) {
        const columnNames = results[0].record.map((item) => item.column);
        setColumns(columnNames);
      }

      setResults(results);
      setTotalRecords(total);
      setPage(pageNum);
      setPageSize(pageSize);
      setCurrentFilters(filters);
    } catch (error) {
      console.error('Error fetching report:', error);
      setErrorMessage(t('errorFetchingReport', 'Failed to load report data.'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportClick = async () => {
    if (!currentFilters) return;

    setLoading(true);
    try {
      const { startDate, endDate, insurance } = currentFilters;
      const allResults = await fetchAllInsuranceReportData(startDate, endDate, insurance);
      exportToExcel(columns, allResults, getValue, 'insurance-report.xlsx');
    } catch (error) {
      console.error('Export failed:', error);
      setErrorMessage(t('errorExportingExcel', 'Failed to export to Excel.'));
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (newPage: number) => {
    handleSearch(currentFilters!, newPage, pageSize);
  };

  const getPageSizes = (totalItems: number, currentPageSize: number) => {
    return [10, 25, 50, 100];
  };

  const headerDisplayMap: Record<string, string> = {
    no: t('no', 'No'),
    first_closing_date_id: t('firstClosingDateId', 'First Closing Date'),
    admission_date: t('admissionDate', 'Admission Date'),
    closing_date: t('closingDate', 'Closing Date'),
    beneficiary_name: t('beneficiaryName', 'Beneficiary Name'),
    household_head_name: t('householdHeadName', 'Household Head Name'),
    family_code: t('familyCode', 'Family Code'),
    beneficiary_level: t('beneficiaryLevel', 'Beneficiary Level'),
    card_number: t('cardNumber', 'Card Number'),
    company_name: t('companyName', 'Company Name'),
    age: t('age', 'Age'),
    birth_date: t('birthDate', 'Birth Date'),
    gender: t('gender', 'Gender'),
    doctor_name: t('doctorName', 'Doctor Name'),
    insurance_id: t('insuranceId', 'Insurance ID'),
    global_bill_id: t('globalBillId', 'Global Bill ID'),
    global_bill_identifier: t('globalBillIdentifier', 'Global Bill Identifier'),
    MEDICAMENTS: t('medicaments', 'Medications'),
    CONSULTATION: t('consultation', 'Consultation'),
    HOSPITALISATION: t('hospitalisation', 'Hospitalization'),
    LABORATOIRE: t('laboratory', 'Laboratory'),
    FORMALITES_ADMINISTRATIVES: t('adminFormalities', 'Administrative Formalities'),
    AMBULANCE: t('ambulance', 'Ambulance'),
    CONSOMMABLES: t('consumables', 'Consumables'),
    OXYGENOTHERAPIE: t('oxygen', 'Oxygen Therapy'),
    IMAGING: t('imaging', 'Imaging'),
    'PROCED.': t('procedure', 'Proced.'),
    Action: t('action', 'Action'),
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await fetchInsuranceFirms();
        setInsuranceOptions(options);
      } catch (e) {
        console.error('Error loading insurance options:', e);
        setErrorMessage(t('errorFetchingInsuranceOptions', 'Failed to load insurance options.'));
      }
    };
    loadOptions();
  }, [t]);

  return (
    <div className={styles.container}>
      {t('insuranceReport', 'Insurance Report')}
      <div className={styles.reportContent}>
        <div className={styles.filterSection}>
          <ReportFilterForm
            fields={['startDate', 'endDate', 'insurance']}
            onSearch={handleSearch}
            insuranceOptions={insuranceOptions}
          />
        </div>
      </div>

      {loading && <p>{t('loading', 'Loading...')}</p>}
      {errorMessage && <p className={styles.error}>{errorMessage}</p>}
      {!loading && !errorMessage && results.length === 0 && <p>{t('noResults', 'No results found.')}</p>}

      {!loading && results.length > 0 && (
        <div className={styles.reportTableContainer}>
          <Button onClick={handleExportClick}>{t('exportExcel', 'Export to Excel')}</Button>

          <DataTable
            rows={results.map((row, index) => {
              const rowData = {
                id: `${(page - 1) * pageSize + index + 1}`,
                ...Object.fromEntries(columns.map((col) => [col, getValue(row.record, col)])),
                no: (page - 1) * pageSize + index + 1,
              };

              return {
                ...rowData,
                record: row.record,
              };
            })}
            headers={[
              { key: 'no', header: t('no', 'No') },
              ...columns.map((col) => ({
                key: col,
                header: headerDisplayMap[col] || col,
              })),
              { key: 'actions', header: t('action', 'Action') },
            ]}
            size="lg"
            useZebraStyles
            isSortable={false}
            overflowMenuOnHover={false}
            className={styles.dataTable}
          >
            {({ rows, headers, getTableProps, getTableContainerProps, getHeaderProps, getRowProps }) => (
              <TableContainer {...getTableContainerProps()}>
                <Table {...getTableProps()} className={styles.table}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                        {columns.map((col) => (
                          <TableCell key={col}>{getValue(row.record, col)}</TableCell>
                        ))}
                        <TableCell>
                          <Button kind="ghost" size="sm" onClick={() => handleView(row.record)}>
                            {t('view', 'View')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          <Pagination
            backwardText={t('previousPage', 'Previous page')}
            forwardText={t('nextPage', 'Next page')}
            itemsPerPageText={t('itemsPerPage', 'Items per page') + ':'}
            page={page}
            pageNumberText={t('pageNumber', 'Page number')}
            pageSize={pageSize}
            pageSizes={getPageSizes(totalRecords, pageSize)}
            onChange={({ page, pageSize }) => {
              goToPage(page);
              setPageSize(pageSize);
            }}
            totalItems={totalRecords}
          />

          <Modal
            open={!!selectedRecord}
            onRequestClose={closeModal}
            modalHeading={t('recordDetails', 'Record Details')}
            passiveModal
            className={styles.billingDetailModal}
          >
            <div className={styles.billingDetailContent}>
              {selectedRecord?.map((item, idx) => (
                <div className={styles.detailRow} key={idx}>
                  <span className={styles.detailLabel}>{item.column}:</span>
                  <span className={styles.detailValue}>{formatValue(item.value)}</span>
                </div>
              ))}
            </div>

            <div className={styles.modalFooter}>
              <Button kind="secondary" onClick={closeModal}>
                {t('close', 'Close')}
              </Button>
              <Button
                kind="primary"
                onClick={() => {
                  if (!selectedRecord || selectedRecord.length === 0) {
                    alert(t('noRecordSelected', 'No record selected.'));
                    return;
                  }

                  const formattedRecord = selectedRecord.map((item) => ({
                    column: item.column,
                    value: formatValue(item.value),
                  }));

                  exportSingleRecordToPDF(formattedRecord);
                }}
              >
                {t('download', 'Download')}
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
};

export default InsuranceReport;
