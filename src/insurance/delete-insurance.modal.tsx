import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';

interface DeleteInsuranceModalProps {
  encounterUuid: string;
  onClose: () => void;
  onDeleted: () => void;
}

const DeleteInsuranceModal: React.FC<DeleteInsuranceModalProps> = ({ encounterUuid, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/openmrs/ws/rest/v1/encounter/${encounterUuid}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(t('deleteFailed', 'Failed to delete encounter.'));

      onDeleted();
      onClose();
      showSnackbar({
        kind: 'success',
        title: t('insuranceDeleted', 'Insurance record deleted'),
        isLowContrast: true,
      });
    } catch (error: any) {
      console.error(error);
      showSnackbar({
        kind: 'error',
        title: t('errorDeletingInsurance', 'Error deleting insurance record'),
        subtitle: error.message,
        isLowContrast: false,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [encounterUuid, onClose, onDeleted, t]);

  return (
    <>
      <ModalHeader title={t('deleteInsurance', 'Delete Insurance')} closeModal={onClose} />
      <ModalBody>
        <p>{t('deleteInsuranceConfirmation', 'Are you sure you want to delete this insurance record?')}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose} disabled={isDeleting}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button kind="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? <InlineLoading description={t('deleting', 'Deleting...')} /> : t('delete', 'Delete')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default DeleteInsuranceModal;
