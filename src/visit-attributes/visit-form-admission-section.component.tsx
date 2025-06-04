import React, { useCallback, useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  openmrsFetch,
  showSnackbar,
  usePatient,
  useLayoutType,
  type Visit,
  launchWorkspace,
} from '@openmrs/esm-framework';
import {
  getInsurances,
  fetchGlobalBillsByInsuranceCard,
  fetchGlobalBillsByPatient,
  getInsurancePolicyByCardNumber,
  getInsuranceById,
} from '../api/billing';
import styles from './visit-form-admission-section.scss';
import { createAdmissionWithGlobalBill, useDiseaseType } from '../api/patient-admission.resource';
import { InlineNotification } from '@carbon/react';
import { TextInput, DatePicker, InlineLoading, ComboBox, DatePickerInput, Checkbox, Toggle } from '@carbon/react';
import { z } from 'zod';
import { Button } from '@carbon/react';

const ADMISSION_TYPES = [
  { id: '1', text: 'Ordinary Admission' },
  { id: '2', text: 'DCP Admission' },
];
const BASE_API_URL = '/ws/rest/v1/mohbilling';

type VisitFormAdmissionSectionProps = {
  patientUuid: string;
  onAdmissionCreated?: (admissionData: any) => void;
  closeWorkspace: () => void;
  closeWorkspaceWithSavedChanges?: () => void;
  setExtraVisitInfo: (state) => void;
  setOnSubmit(onSubmit: (visit: Visit) => Promise<void>): void;
};

interface RequiredFieldLabelProps {
  label: string;
}

const admissionFormSchema = z.object({
  insuranceName: z.string().optional(),
  insuranceCardNumber: z.string().min(1, { message: 'Insurance card number is required for billing' }),
  isAdmitted: z.boolean(),
  admissionDate: z.date().refine((date) => date <= new Date(), { message: 'Date cannot be in the future' }),
  diseaseType: z.string().min(1, { message: 'Disease type is required' }),
  admissionType: z.string().optional(),
});

type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

const RequiredFieldLabel: React.FC<RequiredFieldLabelProps> = ({ label }) => {
  const { t } = useTranslation();
  return (
    <span>
      {label}
      <span title={t('required', 'Required')} className={styles.required}>
        *
      </span>
    </span>
  );
};

