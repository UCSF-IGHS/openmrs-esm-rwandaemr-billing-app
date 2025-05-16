import { type Visit } from '@openmrs/esm-framework';
import React from 'react';
import PatientAdmissionForm from './patient-admission-form.component';

interface VisitFormCallbacks {
  onVisitCreatedOrUpdated: (visit: Visit) => Promise<any>;
}
export interface VisitFormInsurancePolicyFieldsProps {
  setVisitFormCallbacks: (callbacks: VisitFormCallbacks) => void;
  visitFormOpenedFrom: string;
  patientUuid: string;
}

/**
 * This extension contains form fields for adding insurance policy details.
 * It is used slotted into the patient-chart's start visit form
 */
const VisitFormInsurancePolicyFields: React.FC<VisitFormInsurancePolicyFieldsProps> = (props) => {
  const { setVisitFormCallbacks, visitFormOpenedFrom } = props;
  return (
    <PatientAdmissionForm
      setOnSubmit={(onSubmit) => setVisitFormCallbacks({ onVisitCreatedOrUpdated: onSubmit })}
      patientUuid={props.patientUuid}
      closeWorkspace={() => {}}
      setExtraVisitInfo={() => {}}
    />
  );
};

export default VisitFormInsurancePolicyFields;
