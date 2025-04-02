import React, { useState } from 'react';
import ReportFilterForm from './report-filter-form.component';
import { Table, TableHead, TableHeader, TableBody, TableRow, TableCell, Button } from '@carbon/react';

const ThirdPartyReport: React.FC = () => {
  const [results, setResults] = useState([]);

  const handleSearch = (filters) => {
    const dummyData = [
      { thirdParty: 'UNHCR', patient: 'Alice Uwizeye', amount: 1200, date: '2025-03-29', status: 'Paid' },
      { thirdParty: 'FARG', patient: 'Emmanuel Nshimiyimana', amount: 1800, date: '2025-03-30', status: 'Pending' },
    ];

    setResults(dummyData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Third Party Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'thirdParty']} onSearch={handleSearch} />

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>No</TableHeader>
                <TableHeader>Third Party</TableHeader>
                <TableHeader>Patient</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{row.thirdParty}</TableCell>
                  <TableCell>{row.patient}</TableCell>
                  <TableCell>{row.amount} RWF</TableCell>
                  <TableCell>{row.date}</TableCell>
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

export default ThirdPartyReport;
