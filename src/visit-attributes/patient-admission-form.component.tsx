import React, { useCallback, useState } from 'react';
import { ComboBox, DatePicker, DatePickerInput, InlineLoading, InlineNotification, Checkbox, TextInput } from '@carbon/react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { showSnackbar } from '@openmrs/esm-framework';
import { 
  getInsurances, 
  fetchGlobalBillsByInsuranceCard, 
  getDepartments, 
} from '../api/billing';
import styles from './patient-admission-form.scss';
import { createAdmissionWithGlobalBill, useDiseaseType } from '../api/patient-admission.resource';

const ADMISSION_TYPES = [
  { id: 'ordinary', text: 'Ordinary Admission' },
  { id: 'dcp', text: 'DCP Admission' }
];

type PatientAdmissionFormProps = {
  patientUuid: string;
  onAdmissionCreated?: (admissionData: any) => void;
};

// Form schema validation
const admissionFormSchema = z.object({
  insuranceName: z.string().optional(),
  insuranceCardNumber: z.string().min(1, { message: 'Insurance card number is required for billing' }),
  isAdmitted: z.boolean(),
  admissionDate: z.date().refine((date) => date <= new Date(), { message: 'Date cannot be in the future' }),
  diseaseType: z.string().min(1, { message: 'Disease type is required' }),
  admissionType: z.string().min(1, { message: 'Admission type is required' }),
  department: z.string().optional()
});

type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

