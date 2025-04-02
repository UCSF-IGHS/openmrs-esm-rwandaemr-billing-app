import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const DepositsReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    const dummyData = [
      { date: '2025-03-30', collector: 'Admin', patient: 'Jane Doe', amount: 1000, reason: 'deposit' },
      { date: '2025-03-31', collector: 'Admin', patient: 'John Smith', amount: 500, reason: 'withdrawal' },
    ];

    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Deposits Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'type', 'collector']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Collector</TableHeader>
                <TableHeader>Patient</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Reason</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.collector}</TableCell>
                  <TableCell>{row.patient}</TableCell>
                  <TableCell>{row.amount} RWF</TableCell>
                  <TableCell>{row.reason}</TableCell>
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

export default DepositsReport;
