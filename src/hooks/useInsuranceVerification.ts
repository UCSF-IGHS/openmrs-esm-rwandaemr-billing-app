import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getInsurances,
  fetchGlobalBillsByInsuranceCard,
  getInsurancePolicyByCardNumber,
  getInsuranceById,
} from '../api/billing';
import { ADMISSION_CONSTANTS } from '../constants';
import type { Insurance, InsurancePolicy, GlobalBill } from '../api/types';

export interface InsuranceVerificationResult {
  isValid: boolean;
  policy: InsurancePolicy | null;
  policyId: number | null;
  insurance: Insurance | null;
  existingGlobalBill: GlobalBill | null;
  message: string;
  isLoading: boolean;
  error: string | null;
}

export interface UseInsuranceVerificationReturn {
  verificationResult: InsuranceVerificationResult;
  verifyInsuranceCard: (cardNumber: string) => Promise<void>;
  clearVerification: () => void;
  insurances: Insurance[];
  isLoadingInsurances: boolean;
}

/**
 * Custom hook for insurance verification logic
 * Eliminates code duplication between admission forms
 */
export const useInsuranceVerification = (): UseInsuranceVerificationReturn => {
  const { t } = useTranslation();

  const [verificationResult, setVerificationResult] = useState<InsuranceVerificationResult>({
    isValid: false,
    policy: null,
    policyId: null,
    insurance: null,
    existingGlobalBill: null,
    message: '',
    isLoading: false,
    error: null,
  });

  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [isLoadingInsurances, setIsLoadingInsurances] = useState(true);

  // Load insurances on hook initialization
  const loadInsurances = useCallback(async () => {
    try {
      setIsLoadingInsurances(true);
      const insuranceList = await getInsurances();
      setInsurances(insuranceList);
    } catch (error) {
      console.error('Error loading insurances:', error);
    } finally {
      setIsLoadingInsurances(false);
    }
  }, []);

  // Load insurances on mount
  React.useEffect(() => {
    loadInsurances();
  }, [loadInsurances]);

  /**
   * Extracts insurance policy ID from response
   */
  const extractInsurancePolicyId = (policyResponse: any): number | null => {
    if (!policyResponse?.results?.length) return null;

    const policy = policyResponse.results[0];
    return policy?.insurancePolicyId ? parseInt(policy.insurancePolicyId.toString(), 10) : null;
  };

  /**
   * Verifies an insurance card number and updates state
   */
  const verifyInsuranceCard = useCallback(
    async (cardNumber: string) => {
      if (!cardNumber || cardNumber.length < ADMISSION_CONSTANTS.MIN_INSURANCE_CARD_LENGTH) {
        return;
      }

      setVerificationResult((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Get insurance policy by card number
        const policyResponse = await getInsurancePolicyByCardNumber(cardNumber);
        const policyId = extractInsurancePolicyId(policyResponse);

        if (!policyResponse?.results?.length) {
          setVerificationResult({
            isValid: false,
            policy: null,
            policyId: null,
            insurance: null,
            existingGlobalBill: null,
            message: t('insuranceCardNotFound', 'Insurance card not found or invalid'),
            isLoading: false,
            error: null,
          });
          return;
        }

        const policy = policyResponse.results[0];
        let selectedInsurance: Insurance | null = null;

        // Get insurance details if available
        if (policy.insurance?.insuranceId) {
          try {
            selectedInsurance = await getInsuranceById(policy.insurance.insuranceId);
          } catch (error) {
            console.warn('Could not fetch insurance details:', error);
          }
        }

        // Check for existing global bills
        let existingGlobalBill: GlobalBill | null = null;
        let message = t('insuranceCardValidated', 'Insurance card validated successfully');

        try {
          const gbResponse = await fetchGlobalBillsByInsuranceCard(cardNumber);
          if (gbResponse?.results?.length) {
            const openGlobalBill = gbResponse.results.find((bill: any) => bill.closed === false);
            if (openGlobalBill) {
              existingGlobalBill = openGlobalBill;
              message = t('existingGlobalBillFound', 'Patient already has an open global bill (ID: {{billId}})', {
                billId: openGlobalBill.billIdentifier,
              });
            }
          }
        } catch (error) {
          console.warn('Error checking for existing global bills:', error);
        }

        setVerificationResult({
          isValid: true,
          policy,
          policyId,
          insurance: selectedInsurance,
          existingGlobalBill,
          message,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('Error verifying insurance card:', error);
        setVerificationResult({
          isValid: false,
          policy: null,
          policyId: null,
          insurance: null,
          existingGlobalBill: null,
          message: '',
          isLoading: false,
          error: t('errorVerifyingInsurance', 'Error verifying insurance card. Please try again.'),
        });
      }
    },
    [t],
  );

  /**
   * Clears verification state
   */
  const clearVerification = useCallback(() => {
    setVerificationResult({
      isValid: false,
      policy: null,
      policyId: null,
      insurance: null,
      existingGlobalBill: null,
      message: '',
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    verificationResult,
    verifyInsuranceCard,
    clearVerification,
    insurances,
    isLoadingInsurances,
  };
};
