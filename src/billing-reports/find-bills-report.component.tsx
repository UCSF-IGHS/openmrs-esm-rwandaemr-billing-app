import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const FindBillsReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    // console.log('🔍 Filter submitted:', filters);

    // Replace this dummy data with API results later
    const dummyData = [
      {
        date: '2025-03-31',
        department: 'GBV',
        creator: 'Dr Samuel',
        policyId: '0220NPW0-E',
        beneficiary: 'Bakundwa Bakundwa',
        insurance: 'Viol',
        total: 1553,
        insuranceDue: 1553,
        patientDue: 0,
        paidAmount: 0,
        billStatus: 'FULLY PAID',
        admissionType: 'Out-Patient',
        globalBillStatus: 'DISCHARGED',
        collector: 'Clerk1',
      },
    ];

    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Find Bills Report</h3>

      {/* 🔎 Reusable Form */}
      <ReportFilterForm
        fields={[
          'startDate',
          'endDate',
          'insurance',
          'service',
          'thirdParty',
          'reportType',
          'billStatus',
          'billCreator',
        ]}
        onSearch={handleSearch}
      />

      {/* 📊 Results Table */}
      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Department</TableHeader>
                <TableHeader>Creator</TableHeader>
                <TableHeader>Policy ID</TableHeader>
                <TableHeader>Beneficiary</TableHeader>
                <TableHeader>Insurance</TableHeader>
                <TableHeader>Total</TableHeader>
                <TableHeader>Insurance Due</TableHeader>
                <TableHeader>Patient Due</TableHeader>
                <TableHeader>Paid Amount</TableHeader>
                <TableHeader>Bill Status</TableHeader>
                <TableHeader>Admission</TableHeader>
                <TableHeader>Global Bill Status</TableHeader>
                <TableHeader>Collector</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.creator}</TableCell>
                  <TableCell>{row.policyId}</TableCell>
                  <TableCell>{row.beneficiary}</TableCell>
                  <TableCell>{row.insurance}</TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.insuranceDue}</TableCell>
                  <TableCell>{row.patientDue}</TableCell>
                  <TableCell>{row.paidAmount}</TableCell>
                  <TableCell>{row.billStatus}</TableCell>
                  <TableCell>{row.admissionType}</TableCell>
                  <TableCell>{row.globalBillStatus}</TableCell>
                  <TableCell>{row.collector}</TableCell>
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

export default FindBillsReport;
