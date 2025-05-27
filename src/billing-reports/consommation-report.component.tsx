import React, { useState } from 'react';
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
  DataTable,
  TableContainer,
  Modal,
} from '@carbon/react';
import dayjs from 'dayjs';
import { exportToExcel, formatValue, formatToYMD, exportSingleRecordToPDF } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';
import { fetchConsommationReport, fetchAllConsommationReport } from './api/billing-reports';

export interface ReportRecord {
  column: string;
  value: string | string[];
}

export interface ReportRow {
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

  const [selectedRecord, setSelectedRecord] = useState<ReportRow | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };
  const handleExportClick = async () => {
    if (!currentFilters) return;

    setLoading(true);
    try {
      const { startDate, endDate, company } = currentFilters;
      const allResults = await fetchAllConsommationReport(formatToYMD(startDate), formatToYMD(endDate), company);

      exportToExcel(columns, allResults, getValue, 'payment-refund-report.xlsx');
    } catch (error) {
      console.error('Export failed:', error);
      setErrorMessage(t('errorExportingExcel', 'Failed to export to Excel.'));
    } finally {
      setLoading(false);
    }
  };

  const headerDisplayMap: Record<string, string> = {
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

  const goToPage = (newPage: number) => {
    if (currentFilters) {
      handleSearch(currentFilters, newPage, pageSize);
    }
  };

  const getPageSizes = () => [10, 20, 50, 100];

  const formatDateTime = (dateString: string | string[] | undefined) => {
    if (!dateString) return '-';
    const val = Array.isArray(dateString) ? dateString[0] : dateString;
    return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD HH:mm') : formatValue(val);
  };

  const handleViewClick = (record: ReportRow) => {
    setSelectedRecord(record);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  const rows = results.map((row, index) => {
    const record = row.record;
    const id = `${(page - 1) * pageSize + index + 1}`;

    const getColumnValue = (col: string) => {
      const found = record.find((item) => item.column === col);
      return found ? formatValue(found.value) : '-';
    };

    return {
      id,
      no: parseInt(id),
      date: dayjs(Number(getColumnValue('date'))).isValid()
        ? dayjs(Number(getColumnValue('date'))).format('YYYY-MM-DD')
        : getColumnValue('date'),
      name: getColumnValue('name'),
      policy_id_number: getColumnValue('policy_id_number'),
      beneficiary: getColumnValue('beneficiary'),
      insurancename: getColumnValue('insurancename'),
      global_amount: getColumnValue('global_amount'),
      patientdue: getColumnValue('patientdue'),
      insurancedue: getColumnValue('insurancedue'),
      paid_amount: getColumnValue('paid_amount'),
      bill_status: getColumnValue('bill_status'),
      admission_type: getColumnValue('admission_type'),
      global_bill_status: getColumnValue('global_bill_status'),
      collectorname: getColumnValue('collectorname'),
      actions: (
        <div className={styles.actionsCell}>
          <Button kind="ghost" size="sm" onClick={() => handleViewClick(row)}>
            {t('view', 'View')}
          </Button>
          <Button
            kind="ghost"
            size="sm"
            onClick={() => {
              const formattedRecord = row.record.map((item) => ({
                column: item.column,
                value: formatValue(item.value),
              }));
              exportSingleRecordToPDF(formattedRecord);
            }}
          >
            {t('download', 'Downloads')}
          </Button>
        </div>
      ),
    };
  });

  const refundedItemsColumns = ['service_name', 'qty_paid', 'refund_qty', 'unit_price', 'refund_reason'];

  const refundedItemsDetails = selectedRecord
    ? selectedRecord.record
        .filter((item) => refundedItemsColumns.includes(item.column))
        .map((item) => {
          const label = headerDisplayMap[item.column] || item.column;
          return `${label}: ${formatValue(item.value)}`;
        })
        .join(', ')
    : '';
  const otherDetails = selectedRecord
    ? selectedRecord.record.filter((item) => !refundedItemsColumns.includes(item.column))
    : [];
  const headers = [
    { key: 'no', header: t('no', 'No') },
    { key: 'date', header: headerDisplayMap['date'] },
    { key: 'name', header: headerDisplayMap['name'] },
    { key: 'policy_id_number', header: headerDisplayMap['policy_id_number'] },
    { key: 'beneficiary', header: headerDisplayMap['beneficiary'] },
    { key: 'insurancename', header: headerDisplayMap['insurancename'] },
    { key: 'global_amount', header: headerDisplayMap['global_amount'] },
    { key: 'patientdue', header: headerDisplayMap['patientdue'] },
    { key: 'insurancedue', header: headerDisplayMap['insurancedue'] },
    { key: 'paid_amount', header: headerDisplayMap['paid_amount'] },
    { key: 'bill_status', header: headerDisplayMap['bill_status'] },
    { key: 'admission_type', header: headerDisplayMap['admission_type'] },
    { key: 'global_bill_status', header: headerDisplayMap['global_bill_status'] },
    { key: 'collectorname', header: headerDisplayMap['collectorname'] },
    { key: 'actions', header: t('actions', 'Actions') },
  ];
  return (
    <div className={styles.container}>
      <div className={styles.reportContent}>
        <div className={styles.filterSection}>
          <ReportFilterForm
            fields={['startDate', 'endDate', 'company']}
            onSearch={handleSearch}
            insuranceOptions={[]}
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
            rows={rows}
            headers={headers}
            size="lg"
            useZebraStyles
            isSortable={true}
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
                    {rows.map((row) => (
                      <TableRow key={row.id} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id} title={cell.value}>
                            {cell.column?.id === 'policy_id_number' ? (
                              <div className={styles.policyColumn}>{cell.value}</div>
                            ) : (
                              cell.value
                            )}
                          </TableCell>
                        ))}
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
            pageSizes={getPageSizes()}
            onChange={({ page, pageSize }) => {
              goToPage(page);
              setPageSize(pageSize);
            }}
            totalItems={totalRecords}
          />
        </div>
      )}

      {/* Modal for showing selected record details */}
      {isModalOpen && selectedRecord && (
        <Modal
          open={isModalOpen}
          primaryButtonText={t('download', 'Download')}
          secondaryButtonText={t('close', 'Close')}
          onRequestClose={closeModal}
          onRequestSubmit={() => {
            if (!selectedRecord) return;
            const formattedRecord = selectedRecord.record.map((item) => ({
              column: item.column,
              value: formatValue(item.value),
            }));
            exportSingleRecordToPDF(formattedRecord);
            setModalOpen(false);
          }}
          passiveModal={false}
          size="sm"
        >
          <ul>
            {otherDetails.map((item, i) => (
              <li key={i}>
                <strong>{headerDisplayMap[item.column] || item.column}:</strong> {formatValue(item.value)}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
};

export default ConsommationReport;
