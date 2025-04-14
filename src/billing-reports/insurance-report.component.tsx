import React, { useState, useEffect } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button, Modal } from '@carbon/react';
import { fetchInsuranceFirms, fetchInsuranceReport } from '../api/billing';
import dayjs from 'dayjs';
import { exportSingleRecordToPDF, exportToExcel, formatValue } from './utils/download-utils';
import styles from './billing-reports.scss';

const InsuranceReport: React.FC = () => {
  const [results, setResults] = useState([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [insuranceOptions, setInsuranceOptions] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const handleView = (record) => {
    setSelectedRecord(record);
  };

  const closeModal = () => setSelectedRecord(null);

  const handleSearch = async (filters) => {
    setLoading(true);
    try {
      const formattedStart = dayjs(filters.startDate).format('YYYY-MM-DD');
      const formattedEnd = dayjs(filters.endDate).format('YYYY-MM-DD');
      const results = await fetchInsuranceReport(formattedStart, formattedEnd, filters.insurance);

      if (results.length > 0) {
        const columnNames = results[0].record.map((item) => item.column);
        setColumns(columnNames);
      }

      setResults(results);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValue = (record, column) => {
    const found = record.find((item) => item.column === column);
    return Array.isArray(found?.value) ? found.value.join('-') : (found?.value ?? '');
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const options = await fetchInsuranceFirms();
        setInsuranceOptions(options);
      } catch (e) {
        console.error('Error loading insurance options:', e);
      }
    };

    loadOptions();
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Insurance Report</h3>

      <ReportFilterForm
        fields={['startDate', 'endDate', 'insurance']}
        onSearch={handleSearch}
        insuranceOptions={insuranceOptions}
      />

      {loading && <p>Loading...</p>}
      {!loading && results.length === 0 && <p>No results found.</p>}

      {!loading && results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Button onClick={() => exportToExcel(columns, results, getValue)}>Export to Excel</Button>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                {columns.map((col) => (
                  <TableHeader key={col}>{col}</TableHeader>
                ))}
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  {columns.map((col) => (
                    <TableCell key={col}>{getValue(row.record, col)}</TableCell>
                  ))}
                  <TableCell>
                    <Button kind="ghost" size="sm" onClick={() => handleView(row.record)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Modal outside the Table */}
          import styles from './billing.module.scss'; // or './billing.scss' if not using modules
          <Modal
            open={!!selectedRecord}
            onRequestClose={closeModal}
            modalHeading="Record Details"
            passiveModal
            className="billing-detail-modal"
          >
            <div className={styles.billingDetailContent}>
              {selectedRecord?.map((item, idx) => (
                <div className={styles.detailRow} key={idx}>
                  <span className={styles.detailLabel}>{item.column}:</span>
                  <span className={styles.detailValue}>{formatValue(item.value)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
              <Button kind="secondary" onClick={closeModal}>
                Close
              </Button>
              <Button
                kind="primary"
                onClick={() => {
                  if (!selectedRecord || selectedRecord.length === 0) {
                    alert('No record selected.');
                    return;
                  }
                  const formattedRecord = selectedRecord.map((item) => ({
                    column: item.column,
                    value: formatValue(item.value),
                  }));

                  exportSingleRecordToPDF(formattedRecord);
                }}
              >
                Download
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
};

export default InsuranceReport;
