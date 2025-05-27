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
import { fetchConsommationReport, fetchAllConsommationReport } from './api/billing-reports';
import dayjs from 'dayjs';
import { exportSingleRecordToPDF, exportToExcel, formatValue } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';
import { formatToYMD } from './utils/download-utils';

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
  company: string;
}

const ConsommationReport: React.FC = () => {
  const { t } = useTranslation();

  const [results, setResults] = useState<ReportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
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
    'global_amount',
    'patientdue',
    'insurancedue',
    'paid_amount',
    'bill_status',
    'admission_type',
    'global_bill_status',
    'collectorname',
  ];

  const handleSearch = async (filters: Filters, pageNum = 1, pageSize = 50) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const formattedStart = formatToYMD(filters.startDate);
      const formattedEnd = formatToYMD(filters.endDate);

      const { results, total } = await fetchConsommationReport(
        formattedStart,
        formattedEnd,
        filters.company,
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
      const { startDate, endDate, company } = currentFilters;
      const allResults = await fetchAllConsommationReport(formatToYMD(startDate), formatToYMD(endDate), company);

      exportToExcel(columns, allResults, getValue, 'Consommations-report.xlsx');
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
    return [50];
  };

  const headerDisplayMap: Record<string, string> = {
    no: t('no', 'No'),
    date: t('date', 'Date'),
    name: t('department', 'Department'),
    policy_id_number: t('policyIdNumber', 'Policy ID Number'),
    beneficiary: t('beneficiary', 'Beneficiary'),
    insurancename: t('insuranceName', 'Insurance Name'),
    global_amount: t('globalAmount', 'Global Amount'),
    patientdue: t('patientDue', 'Patient Due'),
    insurancedue: t('insuranceDue', 'Insurance Due'),
    paid_amount: t('paidAmount', 'Paid Amount'),
    bill_status: t('billStatus', 'Bill Status'),
    admission_type: t('admissionType', 'Admission Type'),
    global_bill_status: t('globalBillStatus', 'Global Bill Status'),
    collectorname: t('collectorName', 'Collector Name'),
  };

  const filterRecordItems = (record: ReportRecord[]): ReportRecord[] => {
    const filterColumns = [
      'global_amount',
      'patientdue',
      'insurancedue',
      'paid_amount',
      'bill_status',
      'admission_type',
      'global_bill_status',
      'collectorname',
    ];

    return record.filter((item) => filterColumns.includes(item.column));
  };

  return (
    <div className={styles.container}>
      {t('consommationReport', 'Consommation Report')}
      <div className={styles.reportContent}>
        <div className={styles.filterSection}>
          <ReportFilterForm fields={['startDate', 'endDate', 'company']} onSearch={handleSearch} />
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
                                filterRecordItems(recordMap.get(row.id)!).map((item, i) => (
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

export default ConsommationReport;
