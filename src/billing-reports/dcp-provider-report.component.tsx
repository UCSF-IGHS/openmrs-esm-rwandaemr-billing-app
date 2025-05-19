import React from 'react';
import { useTranslation } from 'react-i18next';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';

const DcpProviderReport: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('dcpProviderReport', 'DCP Provider Report');
  const handleSearch = () => {};

  return (
    <div>
      {headerTitle}

      <ReportFilterForm fields={['startDate', 'endDate', 'thirdParty']} onSearch={handleSearch} />

      <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
    </div>
  );
};

export default DcpProviderReport;
