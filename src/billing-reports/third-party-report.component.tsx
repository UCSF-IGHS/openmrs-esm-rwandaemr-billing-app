import React, { useState, useEffect, useMemo } from 'react';
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
import { getThirdParties } from '../api/billing/insurance';
import { showSnackbar } from '@openmrs/esm-framework';
import { fetchThirdPartyReport, fetchAllThirdPartyReport, type ThirdPartyReportRow } from './api/billing-reports';
import styles from './billing-reports.scss';
import * as XLSX from 'xlsx';

interface FilterData {
  startDate?: Date;
  endDate?: Date;
  thirdParty?: string;
}

const ThirdPartyReport: React.FC = () => {
  const { t } = useTranslation();

  const [thirdPartyOptions, setThirdPartyOptions] = useState<{ label: string; value: string }[]>([]);
  const [reportData, setReportData] = useState<ThirdPartyReportRow[]>([]);
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

  const headerTitle = t('thirdPartyReport', 'Third Party Report');

  // Fetch third parties on component mount
  useEffect(() => {
    const fetchThirdParties = async () => {
      try {
        const thirdParties = await getThirdParties();
        const options = thirdParties.map((thirdParty) => ({
          label: thirdParty.name,
          value: thirdParty.name,
        }));
        setThirdPartyOptions(options);
      } catch (error) {
        console.error('Error fetching third parties:', error);
        showSnackbar({
          title: t('errorFetchingThirdParties', 'Failed to load third parties.'),
          kind: 'error',
        });
      }
    };

    fetchThirdParties();
  }, [t]);

  // Check if required filters are selected
  const hasRequiredFilters = useMemo(() => {
    return currentFilters?.startDate && currentFilters?.endDate && currentFilters?.thirdParty;
  }, [currentFilters]);

  // Handle search functionality
  const handleSearch = async (formData: Record<string, any>) => {
    const filters: FilterData = {
      startDate: formData.startDate,
      endDate: formData.endDate,
      thirdParty: formData.thirdParty,
    };

    setCurrentFilters(filters);
    setHasSearched(true);
    setErrorMessage(null);

    // Only proceed if required filters are selected
    if (!filters.startDate || !filters.endDate || !filters.thirdParty) {
      setReportData([]);
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('allFieldsRequired', 'Please select start date, end date, and third party'),
        kind: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      const startDateStr = filters.startDate.toISOString().split('T')[0];
      const endDateStr = filters.endDate.toISOString().split('T')[0];

      const response = await fetchThirdPartyReport(
        startDateStr,
        endDateStr,
        filters.thirdParty,
        1,
        pagination.pageSize
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
          subtitle: t('noDataForCriteria', 'No third party report data found for the selected criteria'),
          kind: 'info',
        });
      }
    } catch (error) {
      console.error('Error fetching third party report:', error);
      const errorMsg = error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load third party report data.');
      setErrorMessage(errorMsg);
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load third party report data.'),
        subtitle: errorMsg,
        kind: 'error',
      });
      setReportData([]);
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

      const response = await fetchThirdPartyReport(
        startDateStr,
        endDateStr,
        currentFilters.thirdParty!,
        page,
        pageSize
      );

      setReportData(response.results);
      setPagination(prev => ({
        ...prev,
        currentPage: page,
        pageSize: pageSize,
        totalRecords: response.total,
        totalPages: Math.ceil(response.total / pageSize),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('errorFetchingReport', 'Failed to load third party report data.');
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load third party report data.'),
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

      const allData = await fetchAllThirdPartyReport(
        startDateStr,
        endDateStr,
        currentFilters.thirdParty!
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
        [t('no', 'No')]: row.no,
        [t('date', 'Date')]: row.date,
        [t('cardNumber', 'Card Number')]: row.cardNumber,
        [t('age', 'Age')]: row.age,
        [t('gender', 'Gender')]: row.gender,
        [t('beneficiaryName', 'Beneficiary Name')]: row.beneficiaryName,
        [t('insurance', 'Insurance')]: row.insurance,
        [t('consultation', 'Consultation')]: row.consultation,
        [t('hospitalization', 'Hospitalization')]: row.hospitalization,
        [t('pharmacy', 'Pharmacy')]: row.pharmacy,
        [t('laboratory', 'Laboratory')]: row.laboratory,
        [t('radiology', 'Radiology')]: row.radiology,
        [t('consommables', 'Consommables')]: row.consommables,
        [t('formalitesAdministratives', 'Formalités Admin.')]: row.formalitesAdministratives,
        [t('ambulance', 'Ambulance')]: row.ambulance,
        [t('oxygenotherapie', 'Oxygénothérapie')]: row.oxygenotherapie,
        [t('procedures', 'Procedures')]: row.proced,
        [t('medicine', 'Medicine')]: row.medicine,
        [t('totalAmount', 'Total Amount')]: row.totalAmount,
        [t('paidAmount', 'Paid Amount')]: row.paidAmount,
        [t('balance', 'Balance')]: row.balance,
        [t('amount100Percent', 'Amount 100%')]: row.amount100Percent,
        [t('insuranceAmount', 'Insurance Amount')]: row.insuranceAmount,
        [t('thirdPartyAmount', 'Third Party Amount')]: row.thirdPartyAmount,
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Third Party Report');
      XLSX.writeFile(wb, `third-party-report-${currentFilters.thirdParty}-${startDateStr}-to-${endDateStr}.xlsx`);

      showSnackbar({
        title: t('exportSuccess', 'Export Successful'),
        subtitle: t('exportComplete', 'Third party report exported successfully'),
        kind: 'success',
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      showSnackbar({
        title: t('exportError', 'Export Failed'),
        subtitle: t('exportFailed', 'Failed to export third party report'),
        kind: 'error',
      });
    }
  };

  // Primary columns that are always visible
  const primaryTableHeaders = [
    { key: 'no', header: t('no', 'No') },
    { key: 'date', header: t('date', 'Date') },
    { key: 'cardNumber', header: t('cardNumber', 'Card Number') },
    { key: 'beneficiaryName', header: t('beneficiaryName', 'Beneficiary Name') },
    { key: 'insurance', header: t('insurance', 'Insurance') },
    { key: 'totalAmount', header: t('totalAmount', 'Total Amount') },
  ];

  // Secondary columns for expandable section - split into rows to avoid horizontal scrolling
  const patientInfoColumns = [
    { key: 'age', header: t('age', 'Age') },
    { key: 'gender', header: t('gender', 'Gender') },
  ];

  const servicesRow1Columns = [
    { key: 'consultation', header: t('consultation', 'Consultation') },
    { key: 'hospitalization', header: t('hospitalization', 'Hospitalization') },
    { key: 'pharmacy', header: t('pharmacy', 'Pharmacy') },
    { key: 'laboratory', header: t('laboratory', 'Laboratory') },
  ];

  const servicesRow2Columns = [
    { key: 'radiology', header: t('radiology', 'Radiology') },
    { key: 'consommables', header: t('consommables', 'Consommables') },
    { key: 'ambulance', header: t('ambulance', 'Ambulance') },
    { key: 'oxygenotherapie', header: t('oxygenotherapie', 'Oxygénothérapie') },
  ];

  const servicesRow3Columns = [
    { key: 'formalitesAdministratives', header: t('formalitesAdministratives', 'Formalités Admin.') },
    { key: 'proced', header: t('procedures', 'Procedures') },
  ];

  const financialColumns = [
    { key: 'paidAmount', header: t('paidAmount', 'Paid Amount') },
    { key: 'balance', header: t('balance', 'Balance') },
  ];

  const financialDetailColumns = [
    { key: 'amount100Percent', header: t('amount100Percent', 'Amount 100%') },
    { key: 'insuranceAmount', header: t('insuranceAmount', 'Insurance Amount') },
    { key: 'thirdPartyAmount', header: t('thirdPartyAmount', 'Third Party Amount') },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Transform data for display with formatted currency for primary columns
  const transformedData = reportData.map(row => ({
    ...row,
    // Format primary table currency columns
    totalAmount: formatCurrency(row.totalAmount),
    // Format all service and financial columns
    consultation: formatCurrency(row.consultation),
    hospitalization: formatCurrency(row.hospitalization),
    pharmacy: formatCurrency(row.pharmacy),
    laboratory: formatCurrency(row.laboratory),
    radiology: formatCurrency(row.radiology),
    consommables: formatCurrency(row.consommables),
    formalitesAdministratives: formatCurrency(row.formalitesAdministratives),
    ambulance: formatCurrency(row.ambulance),
    oxygenotherapie: formatCurrency(row.oxygenotherapie),
    proced: formatCurrency(row.proced),
    medicine: formatCurrency(row.medicine),
    paidAmount: formatCurrency(row.paidAmount),
    balance: formatCurrency(row.balance),
    amount100Percent: formatCurrency(row.amount100Percent),
    insuranceAmount: formatCurrency(row.insuranceAmount),
    thirdPartyAmount: formatCurrency(row.thirdPartyAmount),
  }));

  return (
    <div>
      <h2>{headerTitle}</h2>

      <ReportFilterForm
        fields={['startDate', 'endDate', 'thirdParty']}
        onSearch={handleSearch}
        thirdPartyOptions={thirdPartyOptions}
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
          headerTitle={t('noThirdPartyData', 'No third party report data found for the selected criteria')}
        />
      )}

      {!loading && hasSearched && hasRequiredFilters && reportData.length > 0 && (
        <div className={styles.reportTableContainer}>
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
                      {rows.map((row, index) => {
                        const originalRow = reportData[index];
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow {...getRowProps({ row })}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'totalAmount' ? (
                                    <Tag type="blue" size="sm">
                                      {cell.value}
                                    </Tag>
                                  ) : (
                                    cell.value
                                  )}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow 
                              colSpan={headers.length + 1} 
                              className="demo-expanded-td"
                              {...getExpandedRowProps({ row })}
                            >
                              <div style={{ padding: '1rem', backgroundColor: '#f7f7f7' }}>
                                <h6 style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                                  {t('detailedInformation', 'Detailed Information')}
                                </h6>
                                <div style={{ backgroundColor: 'white', borderRadius: '4px', padding: '0.5rem' }}>
                                  {/* Patient Information */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('patientInformation', 'Patient Information')}
                                    </h6>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {patientInfoColumns.map((column) => (
                                            <TableHeader key={column.key}>
                                              {column.header}
                                            </TableHeader>
                                          ))}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {patientInfoColumns.map((column) => (
                                            <TableCell key={column.key}>
                                              {originalRow[column.key]}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Services Row 1 */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('primaryServices', 'Primary Services')}
                                    </h6>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {servicesRow1Columns.map((column) => (
                                            <TableHeader key={column.key}>
                                              {column.header}
                                            </TableHeader>
                                          ))}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {servicesRow1Columns.map((column) => (
                                            <TableCell key={column.key}>
                                              {transformedData[index][column.key]}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {/* Services Row 2 */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('additionalServices', 'Additional Services')}
                                    </h6>
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <Table size="sm">
                                        <TableHead>
                                          <TableRow>
                                            {servicesRow2Columns.map((column) => (
                                              <TableHeader key={column.key}>
                                                {column.header}
                                              </TableHeader>
                                            ))}
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          <TableRow>
                                            {servicesRow2Columns.map((column) => (
                                              <TableCell key={column.key}>
                                                {transformedData[index][column.key]}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>

                                  {/* Services Row 3 */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('otherServices', 'Other Services')}
                                    </h6>
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <Table size="sm">
                                        <TableHead>
                                          <TableRow>
                                            {servicesRow3Columns.map((column) => (
                                              <TableHeader key={column.key}>
                                                {column.header}
                                              </TableHeader>
                                            ))}
                                            <TableHeader></TableHeader>
                                            <TableHeader></TableHeader>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          <TableRow>
                                            {servicesRow3Columns.map((column) => (
                                              <TableCell key={column.key}>
                                                {transformedData[index][column.key]}
                                              </TableCell>
                                            ))}
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>

                                  {/* Financial Information */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('financialSummary', 'Financial Summary')}
                                    </h6>
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <Table size="sm">
                                        <TableHead>
                                          <TableRow>
                                            {financialColumns.map((column) => (
                                              <TableHeader key={column.key}>
                                                {column.header}
                                              </TableHeader>
                                            ))}
                                            <TableHeader></TableHeader>
                                            <TableHeader></TableHeader>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          <TableRow>
                                            {financialColumns.map((column) => (
                                              <TableCell key={column.key}>
                                                <Tag type={column.key === 'balance' && originalRow[column.key] > 0 ? 'red' : 'green'} size="sm">
                                                  {transformedData[index][column.key]}
                                                </Tag>
                                              </TableCell>
                                            ))}
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>

                                  {/* Financial Detail */}
                                  <div>
                                    <h6 style={{ marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                                      {t('financialBreakdown', 'Financial Breakdown')}
                                    </h6>
                                    <div style={{ marginTop: '0.5rem' }}>
                                      <Table size="sm">
                                        <TableHead>
                                          <TableRow>
                                            {financialDetailColumns.map((column) => (
                                              <TableHeader key={column.key}>
                                                {column.header}
                                              </TableHeader>
                                            ))}
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          <TableRow>
                                            {financialDetailColumns.map((column) => (
                                              <TableCell key={column.key}>
                                                {transformedData[index][column.key]}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
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
            <em>{t('expandRowsHint', 'Click the expand icon (▶) to view detailed patient information and service breakdown for each record')}</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThirdPartyReport;
