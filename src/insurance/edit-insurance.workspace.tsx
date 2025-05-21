import React, { useEffect, useState } from 'react';
import { Modal, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar } from '@openmrs/esm-framework';
import { updateInsurancePolicy, useInsurancePolicy } from '../insurance-policy/insurance-policy.resource';
import type { InsurancePolicyRecord } from '../types';

interface EditInsuranceModalProps {
  record: InsurancePolicyRecord | null;
  policyId: string;
  onClose: () => void;
  parentMutate?: () => void; // Add this prop
}

const EditInsuranceModal: React.FC<EditInsuranceModalProps> = ({ record, onClose, policyId, parentMutate }) => {
  const { t } = useTranslation();

  const [cardNumber, setCardNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (record) {
      setCardNumber(record.insuranceCardNo || '');
      setStartDate(record.coverageStartDate || '');
      setEndDate(record.expirationDate || '');
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;

    const updatedRecord = {
      ...record,
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
      <TextInput
        id="cardNumber"
        labelText={t('membershipNumber', 'Membership Number')}
        value={cardNumber}
        onChange={(e) => setCardNumber(e.target.value)}
      />
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
    </Modal>
  );
};

export default EditInsuranceModal;
