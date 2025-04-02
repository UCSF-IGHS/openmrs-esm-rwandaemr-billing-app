import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const InsuranceReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    const dummyData = [
      {
        insurance: 'MMI',
        patient: 'Pacifique Iradukunda',
        total: 1500,
        covered: 1000,
        patientDue: 500,
        status: 'Paid',
      },
      { insurance: 'RAMA', patient: 'Diane Mukamana', total: 2000, covered: 1800, patientDue: 200, status: 'Pending' },
    ];

    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Insurance Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'insurance', 'reportType']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Insurance</TableHeader>
                <TableHeader>Patient</TableHeader>
                <TableHeader>Total (RWF)</TableHeader>
                <TableHeader>Covered</TableHeader>
                <TableHeader>Patient Due</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.insurance}</TableCell>
                  <TableCell>{row.patient}</TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.covered}</TableCell>
                  <TableCell>{row.patientDue}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>
                    <Button kind="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default InsuranceReport;
