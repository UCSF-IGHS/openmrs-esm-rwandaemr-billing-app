/**
 * Facility Information API service
 * Handles fetching facility details from OpenMRS system settings
 */

import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';

// Helper to convert Blob to data URL
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const BASE_API_URL = API_CONFIG.REST_BASE_URL;
const BILLING_API_URL = API_CONFIG.BASE_BILLING_URL;

// Facility information interface
export interface FacilityInfo {
  name: string;
  physicalAddress: string;
  shortCode: string | null;
  email: string;
  logoUrl?: string;
}

// System setting response interface
interface SystemSetting {
  uuid: string;
  property: string;
  value: string | null;
  description: string;
  display: string;
  datatypeClassname: string | null;
  datatypeConfig: string | null;
  preferredHandlerClassname: string | null;
  handlerConfig: string | null;
  links: Array<{
    rel: string;
    uri: string;
    resourceAlias: string;
  }>;
  resourceVersion: string;
}

interface SystemSettingResponse {
  results: SystemSetting[];
}

/**
 * Fetches facility information from OpenMRS system settings
 * @returns Promise<FacilityInfo> - The facility information
 */
export const fetchFacilityInfo = async (): Promise<FacilityInfo> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const [nameResponse, addressResponse, shortCodeResponse, emailResponse, logoDataUrl] = await Promise.all([
          openmrsFetch(`${BASE_API_URL}/systemsetting?q=billing.healthFacilityName`),
          openmrsFetch(`${BASE_API_URL}/systemsetting?q=billing.healthFacilityPhysicalAddress&v=full`),
          openmrsFetch(`${BASE_API_URL}/systemsetting?q=billing.healthFacilityShortCode&v=full`),
          openmrsFetch(`${BASE_API_URL}/systemsetting?q=billing.healthFacilityEmail&v=full`),
          (async () => {
            try {
              const localUrl = `${window.location.origin}/openmrs/ws/rest/v1/mohbilling/healthFacilityLogo`;

              const res = await fetch(localUrl, {
                method: 'GET',
                headers: {
                  Accept: 'image/*,*/*',
                },
                credentials: 'include',
                cache: 'no-store',
              });

              if (!res.ok) {
                return undefined;
              }

              const ct = res.headers.get('content-type') || '';

              if (
                !ct.startsWith('image/') &&
                !ct.includes('octet-stream') &&
                !ct.includes('application/octet-stream')
              ) {
                return undefined;
              }

              const blob = await res.blob();

              if (blob.size === 0) {
                return undefined;
              }

              const dataUrl = await blobToDataUrl(blob);
              return dataUrl;
            } catch (error) {
              return undefined;
            }
          })(),
        ]);

        const nameData = nameResponse.data as SystemSettingResponse;
        const addressData = addressResponse.data as SystemSettingResponse;
        const shortCodeData = shortCodeResponse.data as SystemSettingResponse;
        const emailData = emailResponse.data as SystemSettingResponse;

        const name = nameData.results[0]?.display?.split('=')[1]?.trim() || 'Health Facility';
        const physicalAddress = addressData.results[0]?.value || '';
        const shortCode = shortCodeData.results[0]?.value || null;
        const email = emailData.results[0]?.value || '';

        const cleanEmail = email.replace(/[^\w@.-]/g, '').toLowerCase();

        const logoUrl = logoDataUrl;

        return {
          name,
          physicalAddress,
          shortCode,
          email: cleanEmail,
          logoUrl,
        };
      },
      { component: 'facility-info-api', action: 'fetchFacilityInfo' },
      commonErrorMessages.fetchError,
    ) || {
      name: 'Health Facility',
      physicalAddress: '',
      shortCode: null,
      email: '',
      logoUrl: undefined,
    }
  );
};

/**
 * Fetches a specific facility setting by property name
 * @param property - The system setting property name
 * @returns Promise<string | null> - The setting value or null if not found
 */
export const fetchFacilitySetting = async (property: string): Promise<string | null> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch(`${BASE_API_URL}/systemsetting?q=${property}&v=full`);
        const data = response.data as SystemSettingResponse;
        return data.results[0]?.value || null;
      },
      { component: 'facility-info-api', action: 'fetchFacilitySetting', metadata: { property } },
      commonErrorMessages.fetchError,
    ) || null
  );
};
