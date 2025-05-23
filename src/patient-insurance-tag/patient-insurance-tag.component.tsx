import React from 'react';
import { usePatientInsurancePolicies } from './patient-insurance-tag.resource';
import { Tag } from '@carbon/react';

interface PatientInsuranceTagProps {
  patientUuid: string;
}

const PatientInsuranceTag: React.FC<PatientInsuranceTagProps> = ({ patientUuid }) => {
  const { data, isLoading, mutate } = usePatientInsurancePolicies(patientUuid);

  if (!isLoading && data.length === 0) {
    return (
      <div>
        <Tag type="red">No insurance policy</Tag>
      </div>
    );
  }
};

export default PatientInsuranceTag;
