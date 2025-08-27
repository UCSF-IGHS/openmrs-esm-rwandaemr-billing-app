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
import { fetchCashierReport, fetchAllCashierReport, type CashierReportRow } from './api/billing-reports';
import { showSnackbar } from '@openmrs/esm-framework';

interface FilterData {
  startDate?: Date;
  endDate?: Date;
}

const CashierReport: React.FC = () => {
  const { t } = useTranslation();
  const headerTitle = t('cashierReport', 'Cashier Report');

  const [reportData, setReportData] = useState<CashierReportRow[]>([]);
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
    () => !!(currentFilters?.startDate && currentFilters?.endDate),
    [currentFilters],
  );

  const handleSearch = async (formData: Record<string, any>) => {
    const filters: FilterData = {
      startDate: formData.startDate,
      endDate: formData.endDate,
    };

    setCurrentFilters(filters);
    setHasSearched(true);
    setErrorMessage(null);

    if (!filters.startDate || !filters.endDate) {
      setReportData([]);
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('allFieldsRequired', 'Please select start date and end date'),
        kind: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const startDateStr = filters.startDate.toISOString().split('T')[0];
      const endDateStr = filters.endDate.toISOString().split('T')[0];

      const response = await fetchCashierReport(startDateStr, endDateStr, 1, pagination.pageSize);

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
          subtitle: t('noDataForCriteria', 'No cashier report data found for the selected criteria'),
          kind: 'info',
        });
      }
    } catch (error) {
      console.error('Error fetching cashier report:', error);
      const errorMsg =
        error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load cashier report.');
      setErrorMessage(errorMsg);
      setReportData([]);
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load cashier report.'),
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

      const response = await fetchCashierReport(startDateStr, endDateStr, page, pageSize);

      setReportData(response.results);
      setPagination({
        currentPage: page,
        pageSize,
        totalRecords: response.total,
        totalPages: Math.ceil(response.total / pageSize),
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load cashier report.');
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load cashier report.'),
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
      const allData = await fetchAllCashierReport(startDateStr, endDateStr);

      if (allData.length === 0) {
        showSnackbar({
          title: t('noDataToExport', 'No Data to Export'),
          subtitle: t('noDataForExport', 'No data available for export'),
          kind: 'info',
        });
        return;
      }

      const exportData = allData.map(row => ({
        [t('date', 'Date')]: row.date,
        [t('patientName', 'Patient Name')]: row.patientName,
        [t('patientBillId', 'Patient Bill ID')]: row.patientBillId,
        [t('globalBillId', 'Global Bill ID')]: row.globalBillId,
        [t('billPaymentId', 'Bill Payment ID')]: row.billPaymentId,
        [t('medicaments', 'Medicaments')]: row.medicaments,
        [t('consultation', 'Consultation')]: row.consultation,
        [t('hospitalisation', 'Hospitalisation')]: row.hospitalisation,
        [t('laboratoire', 'Laboratory')]: row.laboratoire,
        [t('formalitesAdministratives', 'Formalités Admin.')]: row.formalitesAdministratives,
        [t('ambulance', 'Ambulance')]: row.ambulance,
        [t('consommables', 'Consommables')]: row.consommables,
        [t('oxygenotherapie', 'Oxygénothérapie')]: row.oxygenotherapie,
        [t('echographie', 'Echography')]: row.echographie,
        [t('radiologie', 'Radiology')]: row.radiologie,
        [t('stomatologie', 'Stomatology')]: row.stomatologie,
        [t('chirurgie', 'Surgery')]: row.chirurgie,
        [t('maternite', 'Maternity')]: row.maternite,
        [t('soinsInfirmiers', 'Nursing Care')]: row.soinsInfirmiers,
        [t('ophtalmologie', 'Ophthalmology')]: row.ophtalmologie,
        [t('kinesitherapie', 'Kinesitherapy')]: row.kinesitherapie,
        [t('totalAmount', 'Total Amount')]: row.totalAmount,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cashier Report');
      XLSX.writeFile(wb, `cashier-report-${startDateStr}-to-${endDateStr}.xlsx`);

      showSnackbar({
        title: t('exportSuccess', 'Export Successful'),
        subtitle: t('exportComplete', 'Cashier report exported successfully'),
        kind: 'success',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      showSnackbar({
        title: t('exportError', 'Export Failed'),
        subtitle: t('exportFailed', 'Failed to export cashier report'),
        kind: 'error',
      });
    }
  };

  // Primary table (always visible)
  const primaryTableHeaders = [
    { key: 'date', header: t('date', 'Date') },
    { key: 'patientName', header: t('patientName', 'Patient Name') },
    { key: 'patientBillId', header: t('patientBillId', 'Patient Bill ID') },
    { key: 'totalAmount', header: t('totalAmount', 'Total Amount') },
  ];

  // Expanded sections (to avoid horizontal scrolling)
  const idColumns = [
    { key: 'billPaymentId', header: t('billPaymentId', 'Bill Payment ID') },
    { key: 'globalBillId', header: t('globalBillId', 'Global Bill ID') },
    { key: 'patientBillId', header: t('patientBillId', 'Patient Bill ID') },
  ];

  const servicesRow1Columns = [
    { key: 'consultation', header: t('consultation', 'Consultation') },
    { key: 'hospitalisation', header: t('hospitalisation', 'Hospitalisation') },
    { key: 'laboratoire', header: t('laboratoire', 'Laboratory') },
    { key: 'radiologie', header: t('radiologie', 'Radiology') },
  ];

  const servicesRow2Columns = [
    { key: 'medicaments', header: t('medicaments', 'Medicaments') },
    { key: 'consommables', header: t('consommables', 'Consommables') },
    { key: 'formalitesAdministratives', header: t('formalitesAdministratives', 'Formalités Admin.') },
    { key: 'soinsInfirmiers', header: t('soinsInfirmiers', 'Nursing Care') },
  ];

  const servicesRow3Columns = [
    { key: 'ophtalmologie', header: t('ophtalmologie', 'Ophthalmology') },
    { key: 'oxygenotherapie', header: t('oxygenotherapie', 'Oxygénothérapie') },
    { key: 'echographie', header: t('echographie', 'Echography') },
    { key: 'ambulance', header: t('ambulance', 'Ambulance') },
  ];

  const servicesRow4Columns = [
    { key: 'stomatologie', header: t('stomatologie', 'Stomatology') },
    { key: 'chirurgie', header: t('chirurgie', 'Surgery') },
    { key: 'maternite', header: t('maternite', 'Maternity') },
    { key: 'kinesitherapie', header: t('kinesitherapie', 'Kinesitherapy') },
  ];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);

  const transformedData = reportData.map(row => ({
    ...row,
    totalAmount: formatCurrency(row.totalAmount),
    consultation: formatCurrency(row.consultation),
    hospitalisation: formatCurrency(row.hospitalisation),
    laboratoire: formatCurrency(row.laboratoire),
    radiologie: formatCurrency(row.radiologie),
    medicaments: formatCurrency(row.medicaments),
    consommables: formatCurrency(row.consommables),
    formalitesAdministratives: formatCurrency(row.formalitesAdministratives),
    soinsInfirmiers: formatCurrency(row.soinsInfirmiers),
    ophtalmologie: formatCurrency(row.ophtalmologie),
    oxygenotherapie: formatCurrency(row.oxygenotherapie),
    echographie: formatCurrency(row.echographie),
    ambulance: formatCurrency(row.ambulance),
    stomatologie: formatCurrency(row.stomatologie),
    chirurgie: formatCurrency(row.chirurgie),
    maternite: formatCurrency(row.maternite),
    kinesitherapie: formatCurrency(row.kinesitherapie),
  }));

  return (
    <div>
      <h2>{headerTitle}</h2>

      <ReportFilterForm fields={['startDate', 'endDate']} onSearch={handleSearch} />

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
          headerTitle={t('noCashierData', 'No cashier report data found for the selected criteria')}
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
            {({ rows, headers, getExpandedRowProps, getRowProps, getTableProps, getTableContainerProps, getHeaderProps }) => (
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
                      {rows.map((row, index) => {
                        const originalRow = reportData[index];
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow {...getRowProps({ row })}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'totalAmount' ? (
                                    <Tag type="blue" size="sm">{cell.value}</Tag>
                                  ) : (
                                    cell.value
                                  )}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={headers.length + 1} className="cashier-expanded-td" {...getExpandedRowProps({ row })}>
                              <div style={{ padding: '1rem', backgroundColor: '#f7f7f7' }}>
                                <h6 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                                  {t('detailedInformation', 'Detailed Information')}
                                </h6>
                                <div style={{ backgroundColor: 'white', borderRadius: '4px', padding: '0.5rem' }}>
                                  {/* Identifiers */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                      {t('identifiers', 'Identifiers')}
                                    </h6>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {idColumns.map(c => <TableHeader key={c.key}>{c.header}</TableHeader>)}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {idColumns.map(c => <TableCell key={c.key}>{(originalRow as any)[c.key]}</TableCell>)}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Services (split in rows) */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                      {t('primaryServices', 'Primary Services')}
                                    </h6>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {servicesRow1Columns.map(c => <TableHeader key={c.key}>{c.header}</TableHeader>)}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {servicesRow1Columns.map(c => <TableCell key={c.key}>{(transformedData[index] as any)[c.key]}</TableCell>)}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  <div style={{ marginBottom: '1rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {servicesRow2Columns.map(c => <TableHeader key={c.key}>{c.header}</TableHeader>)}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {servicesRow2Columns.map(c => <TableCell key={c.key}>{(transformedData[index] as any)[c.key]}</TableCell>)}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  <div style={{ marginBottom: '1rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {servicesRow3Columns.map(c => <TableHeader key={c.key}>{c.header}</TableHeader>)}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {servicesRow3Columns.map(c => <TableCell key={c.key}>{(transformedData[index] as any)[c.key]}</TableCell>)}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  <div style={{ marginBottom: '1rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {servicesRow4Columns.map(c => <TableHeader key={c.key}>{c.header}</TableHeader>)}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {servicesRow4Columns.map(c => <TableCell key={c.key}>{(transformedData[index] as any)[c.key]}</TableCell>)}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            </TableExpandedRow>
                          </React.Fragment>
                        );
                      })}
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
                  />
                )}
              </>
            )}
          </DataTable>

          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6c6c6c' }}>
            {t('totalRecords', 'Total Records')}: {pagination.totalRecords.toLocaleString()}
            <br />
            <em>{t('expandRowsHint', 'Click the expand icon (▶) to view services breakdown and identifiers')}</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierReport;
