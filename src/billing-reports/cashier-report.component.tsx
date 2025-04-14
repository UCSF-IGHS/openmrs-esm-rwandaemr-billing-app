import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyStateComingSoon } from './empty-state/empty-state-comingsoon.component';

const CashierReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('cashierReport', 'Cashier Report');
  const handleSearch = () => {};

  return (
    <div style={{ padding: '1rem' }}>
      <h3>Cashier Report</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'reportType', 'collector']} onSearch={handleSearch} />

      <>
        <EmptyStateComingSoon displayText={headerTitle} headerTitle={headerTitle} />
      </>
    </div>
  );
};

export default CashierReport;
