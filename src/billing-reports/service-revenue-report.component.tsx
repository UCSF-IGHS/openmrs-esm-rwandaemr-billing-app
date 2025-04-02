import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const departmentColumns = [
  'CHIRURGIE',
  'CONSOMMABLES',
  'DERMATOLOGIE',
  'ECHOGRAPHIE',
  'FORMALITES ADMINISTRATIVES',
  'HOSPITALISATION',
  'KINESITHERAPIE',
  'LABORATOIRE',
  'MATERNITE',
  'MEDECINE INTERNE',
  'MEDICAMENTS',
  'OPHTALMOLOGIE',
  'ORL',
  'OXYGENOTHERAPIE',
  'PEDIATRIE',
  'RADIOLOGIE',
  'SOINS INFIRMIERS',
  'SOINS INTENSIFS',
  'STOMATOLOGIE',
  'AUTRES',
  'CONSULTATION',
  'AMBULANCE',
  'TOTAL',
];

const ServiceRevenueReport: React.FC = () => {
  const [results, setResults] = useState([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  const handleSearch = (filters) => {
    setDateRange({
      startDate: filters.startDate?.toLocaleDateString() || '',
      endDate: filters.endDate?.toLocaleDateString() || '',
    });

    const dummyData = [
      {
        service: 'CHIRURGIE',
        CHIRURGIE: 30672,
        CONSOMMABLES: 2143.24,
        ECHOGRAPHIE: 3137,
        HOSPITALISATION: 22176,
        MEDECINE_INTERNE: 5612.45,
        AUTRES: 26376.77,
        CONSULTATION: 18018,
        TOTAL: 116784.46,
      },
      {
        service: 'OPD',
        CONSOMMABLES: 148.24,
        ECHOGRAPHIE: 18742.5,
        FORMALITES_ADMINISTRATIVES: 61932,
        MEDICAMENTS: 14972.6,
        AUTRES: 199829.34,
        CONSULTATION: 100755.68,
        TOTAL: 396380.36,
      },
      {
        service: 'STOMATOLOGIE',
        CHIRURGIE: 4440,
        CONSOMMABLES: 3015.05,
        STOMATOLOGIE: 8460,
        AUTRES: 14656.25,
        CONSULTATION: 5008.5,
        TOTAL: 40537.93,
      },
    ];

    setResults(dummyData);
  };

  const calculateGrandTotal = () => results.reduce((sum, row) => sum + (row.TOTAL || 0), 0).toLocaleString();

  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Service Revenue Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div
            style={{
              background: '#dff5f0',
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>
                Revenue Amount From {dateRange.startDate} To {dateRange.endDate}:
              </strong>{' '}
              {calculateGrandTotal()} FRW
            </div>
            <Button size="sm" kind="tertiary">
              PDF
            </Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>#</TableHeader>
                  <TableHeader>Service</TableHeader>
                  {departmentColumns.map((col, idx) => (
                    <TableHeader key={idx}>{col}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.service}</TableCell>
                    {departmentColumns.map((col, i) => (
                      <TableCell key={i}>{row[col] ? row[col].toLocaleString() : '0'}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRevenueReport;
