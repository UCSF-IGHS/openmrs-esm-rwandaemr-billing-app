import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';

const CashierReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('cashierReport', 'Cashier Report');
  const handleSearch = () => {};

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Cashier Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'reportType', 'collector']} onSearch={handleSearch} />

      <>
        <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
      </>
    </div>
  );
};

export default CashierReport;
