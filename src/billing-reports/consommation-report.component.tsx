import React, { useState, useEffect, useMemo } from 'react';
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
  InlineNotification,
  DataTableSkeleton,
} from '@carbon/react';
import { fetchConsommationReport, fetchAllConsommationReport } from './api/billing-reports';
import { getInsurances } from '../api/billing';
import dayjs from 'dayjs';
import { exportSingleRecordToPDF, exportToExcel, formatValue } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';
import { formatToYMD } from './utils/download-utils';
import { showSnackbar } from '@openmrs/esm-framework';

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
  const [hasSearched, setHasSearched] = useState(false);
  const [insuranceOptions, setInsuranceOptions] = useState<{ label: string; value: string }[]>([]);

  // Fetch insurance companies on component mount
  useEffect(() => {
    const fetchInsuranceCompanies = async () => {
      try {
        const insurances = await getInsurances();
        const options = insurances.map((insurance) => ({
          label: insurance.name,
          value: insurance.name,
        }));
        setInsuranceOptions(options);
      } catch (error) {
        console.error('Error fetching insurance companies:', error);
        showSnackbar({
          title: t('errorFetchingInsurances', 'Failed to load insurance companies.'),
          kind: 'error',
        });
      }
    };

    fetchInsuranceCompanies();
  }, [t]);

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };
  const recordMap = useMemo(() => {
    const map = new Map<string, ReportRecord[]>();
    results.forEach((row, idx) => {
      const rowKey = `${(page - 1) * pageSize + idx + 1}`;
      map.set(rowKey, row.record);
    });
    return map;
  }, [results, page, pageSize]);

  const hiddenColumns = [
    'global_amount',
    'patientdue',
    'insurancedue',
    'paid_amount',
    'admission_type',
    'global_bill_status',
    'collectorname',
  ];

  const handleSearch = async (filters: Filters, pageNum = 1, pageSize = 50) => {
    setHasSearched(true);
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
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load report data.'),
        kind: 'error',
      });
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
      showSnackbar({
        title: t('errorExportingExcel', 'Failed to export to Excel.'),
        kind: 'error',
      });
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
          <ReportFilterForm
            fields={['startDate', 'endDate', 'company']}
            onSearch={handleSearch}
            companyOptions={insuranceOptions}
          />
        </div>
      </div>

      {loading && <DataTableSkeleton rowCount={5} columnCount={columns.length || 5} />}
      {hasSearched && !loading && !errorMessage && results.length === 0 && (
        <InlineNotification
          kind="info"
          title={t('noResults', 'No results found')}
          subtitle={t('tryDifferentFilters', 'Try adjusting your filters or date range to see data.')}
          hideCloseButton
        />
      )}

      {!loading && results.length > 0 && (
        <div className={styles.reportTableContainer}>
          <Button onClick={handleExportClick}>{t('exportExcel', 'Export to Excel')}</Button>

          <DataTable
            rows={results.map((row, index) => {
              const rowKey = `${(page - 1) * pageSize + index + 1}`;
              const values = Object.fromEntries(
                columns.map((col) => [col === 'id' ? 'db_id' : col, getValue(row.record, col)])
              );

              const rowData: any = {
                id: rowKey,
                ...values,
                no: parseInt(rowKey, 10),
              };

              return rowData;
            })}
            headers={[
              { key: 'no', header: t('no', 'No') },
              ...columns
                .filter((col) => !hiddenColumns.includes(col))
                .map((col) => ({
                  key: col === 'id' ? 'db_id' : col,
                  header: headerDisplayMap[col] || (col === 'id' ? 'id' : col),
                })),
            ]}
            size="lg"
            useZebraStyles
            isSortable={true}
            overflowMenuOnHover={false}
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
                            <div className={styles.billingExpandedTableContainer}>
                              <h6 className={styles.billingExpandedTableTitle}>
                                {t('additionalDetails', 'Additional Details')}
                              </h6>
                              {recordMap.has(row.id) && (
                                <table className={styles.billingExpandedDetailsTable}>
                                  <tbody>
                                    {/* Identifiers section */}
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>{t('id', 'ID')}</td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap
                                            .get(row.id)!
                                            .find((item) => item.column === 'id')?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('globalBillId', 'Global Bill ID')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'global_bill_id')
                                            ?.value,
                                        )}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('consommationId', 'Consommation ID')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'consommation_id')
                                            ?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('policyIdNumber', 'Policy ID Number')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'policy_id_number')
                                            ?.value,
                                        )}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('insuranceName', 'Insurance Name')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'insurancename')?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('collectorName', 'Collector Name')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'collectorname')?.value,
                                        )}
                                      </td>
                                    </tr>

                                    {/* Financial details */}
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('globalAmount', 'Global Amount')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'global_amount')?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('patientDue', 'Patient Due')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'patientdue')?.value,
                                        )}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('insuranceDue', 'Insurance Due')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'insurancedue')?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('paidAmount', 'Paid Amount')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'paid_amount')?.value,
                                        )}
                                      </td>
                                    </tr>

                                    {/* Admission details (bill_status is now shown in the primary table) */}
                                    <tr>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('admissionType', 'Admission Type')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'admission_type')
                                            ?.value,
                                        )}
                                      </td>
                                      <td className={styles.billingExpandedDetailLabel}>
                                        {t('globalBillStatus', 'Global Bill Status')}
                                      </td>
                                      <td className={styles.billingExpandedDetailValue}>
                                        {formatValue(
                                          recordMap.get(row.id)!.find((item) => item.column === 'global_bill_status')
                                            ?.value,
                                        )}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              )}
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
                            </div>
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