const PatientAdmissionForm: React.FC<PatientAdmissionFormProps> = ({ patientUuid, onAdmissionCreated }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<Array<any>>([]);
  const [departments, setDepartments] = useState<Array<any>>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [insurancePolicy, setInsurancePolicy] = useState<any>(null);
  const [selectedInsurance, setSelectedInsurance] = useState<any>(null);
  
  const { diseaseType: diseaseTypes, isLoading: isLoadingDiseaseTypes, error: diseaseTypeError } = useDiseaseType();
  
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      insuranceName: '',
      insuranceCardNumber: '',
      isAdmitted: true,
      admissionDate: new Date(),
      diseaseType: '',
      admissionType: '',
      department: ''
    }
  });
  
  const insuranceCardNumber = watch('insuranceCardNumber');

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [insurancesData, departmentsData] = await Promise.all([
          getInsurances(),
          getDepartments()
        ]);
        setInsurances(insurancesData);
        setDepartments(departmentsData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Error loading necessary data. Please try again.');
      } finally {
        setIsLoadingData(false);
      }
    };
    
    loadData();
  }, []);

  const verifyInsuranceCard = useCallback(async (cardNumber: string) => {
    if (!cardNumber) return;
    
    setIsLoading(true);
    try {
      const response = await fetchGlobalBillsByInsuranceCard(cardNumber);
      if (response && response.results && response.results.length > 0) {
        if (response.results[0]?.admission?.insurancePolicy) {
          setInsurancePolicy(response.results[0].admission.insurancePolicy);
          
          if (response.results[0].admission.insurancePolicy.insurance) {
            const insurance = response.results[0].admission.insurancePolicy.insurance;
            setSelectedInsurance(insurance);
            setValue('insuranceName', insurance.name);
          }
        }
        
        showSnackbar({ 
          title: 'Insurance Card', 
          subtitle: 'Insurance card validated successfully', 
          kind: 'success' 
        });
      } else {
        setInsurancePolicy(null);
        showSnackbar({ 
          title: 'Insurance Card', 
          subtitle: 'Insurance card not found or invalid', 
          kind: 'warning' 
        });
      }
    } catch (err) {
      console.error('Error verifying insurance card:', err);
      setInsurancePolicy(null);
      showSnackbar({ 
        title: 'Insurance Card Error', 
        subtitle: 'An error occurred while verifying the insurance card', 
        kind: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [setValue]);

  React.useEffect(() => {
    if (insuranceCardNumber && insuranceCardNumber.length >= 8) {
      verifyInsuranceCard(insuranceCardNumber);
    }
  }, [insuranceCardNumber, verifyInsuranceCard]);

  const onSubmit = useCallback(async (data: AdmissionFormValues) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await createAdmissionWithGlobalBill({
        patientUuid: patientUuid,
        isAdmitted: data.isAdmitted,
        admissionDate: data.admissionDate,
        diseaseType: data.diseaseType,
        admissionType: data.admissionType,
        insuranceCardNumber: data.insuranceCardNumber,
        department: data.department,
        insuranceId: selectedInsurance?.insuranceId || 1
      });
      
      showSnackbar({ 
        title: 'Patient Admission', 
        subtitle: 'Patient has been admitted successfully with a global bill', 
        kind: 'success' 
      });
      
      if (onAdmissionCreated) {
        onAdmissionCreated({
          ...data,
          admissionId: result.admission.admissionId,
          globalBillId: result.globalBill.globalBillId,
          billIdentifier: result.globalBill.billIdentifier,
          insuranceDetails: selectedInsurance
        });
      }
    } catch (err) {
      console.error('Error creating admission:', err);
      setError('Failed to create admission. Please try again.');
      showSnackbar({ 
        title: 'Admission Error', 
        subtitle: 'An error has occurred while creating admission and global bill', 
        kind: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [onAdmissionCreated, patientUuid, selectedInsurance]);

  if (isLoadingData || isLoadingDiseaseTypes) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading')}
        description={t('loadingAdmissionData', 'Loading admission data...')}
      />
    );
  }

  if (error || diseaseTypeError) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('admissionError', 'Admission error')}
        subtitle={error || 'Error loading disease types'}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <section className={styles.sectionContainer}>
        <div className={styles.sectionTitle}>{t('admissionForm', 'Admission Information')}</div>

        <Controller
          name="insuranceName"
          control={control}
          render={({ field }) => (
            <ComboBox
              titleText={t('insuranceName', 'Insurance Name')}
              id="insurance-name"
              items={insurances}
              itemToString={(item) => (item ? item.name : '')}
              onChange={({ selectedItem }) => {
                field.onChange(selectedItem?.name || '');
                setSelectedInsurance(selectedItem);
              }}
              className={styles.sectionField}
            />
          )}
        />

        <Controller
          name="insuranceCardNumber"
          control={control}
          render={({ field }) => (
            <TextInput
              id="insurance-card-number"
              labelText={t('insuranceCardNumber', 'Insurance Card Number')}
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

        <Controller
          name="department"
          control={control}
          render={({ field }) => (
            <ComboBox
              titleText={t('department', 'Department')}
              id="department"
              items={departments}
              itemToString={(item) => (item ? item.name : '')}
              onChange={({ selectedItem }) => field.onChange(selectedItem?.departmentId || '')}
              className={styles.sectionField}
            />
          )}
        />

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

        <Controller
          name="admissionDate"
          control={control}
          render={({ field }) => (
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
                invalid={!!errors.admissionDate}
                invalidText={errors.admissionDate?.message}
              />
            </DatePicker>
          )}
        />

        <Controller
          name="diseaseType"
          control={control}
          render={({ field }) => (
            <ComboBox
              titleText={t('diseaseType', 'Disease Type')}
              id="disease-type"
              items={diseaseTypes}
              itemToString={(item) => (item ? item.display : '')}
              onChange={({ selectedItem }) => field.onChange(selectedItem?.uuid || '')}
              invalid={!!errors.diseaseType}
              invalidText={errors.diseaseType?.message}
              className={styles.sectionField}
            />
          )}
        />

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
            />
          )}
        />

        {/* Status information about insurance verification */}
        {insurancePolicy && (
          <InlineNotification
            kind="info"
            lowContrast
            title={t('insuranceVerified', 'Insurance Verified')}
            subtitle={t(
              'insuranceVerifiedMessage',
              'Insurance card is valid and will be used for global bill creation',
            )}
            className={styles.sectionField}
          />
        )}
      </section>
    </form>
  );
};

export default PatientAdmissionForm;
