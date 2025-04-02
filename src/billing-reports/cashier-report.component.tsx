import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const CashierReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    // Replace with API call later
    const dummyData = [
      { date: '2025-03-28', collector: 'Cashier 1', amount: '5,000 RWF', paymentMode: 'Cash' },
      { date: '2025-03-29', collector: 'Cashier 2', amount: '3,200 RWF', paymentMode: 'Mobile Money' },
    ];

    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Cashier Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'reportType', 'collector']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Collector</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Payment Mode</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.collector}</TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.paymentMode}</TableCell>
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

export default CashierReport;
