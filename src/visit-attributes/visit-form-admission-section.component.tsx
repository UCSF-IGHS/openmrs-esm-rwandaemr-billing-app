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
  getInsurancePoliciesByPatient,
} from '../api/billing';
import {
  InlineNotification,
  TextInput,
  DatePicker,
  InlineLoading,
  ComboBox,
  DatePickerInput,
  Checkbox,
  Toggle,
  Button,
} from '@carbon/react';
import { z } from 'zod';
import styles from './visit-form-admission-section.scss';
import {
  createAdmissionWithGlobalBill,
  useDiseaseType,
  checkOpenGlobalBillForInsurancePolicy,
} from '../api/patient-admission.resource';

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
  const [patientInsurancePolicies, setPatientInsurancePolicies] = useState<Array<any>>([]);
  const [selectedInsurancePolicy, setSelectedInsurancePolicy] = useState<any>(null);
  const [expiredPolicyAttempt, setExpiredPolicyAttempt] = useState<string | null>(null);
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

  const isPolicyExpired = useCallback((policy: any): boolean => {
    if (!policy?.expirationDate) return false;

    try {
      const expirationDate = new Date(policy.expirationDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      return expirationDate < today;
    } catch (error) {
      console.error('Error parsing expiration date:', error);
      return false;
    }
  }, []);

  const formatExpirationDate = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (error) {
      return dateString;
    }
  }, []);

  const getPolicyDisplayText = useCallback(
    (policy: any): string => {
      if (!policy) return '';

      const isExpired = isPolicyExpired(policy);
      const hasOpenBill = policy.openGlobalBill ? ' (Has Open Bill)' : '';
      const expiredText = isExpired ? ' (EXPIRED)' : '';

      return `${policy.insurance?.name || 'Unknown'} - ${policy.insuranceCardNo}${hasOpenBill}${expiredText}`;
    },
    [isPolicyExpired],
  );

  const extractInsurancePolicyId = useCallback((policyResponse: any): number | null => {
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
  }, []);

  useEffect(() => {
    const loadPatientPolicies = async () => {
      if (!patientUuid) return;

      setIsLoadingData(true);
      try {
        const policyData = await fetchGlobalBillsByPatient(patientUuid);
        const openGlobalBills = policyData?.results?.filter((bill) => bill.closed === false) || [];

        const allPatientPolicies = await getInsurancePoliciesByPatient(patientUuid);

        const enhancedPolicies = await Promise.all(
          allPatientPolicies.map(async (policy) => {
            let enhancedPolicy = { ...policy };

            if (policy.insurance?.insuranceId) {
              const insuranceDetails = await getInsuranceById(policy.insurance.insuranceId);
              if (insuranceDetails) {
                enhancedPolicy.insurance = insuranceDetails;
              }
            }

            const associatedOpenBill = openGlobalBills.find(
              (bill) =>
                bill.admission?.insurancePolicy?.insurancePolicyId === policy.insurancePolicyId ||
                bill.admission?.insurancePolicy?.insuranceCardNo === policy.insuranceCardNo,
            );

            if (associatedOpenBill) {
              enhancedPolicy.openGlobalBill = associatedOpenBill;
            }

            return enhancedPolicy;
          }),
        );

        setPatientInsurancePolicies(enhancedPolicies);

        let defaultPolicy = null;

        if (enhancedPolicies.length > 0) {
          const validPolicies = enhancedPolicies.filter((policy) => !isPolicyExpired(policy));

          if (validPolicies.length > 0) {
            defaultPolicy = validPolicies.find((policy) => policy.openGlobalBill) || validPolicies[0];
          } else {
            defaultPolicy = enhancedPolicies[0];
            showSnackbar({
              title: t('allPoliciesExpired', 'All Insurance Policies Expired'),
              subtitle: t(
                'allPoliciesExpiredMessage',
                'All insurance policies for this patient have expired. Please add a new valid insurance policy.',
              ),
              kind: 'error',
            });
          }

          setSelectedInsurancePolicy(defaultPolicy);
          setInsurancePolicy(defaultPolicy);

          const policyId = extractInsurancePolicyId({ results: [defaultPolicy] });
          if (policyId) {
            setInsurancePolicyId(policyId);
          }

          if (defaultPolicy.insuranceCardNo) {
            setValue('insuranceCardNumber', defaultPolicy.insuranceCardNo);
          }

          if (defaultPolicy.insurance?.name) {
            setSelectedInsurance(defaultPolicy.insurance);
            setValue('insuranceName', defaultPolicy.insurance.name);
          }

          if (defaultPolicy.openGlobalBill) {
            setExistingGlobalBill(defaultPolicy.openGlobalBill);
            showSnackbar({
              title: t('existingGlobalBill', 'Existing Global Bill'),
              subtitle: t(
                'existingGlobalBillMessage',
                `Patient has an open global bill (ID: ${defaultPolicy.openGlobalBill.billIdentifier}) with insurance policy ${defaultPolicy.insurance?.name || 'None'}. This visit will be associated with the existing bill.`,
              ),
              kind: 'warning',
            });
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
  }, [patientUuid, setValue, t, extractInsurancePolicyId, isPolicyExpired]);

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
    [setValue, existingGlobalBill, t, extractInsurancePolicyId],
  );

  React.useEffect(() => {
    if (insuranceCardNumber && insuranceCardNumber.length >= 8 && !isLoadingData) {
      verifyInsuranceCard(insuranceCardNumber);
    }
  }, [insuranceCardNumber, verifyInsuranceCard, isLoadingData]);

  const handleInsurancePolicySelection = useCallback(
    async (selectedPolicy: any) => {
      if (!selectedPolicy) return;

      if (isPolicyExpired(selectedPolicy)) {
        const expiredDate = formatExpirationDate(selectedPolicy.expirationDate);
        setExpiredPolicyAttempt(selectedPolicy.insurance?.name || 'Unknown');

        showSnackbar({
          title: t('expiredInsurancePolicy', 'Expired Insurance Policy'),
          subtitle: t(
            'expiredInsurancePolicyMessage',
            `The selected insurance policy (${selectedPolicy.insurance?.name}) expired on ${expiredDate}. Please select a valid insurance policy.`,
          ),
          kind: 'error',
        });

        setTimeout(() => setExpiredPolicyAttempt(null), 5000);
        return;
      }

      setExpiredPolicyAttempt(null);

      setSelectedInsurancePolicy(selectedPolicy);
      setInsurancePolicy(selectedPolicy);

      const policyId = extractInsurancePolicyId({ results: [selectedPolicy] });
      if (policyId) {
        setInsurancePolicyId(policyId);
      }

      if (selectedPolicy.insuranceCardNo) {
        setValue('insuranceCardNumber', selectedPolicy.insuranceCardNo);
      }

      if (selectedPolicy.insurance?.name) {
        setSelectedInsurance(selectedPolicy.insurance);
        setValue('insuranceName', selectedPolicy.insurance.name);
      }

      try {
        if (policyId && patientUuid) {
          const openBillForPolicy = await checkOpenGlobalBillForInsurancePolicy(patientUuid, policyId);

          if (openBillForPolicy) {
            setExistingGlobalBill(openBillForPolicy);
            showSnackbar({
              title: t('existingGlobalBill', 'Existing Global Bill'),
              subtitle: t(
                'existingGlobalBillMessage',
                `Patient has an open global bill (ID: ${openBillForPolicy.billIdentifier}) with insurance policy ${selectedPolicy.insurance?.name || 'None'}. This visit will be associated with the existing bill.`,
              ),
              kind: 'warning',
            });
          } else {
            setExistingGlobalBill(null);
          }
        } else {
          if (selectedPolicy.openGlobalBill) {
            setExistingGlobalBill(selectedPolicy.openGlobalBill);
            showSnackbar({
              title: t('existingGlobalBill', 'Existing Global Bill'),
              subtitle: t(
                'existingGlobalBillMessage',
                `Patient has an open global bill (ID: ${selectedPolicy.openGlobalBill.billIdentifier}) with insurance policy ${selectedPolicy.insurance?.name || 'None'}. This visit will be associated with the existing bill.`,
              ),
              kind: 'warning',
            });
          } else {
            setExistingGlobalBill(null);
          }
        }
      } catch (error) {
        console.error('Error checking for open global bill:', error);
        if (selectedPolicy.openGlobalBill) {
          setExistingGlobalBill(selectedPolicy.openGlobalBill);
        } else {
          setExistingGlobalBill(null);
        }
      }
    },
    [setValue, t, extractInsurancePolicyId, patientUuid, isPolicyExpired, formatExpirationDate],
  );

  const handleFormSubmission = useCallback(
    async (data: AdmissionFormValues) => {
      setIsLoading(true);
      setError(null);

      try {
        if (!insurancePolicyId) {
          throw new Error('Insurance policy ID is required. Please verify the insurance card first.');
        }

        if (selectedInsurancePolicy && isPolicyExpired(selectedInsurancePolicy)) {
          const expiredDate = formatExpirationDate(selectedInsurancePolicy.expirationDate);
          throw new Error(
            `The selected insurance policy expired on ${expiredDate}. Please select a valid insurance policy.`,
          );
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

        const admissionTypeNumber = parseInt(data.admissionType) || 1;

        const result = await createAdmissionWithGlobalBill({
          patientUuid: patientUuid,
          isAdmitted: data.isAdmitted,
          admissionDate: data.admissionDate,
          diseaseType: data.diseaseType,
          admissionType: admissionTypeNumber,
          insuranceCardNumber: data.insuranceCardNumber,
          insurancePolicyId: insurancePolicyId,
          insuranceId: selectedInsurancePolicy?.insurance?.insuranceId || selectedInsurance?.insuranceId || 1,
        });

        const isNewBill = !existingGlobalBill;
        const billAction = isNewBill ? 'created' : 'associated with existing bill';

        if (isNewBill) {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('globalBillCreated', {
                detail: {
                  globalBillId: result.globalBill?.globalBillId,
                  billIdentifier: result.globalBill?.billIdentifier,
                  patientUuid,
                  insuranceCardNumber: data.insuranceCardNumber,
                },
              }),
            );
          }, 500);

          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }

        showSnackbar({
          title: 'Global Bill',
          subtitle: `Global bill has been ${billAction} successfully (ID: ${result.globalBill?.billIdentifier || result.globalBill?.globalBillId})`,
          kind: 'success',
        });

        setExtraVisitInfo({
          admissionData: {
            ...data,
            globalBillId: result.globalBill.globalBillId,
            billIdentifier: result.globalBill.billIdentifier,
            insuranceDetails: selectedInsurancePolicy?.insurance || selectedInsurance,
            insurancePolicyId: insurancePolicyId,
            patientUuid: patientUuid,
          },
          handleAdmissionCreated: () => {
            if (onAdmissionCreated) {
              onAdmissionCreated({
                ...data,
                globalBillId: result.globalBill.globalBillId,
                billIdentifier: result.globalBill.billIdentifier,
                insuranceDetails: selectedInsurancePolicy?.insurance || selectedInsurance,
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
    [
      insurancePolicyId,
      existingGlobalBill,
      t,
      selectedInsurance,
      selectedInsurancePolicy,
      setExtraVisitInfo,
      patientUuid,
      onAdmissionCreated,
      isPolicyExpired,
      formatExpirationDate,
    ],
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

  if (patientInsurancePolicies.length === 0) {
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

            {/* Insurance Policy Selection - Show ComboBox when multiple policies exist */}
            {patientInsurancePolicies.length > 1 && (
              <div className={styles.formRow}>
                <div className={styles.formColumn}>
                  <ComboBox
                    titleText={t('selectInsurancePolicy', 'Select Insurance Policy')}
                    id="insurance-policy-selector"
                    items={patientInsurancePolicies}
                    itemToString={(item) => getPolicyDisplayText(item)}
                    selectedItem={selectedInsurancePolicy}
                    onChange={({ selectedItem }) => handleInsurancePolicySelection(selectedItem)}
                    className={styles.sectionField}
                    placeholder={t('chooseInsurancePolicy', 'Choose insurance policy to use')}
                  />
                  {/* Display warning for expired policy attempt */}
                  {expiredPolicyAttempt && (
                    <div style={{ marginTop: '8px' }}>
                      <InlineNotification
                        kind="error"
                        title={t('expiredPolicy', 'Expired Policy')}
                        subtitle={t(
                          'expiredPolicyWarning',
                          `${expiredPolicyAttempt} policy has expired and cannot be selected.`,
                        )}
                        lowContrast
                        hideCloseButton
                      />
                    </div>
                  )}
                </div>
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
            {selectedInsurancePolicy && (
              <div className={styles.errorContainer}>
                <InlineNotification
                  kind="info"
                  lowContrast
                  title={t('insuranceVerified', 'Insurance Verified')}
                  subtitle={
                    insurancePolicyId
                      ? t(
                          'insurancePolicyFound',
                          `Insurance policy ID #${insurancePolicyId} (${selectedInsurancePolicy.insurance?.name}) will be used for global bill creation`,
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
