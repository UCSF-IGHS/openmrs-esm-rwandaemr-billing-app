import { openmrsFetch } from '@openmrs/esm-framework';

export interface PatientPhoneNumber {
  phoneNumber: string;
  success: boolean;
  error?: string;
}

/**
 * Fetches patient phone number from OpenMRS person endpoint
 * @param patientUuid - The UUID of the patient
 * @returns Promise<PatientPhoneNumber> - Object containing phone number and success status
 */
export async function fetchPatientPhoneNumber(patientUuid: string): Promise<PatientPhoneNumber> {
  if (!patientUuid) {
    return {
      phoneNumber: '',
      success: false,
      error: 'Patient UUID is required',
    };
  }

  try {
    // Fetch patient details from OpenMRS API
    const response = await openmrsFetch(`/ws/rest/v1/person/${patientUuid}?v=full`);
    const personData = response.data;

    // Look for phone number in attributes
    const phoneAttribute = personData.attributes?.find((attr: any) => attr.attributeType?.display === 'Phone number');

    if (phoneAttribute?.value) {
      return {
        phoneNumber: phoneAttribute.value,
        success: true,
      };
    } else {
      return {
        phoneNumber: '',
        success: false,
        error: 'No phone number found for this patient',
      };
    }
  } catch (error) {
    console.error('Error fetching patient phone number:', error);
    return {
      phoneNumber: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Fetches patient basic information from OpenMRS person endpoint
 * @param patientUuid - The UUID of the patient
 * @returns Promise<any> - Patient data object
 */
export async function fetchPatientInfo(patientUuid: string): Promise<any> {
  if (!patientUuid) {
    throw new Error('Patient UUID is required');
  }

  try {
    const response = await openmrsFetch(`/ws/rest/v1/person/${patientUuid}?v=full`);
    return response.data;
  } catch (error) {
    console.error('Error fetching patient info:', error);
    throw error;
  }
}
