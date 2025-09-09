import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Select, SelectItem, InlineLoading } from '@carbon/react';
import { showToast } from '@openmrs/esm-framework';
import { revertGlobalBill, getGlobalBillById } from '../api/billing';
import { type Admission } from '../api/patient-admission.resource';
import styles from './revert-global-bill-modal.scss';

interface RevertGlobalBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  globalBillId: string;
  admission?: Admission;
}

const REVERT_REASONS = [
  { value: 'Missing Items', label: 'Missing Items' },
  { value: 'Over Billing', label: 'Over Billing' },
  { value: 'Item(s) Not Available', label: 'Item(s) Not Available' },
];

const RevertGlobalBillModal: React.FC<RevertGlobalBillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  globalBillId,
  admission,
}) => {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = useState('');
  const [isReverting, setIsReverting] = useState(false);
  const [admissionDate, setAdmissionDate] = useState<string>('');
  const [dischargeDate, setDischargeDate] = useState<string>('');

  useEffect(() => {
    if (isOpen && admission) {
      setAdmissionDate(admission.admissionDate ? new Date(admission.admissionDate).toISOString().split('T')[0] : '');
      setDischargeDate(
        admission.dischargingDate ? new Date(admission.dischargingDate).toISOString().split('T')[0] : '',
      );
    }
  }, [isOpen, admission]);

  const handleRevert = async () => {
    if (!selectedReason.trim()) {
      showToast({
        title: t('error', 'Error'),
        description: t('revertReasonRequired', 'Please select a reason for reverting the bill'),
        kind: 'error',
      });
      return;
    }

    setIsReverting(true);
    try {
      showToast({
        title: t('revertingBill', 'Reverting bill'),
        description: t('revertingBillInProgress', 'Please wait while bill is being reverted…'),
        kind: 'info',
      });

      const result = await revertGlobalBill(globalBillId, selectedReason);

      showToast({
        title: t('success', 'Success'),
        description: result?.message || t('billRevertedSuccessfully', 'Global bill reverted successfully'),
        kind: 'success',
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      showToast({
        title: t('error', 'Error'),
        description: error?.message || t('failedToRevertBill', 'Failed to revert global bill'),
        kind: 'error',
      });
    } finally {
      setIsReverting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      modalHeading={t('revertGlobalBill', 'Revert Global Bill')}
      primaryButtonText={isReverting ? t('reverting', 'Reverting…') : t('confirm', 'Confirm')}
      secondaryButtonText={t('cancel', 'Cancel')}
      danger
      onRequestClose={handleClose}
      onSecondarySubmit={handleClose}
      onRequestSubmit={isReverting ? undefined : handleRevert}
      primaryButtonDisabled={isReverting || !selectedReason.trim()}
      size="sm"
    >
      <div className={styles.modalContent}>
        {/* Date Information */}
        <div className={styles.dateInfo}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>{t('admissionDate', 'Admission Date')}:</label>
            <span className={styles.dateValue}>{admissionDate || '--'}</span>
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel}>{t('dischargeDate', 'Discharge Date')}:</label>
            <span className={styles.dateValue}>{dischargeDate || '--'}</span>
          </div>
        </div>

        {/* Revert Reason Dropdown */}
        <div className={styles.reasonSection}>
          <label htmlFor="revert-reason" className={styles.reasonLabel}>
            {t('revertingReason', 'Reverting Reason')}
          </label>
          <Select
            id="revert-reason"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className={styles.reasonSelect}
          >
            <SelectItem value="" text={t('selectReason', 'Select a reason...')} />
            {REVERT_REASONS.map((reason) => (
              <SelectItem key={reason.value} value={reason.value} text={reason.label} />
            ))}
          </Select>
        </div>

        {/* Warning Message */}
        <div className={styles.warningMessage}>
          <p>
            {t(
              'revertBillWarning',
              'This will revert the global bill to unpaid status and allow further modifications.',
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default RevertGlobalBillModal;
