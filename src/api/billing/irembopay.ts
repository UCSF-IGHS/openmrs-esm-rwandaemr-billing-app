import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG } from '../../constants';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

// Irembo Pay request interface
export interface IremboPayRequest {
  accountIdentifier: string; // Phone number
  paymentProvider: 'MTN' | 'AIRTEL';
  consommationId: string;
}

// Irembo Pay response interface
export interface IremboPayResponse {
  success: boolean;
  message: string;
  data?: {
    accountIdentifier: string;
    paymentProvider: string;
    invoiceNumber: string;
    amount: number;
    referenceId: string;
  };
  errors?: Array<{
    code: string;
    detail: string;
  }>;
}

/**
 * Initiates an Irembo Pay transaction for a consommation
 * @param request - The Irembo Pay request data
 * @returns Promise with the Irembo Pay response
 */
export const initiateIremboPayTransaction = async (request: IremboPayRequest): Promise<IremboPayResponse> => {
  try {
    const response = await openmrsFetch<IremboPayResponse>(`${BASE_API_URL}/irembopay/transactions/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (response.status >= 400) {
      throw new Error(`Irembo Pay transaction failed with status ${response.status}`);
    }

    return response.data;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'initiateIremboPayTransaction' },
      commonErrorMessages.saveError,
    );
    throw error;
  }
};
