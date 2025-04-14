import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyStateComingSoon } from './empty-state/empty-state-comingsoon.component';

const ThirdPartyReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('thirdPartyReport', 'Third Party Report');
  const handleSearch = () => {};

  return (
    <div style={{ padding: '1rem' }}>
      <h3>{headerTitle}</h3>

      <ReportFilterForm fields={['startDate', 'endDate', 'thirdParty']} onSearch={handleSearch} />

      <EmptyStateComingSoon displayText={headerTitle} headerTitle={headerTitle} />
    </div>
  );
};

export default ThirdPartyReport;
