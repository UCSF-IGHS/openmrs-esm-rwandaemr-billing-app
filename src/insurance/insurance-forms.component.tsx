import React, { useState, useEffect } from 'react';
import { useForm, FormProvider, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type TFunction, useTranslation } from 'react-i18next';
import {
  Button,
  ButtonSet,
  InlineLoading,
  InlineNotification,
  TextInput,
  DatePicker,
  DatePickerInput,
  Checkbox,
  Select,
  SelectItem,
} from '@carbon/react';
import classNames from 'classnames';
import { closeWorkspace, ResponsiveWrapper, useLayoutType, showSnackbar } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import styles from './insurance.scss';
import { getThirdParties } from '../api/billing';
import {
  fetchInsuranceFirms,
  createInsurancePolicy,
  checkInsuranceEligibility,
  useInsuranceTypes,
} from './insurance-resource';

interface InsuranceFormProps {
  patientUuid: string;
  patientId: string;
  insuranceId?: string;
  closeForm: () => void;
  closeFormWithSavedChanges?: () => void;
  closeWorkspace: () => void;
}

interface RequiredFieldLabelProps {
  label: string;
  t: TFunction;
}

const schema = z
  .object({
    insuranceName: z.string().nonempty('Insurance name is required'),
    cardNumber: z.string().nonempty('Card number is required'),
    coverageStartDate: z.date({ required_error: 'Coverage start date is required' }),
    coverageEndDate: z.date({ required_error: 'Coverage end date is required' }),
    hasThirdParty: z.boolean(),
    thirdPartyProvider: z.string().optional(),
    companyName: z.string().optional(),
    insuranceOwner: z.string().optional(),
    family: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.hasThirdParty) {
        return !!data.thirdPartyProvider;
      }
      return true;
    },
    {
      path: ['thirdPartyProvider'],
      message: 'Third Party Provider is required when Has Third Party is checked',
    },
  )
  .superRefine((data, ctx) => {
    if (data.coverageStartDate && data.coverageEndDate) {
      const start = new Date(data.coverageStartDate);
      const end = new Date(data.coverageEndDate);
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['coverageEndDate'],
          message: 'Coverage end date cannot be before coverage start date',
        });
      }
    }
  });

type InsuranceFormSchema = z.infer<typeof schema>;

