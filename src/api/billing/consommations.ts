import { openmrsFetch } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../../utils/error-handler';
import { API_CONFIG, BILLING_CONSTANTS } from '../../constants';
import type {
  Consommation,
  ConsommationListResponse,
  ConsommationStatusResponse,
  ConsommationRates,
  ConsommationItem,
  Insurance,
} from '../types';

const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;

/**
 * Fetches consommation by ID
 * @param consommationId - The consommation ID
 * @returns Promise with consommation data
 */
export const getConsommationById = async (consommationId: string): Promise<Consommation> => {
  const response = await openmrsFetch<Consommation>(`${BASE_API_URL}/consommation/${consommationId}`);
  return response.data;
};

/**
 * Fetches consommations by global bill ID
 * @param globalBillId - The global bill ID
 * @returns Promise with consommations list
 */
export const getConsommationsByGlobalBillId = async (globalBillId: string): Promise<ConsommationListResponse> => {
  const response = await openmrsFetch<ConsommationListResponse>(
    `${BASE_API_URL}/consommation?globalBillId=${globalBillId}`,
  );
  return response.data;
};

/**
 * Utility to extract service name from a bill item
 * Updated to work with the new BillableService structure
 */
function extractServiceName(billItem: any, departmentName = 'Unknown') {
  if (billItem.service && billItem.service.facilityServicePrice && billItem.service.facilityServicePrice.name) {
    return billItem.service.facilityServicePrice.name;
  } else if (billItem.serviceOtherDescription) {
    return billItem.serviceOtherDescription;
  } else if (billItem.serviceOther) {
    return billItem.serviceOther;
  } else {
    return `${departmentName} Service Item`;
  }
}

/**
 * Helper function to extract patient service bill ID
 */
function extractPatientServiceBillId(item: any, index: number): number {
  try {
    if (item.links && Array.isArray(item.links)) {
      const patientServiceBillLink = item.links.find((link: any) => link.resourceAlias === 'patientServiceBill');

      if (patientServiceBillLink && patientServiceBillLink.uri) {
        const idMatch = patientServiceBillLink.uri.match(/\/patientServiceBill\/(\d+)/);
        if (idMatch && idMatch[1]) {
          return parseInt(idMatch[1]);
        }
      }
    }

    return BILLING_CONSTANTS.DEFAULT_PATIENT_SERVICE_BILL_ID_BASE + index;
  } catch (error) {
    errorHandler.handleWarning(
      'Error extracting patient service bill ID',
      { error: error.message, item },
      { component: 'billing-api', action: 'extractPatientServiceBillId' },
    );
    return BILLING_CONSTANTS.DEFAULT_PATIENT_SERVICE_BILL_ID_BASE + index;
  }
}

/**
 * Fetches detailed items for a specific consommation with improved service name display
 * Updated to handle BillableService structure
 * @param consommationId - The ID of the consommation to fetch items for
 * @returns Promise containing the items for the specified consommation
 */
export async function getConsommationItems(consommationId: string): Promise<ConsommationItem[]> {
  try {
    const consommationData = await getConsommationById(consommationId);

    const departmentName = consommationData.department?.name || 'Unknown Department';

    const items = consommationData.billItems.map((item: any, index: number) => {
      const itemName = extractServiceName(item, departmentName);

      const itemTotal = item.quantity * item.unitPrice;
      const paidAmount = item.paidQuantity ? item.paidQuantity * item.unitPrice : item.paid ? itemTotal : 0;
      const remainingAmount = Math.max(0, itemTotal - paidAmount);

      const isFullyPaid = item.paid || remainingAmount <= 0;
      const isPartiallyPaid = !isFullyPaid && paidAmount > 0;

      return {
        itemId: index + 1,
        itemCode: `ITEM-${index + 1}`,
        itemName: itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        serviceDate: item.serviceDate,
        itemType: item.itemType,
        paid: isFullyPaid,
        partiallyPaid: isPartiallyPaid,
        paidQuantity: item.paidQuantity || 0,
        drugFrequency: item.drugFrequency,
        patientServiceBillId: extractPatientServiceBillId(item, index),
        serviceId: item.service?.serviceId,
        selected: false,
      };
    });

    return items;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getConsommationItems', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    );
    throw error;
  }
}

