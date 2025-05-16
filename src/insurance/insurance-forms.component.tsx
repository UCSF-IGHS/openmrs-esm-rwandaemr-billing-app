import React, { useState, useEffect } from 'react';
import { useForm, FormProvider, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type TFunction, useTranslation } from 'react-i18next';
import {
  Button,
  ButtonSet,
  Form,
  InlineLoading,
  InlineNotification,
  TextInput,
  DatePicker,
  DatePickerInput,
  FormGroup,
  Checkbox,
  Select,
  SelectItem,
} from '@carbon/react';
import classNames from 'classnames';
import { closeWorkspace, ResponsiveWrapper, useLayoutType, showSnackbar } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import styles from './insurance.scss';
import { getThirdParties } from '../api/billing';
import { fetchInsuranceFirms, createInsurancePolicy } from './insurance-resource';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';

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
    companyName: z.string().nonempty('Company Name is required'),
    policyOwner: z.string().nonempty('policy Owner is required'),
    family: z.string().nonempty('Family is required'),
    category: z.string().nonempty('Category is required'),
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
  );

type InsuranceFormSchema = z.infer<typeof schema>;

const InsuranceForm: React.FC<InsuranceFormProps> = ({ patientUuid, closeFormWithSavedChanges }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [insuranceOptions, setInsuranceOptions] = useState<{ value: string; label: string }[]>([]);
  const [thirdPartyOptions, setThirdPartyOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
      policyOwner: '',
      family: '',
      category: '',
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
      };

      await createInsurancePolicy(payload, patientUuid);

      showSnackbar({
        title: t('insurancePolicySaved', 'Insurance policy saved'),
        kind: 'success',
      });
      window.dispatchEvent(new CustomEvent('insurancePolicyAdded'));
      closeWorkspace('insurance-form-workspace');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = (errors: any) => {
    setIsSubmitting(false);
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

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit, onError)} className={styles.form}>
        <div className={styles.form}>
          <div className={styles.formContainer}>
            <div className={styles.subheading}>{t('insuranceSection', 'Insurance')}</div>

            <Controller
              name="insuranceName"
              control={control}
              render={({ field }) => (
                <Select
                  id="insuranceName"
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
            <Controller
              name="coverageStartDate"
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <ResponsiveWrapper>
                  <DatePicker
                    id="coverageStartDate"
                    datePickerType="single"
                    dateFormat="d/m/Y"
                    maxDate={dayjs().utc().format('YYYY-MM-DD')}
                    placeholder="dd/mm/yyyy"
                    onChange={([date]) => onChange(date)}
                    onBlur={onBlur}
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
                    id="coverageEndDate"
                    datePickerType="single"
                    dateFormat="d/m/Y"
                    minDate={dayjs().startOf('day').format('YYYY-MM-DD')}
                    placeholder="dd/mm/yyyy"
                    onChange={([date]) => onChange(date)}
                    onBlur={onBlur}
                    value={value}
                  >
                    <DatePickerInput
                      id="coverageEndDateInput"
                      labelText={<RequiredFieldLabel label={t('coverageEndDate', 'Coverage End Date')} t={t} />}
                      placeholder="dd/mm/yyyy"
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
                      labelText={<RequiredFieldLabel label={t('hasThirdParty', 'Has Third party?')} t={t} />}
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

            <TextInput
              id="companyName"
              labelText={<RequiredFieldLabel label={t('companyName', 'Company Name')} t={t} />}
              {...register('companyName')}
            />

            <TextInput
              id="policyOwner"
              labelText={<RequiredFieldLabel label={t('policyOwner', 'Policy Owner')} t={t} />}
              {...register('policyOwner')}
            />

            <TextInput
              id="family"
              labelText={<RequiredFieldLabel label={t('family', 'Family')} t={t} />}
              {...register('family')}
            />

            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select
                  id="category"
                  labelText={<RequiredFieldLabel label={t('category', 'Category')} t={t} />}
                  {...field}
                >
                  <SelectItem disabled hidden value="" text={t('selectLevelsPlease', 'Select levels please')} />
                  <SelectItem value="1" text="1" />
                  <SelectItem value="2" text="2" />
                  <SelectItem value="3" text="3" />
                  <SelectItem value="4" text="4" />
                </Select>
              )}
            />

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
                disabled={isSubmitting}
                kind="primary"
                type="button"
                onClick={() => {
                  handleSubmit(onSubmit, onError)();
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