const InsuranceForm: React.FC<InsuranceFormProps> = ({ patientUuid, closeFormWithSavedChanges }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [insuranceOptions, setInsuranceOptions] = useState<{ value: string; label: string }[]>([]);
  const [thirdPartyOptions, setThirdPartyOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState<'success' | 'error' | 'warning' | null>(null);
  const [eligibilityDetails, setEligibilityDetails] = useState<any>(null);
  const [insuranceType, setInsuranceType] = useState<string | null>(null);
  const { determineInsuranceType, isLoading: typesLoading } = useInsuranceTypes();

  const methods = useForm<InsuranceFormSchema>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      insuranceName: '',
      cardNumber: '',
      coverageStartDate: null,
      coverageEndDate: null,
      hasThirdParty: false,
      thirdPartyProvider: '',
      companyName: '',
      insuranceOwner: '',
      family: '',
    },
  });

  const {
    handleSubmit,
    register,
    control,
    watch,
    formState: { errors },
  } = methods;

  const hasThirdParty = watch('hasThirdParty');
  const coverageStartDate = watch('coverageStartDate');
  const coverageEndDate = watch('coverageEndDate');
  const endBeforeStart =
    !!coverageStartDate &&
    !!coverageEndDate &&
    new Date(coverageEndDate).getTime() < new Date(coverageStartDate).getTime();

  const onSubmit: SubmitHandler<InsuranceFormSchema> = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        insurance: {
          insuranceId: Number(data.insuranceName),
        },
        owner: patientUuid,
        insuranceCardNo: data.cardNumber,
        coverageStartDate: dayjs(data.coverageStartDate).format('YYYY-MM-DD'),
        expirationDate: dayjs(data.coverageEndDate).format('YYYY-MM-DD'),
        beneficiaries: [
          {
            patient: patientUuid,
            policyIdNumber: data.cardNumber,
          },
        ],
      };

      await createInsurancePolicy(payload, patientUuid);

      showSnackbar({
        title: t('insurancePolicySaved', 'Insurance policy saved'),
        kind: 'success',
      });

      window.dispatchEvent(new CustomEvent('insurancePolicyAdded'));
      closeWorkspace('insurance-form-workspace');
    } catch (err: any) {
      const backendMessage =
        err?.response?.data?.error?.message ?? err?.responseBody?.error?.message ?? err?.message ?? '';

      const isDuplicate = backendMessage.includes('Duplicate entry') && backendMessage.includes('insurance_card_no');

      if (isDuplicate) {
        const duplicateMsg = t('duplicateCardNumber', 'An insurance policy with this Card Number already exists.');

        methods.setError('cardNumber', {
          type: 'manual',
          message: duplicateMsg,
        });

        setSubmitError(duplicateMsg);
        methods.setFocus('cardNumber');
      } else {
        setSubmitError(t('errorSavingInsurance', 'Error saving insurance'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const loadInsuranceFirms = async () => {
      const options = await fetchInsuranceFirms();
      setInsuranceOptions(options);
    };

    loadInsuranceFirms();
  }, []);

  useEffect(() => {
    const loadThirdParties = async () => {
      const results = await getThirdParties();
      const mapped = results.map((p) => ({
        value: String(p.thirdPartyId),
        label: p.name ?? 'Unknown',
      }));
      setThirdPartyOptions(mapped);
    };

    loadThirdParties();
  }, []);

  useEffect(() => {
    if (endBeforeStart) {
      methods.setError('coverageEndDate', {
        type: 'manual',
        message: 'Coverage end date cannot be before coverage start date',
      });
    } else {
      methods.clearErrors('coverageEndDate');
    }
  }, [endBeforeStart, methods]);

  const formValues = methods.getValues();
  const { cardNumber, insuranceName } = formValues;

  const handleInsuranceEligibilityCheck = async () => {
    const formValues = methods.getValues();
    const { cardNumber, insuranceName } = formValues;

    if (!cardNumber || !insuranceName) {
      setEligibilityMessage(
        t(
          'cardNumberAndInsuranceRequired',
          'Please enter both card number and select an insurance before checking eligibility',
        ),
      );
      setEligibilityStatus('warning');
      return;
    }

    setIsLoading(true);
    setEligibilityMessage(null);
    setEligibilityStatus(null);
    setEligibilityDetails(null);

    try {
      // Use the hook's helper function to determine insurance type
      const detectedInsuranceType = determineInsuranceType(insuranceName);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.form}>
          <div className={styles.formContainer}>
            <div className={styles.subheading}>{t('insuranceSection', 'Insurance')}</div>

            <Controller
              name="insuranceName"
              control={control}
              render={({ field }) => (
                <Select
                  id="insuranceName"
                  style={{ marginBottom: '0.5rem' }}
                  labelText={<RequiredFieldLabel label={t('insuranceName', 'Insurance Name')} t={t} />}
                  {...field}
                >
                  <SelectItem disabled hidden value="" text={t('selectAnOption', 'Select an option')} />
                  {insuranceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} text={option.label} />
                  ))}
                </Select>
              )}
            />

            <TextInput
              id="cardNumber"
              labelText={<RequiredFieldLabel label={t('cardNumber', 'Card Number')} t={t} />}
              {...register('cardNumber')}
            />

            <Button size="sm" onClick={handleInsuranceEligibilityCheck} disabled={isLoading}>
              {isLoading
                ? t('checkingInsuranceEligibility', 'Checking insurance eligibility...')
                : t('checkInsuranceEligibility', 'Check insurance eligibility')}
            </Button>

            {eligibilityMessage && eligibilityStatus && (
              <InlineNotification
                kind={eligibilityStatus}
                lowContrast
                title={
                  eligibilityStatus === 'success'
                    ? t('eligibilityConfirmed', 'Eligibility Confirmed')
                    : isLoading
                      ? t('checkingEligibility', 'Checking eligibility...')
                      : eligibilityStatus === 'warning'
                        ? t('incompleteFields', 'Incomplete Fields')
                        : t('eligibilityCheckFailed', 'Eligibility Check Failed')
                }
                subtitle={eligibilityMessage}
                role="alert"
                className={styles.eligibilityMessage}
              />
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
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
                      <strong style={{ color: '#525252', fontSize: '0.875rem' }}>
                        {t('dateOfBirth', 'Date of Birth')}:{' '}
                      </strong>
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
                      <strong style={{ color: '#525252', fontSize: '0.875rem' }}>
                        {t('nationalId', 'National ID')}:{' '}
                      </strong>
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
                        {t('mainAffiliateId', 'Main Affiliate ID')}:{' '}
                      </strong>
                      <span style={{ color: '#161616' }}>{eligibilityDetails.mainAffiliateId}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <Controller
              name="coverageStartDate"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <ResponsiveWrapper>
                  <DatePicker
                    datePickerType="single"
                    dateFormat="d/m/Y"
                    maxDate={new Date()}
                    onChange={([date]) => onChange(date)}
                    value={value}
                  >
                    <DatePickerInput
                      id="insuranceStartDateInput"
                      labelText={<RequiredFieldLabel label={t('coverageStartdate', 'Coverage Start Date')} t={t} />}
                      placeholder="dd/mm/yyyy"
                    />
                  </DatePicker>
                </ResponsiveWrapper>
              )}
            />

            <Controller
              name="coverageEndDate"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <ResponsiveWrapper>
                  <DatePicker
                    datePickerType="single"
                    dateFormat="d/m/Y"
                    minDate={coverageStartDate ? new Date(coverageStartDate) : new Date()}
                    onChange={([date]) => onChange(date)}
                    value={value}
                  >
                    <DatePickerInput
                      id="coverageEndDateInput"
                      labelText={<RequiredFieldLabel label={t('coverageEndDate', 'Coverage End Date')} t={t} />}
                      placeholder="dd/mm/yyyy"
                      invalid={endBeforeStart || !!errors.coverageEndDate}
                      invalidText={t('endDateBeforeStart', 'Coverage end date cannot be before coverage start date')}
                    />
                  </DatePicker>
                </ResponsiveWrapper>
              )}
            />

            <div className={styles.formRow}>
              <div className={styles.formColumn}>
                <Controller
                  name="hasThirdParty"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is-admitted"
                      labelText={t('hasThirdParty', 'Has Third party?')}
                      checked={field.value}
                      onChange={field.onChange}
                      className={styles.sectionField}
                    />
                  )}
                />
              </div>
            </div>
            {hasThirdParty && (
              <Controller
                name="thirdPartyProvider"
                control={control}
                render={({ field }) => (
                  <Select
                    id="thirdPartyProvider"
                    labelText={<RequiredFieldLabel label={t('thirdPartyProvider', 'Third Party Provider')} t={t} />}
                    {...field}
                  >
                    <SelectItem disabled hidden value="" text={t('selectAnOption', 'Select an option')} />
                    {thirdPartyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} text={option.label} />
                    ))}
                  </Select>
                )}
              />
            )}
            <div className={styles.subheading}>{t('ownershipSection', 'Ownership')}</div>

            <TextInput id="companyName" labelText={t('companyName', 'Company Name')} {...register('companyName')} />

            <TextInput
              id="insuranceOwner"
              labelText={t('insuranceOwner', 'Head Household Name/Insurance Owner')}
              {...register('insuranceOwner')}
            />

            <TextInput id="family" labelText={t('family', 'Family/ Affiliation code')} {...register('family')} />

            {submitError && (
              <InlineNotification
                kind="error"
                lowContrast
                title={t('errorSavingInsurance', 'Error saving insurance')}
                subtitle={submitError}
                role="alert"
                className={styles.error}
              />
            )}
          </div>

          <div className={styles.formFooter}>
            <ButtonSet className={classNames({ [styles.tablet]: isTablet, [styles.desktop]: !isTablet })}>
              <Button
                className={styles.button}
                kind="secondary"
                onClick={() => closeWorkspace('insurance-form-workspace')}
                disabled={isLoading}
              >
                {t('cancel', 'Cancel')}
              </Button>

              <Button
                className={styles.button}
                disabled={isSubmitting || endBeforeStart || !!errors.coverageEndDate}
                kind="primary"
                type="button"
                onClick={() => {
                  handleSubmit(onSubmit)();
                }}
              >
                {isSubmitting ? (
                  <InlineLoading className={styles.spinner} description={t('saving', 'Saving') + '...'} />
                ) : (
                  <span>{t('saveAndClose', 'Save & close')}</span>
                )}
              </Button>
            </ButtonSet>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

function RequiredFieldLabel({ label, t }: RequiredFieldLabelProps) {
  return (
    <span>
      {label}
      <span title={t('required', 'Required')} className={styles.required}>
        *
      </span>
    </span>
  );
}

export default InsuranceForm;
