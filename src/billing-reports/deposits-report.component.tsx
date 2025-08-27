
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';
import {
  DataTable,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  DataTableSkeleton,
  Button,
  Pagination,
  InlineNotification,
  Tag,
} from '@carbon/react';
import styles from './billing-reports.scss';
import * as XLSX from 'xlsx';
import { showSnackbar } from '@openmrs/esm-framework';
import { fetchDepositsReport, fetchAllDepositsReport, type DepositReportRow } from './api/billing-reports';

interface FilterData {
  startDate?: Date;
  endDate?: Date;
  collector?: string;
  type?: string;
}

const DepositsReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('depositsReport', 'Deposits Report');
  const [reportData, setReportData] = useState<DepositReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 50,
    totalRecords: 0,
    totalPages: 1,
  });

  const hasRequiredFilters = useMemo(
    () => !!(currentFilters?.startDate && currentFilters?.endDate && currentFilters?.collector && currentFilters?.type),
    [currentFilters],
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);

  const handleSearch = async (formData: Record<string, any>) => {
    const filters: FilterData = {
      startDate: formData.startDate,
      endDate: formData.endDate,
      collector: formData.collector?.trim(),
      type: formData.type || 'Deposit',
    };

    setCurrentFilters(filters);
    setHasSearched(true);
    setErrorMessage(null);

    if (!filters.startDate || !filters.endDate || !filters.collector || !filters.type) {
      setReportData([]);
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('allFieldsRequired', 'Please select start date, end date, collector and type'),
        kind: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const startDateStr = filters.startDate.toISOString().split('T')[0];
      const endDateStr = filters.endDate.toISOString().split('T')[0];

      const response = await fetchDepositsReport(
        startDateStr,
        endDateStr,
        filters.collector!,
        filters.type!,
        1,
        pagination.pageSize,
      );

      setReportData(response.results);
      setPagination(prev => ({
        ...prev,
        currentPage: 1,
        totalRecords: response.total,
        totalPages: Math.ceil(response.total / prev.pageSize),
      }));

      if (response.results.length === 0) {
        showSnackbar({
          title: t('noDataFound', 'No Data Found'),
          subtitle: t('noDataForCriteria', 'No deposits data found for the selected criteria'),
          kind: 'info',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load deposits report.');
      setErrorMessage(errorMsg);
      setReportData([]);
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load deposits report.'),
        subtitle: errorMsg,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = async ({ page, pageSize }: { page: number; pageSize: number }) => {
    if (!hasRequiredFilters || !currentFilters) return;
    setLoading(true);
    try {
      const startDateStr = currentFilters.startDate!.toISOString().split('T')[0];
      const endDateStr = currentFilters.endDate!.toISOString().split('T')[0];

      const response = await fetchDepositsReport(
        startDateStr,
        endDateStr,
        currentFilters.collector!,
        currentFilters.type!,
        page,
        pageSize,
      );

      setReportData(response.results);
      setPagination({
        currentPage: page,
        pageSize,
        totalRecords: response.total,
        totalPages: Math.ceil(response.total / pageSize),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load deposits report.');
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load deposits report.'),
        subtitle: errorMsg,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = async () => {
    if (!hasRequiredFilters || !currentFilters) return;

    try {
      const startDateStr = currentFilters.startDate!.toISOString().split('T')[0];
      const endDateStr = currentFilters.endDate!.toISOString().split('T')[0];
      const allData = await fetchAllDepositsReport(
        startDateStr,
        endDateStr,
        currentFilters.collector!,
        currentFilters.type!,
      );

      if (allData.length === 0) {
        showSnackbar({
          title: t('noDataToExport', 'No Data to Export'),
          subtitle: t('noDataForExport', 'No data available for export'),
          kind: 'info',
        });
        return;
      }

      const exportData = allData.map((row) => ({
        [t('date', 'Date')]: row.date,
        [t('collector', 'Collector')]: row.collector,
        [t('personName', 'Person Name')]: row.personNameShort,
        [t('amount', 'Amount')]: row.amount,
        [t('reason', 'Reason')]: row.reason,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Deposits Report');
      XLSX.writeFile(wb, `deposits-report-${startDateStr}-to-${endDateStr}.xlsx`);

      showSnackbar({
        title: t('exportSuccess', 'Export Successful'),
        subtitle: t('exportComplete', 'Deposits report exported successfully'),
        kind: 'success',
      });
    } catch (error) {
      showSnackbar({
        title: t('exportError', 'Export Failed'),
        subtitle: t('exportFailed', 'Failed to export deposits report'),
        kind: 'error',
      });
    }
  };

  const primaryTableHeaders = [
    { key: 'date', header: t('date', 'Date') },
    { key: 'collector', header: t('collector', 'Collector') },
    { key: 'personNameShort', header: t('personName', 'Person Name') },
    { key: 'amount', header: t('amount', 'Amount') },
  ];

  const transformedData = reportData.map((row) => ({
    ...row,
    amount: formatCurrency(row.amount),
  }));

  return (
    <div>
      <h2>{headerTitle}</h2>

      <ReportFilterForm
        fields={['startDate', 'endDate', 'type', 'collector']}
        onSearch={handleSearch}
      />

      {errorMessage && (
        <InlineNotification
          kind="error"
          title={t('error', 'Error')}
          subtitle={errorMessage}
          onCloseButtonClick={() => setErrorMessage(null)}
        />
      )}

      {loading && <DataTableSkeleton columnCount={primaryTableHeaders.length} />}

      {!loading && (!hasSearched || !hasRequiredFilters || reportData.length === 0) && !hasSearched && (
        <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
      )}

      {!loading && hasSearched && hasRequiredFilters && reportData.length === 0 && (
        <EmptyState 
          displayText={t('noDataFound', 'No Data Found')}
          headerTitle={t('noDepositsData', 'No deposits data found for the selected criteria')}
        />
      )}

      {!loading && hasSearched && hasRequiredFilters && reportData.length > 0 && (
        <div className={styles.billingReportTableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p>
              {t('totalRecords', 'Total Records')}: {pagination.totalRecords.toLocaleString()}
            </p>
            <Button onClick={handleExportToExcel} kind="secondary">
              {t('exportExcel', 'Export to Excel')}
            </Button>
          </div>

          <DataTable rows={transformedData} headers={primaryTableHeaders}>
            {({ 
              rows, 
              headers, 
              getExpandedRowProps,
              getRowProps, 
              getTableProps, 
              getTableContainerProps,
              getHeaderProps,
            }) => (
              <>
                <TableContainer {...getTableContainerProps()}>
                  <Table {...getTableProps()} className={styles.table} size="lg" useZebraStyles>
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
                      {rows.map((row, index) => (
                        <React.Fragment key={row.id}>
                          <TableExpandRow {...getRowProps({ row })}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>
                                {cell.info.header === 'amount' ? (
                                  <Tag type="teal" size="sm">{cell.value}</Tag>
                                ) : (
                                  cell.value
                                )}
                              </TableCell>
                            ))}
                          </TableExpandRow>
                          <TableExpandedRow colSpan={headers.length + 1} {...getExpandedRowProps({ row })}>
                            <div style={{ padding: '1rem', backgroundColor: '#f7f7f7' }}>
                              <h6 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('details', 'Details')}</h6>
                              <div style={{ backgroundColor: 'white', borderRadius: '4px', padding: '0.75rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                  <div><strong>{t('reason', 'Reason')}:</strong> {reportData[index].reason || '-'}</div>
                                </div>
                              </div>
                            </div>
                          </TableExpandedRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {pagination.totalRecords > pagination.pageSize && (
                  <Pagination
                    page={pagination.currentPage}
                    pageSize={pagination.pageSize}
                    pageSizes={[25, 50, 100]}
                    totalItems={pagination.totalRecords}
                    onChange={handlePageChange}
                  />)
                }
              </>
            )}
          </DataTable>

          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6c6c6c' }}>
            {t('totalRecords', 'Total Records')}: {pagination.totalRecords.toLocaleString()}
            <br />
            <em>{t('expandRowsHint', 'Click the expand icon (▶) to view deposit reason')}</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositsReport;
