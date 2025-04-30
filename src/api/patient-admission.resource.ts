import useSWR from 'swr';
import { type OpenmrsResource, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';

const BASE_API_URL = '/ws/rest/v1/mohbilling';

/**
 * Hook to fetch disease types from concept dictionary
 * @returns Disease types with uuid and display properties
 */
export function useDiseaseType() {
  const config = useConfig();
  const diseaseTypeConceptUuid = config.diseaseType.diseaseTypeConcept;
  const url = `${restBaseUrl}/concept/${diseaseTypeConceptUuid}?v=custom:(answers:(uuid,display))`;

  const { data, error, isLoading } = useSWR<{ data }>(url, openmrsFetch);

  return {
    diseaseType: data?.data.answers ?? [],
    error,
    isLoading,
  };
}

/**
 * Creates a new patient admission
 * @param admissionData - Object containing admission details
 */
export const createPatientAdmission = async (admissionData: any): Promise<any> => {
  try {
    // Format the admission payload according to API requirements
    const payload = {
      patient: { uuid: admissionData.patientUuid },
      isAdmitted: admissionData.isAdmitted,
      admissionDate: admissionData.admissionDate.toISOString(),
      diseaseType: admissionData.diseaseType,
      admissionType: admissionData.admissionType,
      insurancePolicy: { 
        insuranceCardNo: admissionData.insuranceCardNumber 
      }
    };

    console.log('Creating admission with payload:', payload);

    const response = await openmrsFetch(`${BASE_API_URL}/admission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Admission creation response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating patient admission:', error);
    throw error;
  }
};

/**
 * Creates a new global bill linked to an admission
 * Based on the GlobalBillResource Java implementation, we only need to send the admission object
 * @param globalBillData - Object containing global bill details
 */
export const createGlobalBill = async (globalBillData: any): Promise<any> => {
  try {
    // Based on the Java implementation, we only need to provide the admission object
    // The server will handle:
    // 1. Finding the insurance policy from the admission's insuranceCardNo
    // 2. Checking for existing open global bills
    // 3. Setting the creator and creation date
    // 4. Generating the bill identifier (insuranceCardNo + admissionId)
    const payload = {
      admission: {
        admissionId: globalBillData.admissionId
      }
    };

    console.log('Creating global bill with payload:', payload);

    const response = await openmrsFetch(`${BASE_API_URL}/globalBill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('Global bill creation response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating global bill:', error);
    throw error;
  }
};

/**
 * Creates an admission with a linked global bill in one operation
 * @param data - Combined data for admission and global bill
 */
export const createAdmissionWithGlobalBill = async (data: any): Promise<any> => {
  try {
    console.log('Creating admission and global bill with data:', data);
    
    // First create the admission
    const admission = await createPatientAdmission({
      patientUuid: data.patientUuid,
      isAdmitted: data.isAdmitted,
      admissionDate: data.admissionDate,
      diseaseType: data.diseaseType,
      admissionType: data.admissionType,
      insuranceCardNumber: data.insuranceCardNumber,
      departmentId: data.department
    });
    
    console.log('Admission created successfully:', admission);
    
    // Then create the global bill using the new admission ID
    const globalBill = await createGlobalBill({
      admissionId: admission.admissionId
    });
    
    console.log('Global bill created successfully:', globalBill);
    
    // Return both objects
    return {
      admission,
      globalBill
    };
  } catch (error) {
    console.error('Error creating admission with global bill:', error);
    throw error;
  }
};

/**
 * Fetches global bills by patient UUID
 * @param patientUuid - The patient's UUID
 */
export const getGlobalBillsByPatient = async (patientUuid: string): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?patient=${patientUuid}&v=full`);
    return response.data;
  } catch (error) {
    console.error('Error fetching global bills by patient:', error);
    throw error;
  }
};

/**
 * Fetches a specific global bill by identifier
 * @param billIdentifier - The bill identifier
 */
export const getGlobalBillByIdentifier = async (billIdentifier: string): Promise<any> => {
  try {
    const response = await openmrsFetch(`${BASE_API_URL}/globalBill?billIdentifier=${billIdentifier}&v=full`);
    return response.data;
  } catch (error) {
    console.error('Error fetching global bill by identifier:', error);
    throw error;
  }
};