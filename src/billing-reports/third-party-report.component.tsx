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
  DataTableSkeleton,
  Button,
  Pagination,
  InlineNotification,
} from '@carbon/react';
import { getThirdParties } from '../api/billing/insurance';
import { showSnackbar } from '@openmrs/esm-framework';
import styles from './billing-reports.scss';
import * as XLSX from 'xlsx';

interface ThirdPartyReportRow {
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
  otherServices: number;
  medicine: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
}

interface FilterData {
  startDate?: Date;
  endDate?: Date;
  thirdParty?: string;
}

const ThirdPartyReport: React.FC = () => {
  const { t } = useTranslation();

  // State management
  const [thirdPartyOptions, setThirdPartyOptions] = useState<{ label: string; value: string }[]>([]);
  const [reportData, setReportData] = useState<ThirdPartyReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

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
      return;
    }

    setLoading(true);

    try {
      // TODO: Replace with actual API call when endpoint is ready
      // const data = await fetchThirdPartyReport(filters);
      // setReportData(data);

      // For now, set empty data until API is ready
      setReportData([]);
    } catch (error) {
      console.error('Error fetching third party report:', error);
      setErrorMessage(t('errorFetchingReport', 'Failed to load third party report data.'));
      showSnackbar({
        title: t('errorFetchingReport', 'Failed to load third party report data.'),
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Export functionality
  const handleExportToExcel = () => {
    if (reportData.length === 0) return;

    const exportData = reportData.map((row) => ({
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
      [t('otherServices', 'Other Services')]: row.otherServices,
      [t('medicine', 'Medicine')]: row.medicine,
      [t('totalAmount', 'Total Amount')]: row.totalAmount,
      [t('paidAmount', 'Paid Amount')]: row.paidAmount,
      [t('balance', 'Balance')]: row.balance,
    }));

    // Simple export using XLSX directly
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Third Party Report');
    XLSX.writeFile(wb, `third-party-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Table headers
  const tableHeaders = [
    { key: 'no', header: t('no', 'No') },
    { key: 'date', header: t('date', 'Date') },
    { key: 'cardNumber', header: t('cardNumber', 'Card Number') },
    { key: 'age', header: t('age', 'Age') },
    { key: 'gender', header: t('gender', 'Gender') },
    { key: 'beneficiaryName', header: t('beneficiaryName', 'Beneficiary Name') },
    { key: 'insurance', header: t('insurance', 'Insurance') },
    { key: 'consultation', header: t('consultation', 'Consultation') },
    { key: 'hospitalization', header: t('hospitalization', 'Hospitalization') },
    { key: 'pharmacy', header: t('pharmacy', 'Pharmacy') },
    { key: 'laboratory', header: t('laboratory', 'Laboratory') },
    { key: 'radiology', header: t('radiology', 'Radiology') },
    { key: 'otherServices', header: t('otherServices', 'Other Services') },
    { key: 'medicine', header: t('medicine', 'Medicine') },
    { key: 'totalAmount', header: t('totalAmount', 'Total Amount') },
    { key: 'paidAmount', header: t('paidAmount', 'Paid Amount') },
    { key: 'balance', header: t('balance', 'Balance') },
  ];

  // Pagination
  const totalPages = Math.ceil(reportData.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = reportData.slice(startIndex, endIndex);

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

      {loading && <DataTableSkeleton columnCount={tableHeaders.length} />}

      {!loading && (!hasSearched || !hasRequiredFilters || reportData.length === 0) && (
        <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
      )}

      {!loading && hasSearched && hasRequiredFilters && reportData.length > 0 && (
        <div className={styles.reportTableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p>
              {t('totalRecords', 'Total Records')}: {reportData.length}
            </p>
            <Button onClick={handleExportToExcel} kind="secondary">
              {t('exportExcel', 'Export to Excel')}
            </Button>
          </div>

          <DataTable rows={paginatedData} headers={tableHeaders} size="lg" useZebraStyles isSortable={true}>
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
                    {rows.map((row) => (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>
                            {typeof cell.value === 'number' &&
                            [
                              'consultation',
                              'hospitalization',
                              'pharmacy',
                              'laboratory',
                              'radiology',
                              'otherServices',
                              'medicine',
                              'totalAmount',
                              'paidAmount',
                              'balance',
                            ].includes(cell.id.split(':')[1])
                              ? new Intl.NumberFormat('en-US').format(cell.value)
                              : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          {totalPages > 1 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              pageSizes={[25, 50, 100]}
              totalItems={reportData.length}
              onChange={({ page, pageSize }) => {
                setPage(page);
                setPageSize(pageSize);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ThirdPartyReport;