const VisitFormAdmissionSection: React.FC<VisitFormAdmissionSectionProps> = ({
  patientUuid,
  onAdmissionCreated,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  setExtraVisitInfo,
  setOnSubmit,
}) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<Array<any>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [insurancePolicy, setInsurancePolicy] = useState<any>(null);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);
  const [insurancePolicyId, setInsurancePolicyId] = useState<number | null>(null);
  const [existingGlobalBill, setExistingGlobalBill] = useState<any>(null);
  const [includeAdmission, setIncludeAdmission] = useState(false);
  const { diseaseType: diseaseTypes, isLoading: isLoadingDiseaseTypes, error: diseaseTypeError } = useDiseaseType();

  const methods = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      insuranceName: '',
      insuranceCardNumber: '',
      isAdmitted: false,
      admissionDate: new Date(),
      diseaseType: '',
      admissionType: '',
    },
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = methods;

  const insuranceCardNumber = watch('insuranceCardNumber');

  const extractInsurancePolicyId = (policyResponse: any): number | null => {
    try {
      if (policyResponse?.results && policyResponse.results.length > 0) {
        const policy = policyResponse.results[0];

        if (policy.insurancePolicyId) {
          return policy.insurancePolicyId;
        }

        if (policy.links && policy.links.length > 0) {
          const selfLink = policy.links.find((link) => link.rel === 'self');
          if (selfLink && selfLink.uri) {
            const matches = selfLink.uri.match(/\/insurancePolicy\/(\d+)/);
            if (matches && matches[1]) {
              return parseInt(matches[1]);
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error extracting insurance policy ID:', error);
      return null;
    }
  };

  useEffect(() => {
    const loadPatientPolicies = async () => {
      if (!patientUuid) return;

      setIsLoadingData(true);
      try {
        const policyData = await fetchGlobalBillsByPatient(patientUuid);
        let patientPolicyInfo = null;

        if (policyData && policyData.results && policyData.results.length > 0) {
          const openGlobalBill = policyData.results.find((bill) => bill.closed === false);

          if (openGlobalBill) {
            setExistingGlobalBill(openGlobalBill);

            showSnackbar({
              title: t('existingGlobalBill', 'Existing Global Bill'),
              subtitle: t(
                'existingGlobalBillMessage',
                `Patient already has an open global bill (ID: ${openGlobalBill.billIdentifier})`,
              ),
              kind: 'warning',
            });

            if (openGlobalBill.admission?.insurancePolicy) {
              patientPolicyInfo = openGlobalBill.admission.insurancePolicy;

              if (openGlobalBill.insurance) {
                patientPolicyInfo.insurance = openGlobalBill.insurance;
              }
            }
          } else if (policyData.results.length > 0) {
            const latestBill = policyData.results[0];
            if (latestBill.admission?.insurancePolicy) {
              patientPolicyInfo = latestBill.admission.insurancePolicy;

              if (latestBill.insurance) {
                patientPolicyInfo.insurance = latestBill.insurance;
              }
            }
          }
        }

        if (!patientPolicyInfo) {
          try {
            const patientResponse = await openmrsFetch(`${BASE_API_URL}/insurancePolicy?patient=${patientUuid}&v=full`);

            if (patientResponse.data?.results && patientResponse.data.results.length > 0) {
              patientPolicyInfo = patientResponse.data.results[0];

              if (patientPolicyInfo.insurance?.insuranceId) {
                const insuranceDetails = await getInsuranceById(patientPolicyInfo.insurance.insuranceId);
                if (insuranceDetails) {
                  patientPolicyInfo.insurance = insuranceDetails;
                }
              }
            }
          } catch (err) {
            console.error('Error fetching patient policies directly:', err);
          }
        }

        if (patientPolicyInfo) {
          setInsurancePolicy(patientPolicyInfo);

          const policyId = extractInsurancePolicyId({ results: [patientPolicyInfo] });
          if (policyId) {
            setInsurancePolicyId(policyId);
          }

          if (patientPolicyInfo.insuranceCardNo) {
            setValue('insuranceCardNumber', patientPolicyInfo.insuranceCardNo);
          }

          if (patientPolicyInfo.insurance?.name) {
            setSelectedInsurance(patientPolicyInfo.insurance);
            setValue('insuranceName', patientPolicyInfo.insurance.name);
          }
        }

        const insurancesData = await getInsurances();
        setInsurances(insurancesData);
      } catch (err) {
        console.error('Error loading patient policy data:', err);
        setError('Error loading patient insurance data. Please try again.');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadPatientPolicies();
  }, [patientUuid, setValue, t]);

  const verifyInsuranceCard = useCallback(
    async (cardNumber: string) => {
      if (!cardNumber) return;

      setIsLoading(true);
      setInsurancePolicyId(null);

      try {
        const policyResponse = await getInsurancePolicyByCardNumber(cardNumber);

        const policyId = extractInsurancePolicyId(policyResponse);

        if (policyResponse && policyResponse.results && policyResponse.results.length > 0) {
          const policy = policyResponse.results[0];
          setInsurancePolicy(policy);

          if (policyId) {
            setInsurancePolicyId(policyId);
            if (policy.insurance) {
              const insurance = policy.insurance;
              setSelectedInsurance(insurance);
              setValue('insuranceName', insurance.name);
            }

            if (!existingGlobalBill) {
              const gbResponse = await fetchGlobalBillsByInsuranceCard(cardNumber);

              if (gbResponse && gbResponse.results && gbResponse.results.length > 0) {
                const openGlobalBill = gbResponse.results.find((bill) => bill.closed === false);

                if (openGlobalBill) {
                  setExistingGlobalBill(openGlobalBill);

                  showSnackbar({
                    title: t('existingGlobalBill', 'Existing Global Bill'),
                    subtitle: t(
                      'existingGlobalBillMessage',
                      `Patient already has an open global bill (ID: ${openGlobalBill.billIdentifier})`,
                    ),
                    kind: 'warning',
                  });
                } else {
                  showSnackbar({
                    title: 'Insurance Card',
                    subtitle: 'Insurance card validated successfully',
                    kind: 'success',
                  });
                }
              } else {
                showSnackbar({
                  title: 'Insurance Card',
                  subtitle: 'Insurance card validated successfully',
                  kind: 'success',
                });
              }
            }
          } else {
            showSnackbar({
              title: 'Insurance Card',
              subtitle: 'Insurance verified but policy ID not found',
              kind: 'warning',
            });
          }
        } else {
          setInsurancePolicy(null);
          showSnackbar({
            title: 'Insurance Card',
            subtitle: 'Insurance card not found or invalid',
            kind: 'warning',
          });
        }
      } catch (err) {
        console.error('Error verifying insurance card:', err);
        setInsurancePolicy(null);
        showSnackbar({
          title: 'Insurance Card Error',
          subtitle: 'An error occurred while verifying the insurance card',
          kind: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [setValue, existingGlobalBill, t],
  );

  React.useEffect(() => {
    if (insuranceCardNumber && insuranceCardNumber.length >= 8 && !isLoadingData) {
      verifyInsuranceCard(insuranceCardNumber);
    }
  }, [insuranceCardNumber, verifyInsuranceCard, isLoadingData]);

  const handleFormSubmission = useCallback(
    async (data: AdmissionFormValues) => {
      setIsLoading(true);
      setError(null);

      try {
        if (!insurancePolicyId) {
          throw new Error('Insurance policy ID is required. Please verify the insurance card first.');
        }

        if (existingGlobalBill) {
          showSnackbar({
            title: t('existingGlobalBill', 'Existing Global Bill'),
            subtitle: t(
              'existingGlobalBillInfo',
              'Note: Patient has an open global bill. This visit will be associated with the existing bill.',
            ),
            kind: 'info',
          });
        }

        const admissionTypeNumber = parseInt(data.admissionType);
        const result = await createAdmissionWithGlobalBill({
          patientUuid: patientUuid,
          isAdmitted: data.isAdmitted,
          admissionDate: data.admissionDate,
          diseaseType: data.diseaseType,
          admissionType: admissionTypeNumber,
          insuranceCardNumber: data.insuranceCardNumber,
          insurancePolicyId: insurancePolicyId,
          insuranceId: selectedInsurance?.insuranceId || 1,
        });

        setExtraVisitInfo({
          admissionData: {
            ...data,
            globalBillId: result.globalBill.globalBillId,
            billIdentifier: result.globalBill.billIdentifier,
            insuranceDetails: selectedInsurance,
            insurancePolicyId: insurancePolicyId,
            patientUuid: patientUuid,
          },
          handleAdmissionCreated: () => {
            if (onAdmissionCreated) {
              onAdmissionCreated({
                ...data,
                globalBillId: result.globalBill.globalBillId,
                billIdentifier: result.globalBill.billIdentifier,
                insuranceDetails: selectedInsurance,
                insurancePolicyId: insurancePolicyId,
              });
            }
          },
        });
        return result;
      } catch (err) {
        console.error('Error creating global bill:', err);
        showSnackbar({
          title: 'Global Bill Error',
          subtitle: 'An error has occurred while creating global bill',
          kind: 'error',
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [insurancePolicyId, existingGlobalBill, t, selectedInsurance, setExtraVisitInfo, patientUuid, onAdmissionCreated],
  );

  const onSubmit = useCallback(
    async (visit: Visit) => {
      if (!includeAdmission) {
        if (closeWorkspaceWithSavedChanges) {
          closeWorkspaceWithSavedChanges();
        } else {
          closeWorkspace();
        }
        return Promise.resolve();
      }

      const isValid = await methods.trigger();
      if (!isValid) {
        return Promise.reject(new Error('Form validation failed'));
      }
      const formData = methods.getValues();
      await handleFormSubmission(formData);

      if (closeWorkspaceWithSavedChanges) {
        closeWorkspaceWithSavedChanges();
      } else {
        closeWorkspace();
      }
    },
    [methods, closeWorkspace, closeWorkspaceWithSavedChanges, handleFormSubmission, includeAdmission],
  );

  useEffect(() => {
    setOnSubmit?.(onSubmit);
  }, [onSubmit, setOnSubmit]);

  const handleAddInsurancePolicy = useCallback(() => {
    launchWorkspace('insurance-form-workspace', {
      patientUuid: patientUuid,
      onClose: () => {
        closeWorkspace();
      },
    });
  }, [patientUuid, closeWorkspace]);

  useEffect(() => {
    if (includeAdmission && existingGlobalBill) {
      showSnackbar({
        title: t('existingGlobalBill', 'Existing Global Bill'),
        subtitle: t(
          'existingGlobalBillInfo',
          `Patient has an open global bill (ID: ${existingGlobalBill.billIdentifier}) with insurance policy ${existingGlobalBill.insurance?.name || 'N/A'}. This visit will be associated with the existing bill.`,
        ),
        kind: 'info',
      });
    }
  }, [includeAdmission, existingGlobalBill, t]);

  if (isLoadingData || isLoadingDiseaseTypes || isLoading) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading')}
        description={t('loadingAdmissionData', 'Loading admission data...')}
        className={styles.loader}
      />
    );
  }

  if (error || diseaseTypeError) {
    return (
      <div className={styles.errorContainer}>
        <InlineNotification
          kind="error"
          lowContrast
          title={t('admissionError', 'Admission error')}
          subtitle={error || 'Error loading disease types'}
          className={styles.error}
        />
      </div>
    );
  }

  if (!insurancePolicy) {
    return (
      <div className={styles.errorContainer}>
        <InlineNotification
          kind="warning"
          lowContrast
          title={t('insuranceNotFound', 'Insurance not found')}
          subtitle={t('insuranceNotFoundMessage', 'No insurance policy found for this patient, click here to add one')}
          className={styles.error}
          onClick={handleAddInsurancePolicy}
        />
      </div>
    );
  }
  return (
    <FormProvider {...methods}>
      <div className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.formColumn}>
            <Toggle
              id="include-admission"
              labelText={t('includeAdmissionInfo', 'Include admission information')}
              toggled={includeAdmission}
              onToggle={(toggled) => setIncludeAdmission(toggled)}
              className={styles.sectionField}
            />
          </div>
        </div>

        {includeAdmission && (
          <>
            {existingGlobalBill && (
              <div className={styles.errorContainer}>
                <InlineNotification
                  kind="info"
                  lowContrast
                  title={t('existingGlobalBill', 'Existing Global Bill')}
                  subtitle={t(
                    'existingGlobalBillInfo',
                    `Patient has an open global bill (ID: ${existingGlobalBill.billIdentifier}) with insurance policy ${existingGlobalBill.insurance?.name || 'N/A'}. This visit will be associated with the existing bill.`,
                  )}
                  className={styles.error}
                />
              </div>
            )}

            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="insuranceName"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="insurance-name"
                      labelText={t('insuranceName', 'Insurance Name')}
                      value={field.value}
                      readOnly
                      className={styles.sectionField}
                    />
                  )}
                />
              </div>

              <div className={styles.formColumn}>
                <Controller
                  name="insuranceCardNumber"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      id="insurance-card-number"
                      labelText={<RequiredFieldLabel label={t('insuranceCardNumber', 'Insurance Card Number')} />}
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                      }}
                      invalid={!!errors.insuranceCardNumber}
                      invalidText={errors.insuranceCardNumber?.message}
                      className={styles.sectionField}
                    />
                  )}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="admissionDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <DatePicker
                      datePickerType="single"
                      dateFormat="m/d/Y"
                      onChange={([date]) => field.onChange(date)}
                      value={field.value}
                      className={styles.sectionField}
                    >
                      <DatePickerInput
                        id="admission-date"
                        labelText={t('admissionDate', 'Admission Date')}
                        invalid={!!fieldState.error}
                        invalidText={fieldState.error?.message}
                      />
                    </DatePicker>
                  )}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="diseaseType"
                  control={control}
                  render={({ field }) => (
                    <ComboBox
                      titleText={<RequiredFieldLabel label={t('diseaseType', 'Disease Type')} />}
                      id="disease-type"
                      items={diseaseTypes}
                      itemToString={(item) => (item ? item.display : '')}
                      onChange={({ selectedItem }) => field.onChange(selectedItem?.uuid || '')}
                      invalid={!!errors.diseaseType}
                      invalidText={errors.diseaseType?.message}
                      className={styles.sectionField}
                      placeholder={t('selectDiseaseType', 'Please select disease type')}
                    />
                  )}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="isAdmitted"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is-admitted"
                      labelText={t('isAdmitted', 'Is admitted?')}
                      checked={field.value}
                      onChange={(_, { checked }) => field.onChange(checked)}
                      className={styles.sectionField}
                    />
                  )}
                />
              </div>
            </div>

            {watch('isAdmitted') && (
              <div className={styles.formRow}>
                <div className={styles.formColumn}>
                  <Controller
                    name="admissionType"
                    control={control}
                    render={({ field }) => (
                      <ComboBox
                        titleText={t('admissionType', 'Admission Type')}
                        id="admission-type"
                        items={ADMISSION_TYPES}
                        itemToString={(item) => (item ? item.text : '')}
                        onChange={({ selectedItem }) => field.onChange(selectedItem?.id || '')}
                        invalid={!!errors.admissionType}
                        invalidText={errors.admissionType?.message}
                        className={styles.sectionField}
                        placeholder={t('selectAdmissionType', 'Please select admission type')}
                      />
                    )}
                  />
                </div>
              </div>
            )}

            {/* Status information about insurance verification */}
            {insurancePolicy && (
              <div className={styles.errorContainer}>
                <InlineNotification
                  kind="info"
                  lowContrast
                  title={t('insuranceVerified', 'Insurance Verified')}
                  subtitle={
                    insurancePolicyId
                      ? t(
                          'insurancePolicyFound',
                          `Insurance policy ID #${insurancePolicyId} found and will be used for global bill creation`,
                        )
                      : t('insuranceVerifiedNoPolicy', 'Insurance verified but policy ID not found')
                  }
                  className={styles.error}
                />
              </div>
            )}
          </>
        )}
      </div>
    </FormProvider>
  );
};

export default VisitFormAdmissionSection;
