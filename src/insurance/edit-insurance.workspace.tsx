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
  parentMutate?: () => void;
}

const EditInsuranceModal: React.FC<EditInsuranceModalProps> = ({ record, onClose, policyId, parentMutate }) => {
  const { t } = useTranslation();

  const [cardNumber, setCardNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasThirdParty, setHasThirdParty] = useState(false);
  const [thirdPartyProvider, setThirdPartyProvider] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [insuranceOwner, setInsuranceOwner] = useState('');
  const [family, setFamily] = useState('');

  useEffect(() => {
    if (record) {
      setCardNumber(record.insuranceCardNo || '');
      setStartDate(record.coverageStartDate || '');
      setEndDate(record.expirationDate || '');
      setHasThirdParty(record.hasThirdParty ?? false);
      setThirdPartyProvider(record.thirdPartyProvider || '');
      setCompanyName(record.companyName || '');
      setInsuranceOwner(record.insuranceOwner || '');
      setFamily(record.family || '');
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

      <div style={{ marginTop: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <input type="checkbox" checked={hasThirdParty} onChange={(e) => setHasThirdParty(e.target.checked)} />{' '}
          {t('hasThirdParty', 'Has Third Party?')}
        </label>
      </div>

      {hasThirdParty && (
        <TextInput
          id="thirdPartyProvider"
          labelText={t('thirdPartyProvider', 'Third Party Provider')}
          value={thirdPartyProvider}
          onChange={(e) => setThirdPartyProvider(e.target.value)}
        />
      )}
      <TextInput
        id="companyName"
        labelText={t('companyName', 'Company Name')}
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
      />

      <TextInput
        id="insuranceOwner"
        labelText={t('insuranceOwner', 'Head Household Name/Insurance Owner')}
        value={insuranceOwner}
        onChange={(e) => setInsuranceOwner(e.target.value)}
      />

      <TextInput
        id="family"
        labelText={t('family', 'Family/ Affiliation code')}
        value={family}
        onChange={(e) => setFamily(e.target.value)}
      />
    </Modal>
  );
};

export default EditInsuranceModal;
