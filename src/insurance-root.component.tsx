import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Insurance from './billing-admin/Insurance';
import { InsurancePolicy } from './insurance-policy/insurance-policy.component';

const InsurancePolicyRootComponent: React.FC = () => {
  const baseName = window.getOpenmrsSpaBase() + 'home/insurance-policy';

  return (
    <BrowserRouter basename={baseName}>
      <Routes>
        <Route path="/" element={<InsurancePolicy />} />
      </Routes>
    </BrowserRouter>
  );
};

export default InsurancePolicyRootComponent;
