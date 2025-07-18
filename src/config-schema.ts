import { Type } from '@openmrs/esm-framework';
import { CONFIG_CONSTANTS } from './constants';

export interface BillingConfig {}

export const configSchema = {
  diseaseType: {
    _type: Type.Object,
    _description: 'GET disease types such as Natural Disease, Professional Disease e.t.c.',
    _default: {
      diseaseTypeConcept: CONFIG_CONSTANTS.DISEASE_TYPE_CONCEPT,
    },
  },

  admission: {
    _type: Type.Object,
    _description: 'Concept UUIDs for admission-related attributes',
    _default: {
      patientName: CONFIG_CONSTANTS.ADMISSION_CONCEPTS.PATIENT_NAME,
      billIdentifier: CONFIG_CONSTANTS.ADMISSION_CONCEPTS.BILL_IDENTIFIER,
      insuranceName: CONFIG_CONSTANTS.ADMISSION_CONCEPTS.INSURANCE_NAME,
      cardNumber: CONFIG_CONSTANTS.ADMISSION_CONCEPTS.CARD_NUMBER,
    },
  },
};

export interface ConfigObject {
  diseaseType: Object;
  admission: Object;
}
