import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  InlineLoading,
  Pagination,
  Tag,
} from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';
import { type ServiceRevenueRow, fetchServiceRevenueReport } from './api/billing-reports';

interface ServiceRevenueReportFilters {
  startDate: string;
  endDate: string;
}

const ServiceRevenueReport: React.FC = () => {
  const { t } = useTranslation();
  const [hasSearched, setHasSearched] = useState(false);
  const [reportData, setReportData] = useState<ServiceRevenueRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<ServiceRevenueReportFilters | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 50,
    totalRecords: 0,
    totalPages: 1,
  });

  const headerTitle = t('serviceRevenueReport', 'Service Revenue Report');

  const handleSearch = async (filters: ServiceRevenueReportFilters) => {
    if (!filters.startDate || !filters.endDate) {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('dateRangeRequired', 'Please select both start and end dates'),
        kind: 'error',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentFilters(filters);

    try {
      const response = await fetchServiceRevenueReport(
        filters.startDate,
        filters.endDate,
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
          subtitle: t('noDataForDateRange', 'No service revenue data found for the selected date range'),
          kind: 'info',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('unknownError', 'An unknown error occurred');
      setError(errorMessage);
      showSnackbar({
        title: t('fetchError', 'Error Fetching Data'),
        subtitle: errorMessage,
        kind: 'error',
      });
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async ({ page, pageSize }: { page: number; pageSize: number }) => {
    if (!hasSearched || !currentFilters) return;

    setIsLoading(true);
    
    try {
      const response = await fetchServiceRevenueReport(
        currentFilters.startDate,
        currentFilters.endDate,
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('unknownError', 'An unknown error occurred');
      showSnackbar({
        title: t('fetchError', 'Error Fetching Data'),
        subtitle: errorMessage,
        kind: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Primary columns that are always visible
  const primaryColumns = [
    { key: 'service', header: t('service', 'Service') },
    { key: 'consultation', header: t('consultation', 'Consultation') },
    { key: 'hospitalisation', header: t('hospitalisation', 'Hospitalisation') },
    { key: 'laboratoire', header: t('laboratoire', 'Laboratoire') },
    { key: 'total', header: t('total', 'Total') },
  ];

  // Secondary columns for expandable section - split into rows to avoid horizontal scrolling
  const secondaryColumnsRow1 = [
    { key: 'chirurgie', header: t('chirurgie', 'Chirurgie') },
    { key: 'consommables', header: t('consommables', 'Consommables') },
    { key: 'dermatologie', header: t('dermatologie', 'Dermatologie') },
    { key: 'echographie', header: t('echographie', 'Echographie') },
    { key: 'formalitesAdministratives', header: t('formalitesAdministratives', 'Formalités Administratives') },
  ];

  const secondaryColumnsRow2 = [
    { key: 'kinestherapie', header: t('kinestherapie', 'Kinésthérapie') },
    { key: 'maternite', header: t('maternite', 'Maternité') },
    { key: 'medecineInterne', header: t('medecineInterne', 'Médecine Interne') },
    { key: 'medicaments', header: t('medicaments', 'Médicaments') },
    { key: 'ophtalmologie', header: t('ophtalmologie', 'Ophtalmologie') },
  ];

  const secondaryColumnsRow3 = [
    { key: 'orl', header: t('orl', 'ORL') },
    { key: 'oxygenotherapie', header: t('oxygenotherapie', 'Oxygénothérapie') },
    { key: 'pediatrie', header: t('pediatrie', 'Pédiatrie') },
    { key: 'radiologie', header: t('radiologie', 'Radiologie') },
    { key: 'soinsInfirmiers', header: t('soinsInfirmiers', 'Soins Infirmiers') },
  ];

  const secondaryColumnsRow4 = [
    { key: 'soinsTherapeutiques', header: t('soinsTherapeutiques', 'Soins Thérapeutiques') },
    { key: 'stomatologie', header: t('stomatologie', 'Stomatologie') },
    { key: 'autres', header: t('autres', 'Autres') },
    { key: 'ambulance', header: t('ambulance', 'Ambulance') },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Transform data for DataTable with formatted currency values
  const transformedData = reportData.map((row, index) => ({
    ...row,
    // Format for primary columns
    consultation: formatCurrency(row.consultation),
    hospitalisation: formatCurrency(row.hospitalisation),
    laboratoire: formatCurrency(row.laboratoire),
    total: formatCurrency(row.total),
    // Format secondary columns
    chirurgie: formatCurrency(row.chirurgie),
    consommables: formatCurrency(row.consommables),
    dermatologie: formatCurrency(row.dermatologie),
    echographie: formatCurrency(row.echographie),
    formalitesAdministratives: formatCurrency(row.formalitesAdministratives),
    kinestherapie: formatCurrency(row.kinestherapie),
    maternite: formatCurrency(row.maternite),
    medecineInterne: formatCurrency(row.medecineInterne),
    medicaments: formatCurrency(row.medicaments),
    ophtalmologie: formatCurrency(row.ophtalmologie),
    orl: formatCurrency(row.orl),
    oxygenotherapie: formatCurrency(row.oxygenotherapie),
    pediatrie: formatCurrency(row.pediatrie),
    radiologie: formatCurrency(row.radiologie),
    soinsInfirmiers: formatCurrency(row.soinsInfirmiers),
    soinsTherapeutiques: formatCurrency(row.soinsTherapeutiques),
    stomatologie: formatCurrency(row.stomatologie),
    autres: formatCurrency(row.autres),
    ambulance: formatCurrency(row.ambulance),
  }));

  return (
    <div>
      <h2>{headerTitle}</h2>
      <ReportFilterForm fields={['startDate', 'endDate']} onSearch={handleSearch} />

      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f4f4f4', color: 'red' }}>
          {t('errorOccurred', 'An error occurred')}: {error}
        </div>
      )}

      {isLoading && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
          <InlineLoading
            status="active"
            iconDescription={t('loading', 'Loading')}
            description={t('loadingServiceRevenueData', 'Loading service revenue data...')}
          />
        </div>
      )}

      {!hasSearched && !isLoading && (
        <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
      )}

      {hasSearched && !isLoading && !error && reportData.length === 0 && (
        <EmptyState 
          displayText={t('noDataFound', 'No Data Found')}
          headerTitle={t('noServiceRevenueData', 'No service revenue data found for the selected criteria')}
        />
      )}

      {hasSearched && !isLoading && !error && reportData.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <DataTable rows={transformedData} headers={primaryColumns}>
            {({ 
              rows, 
              headers, 
              getExpandedRowProps,
              getRowProps, 
              getTableProps, 
              getHeaderProps,
            }) => (
              <>
                <TableContainer>
                  <Table {...getTableProps()} size="sm" useZebraStyles>
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
                                  {cell.info.header === 'total' ? (
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
                                  {t('additionalServices', 'Additional Services')}
                                </h6>
                                <div style={{ backgroundColor: 'white', borderRadius: '4px', padding: '0.5rem' }}>
                                  <Table size="sm">
                                    <TableHead>
                                      <TableRow>
                                        {secondaryColumnsRow1.map((column) => (
                                          <TableHeader key={column.key}>
                                            {column.header}
                                          </TableHeader>
                                        ))}
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      <TableRow>
                                        {secondaryColumnsRow1.map((column) => (
                                          <TableCell key={column.key}>
                                            {transformedData[index][column.key]}
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                  
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {secondaryColumnsRow2.map((column) => (
                                            <TableHeader key={column.key}>
                                              {column.header}
                                            </TableHeader>
                                          ))}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {secondaryColumnsRow2.map((column) => (
                                            <TableCell key={column.key}>
                                              {transformedData[index][column.key]}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                  
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {secondaryColumnsRow3.map((column) => (
                                            <TableHeader key={column.key}>
                                              {column.header}
                                            </TableHeader>
                                          ))}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {secondaryColumnsRow3.map((column) => (
                                            <TableCell key={column.key}>
                                              {transformedData[index][column.key]}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                  
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <Table size="sm">
                                      <TableHead>
                                        <TableRow>
                                          {secondaryColumnsRow4.map((column) => (
                                            <TableHeader key={column.key}>
                                              {column.header}
                                            </TableHeader>
                                          ))}
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        <TableRow>
                                          {secondaryColumnsRow4.map((column) => (
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
                    pageSizes={[10, 25, 50, 100]}
                    totalItems={pagination.totalRecords}
                    onChange={handlePageChange}
                  />
                )}
              </>
            )}
          </DataTable>

          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6c6c6c' }}>
            {t('totalRecords', 'Total records')}: {pagination.totalRecords.toLocaleString()}
            <br />
            <em>{t('expandRowsHint', 'Click the expand icon (▶) to view detailed service breakdown for each row')}</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRevenueReport;
