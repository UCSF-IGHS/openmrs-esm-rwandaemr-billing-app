import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const RefundReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    const dummyData = [
      {
        refundId: 'RF-001',
        paymentId: 'PM-001',
        cashier: 'Cashier 1',
        submittedOn: '2025-03-30',
        approvedBy: 'Supervisor A',
        confirmedBy: 'Admin A',
        details: 'Lab refund for Alice Kayitesi',
      },
      {
        refundId: 'RF-002',
        paymentId: 'PM-002',
        cashier: 'Cashier 2',
        submittedOn: '2025-03-31',
        approvedBy: 'Supervisor B',
        confirmedBy: 'Admin B',
        details: 'Overpayment for Eric Uwizeye',
      },
    ];
    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Payment Refunds Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'collector']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Refund List: ({results.length})</span>

          <Table useZebraStyles size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>#</TableHeader>
                <TableHeader>Refund Id</TableHeader>
                <TableHeader>Payment Id</TableHeader>
                <TableHeader>Cashier Names</TableHeader>
                <TableHeader>Submitted On</TableHeader>
                <TableHeader>Approved By</TableHeader>
                <TableHeader>Confirmed By</TableHeader>
                <TableHeader>Refunded Items Details</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.refundId}</TableCell>
                  <TableCell>{row.paymentId}</TableCell>
                  <TableCell>{row.cashier}</TableCell>
                  <TableCell>{row.submittedOn}</TableCell>
                  <TableCell>{row.approvedBy}</TableCell>
                  <TableCell>{row.confirmedBy}</TableCell>
                  <TableCell>{row.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default RefundReport;
