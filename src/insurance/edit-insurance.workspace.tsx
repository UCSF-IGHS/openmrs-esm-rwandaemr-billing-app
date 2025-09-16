import React, { useEffect, useState } from 'react';
import { Modal, TextInput, Button, InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar } from '@openmrs/esm-framework';
import { updateInsurancePolicy, useInsurancePolicy } from '../insurance-policy/insurance-policy.resource';
import { checkInsuranceEligibility } from './insurance-resource';
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

  useEffect(() => {
    if (record) {
      setCardNumber(record.insuranceCardNo || '');
      setStartDate(record.coverageStartDate || '');
      setEndDate(record.expirationDate || '');
      // Reset eligibility state when record changes
      setEligibilityMessage(null);
      setEligibilityStatus(null);
    }
  }, [record]);

  const handleEligibilityCheck = async () => {
    if (!cardNumber || !record?.insuranceId) {
      setEligibilityMessage(t('cardNumberRequired', 'Please enter a card number before checking eligibility'));
      setEligibilityStatus('warning');
      return;
    }

    setIsCheckingEligibility(true);
    setEligibilityMessage(null);
    setEligibilityStatus(null);

    try {
      const response = await checkInsuranceEligibility(cardNumber, String(record.insuranceId));

      const message =
        response.message ||
        (response.eligible
          ? t('insuranceIsValid', 'Insurance is valid')
          : t('insuranceIsInvalid', 'Insurance is not valid'));

      setEligibilityMessage(message);
      setEligibilityStatus(response.eligible ? 'success' : 'error');
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setEligibilityMessage(t('unableToCheckEligibility', 'Unable to check insurance eligibility at this time'));
      setEligibilityStatus('error');
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleSubmit = async () => {
    if (!record) return;

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
    }
  };

  return (
    <Modal
      open={Boolean(record)}
      modalHeading={t('editInsurance', 'Edit Insurance Policy')}
      primaryButtonText={t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
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
        onChange={(e) => {
          setCardNumber(e.target.value);
          // Reset eligibility when card number changes
          setEligibilityMessage(null);
          setEligibilityStatus(null);
        }}
      />

      <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
        <Button
          kind="secondary"
          size="sm"
          onClick={handleEligibilityCheck}
          disabled={isCheckingEligibility || !cardNumber}
        >
          {isCheckingEligibility
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
        onChange={(e) => setStartDate(e.target.value)}
      />
      <TextInput
        id="endDate"
        type="date"
        labelText={t('coverageEndDate', 'Coverage End Date')}
        value={endDate}
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
