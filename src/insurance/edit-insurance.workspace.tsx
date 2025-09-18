import React, { useEffect, useState } from 'react';
import { Modal, TextInput, Button, InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar } from '@openmrs/esm-framework';
import { updateInsurancePolicy } from '../insurance-policy/insurance-policy.resource';
import { checkInsuranceEligibility, useInsuranceTypes } from './insurance-resource';
import type { InsurancePolicyRecord, InsurancePolicyUpdatePayload } from '../types';

interface EditInsuranceModalProps {
  record: InsurancePolicyRecord | null;
  policyId: string;
  onClose: () => void;
  parentMutate?: () => void;
}

const EditInsuranceModal: React.FC<EditInsuranceModalProps> = ({ record, onClose, policyId, parentMutate }) => {
  const { t } = useTranslation();

  const [cardNumber, setCardNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState<'success' | 'error' | 'warning' | null>(null);
  const [insuranceType, setInsuranceType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { determineInsuranceType, isLoading: typesLoading } = useInsuranceTypes();

  useEffect(() => {
    if (record) {
      setCardNumber(record.insuranceCardNo || '');
      setStartDate(record.coverageStartDate || '');
      setEndDate(record.expirationDate || '');
      // Reset eligibility state when record changes
      setEligibilityMessage(null);
      setEligibilityStatus(null);
      setInsuranceType(null);
    }
  }, [record]);

  const handleEligibilityCheck = async () => {
    if (!cardNumber || !record?.insuranceId) {
      setEligibilityMessage(t('cardNumberRequired', 'Please enter a card number before checking eligibility'));
      setEligibilityStatus('warning');
      setInsuranceType(null);
      return;
    }

    setIsCheckingEligibility(true);
    setEligibilityMessage(null);
    setEligibilityStatus(null);

    try {
      // Use the hook's helper function to determine insurance type
      const detectedInsuranceType = determineInsuranceType(String(record.insuranceId));
      setInsuranceType(detectedInsuranceType);

      if (!detectedInsuranceType) {
        setEligibilityMessage(
          t(
            'unableToCheckEligibilityOfSelectedInsurance',
            'Unable to check insurance eligibility of the selected insurance',
          ),
        );
        setEligibilityStatus('error');
        return;
      }

      const response = await checkInsuranceEligibility(cardNumber, detectedInsuranceType);

      const message =
        response.message ||
        (response.eligible
          ? t('insuranceIsValid', 'Insurance is valid')
          : t('insuranceIsInvalid', 'Insurance is not valid'));

      setEligibilityMessage(message);
      setEligibilityStatus(response.eligible ? 'success' : 'error');
    } catch (error) {
      setEligibilityMessage(t('unableToCheckEligibility', 'Unable to check insurance eligibility at this time'));
      setEligibilityStatus('error');
      setInsuranceType(null);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleSubmit = async () => {
    if (!record) return;

    setIsSubmitting(true);

    const updatedRecord: InsurancePolicyUpdatePayload = {
      insurance: record.insuranceId ? { insuranceId: record.insuranceId } : undefined,
      insuranceCardNo: cardNumber,
      coverageStartDate: startDate,
      expirationDate: endDate,
    };

    try {
      const response = await updateInsurancePolicy(updatedRecord, policyId);
      if (response) {
        showSnackbar({
          title: t('insurancePolicyUpdated', 'Insurance policy Updated'),
          kind: 'success',
        });
        parentMutate?.();
        onClose?.();
      }
    } catch (error) {
      showSnackbar({
        title: t('updateFailed', 'Failed to Updated insurance policy'),
        kind: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(record)}
      modalHeading={t('editInsurance', 'Edit Insurance Policy')}
      primaryButtonText={isSubmitting ? t('saving', 'Saving...') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={isSubmitting}
      onRequestClose={onClose}
      onRequestSubmit={handleSubmit}
      passiveModal={false}
    >
      {record?.insuranceName && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
          <strong>{t('insuranceName', 'Insurance')}: </strong>
          <span>{record.insuranceName}</span>
        </div>
      )}
      <TextInput
        id="cardNumber"
        labelText={t('membershipNumber', 'Membership Number')}
        value={cardNumber}
        disabled={isSubmitting}
        onChange={(e) => {
          setCardNumber(e.target.value);
          // Reset eligibility when card number changes
          setEligibilityMessage(null);
          setEligibilityStatus(null);
          setInsuranceType(null);
        }}
      />

      <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
        <Button
          kind="secondary"
          size="sm"
          onClick={handleEligibilityCheck}
          disabled={isCheckingEligibility || typesLoading || !cardNumber}
        >
          {isCheckingEligibility || typesLoading
            ? t('checkingEligibility', 'Checking eligibility...')
            : t('checkEligibility', 'Check eligibility')}
        </Button>
      </div>

      {eligibilityMessage && eligibilityStatus && (
        <div style={{ marginBottom: '1rem' }}>
          <InlineNotification
            kind={eligibilityStatus}
            lowContrast
            title={
              eligibilityStatus === 'success'
                ? t('eligibilityConfirmed', 'Eligibility Confirmed')
                : eligibilityStatus === 'warning'
                  ? t('incompleteFields', 'Incomplete Fields')
                  : t('eligibilityCheckFailed', 'Eligibility Check Failed')
            }
            subtitle={eligibilityMessage}
            role="alert"
          />
        </div>
      )}
      <TextInput
        id="startDate"
        type="date"
        labelText={t('coverageStartDate', 'Coverage Start Date')}
        value={startDate}
        disabled={isSubmitting}
        onChange={(e) => setStartDate(e.target.value)}
      />
      <TextInput
        id="endDate"
        type="date"
        labelText={t('coverageEndDate', 'Coverage End Date')}
        value={endDate}
        disabled={isSubmitting}
        onChange={(e) => setEndDate(e.target.value)}
      />

      <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#f4f4f4', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
          <strong>Note:</strong> Only insurance card number, start date, and end date can be edited. Other fields are
          managed by the system and cannot be modified through this interface.
        </p>
      </div>
    </Modal>
  );
};

export default EditInsuranceModal;
