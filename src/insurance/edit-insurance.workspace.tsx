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
  const [eligibilityDetails, setEligibilityDetails] = useState<any>(null);
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
      setEligibilityDetails(null);
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
    setEligibilityDetails(null);

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

      // Store the full response details
      setEligibilityDetails(response.details);

      const isEligible = response?.eligible;
      const message =
        response?.message ||
        (isEligible ? t('insuranceIsValid', 'Insurance is valid') : t('insuranceIsInvalid', 'Insurance is not valid'));

      setEligibilityMessage(message);
      setEligibilityStatus(isEligible ? 'success' : 'error');
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
          setEligibilityDetails(null);
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

      {eligibilityDetails && eligibilityStatus === 'success' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f4f4f4',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
          }}
        >
          <h4 style={{ margin: '0 0 0.75rem 0', color: '#161616', fontSize: '1rem', fontWeight: '600' }}>
            {t('memberDetails', 'Member Details')}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
            {eligibilityDetails.cardId && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('cardId', 'Card ID')}: </strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.cardId}</span>
              </div>
            )}
            {(eligibilityDetails.firstName || eligibilityDetails.lastName) && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('fullName', 'Full Name')}: </strong>
                <span style={{ color: '#161616' }}>
                  {[eligibilityDetails.firstName, eligibilityDetails.lastName].filter(Boolean).join(' ')}
                </span>
              </div>
            )}
            {eligibilityDetails.dateOfBirth && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('dateOfBirth', 'Date of Birth')}:</strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.dateOfBirth}</span>
              </div>
            )}
            {eligibilityDetails.gender && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('gender', 'Gender')}: </strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.gender}</span>
              </div>
            )}
            {eligibilityDetails.nationalId && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('nationalId', 'National ID')}: </strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.nationalId}</span>
              </div>
            )}
            {eligibilityDetails.employerName && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>{t('employer', 'Employer')}: </strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.employerName}</span>
              </div>
            )}
            {eligibilityDetails.mainAffiliateId && (
              <div>
                <strong style={{ color: '#525252', fontSize: '0.875rem' }}>
                  {t('mainAffiliateId', 'Main Affiliate ID')}:
                </strong>
                <span style={{ color: '#161616' }}>{eligibilityDetails.mainAffiliateId}</span>
              </div>
            )}
          </div>
          {/* Show members info if insuranceType is cbhi and members exist */}
          {insuranceType === 'cbhi' &&
            Array.isArray(eligibilityDetails.members) &&
            eligibilityDetails.members.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#0f62fe', fontSize: '0.95rem', fontWeight: '600' }}>
                  {t('householdMembers', 'Household Members')}
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {eligibilityDetails.members.map((member, idx) => (
                    <div
                      key={member.memberId || idx}
                      style={{
                        background: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: 6,
                        padding: '0.75rem',
                      }}
                    >
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('name', 'Name')}:</strong> {member.firstName} {member.lastName}
                      </div>
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('gender', 'Gender')}:</strong> {member.gender}
                      </div>
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('dateOfBirth', 'Date of Birth')}:</strong> {member.dateOfBirth}
                      </div>
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('type', 'Type')}:</strong> {member.type}
                      </div>
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('documentNumber', 'Document Number')}:</strong> {member.documentNumber}
                      </div>
                      <div style={{ padding: '0.25rem 0' }}>
                        <strong>{t('isEligible', 'Is Eligible')}:</strong>{' '}
                        {member.isEligible ? t('yes', 'Yes') : t('no', 'No')}
                      </div>
                      {member.eligibilityStartDate && (
                        <div style={{ padding: '0.25rem 0' }}>
                          <strong>{t('eligibilityStartDate', 'Eligibility Start Date')}:</strong>{' '}
                          {member.eligibilityStartDate}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
