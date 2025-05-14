import React, { useState } from 'react';
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
} from '@carbon/react';
import classNames from 'classnames';
import { ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import styles from './insurance.scss';

interface InsuranceFormProps {
  closeForm: () => void;
  closeFormWithSavedChanges?: () => void;
}

interface RequiredFieldLabelProps {
  label: string;
  t: TFunction;
}

const schema = z.object({
  insuranceFirm: z.string().nonempty('Insurance name is required'),
  cardNumber: z.string().nonempty('Card number is required'),
  coverageStartDate: z.string().nonempty('Coverage start date is required'),
  coverageEndDate: z.string().nonempty('Coverage end date is required'),
  isAdmitted: z.boolean(),
  thirdPartyProvider: z.string().nonempty('Third Party Provider is required'),
  companyName: z.string().nonempty('Company Name is required'),
  policyOwner: z.string().nonempty('policy Owner is required'),
  family: z.string().nonempty('Family is required'),
  category: z.string().nonempty('Category is required'),
});

type InsuranceFormSchema = z.infer<typeof schema>;

const InsuranceForm: React.FC<InsuranceFormProps> = ({ closeForm, closeFormWithSavedChanges }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const methods = useForm<InsuranceFormSchema>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      insuranceFirm: '',
      cardNumber: '',
      coverageStartDate: '',
      coverageEndDate: '',
      isAdmitted: false,
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
    formState: { errors },
  } = methods;

  const onSubmit: SubmitHandler<InsuranceFormSchema> = async (data) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // TODO: Replace with actual save logic
      closeFormWithSavedChanges?.();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = () => setIsSubmitting(false);

  return (
    <FormProvider {...methods}>
      <Form onSubmit={handleSubmit(onSubmit, onError)} className={styles.form}>
        <div className={styles.form}>
          <div className={styles.formContainer}>
            <div className={styles.subheading}>{t('insuranceSection', 'Insurance')}</div>

            <TextInput
              id="insuranceFirm"
              labelText={<RequiredFieldLabel label={t('insuranceName', 'Insurance Name')} t={t} />}
              {...register('insuranceFirm')}
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
                  name="isAdmitted"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is-admitted"
                      labelText={<RequiredFieldLabel label={t('isAdmitted', 'Is admitted?')} t={t} />}
                      checked={field.value}
                      onChange={field.onChange}
                      className={styles.sectionField}
                    />
                  )}
                />
              </div>
            </div>

            <TextInput
              id="thirdPartyProvider"
              labelText={<RequiredFieldLabel label={t('thirdPartyProvider', 'Third Party Provider')} t={t} />}
              {...register('thirdPartyProvider')}
            />

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

            <TextInput
              id="category"
              labelText={<RequiredFieldLabel label={t('category', 'Category')} t={t} />}
              {...register('category')}
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
              <Button className={styles.button} kind="secondary" onClick={closeForm}>
                {t('cancel', 'Cancel')}
              </Button>
              <Button className={styles.button} disabled={isSubmitting} kind="primary" type="submit">
                {isSubmitting ? (
                  <InlineLoading className={styles.spinner} description={t('saving', 'Saving') + '...'} />
                ) : (
                  <span>{t('saveAndClose', 'Save & close')}</span>
                )}
              </Button>
            </ButtonSet>
          </div>
        </div>
      </Form>
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
