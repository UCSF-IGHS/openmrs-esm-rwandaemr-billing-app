import { Type } from '@openmrs/esm-framework';

export interface BillingConfig {}

export const configSchema = {
  diseaseType: {
    _type: Type.Object,
    _description: 'GET disease types such as Natural Disease, Professional Disease e.t.c.',
    _default: {
      diseaseTypeConcept: '90029723-7058-40bd-b20a-e369524cb355',
    },
  },

  admission: {
    _type: Type.Object,
    _description: 'Concept UUIDs for admission-related attributes',
    _default: {
      patientName: '1528AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      billIdentifier: '159465AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      insuranceName: '8da67e73-776c-43f6-9758-79d1f6786db3',
      cardNumber: 'b78996b6-1ee8-4201-8cb8-69ab676ee7d2',
    },
  }
};

export interface ConfigObject {
  diseaseType: Object;
  admission: Object;
}
