import { Type } from '@openmrs/esm-framework';

export interface BillingConfig {}

export const configSchema = {
  diseaseType: {
    _type: Type.Object,
    _description: 'GET disease types such as Natural Disease, Professional Disease e.t.c.',
    _default: {
      diseaseTypeConcept: '90029723-7058-40bd-b20a-e369524cb355',
    },
  }
};

export interface ConfigObject {
  diseaseType: Object;
}
