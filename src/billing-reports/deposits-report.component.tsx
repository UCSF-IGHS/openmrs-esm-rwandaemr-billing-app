import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';

const DepositsReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('depositsReport', 'Deposits Report');
  const handleSearch = () => {};

  return (
    <div>
      {headerTitle}

      <ReportFilterForm fields={['startDate', 'endDate', 'type', 'collector']} onSearch={handleSearch} />

      <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
    </div>
  );
};

export default DepositsReport;