/**
 * Gets the insurance rates for a consommation from its related insurance policy
 * @param consommationId - The consommation ID
 * @returns Promise with rates object containing insurance and patient percentages
 */
export const getConsommationRates = async (
  consommationId: string,
  globalBillId?: string,
): Promise<ConsommationRates> => {
  try {
    // Get consommation details
    const consommation = await getConsommationById(consommationId);

    if (!consommation?.patientBill?.policyIdNumber) {
      errorHandler.handleWarning(
        'Insurance card number not found in consommation',
        { consommationId },
        { component: 'billing-api', action: 'getConsommationRates' },
      );
      return { insuranceRate: 0, patientRate: 100 };
    }

    const insuranceCardNo = consommation.patientBill.policyIdNumber;
    const insuranceName = consommation.patientBill.insuranceName || '';

    // First, try to get the global bill's insurance policy instead of the consommation's
    try {
      // Use provided globalBillId
      if (globalBillId) {
        // Fetch the global bill to get its insurance policy
        const { getGlobalBillById } = await import('./global-bills');
        const globalBillData = await getGlobalBillById(globalBillId);

        if (globalBillData?.admission?.insurancePolicy?.insurance?.insuranceId) {
          const globalBillInsuranceId = globalBillData.admission.insurancePolicy.insurance.insuranceId;

          // Get the insurance details from the global bill's insurance
          const insuranceData = await getInsuranceById(globalBillInsuranceId);

          if (insuranceData) {
            const currentRate =
              insuranceData.rate !== null && insuranceData.rate !== undefined ? Number(insuranceData.rate) : 0;

            return {
              insuranceRate: currentRate,
              patientRate: 100 - currentRate,
              insuranceName: insuranceData.name,
            };
          }
        }
      }
    } catch (globalBillError) {
      console.warn(`Failed to get global bill insurance, falling back to consommation policy:`, globalBillError);
    }

    // Fallback to the original method using consommation's policy
    try {
      const policyResponse = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?insuranceCardNo=${insuranceCardNo}`);

      if (!policyResponse.ok || !policyResponse.data?.results?.length) {
        throw new Error(`No insurance policy found for card number: ${insuranceCardNo}`);
      }

      const policy = policyResponse.data.results[0];

      if (!policy.insurance || !policy.insurance.insuranceId) {
        throw new Error('Insurance information missing from policy');
      }

      // Get the insurance details with rate
      const insuranceId = policy.insurance.insuranceId;
      const insuranceData = await getInsuranceById(insuranceId);

      if (!insuranceData) {
        throw new Error(`Failed to fetch insurance details for ID: ${insuranceId}`);
      }

      const currentRate =
        insuranceData.rate !== null && insuranceData.rate !== undefined ? Number(insuranceData.rate) : 0;

      return {
        insuranceRate: currentRate,
        patientRate: 100 - currentRate,
        insuranceName: insuranceName || insuranceData.name,
      };
    } catch (policyError) {
      errorHandler.handleWarning(
        'Error fetching policy, trying to match by name',
        { policyError: policyError.message, insuranceCardNo },
        { component: 'billing-api', action: 'getConsommationRates' },
      );

      if (insuranceName) {
        try {
          const { getInsurances } = await import('./insurance');
          const insurances = await getInsurances();
          const matchingInsurance = insurances.find(
            (ins: Insurance) => ins.name.toLowerCase() === insuranceName.toLowerCase(),
          );

          if (matchingInsurance && matchingInsurance.rate !== null && matchingInsurance.rate !== undefined) {
            const insuranceRate = Number(matchingInsurance.rate);
            return {
              insuranceRate: insuranceRate,
              patientRate: 100 - insuranceRate,
              insuranceName: insuranceName,
            };
          }
        } catch (err) {
          errorHandler.handleError(
            err,
            { component: 'billing-api', action: 'getConsommationRates' },
            { title: 'Error fetching insurances for fallback', kind: 'error' },
          );
        }
      }

      // Last resort default
      return {
        insuranceRate: 0,
        patientRate: 100,
        insuranceName: insuranceName,
      };
    }
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getConsommationRates', metadata: { consommationId } },
      { title: 'Error fetching consommation rates', kind: 'error' },
    );
    return { insuranceRate: 0, patientRate: 100 };
  }
};

// Helper function to get insurance by ID (imported from insurance module)
async function getInsuranceById(insuranceId: number): Promise<Insurance | null> {
  try {
    const { getInsuranceById } = await import('./insurance');
    return await getInsuranceById(insuranceId);
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getInsuranceById', metadata: { insuranceId } },
      { title: `Error fetching insurance ID ${insuranceId}`, kind: 'error' },
    );
    return null;
  }
}

/**
 * Creates a consommation directly with beneficiary
 * Backend will handle creating PatientBill, InsuranceBill, and ThirdPartyBill based on insurance policy rates
 * With proper unitPrice handling to ensure Double values
 *
 * @param globalBillId - The global bill ID
 * @param departmentId - The department ID
 * @param beneficiaryId - The beneficiary ID
 * @param items - The bill items
 * @returns Promise with the complete consommation including all bill items
 */
export const createDirectConsommationWithBeneficiary = async (
  globalBillId: number,
  departmentId: number,
  beneficiaryId: number,
  items: Array<{
    serviceId?: number | string;
    quantity: number;
    price?: number;
    drugFrequency?: string;
    hopServiceId?: number;
  }>,
): Promise<any> => {
  try {
    const billItems = items.map((item) => {
      const unitPrice = parseFloat((item.price || 0).toString()) + 0.000001;
      const serviceIdForPayload = parseInt(item.serviceId?.toString() || '0', 10);

      return {
        service: {
          serviceId: serviceIdForPayload,
        },
        hopService: {
          serviceId: item.hopServiceId || departmentId,
        },
        unitPrice: unitPrice,
        quantity: item.quantity,
        drugFrequency: item.drugFrequency || '',
      };
    });

    const expectedItemCount = billItems.length;
    const consommationPayload = {
      globalBill: { globalBillId },
      department: { departmentId },
      beneficiary: { beneficiaryId },
      billItems,
    };

    let response;
    let consommationId;

    try {
      response = await openmrsFetch(`${BASE_API_URL}/consommation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consommationPayload),
      });

      if (!response.ok) {
        errorHandler.handleError(
          new Error(`API returned status ${response.status}`),
          { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary', metadata: { response } },
          { title: 'Consommation creation failed', kind: 'error' },
        );
        throw new Error(`API returned status ${response.status}`);
      }

      consommationId = response.data?.consommationId;
    } catch (error) {
      // Handle the specific paymentStatus serialization error
      const isPaymentStatusError =
        error.message &&
        (error.message.includes('paymentStatus') ||
          error.message.includes('ConversionException') ||
          error.message.includes('NullPointerException'));

      // Also check for 500 status which might indicate backend serialization error
      const isSerializationError = error.status === 500 && error.responseText;

      if (isPaymentStatusError || isSerializationError) {
        errorHandler.handleWarning(
          'Consommation creation likely succeeded but response serialization failed due to paymentStatus issue',
          { error: error.message, status: error.status },
          { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
        );

        // Try to find the most recently created consommation for this global bill
        try {
          const recentConsommationsResponse = await openmrsFetch(
            `${BASE_API_URL}/consommation?globalBillId=${globalBillId}&limit=1&sort=createdDate:desc`,
          );

          if (recentConsommationsResponse.ok && recentConsommationsResponse.data?.results?.length > 0) {
            const recentConsommation = recentConsommationsResponse.data.results[0];
            consommationId = recentConsommation.consommationId;
            errorHandler.handleInfo(
              'Found recently created consommation',
              { consommationId },
              { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
            );
          } else {
            // Try alternative approach - get all consommations for this global bill
            const allConsommationsResponse = await openmrsFetch(
              `${BASE_API_URL}/consommation?globalBillId=${globalBillId}&v=default`,
            );

            if (allConsommationsResponse.ok && allConsommationsResponse.data?.results?.length > 0) {
              // Find the most recent one by sorting by ID (assuming higher IDs are newer)
              const sortedConsommations = allConsommationsResponse.data.results.sort(
                (a: any, b: any) => b.consommationId - a.consommationId,
              );
              consommationId = sortedConsommations[0].consommationId;
              errorHandler.handleInfo(
                'Found consommation using alternative method',
                { consommationId },
                { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
              );
            }
          }
        } catch (fetchError) {
          errorHandler.handleError(
            fetchError,
            { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
            { title: 'Failed to fetch recent consommations', kind: 'error' },
          );
        }
      }

      if (!consommationId) {
        errorHandler.handleError(
          error,
          { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
          { title: 'Error creating consommation', kind: 'error' },
        );
        throw error;
      }
    }

    if (!consommationId) {
      errorHandler.handleError(
        new Error('No consommation ID found in response'),
        { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
        { title: 'No consommation ID found in response', kind: 'error' },
      );
      return {
        ...response?.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: 0,
      };
    }

    try {
      const completeConsommationResponse = await openmrsFetch(`${BASE_API_URL}/consommation/${consommationId}?v=full`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!completeConsommationResponse.ok) {
        errorHandler.handleWarning(
          `Failed to fetch complete consommation: ${completeConsommationResponse.status}`,
          { status: completeConsommationResponse.status },
          { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
        );
        return {
          ...response.data,
          _itemsCount: expectedItemCount,
          _actualItemsReturned: 0,
        };
      }

      const actualItemsReturned = completeConsommationResponse.data.billItems?.length || 0;
      return {
        ...completeConsommationResponse.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: actualItemsReturned,
      };
    } catch (fetchError) {
      errorHandler.handleError(
        fetchError,
        { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
        { title: 'Error fetching complete consommation', kind: 'error' },
      );
      return {
        ...response.data,
        _itemsCount: expectedItemCount,
        _actualItemsReturned: 0,
      };
    }
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'createDirectConsommationWithBeneficiary' },
      { title: 'Error creating consommation', kind: 'error' },
    );
    throw error;
  }
};

/**
 * Fetches the real-time consommation status from the server using the isPaid flag
 * @param consommationId - The consommation ID to check status for
 * @returns Promise with the consommation status response containing isPaid status
 */
export const getConsommationStatus = async (consommationId: string): Promise<ConsommationStatusResponse | null> => {
  return (
    errorHandler.wrapAsync(
      async () => {
        const response = await openmrsFetch<ConsommationStatusResponse>(
          `${BASE_API_URL}/consommation/${consommationId}?v=custom:(department,billItems,patientBill:(isPaid))`,
        );
        return response.data;
      },
      { component: 'billing-api', action: 'getConsommationStatus', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    ) || null
  );
};

/**
 * Checks if a consommation is paid based on the server-side isPaid flag
 * @param consommationId - The consommation ID to check
 * @returns Promise with boolean indicating if the consommation is paid
 */
export const isConsommationPaid = async (consommationId: string): Promise<boolean> => {
  try {
    const statusResponse = await getConsommationStatus(consommationId);
    return statusResponse?.patientBill?.isPaid === true;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'isConsommationPaid', metadata: { consommationId } },
      commonErrorMessages.fetchError,
    );
    return false;
  }
};

/**
 * Fetches payment status for multiple consommations
 * @param consommationIds - Array of consommation IDs to check
 * @returns Promise with a map of consommation ID to payment status
 */
export const getMultipleConsommationStatuses = async (consommationIds: string[]): Promise<Record<string, boolean>> => {
  const statusPromises = consommationIds.map(async (id) => {
    const isPaid = await isConsommationPaid(id);
    return { id, isPaid };
  });

  try {
    const results = await Promise.all(statusPromises);
    const statusMap: Record<string, boolean> = {};
    results.forEach(({ id, isPaid }) => {
      statusMap[id] = isPaid;
    });
    return statusMap;
  } catch (error) {
    errorHandler.handleError(
      error,
      { component: 'billing-api', action: 'getMultipleConsommationStatuses' },
      commonErrorMessages.fetchError,
    );
    return {};
  }
};
