import React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@openmrs/esm-patient-common-lib';

const Insurance: React.FC = () => {
  const { t } = useTranslation();

  const headerTitle = t('insurance', 'Insurance');

  return (
    <div>
      <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
    </div>
  );
};

export default Insurance;
