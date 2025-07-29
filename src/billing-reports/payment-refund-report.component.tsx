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
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  InlineNotification,
  DataTableSkeleton,
} from '@carbon/react';
import dayjs from 'dayjs';
import { exportToExcel, formatValue, formatToYMD, exportSingleRecordToPDF } from './utils/download-utils';
import styles from './billing-reports.scss';
import { useTranslation } from 'react-i18next';
import { fetchRefundPaymentReport, fetchAllRefundPaymentReport } from './api/billing-reports';
import { showSnackbar } from '@openmrs/esm-framework';

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
  collector: string;
}

const PaymentRefundReport: React.FC = () => {
  const { t } = useTranslation();

  const [results, setResults] = useState<ReportRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ReportRow | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [allResults, setAllResults] = useState([]);
  const [, setPaginatedResults] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const headerTitle = t('paymentRefundReport', 'Payment Refund Report');

  const paginateResults = (data, currentPage, size) => {
    const startIndex = (currentPage - 1) * size;
    const endIndex = startIndex + size;
    const pageData = data.slice(startIndex, endIndex);
    setPaginatedResults(pageData);
  };

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };

  const handleExportClick = async () => {
    if (!currentFilters) return;

    setLoading(true);
    try {
      const { startDate, endDate, collector } = currentFilters;
      const allResults = await fetchAllRefundPaymentReport(
        formatToYMD(startDate),
        formatToYMD(endDate),
        collector || '',
      );

      exportToExcel(columns, allResults, getValue, 'payment-refund-report.xlsx');
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

  const refundedItemsColumns = ['service_name', 'qty_paid', 'refund_qty', 'unit_price', 'refund_reason'];

  const headerDisplayMap: Record<string, string> = {
    refund_id: t('refundId', 'Refund Id'),
    payment_id: t('paymentId', 'Payment Id'),
    cashier_name: t('cashierName', 'Cashier Name'),
    submitted_on: t('submittedOn', 'Submitted On'),
    approvedby: t('approvedBy', 'Approved By'),
    confirmed_by: t('confirmedBy', 'Confirmed By'),
    service_name: t('serviceName', 'Service Name'),
    qty_paid: t('qtyPaid', 'Quantity Paid'),
    refund_qty: t('refundQty', 'Refund Quantity'),
    unit_price: t('unitPrice', 'Unit Price'),
    refund_reason: t('refundReason', 'Refund Reason'),
  };

  const handleSearch = async (filters: Filters, pageNum = 1, pageSize = 50) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const formattedStart = formatToYMD(filters.startDate);
      const formattedEnd = formatToYMD(filters.endDate);

      const { results, total } = await fetchRefundPaymentReport(
        formattedStart,
        formattedEnd,
        filters.collector || '', // Use collector from form or empty string
        1,
        10000,
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
      setHasSearched(true);
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

  const goToPage = (newPage: number) => {
    setPage(newPage);
    paginateResults(allResults, newPage, pageSize);
  };

  const getPageSizes = () => [50];

  const formatDateTime = (dateString: string | string[] | undefined) => {
    if (!dateString) return '-';
    const val = Array.isArray(dateString) ? dateString[0] : dateString;
    return dayjs(val).isValid() ? dayjs(val).format('YYYY-MM-DD HH:mm') : formatValue(val);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRecord(null);
  };

  const groupedByRefundId: { [key: string]: ReportRow[] } = {};

  results.forEach((row) => {
    const refundId = getValue(row.record, 'refund_id');
    if (!groupedByRefundId[refundId]) {
      groupedByRefundId[refundId] = [];
    }
    groupedByRefundId[refundId].push(row);
  });

  const rows = Object.entries(groupedByRefundId)
    .filter(([_, group]) => group.length > 0)
    .map(([refundId, group], index) => {
      const firstRow = group.find((r) => getValue(r.record, 'payment_id')) || group[0];

      if (!firstRow || !firstRow.record) {
        console.warn('Missing or malformed row for refund ID:', refundId);
        return null;
      }

      const baseRecord = firstRow.record;

      const getColumnValue = (col: string) => {
        const found = baseRecord.find((item) => item.column === col);
        return found ? formatValue(found.value) : '-';
      };

      const submittedOnValue = baseRecord.find((item) => item.column === 'submitted_on')?.value;

      const refundedItems = group
        .map((row, idx) => {
          const itemMap: Record<string, string> = {};
          row.record.forEach((item) => {
            if (item?.column && refundedItemsColumns.includes(item.column)) {
              itemMap[item.column] = formatValue(item.value);
            }
          });
          return `${idx + 1}. ${itemMap.service_name || '-'}\t${itemMap.qty_paid || '-'}\t${itemMap.refund_qty || '-'}\t${itemMap.unit_price || '-'}\t${itemMap.refund_reason || '-'}`;
        })
        .join('\n');

      return {
        id: refundId,
        no: index + 1,
        refund_id: refundId,
        payment_id: getColumnValue('payment_id'),
        cashier_name: getColumnValue('cashier_name'),
        submitted_on: formatDateTime(submittedOnValue),
        approvedby: getColumnValue('approvedby'),
        confirmed_by: getColumnValue('confirmed_by'),
        refunded_items: refundedItems,
        record: baseRecord,
      };
    })
    .filter(Boolean);

  const otherDetails = selectedRecord
    ? selectedRecord.record.filter((item) => !refundedItemsColumns.includes(item.column))
    : [];
  const headers = [
    { key: 'no', header: t('no', 'No') },
    { key: 'refund_id', header: t('refundId', 'Refund Id') },
    { key: 'payment_id', header: t('paymentId', 'Payment Id') },
    { key: 'cashier_name', header: t('cashierName', 'Cashier Name') },
    { key: 'submitted_on', header: t('submittedOn', 'Submitted On') },
    { key: 'approvedby', header: t('approvedBy', 'Approved By') },
    { key: 'confirmed_by', header: t('confirmedBy', 'Confirmed By') },
  ];

  return (
    <div>
      {headerTitle}

      <div className={styles.reportContent}>
        <div className={styles.filterSection}>
          <ReportFilterForm fields={['startDate', 'endDate', 'collector']} onSearch={handleSearch} />
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
          <DataTable rows={rows} headers={headers} useZebraStyles isSortable overflowMenuOnHover={false}>
            {({ rows, headers, getTableProps, getTableContainerProps, getHeaderProps, getRowProps }) => (
              <TableContainer {...getTableContainerProps()}>
                <Table {...getTableProps()}>
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
                    {rows.map((row) => {
                      return (
                        <React.Fragment key={row.id}>
                          <TableExpandRow {...getRowProps({ row })}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableExpandRow>
                          {row.isExpanded && (
                            <TableExpandedRow colSpan={headers.length + 1}>
                              <strong>{t('refundedItemsDetails', 'Refunded Items Details')}</strong>{' '}
                              <div className={styles.refundedItemsTableWrapper}>
                                <Table size="md">
                                  <TableHead>
                                    <TableRow>
                                      <TableHeader>{t('no', 'No')}</TableHeader>
                                      <TableHeader>{t('serviceName', 'Service Name')}</TableHeader>
                                      <TableHeader>{t('qtyPaid', 'Quantity Paid')}</TableHeader>
                                      <TableHeader>{t('refundQty', 'Refund Quantity')}</TableHeader>
                                      <TableHeader>{t('unitPrice', 'Unit Price (Rwf)')}</TableHeader>
                                      <TableHeader>{t('refundReason', 'Reason')}</TableHeader>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {groupedByRefundId[row.id]?.map((rowItem, index) => {
                                      const itemMap: Record<string, string> = {};
                                      rowItem.record.forEach((item) => {
                                        if (refundedItemsColumns.includes(item.column)) {
                                          itemMap[item.column] = formatValue(item.value);
                                        }
                                      });

                                      return (
                                        <TableRow key={index}>
                                          <TableCell>{index + 1}</TableCell>
                                          <TableCell>{itemMap.service_name || '-'}</TableCell>
                                          <TableCell>{itemMap.qty_paid || '-'}</TableCell>
                                          <TableCell>{itemMap.refund_qty || '-'}</TableCell>
                                          <TableCell>{itemMap.unit_price || '-'}</TableCell>
                                          <TableCell>{itemMap.refund_reason || '-'}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className={styles.expandedDownloadRow}>
                                <Button
                                  size="sm"
                                  kind="primary"
                                  onClick={() => {
                                    const fullRecord = groupedByRefundId[row.id]?.flatMap((r) => r.record) || [];
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
                            </TableExpandedRow>
                          )}
                        </React.Fragment>
                      );
                    })}
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
            totalItems={rows.length}
          />
        </div>
      )}

      {/* Modal for showing selected record details */}
      {isModalOpen && selectedRecord && (
        <Modal
          open={isModalOpen}
          modalHeading={t('paymentRefundDetails', 'Payment Refund Details')}
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
            <li>
              <strong>{t('paymentRefundedItemsDetails', 'Payment Refunded Items Details')}:</strong>
              <ul>
                {selectedRecord?.record
                  .filter((item) => refundedItemsColumns.includes(item.column))
                  .map((item, idx) => (
                    <li key={idx}>
                      {headerDisplayMap[item.column] || item.column}: {formatValue(item.value)}
                    </li>
                  ))}
              </ul>
            </li>
          </ul>
        </Modal>
      )}
    </div>
  );
};

export default PaymentRefundReport;
