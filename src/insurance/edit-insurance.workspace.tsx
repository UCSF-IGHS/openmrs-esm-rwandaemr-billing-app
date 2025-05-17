import React, { useEffect, useState } from 'react';
import { Modal, TextInput } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { showSnackbar } from '@openmrs/esm-framework';

interface InsuranceRecord {
  id: string;
  cardNumber: string;
  startDate: string;
  endDate: string;
}

interface EditInsuranceModalProps {
  record: InsuranceRecord | null;
  onClose: () => void;
  onSave: (updatedRecord: InsuranceRecord) => Promise<void>;
}

const EditInsuranceModal: React.FC<EditInsuranceModalProps> = ({ record, onClose, onSave }) => {
  const { t } = useTranslation();

  const [cardNumber, setCardNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (record) {
      setCardNumber(record.cardNumber || '');
      setStartDate(record.startDate || '');
      setEndDate(record.endDate || '');
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record) return;

    const updatedRecord: InsuranceRecord = {
      ...record,
      cardNumber,
      startDate,
      endDate,
    };

    try {
      await onSave(updatedRecord);

      showSnackbar({
        title: t('insurancePolicyUpdated', 'Insurance policy Updated'),
        kind: 'success',
      });

      onClose?.();
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
