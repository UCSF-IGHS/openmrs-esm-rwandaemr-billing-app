import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Billing from './billing.component';
import InvoiceTable from './invoice/invoice-table.component';
import PatientBills from './billing-admin/patientbills.component';
import ConsommationView from './consommation/consommation-view.component';
import ConsommationsList from './consommation/consommations-list.component';
import BillingReportsHome from './billing-reports/billing-reports.component'; // ✅ New

const RootComponent: React.FC = () => {
  const baseName = window.getOpenmrsSpaBase() + 'home'; // ✅ Updated

  return (
    <BrowserRouter basename={baseName}>
      <Routes>
        <Route path="billing" element={<Billing />} />
        <Route path="billing/invoice/:insuranceCardNo" element={<InvoiceTable />} />
        <Route path="billing/patient-bills" element={<PatientBills />} />
        <Route path="billing/consommations/:globalBillId" element={<ConsommationsList />} />
        <Route path="billing/consommation/:consommationId" element={<ConsommationView />} />
        <Route path="billing-reports" element={<BillingReportsHome />} /> {/* ✅ New route */}
      </Routes>
    </BrowserRouter>
  );
};

export default RootComponent;
