import React from 'react';
import { DatePicker, DatePickerInput, Dropdown, TextInput, Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import styles from './billing-reports.scss';

type ReportFilterField =
  | 'startDate'
  | 'endDate'
  | 'reportType'
  | 'insurance'
  | 'service'
  | 'type'
  | 'thirdParty'
  | 'collector'
  | 'billCreator'
  | 'billStatus';

interface ReportFilterFormProps {
  fields: ReportFilterField[];
  onSearch: (formData: Record<string, any>) => void;
  insuranceOptions?: { label: string; value: number }[];
}

const ReportFilterForm: React.FC<ReportFilterFormProps> = ({ fields, onSearch, insuranceOptions }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState({});

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSearch = () => {
    onSearch(formData);
  };

  const renderField = (field: ReportFilterField) => {
    switch (field) {
      case 'startDate':
      case 'endDate':
        return (
          <DatePicker datePickerType="single" onChange={(date) => handleChange(field, date[0])}>
            <DatePickerInput
              id={field}
              labelText={t(field, field === 'startDate' ? 'Start Date' : 'End Date')}
              placeholder={t('datePlaceholder', 'DD-MMM-YYYY')}
              aria-label={t(field, field === 'startDate' ? 'Start Date' : 'End Date')}
            />
          </DatePicker>
        );

      case 'insurance':
        return (
          <Dropdown
            id="insurance"
            titleText={t('insurance', 'Insurance')}
            label={t('select', 'Select')}
            items={insuranceOptions || []}
            itemToString={(item) => item?.label || ''}
            onChange={({ selectedItem }) => handleChange('insurance', selectedItem?.value)}
          />
        );

      case 'service':
        return (
          <Dropdown
            id="service"
            titleText={t('service', 'Service')}
            label={t('select', 'Select')}
            items={['Consultation', 'Pharmacy', 'Lab', 'Radiology', 'Surgery']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('service', selectedItem)}
          />
        );

      case 'thirdParty':
        return (
          <Dropdown
            id="third-party"
            titleText={t('thirdParty', 'Third Party')}
            label={t('select', 'Select')}
            items={['Prison', 'RNUD', 'GBV', 'Others']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('thirdParty', selectedItem)}
          />
        );

      case 'reportType':
        return (
          <Dropdown
            id="report-type"
            titleText={t('reportType', 'Report Type')}
            label={t('select', 'Select')}
            items={['Ordinary Report', 'DCP Report', 'All']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('reportType', selectedItem)}
          />
        );

      case 'billStatus':
        return (
          <Dropdown
            id="bill-status"
            titleText={t('billStatus', 'Bill Status')}
            label={t('select', 'Select')}
            items={['Paid', 'Fully Paid', 'UnPaid', 'Partly Paid']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('billStatus', selectedItem)}
          />
        );

      case 'type':
        return (
          <Dropdown
            id="deposit-type"
            titleText={t('type', 'Deposit Report Type')}
            label={t('select', 'Select')}
            items={['Deposit', 'Payment', 'Withdrawal']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('type', selectedItem)}
          />
        );

      case 'billCreator':
        return (
          <TextInput
            id="bill-creator"
            labelText={t('billCreator', 'Bill Creator')}
            placeholder={t('enterUserName', 'Enter user name')}
            aria-label={t('billCreator', 'Bill Creator')}
            onChange={(e) => handleChange('billCreator', e.target.value)}
          />
        );

      case 'collector':
        return (
          <TextInput
            id="collector"
            labelText={t('collector', 'Collector')}
            placeholder={t('enterUserName', 'Enter user name')}
            aria-label={t('collector', 'Collector')}
            onChange={(e) => handleChange('collector', e.target.value)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles['report-filter-form']}>
      <div className={styles['report-filter-form__fields']}>
        {fields.map((field) => (
          <div key={field}>{renderField(field)}</div>
        ))}
      </div>

      <div className={styles['report-filter-form__button-container']}>
        <Button kind="primary" onClick={handleSearch}>
          {t('search', 'Search')}
        </Button>
      </div>
    </div>
  );
};

export default ReportFilterForm;
