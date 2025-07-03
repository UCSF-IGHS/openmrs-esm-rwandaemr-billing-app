import React, { useCallback, useState, useEffect } from 'react';
import classNames from 'classnames';
import {
  ComboBox,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  InlineNotification,
  Checkbox,
  TextInput,
  Button,
  ButtonSet,
  Form,
} from '@carbon/react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { openmrsFetch, showSnackbar, usePatient, useLayoutType, useVisit } from '@openmrs/esm-framework';
import {
  getInsurances,
  fetchGlobalBillsByInsuranceCard,
  fetchGlobalBillsByPatient,
  getInsurancePolicyByCardNumber,
  getInsuranceById,
} from '../api/billing';
import styles from './patient-admission-form.scss';
import { createAdmissionWithGlobalBill, getPatientVisits, useDiseaseType } from '../api/patient-admission.resource';

const ADMISSION_TYPES = [
  { id: '1', text: 'Ordinary Admission' },
  { id: '2', text: 'DCP Admission' },
];
const BASE_API_URL = '/ws/rest/v1/mohbilling';

type PatientAdmissionFormProps = {
  patientUuid: string;
  onAdmissionCreated?: (admissionData: any) => void;
  closeWorkspace: () => void;
  closeWorkspaceWithSavedChanges?: () => void;
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
  admissionType: z.string().min(1, { message: 'Admission type is required' }),
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

const PatientAdmissionForm: React.FC<PatientAdmissionFormProps> = ({
  patientUuid,
  onAdmissionCreated,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
}) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const { mutate: mutateVisitData } = useVisit(patientUuid);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<Array<any>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [insurancePolicy, setInsurancePolicy] = useState<any>(null);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);
  const [insurancePolicyId, setInsurancePolicyId] = useState<number | null>(null);
  const [existingGlobalBill, setExistingGlobalBill] = useState<any>(null);
  const isTablet = useLayoutType() === 'tablet';
  const { diseaseType: diseaseTypes, isLoading: isLoadingDiseaseTypes, error: diseaseTypeError } = useDiseaseType();

  const methods = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      insuranceName: '',
      insuranceCardNumber: '',
      isAdmitted: false,
      admissionDate: new Date(),
      diseaseType: '',
      admissionType: '1',
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
  const isAdmitted = watch('isAdmitted');

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
    if (insuranceCardNumber && insuranceCardNumber.length >= 8 && !isLoadingData && !isAdmitted) {
      verifyInsuranceCard(insuranceCardNumber);
    }
  }, [insuranceCardNumber, verifyInsuranceCard, isLoadingData, isAdmitted]);

  const onSubmit = useCallback(
    async (data: AdmissionFormValues) => {
      setIsLoading(true);
      setError(null);

      try {
        if (!insurancePolicyId) {
          throw new Error('Insurance policy ID is required. Please verify the insurance card first.');
        }

        if (existingGlobalBill) {
          setIsLoading(false);
          showSnackbar({
            title: t('existingGlobalBill', 'Existing Global Bill'),
            subtitle: t(
              'cannotCreateDuplicateGlobalBill',
              'Cannot create a new global bill because patient already has an open one.',
            ),
            kind: 'error',
          });
          return;
        }

        const admissionTypeNumber = parseInt(data.admissionType) || 1;
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

        // Show global bill creation success
        showSnackbar({
          title: 'Global Bill',
          subtitle: 'Global bill has been created successfully',
          kind: 'success',
        });

        try {
          const startOfDay = new Date(data.admissionDate);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(data.admissionDate);
          endOfDay.setHours(23, 59, 59, 999);

          await new Promise((resolve) => setTimeout(resolve, 1000));

          const visitsResponse = await getPatientVisits(patientUuid, startOfDay, endOfDay);

          if (visitsResponse && visitsResponse.results && visitsResponse.results.length > 0) {
            const visit = visitsResponse.results[0]; // Get the most recent visit
            const visitType = visit.visitType?.display || 'Clinic Visit';

            showSnackbar({
              title: t('visitCreated', 'Visit Created'),
              subtitle: t('visitCreatedSuccessfully', `${visitType} has been created successfully`),
              kind: 'success',
            });

            mutateVisitData();
          }
        } catch (visitError) {
          console.error('Failed to check for patient visits:', visitError);

          showSnackbar({
            title: t('visitCheckError', 'Visit Check Error'),
            subtitle: t(
              'visitCheckErrorMessage',
              'Unable to verify if a visit was created. The admission was saved successfully.',
            ),
            kind: 'warning',
            isLowContrast: true,
          });
        }

        if (onAdmissionCreated) {
          onAdmissionCreated({
            ...data,
            globalBillId: result.globalBill.globalBillId,
            billIdentifier: result.globalBill.billIdentifier,
            insuranceDetails: selectedInsurance,
            insurancePolicyId: insurancePolicyId,
          });
        }

        if (closeWorkspaceWithSavedChanges) {
          closeWorkspaceWithSavedChanges();
        } else {
          closeWorkspace();
        }
      } catch (err) {
        console.error('Error creating global bill:', err);
        setError('Failed to create global bill. Please try again.');
        showSnackbar({
          title: 'Global Bill Error',
          subtitle: 'An error has occurred while creating global bill',
          kind: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      onAdmissionCreated,
      patientUuid,
      selectedInsurance,
      insurancePolicyId,
      existingGlobalBill,
      t,
      closeWorkspace,
      closeWorkspaceWithSavedChanges,
      mutateVisitData,
    ],
  );

  if (isLoadingData || isLoadingDiseaseTypes) {
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

  return (
    <FormProvider {...methods}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <div className={styles.formContainer}>
          {/* Show warning if there's an existing open global bill */}
          {existingGlobalBill && (
            <div className={styles.errorContainer}>
              <InlineNotification
                kind="warning"
                lowContrast
                title={t('existingGlobalBill', 'Existing Global Bill')}
                subtitle={t(
                  'existingGlobalBillMessage',
                  `Patient already has an open global bill (ID: ${existingGlobalBill.billIdentifier}). You cannot create a new one.`,
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
                    readOnly={isAdmitted}
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
                name="isAdmitted"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="is-admitted"
                    labelText={t('isAdmitted', 'Is admitted?')}
                    checked={field.value}
                    onChange={field.onChange}
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
                      placeholder="mm/dd/yyyy"
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
                    itemToString={(item) => (item ? (item as any).display : '')}
                    onChange={({ selectedItem }) => field.onChange((selectedItem as any)?.uuid || '')}
                    invalid={!!errors.diseaseType}
                    invalidText={errors.diseaseType?.message}
                    className={styles.sectionField}
                    placeholder={t('selectDiseaseType', 'Please select disease type')}
                  />
                )}
              />
            </div>
          </div>

          {/* Only show Admission Type when isAdmitted is true */}
          {isAdmitted && (
            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="admissionType"
                  control={control}
                  render={({ field }) => (
                    <ComboBox
                      titleText={<RequiredFieldLabel label={t('admissionType', 'Admission Type')} />}
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
        </div>

        {/* Button container with cancel and save buttons */}
        <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
          <Button className={styles.button} kind="secondary" onClick={closeWorkspace} disabled={isLoading}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            type="submit"
            disabled={isLoading || !insurancePolicyId || existingGlobalBill !== null}
          >
            {isLoading ? (
              <InlineLoading className={styles.spinner} description={t('saving', 'Saving') + '...'} />
            ) : (
              <span>{t('saveAndClose', 'Save & close')}</span>
            )}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );
};

export default PatientAdmissionForm;
