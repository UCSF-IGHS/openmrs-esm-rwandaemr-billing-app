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
  Modal,
  Pagination,
} from '@carbon/react';
import { fetchInsuranceFirms, fetchInsuranceReport } from '../api/billing';
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
  const [selectedRecord, setSelectedRecord] = useState<ReportRecord[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleView = (record: ReportRecord[]) => setSelectedRecord(record);
  const closeModal = () => setSelectedRecord(null);

  const getValue = (record: ReportRecord[], column: string): string => {
    const found = record.find((item) => item.column === column);
    const value = found?.value;
    return formatValue(value);
  };
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

  const goToPage = (newPage: number) => {
    handleSearch(currentFilters!, newPage, pageSize);
  };

  const getPageSizes = (totalItems: number, currentPageSize: number) => {
    return [10, 25, 50, 100];
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
          <Button onClick={() => exportToExcel(columns, results, getValue)}>
            {t('exportExcel', 'Export to Excel')}
          </Button>

          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>{t('no', 'No')}</TableHeader>
                {columns.map((col) => (
                  <TableHeader key={col}>{col}</TableHeader>
                ))}
                <TableHeader>{t('action', 'Action')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col}>{getValue(row.record, col)}</TableCell>
                  ))}
                  <TableCell>
                    <Button kind="ghost" size="sm" onClick={() => handleView(row.record)}>
                      {t('view', 'View')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

          <Modal
            open={!!selectedRecord}
            onRequestClose={closeModal}
            modalHeading={t('recordDetails', 'Record Details')}
            passiveModal
            className={styles.billingDetailModal}
          >
            <div className={styles.billingDetailContent}>
              {selectedRecord?.map((item, idx) => (
                <div className={styles.detailRow} key={idx}>
                  <span className={styles.detailLabel}>{item.column}:</span>
                  <span className={styles.detailValue}>{formatValue(item.value)}</span>
                </div>
              ))}
            </div>

            <div className={styles.modalFooter}>
              <Button kind="secondary" onClick={closeModal}>
                {t('close', 'Close')}
              </Button>
              <Button
                kind="primary"
                onClick={() => {
                  if (!selectedRecord || selectedRecord.length === 0) {
                    alert(t('noRecordSelected', 'No record selected.'));
                    return;
                  }

                  const formattedRecord = selectedRecord.map((item) => ({
                    column: item.column,
                    value: formatValue(item.value),
                  }));

                  exportSingleRecordToPDF(formattedRecord);
                }}
              >
                {t('download', 'Download')}
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
};

export default InsuranceReport;
