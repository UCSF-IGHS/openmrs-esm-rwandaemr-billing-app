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
  Pagination,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  DataTable,
  TableContainer,
} from '@carbon/react';
import { fetchAllInsuranceReportData, fetchInsuranceFirms, fetchInsuranceReport } from '../api/billing';
import dayjs from 'dayjs';
import { exportSingleRecordToPDF, exportToExcel, formatValue } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recordMap = new Map<string, ReportRecord[]>();

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };

  const hiddenColumns = [
    'first_closing_date_id',
    'family_code',
    'household_head_name',
    'beneficiary_level',
    'birth_date',
    'company_name',
    'insurance_id',
    'global_bill_id',
    'global_bill_identifier',
    'MEDICAMENTS',
    'CONSULTATION',
    'HOSPITALISATION',
    'LABORATOIRE',
    'FORMALITES ADMINISTRATIVES',
    'AMBULANCE',
    'CONSOMMABLES',
    'OXYGENOTHERAPIE',
    'IMAGING',
    'PROCED.',
  ];

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
    first_closing_date_id: t('firstClosingDateId', 'First Closing Date ID'),
    admission_date: t('admissionDate', 'Admission Date'),
    closing_date: t('closingDate', 'Closing Date'),
    beneficiary_name: t('beneficiaryName', 'Beneficiary Name'),
    household_head_name: t('householdHeadName', 'Household Head Name'),
    family_code: t('familyCode', 'Family Code'),
    beneficiary_level: t('beneficiaryLevel', 'Beneficiary Level'),
    card_number: t('cardNumber', 'Card No'),
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
    FORMALITES_ADMINISTRATIVES: t('adminFormalities', 'Admin Formalities'),
    AMBULANCE: t('ambulance', 'Ambulance'),
    CONSOMMABLES: t('consumables', 'Consumables'),
    OXYGENOTHERAPIE: t('oxygen', 'Oxygen Therapy'),
    IMAGING: t('imaging', 'Imaging'),
    'PROCED.': t('procedure', 'Proced.'),
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
              const id = `${(page - 1) * pageSize + index + 1}`;
              const rowData = {
                id,
                ...Object.fromEntries(columns.map((col) => [col, getValue(row.record, col)])),
                no: parseInt(id),
              };
              recordMap.set(id, row.record);

              return rowData;
            })}
            headers={[
              { key: 'no', header: t('no', 'No') },
              ...columns
                .filter((col) => !hiddenColumns.includes(col))
                .map((col) => ({
                  key: col,
                  header: headerDisplayMap[col] || col,
                })),
            ]}
            size="lg"
            useZebraStyles
            isSortable={true}
            overflowMenuOnHover={false}
            className={styles.dataTable}
          >
            {({ rows, headers, getTableProps, getTableContainerProps, getHeaderProps, getRowProps }) => (
              <TableContainer {...getTableContainerProps()}>
                <Table {...getTableProps()} className={styles.table}>
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader />
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <TableExpandRow {...getRowProps({ row })}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>
                              <span title={cell.value}>{cell.value}</span>
                            </TableCell>
                          ))}
                        </TableExpandRow>
                        {row.isExpanded && (
                          <TableExpandedRow colSpan={headers.length + 1}>
                            <div className={styles.expandedContentRow}>
                              {recordMap.has(row.id) &&
                                recordMap
                                  .get(row.id)!
                                  .filter((item) =>
                                    [
                                      'first_closing_date_id',
                                      'household_head_name',
                                      'family_code',
                                      'beneficiary_level',
                                      'company_name',
                                      'birth_date',
                                      'insurance_id',
                                      'global_bill_id',
                                      'global_bill_identifier',
                                      'MEDICAMENTS',
                                      'CONSULTATION',
                                      'HOSPITALISATION',
                                      'LABORATOIRE',
                                      'FORMALITES ADMINISTRATIVES',
                                      'AMBULANCE',
                                      'CONSOMMABLES',
                                      'OXYGENOTHERAPIE',
                                      'IMAGING',
                                      'PROCED.',
                                    ].includes(item.column),
                                  )
                                  .map((item, i) => (
                                    <div className={styles.inlineDetailItem} key={i}>
                                      <span className={styles.detailLabel}>
                                        {headerDisplayMap[item.column] || item.column}:
                                      </span>{' '}
                                      <span className={styles.detailValue}>{formatValue(item.value)}</span>
                                      {i !== 9 && <span className={styles.divider}>|</span>}
                                    </div>
                                  ))}
                            </div>
                            {recordMap.has(row.id) && (
                              <div className={styles.expandedDownloadRow}>
                                <Button
                                  size="sm"
                                  kind="primary"
                                  onClick={() => {
                                    const fullRecord = recordMap.get(row.id)!;
                                    const formattedRecord = fullRecord.map((item) => ({
                                      column: item.column,
                                      value: formatValue(item.value),
                                    }));
                                    exportSingleRecordToPDF(formattedRecord);
                                  }}
                                >
                                  {t('download', 'Download')}
                                </Button>
                              </div>
                            )}
                          </TableExpandedRow>
                        )}
                      </React.Fragment>
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
        </div>
      )}
    </div>
  );
};

export default InsuranceReport;
