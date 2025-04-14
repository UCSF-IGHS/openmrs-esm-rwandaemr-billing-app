import React from 'react';
import { DatePicker, DatePickerInput, Dropdown, TextInput, Button } from '@carbon/react';

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
              labelText={field === 'startDate' ? 'Start Date' : 'End Date'}
              placeholder="DD-MMM-YYYY"
            />
          </DatePicker>
        );

      case 'insurance':
        return (
          <Dropdown
            id="insurance"
            label="Insurance"
            items={insuranceOptions || []}
            itemToString={(item) => item?.label || ''}
            onChange={({ selectedItem }) => handleChange('insurance', selectedItem?.value)}
          />
        );

      case 'service':
        return (
          <Dropdown
            id="service"
            label="Service"
            items={['Consultation', 'Pharmacy', 'Lab', 'Radiology', 'Surgery']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('service', selectedItem)}
          />
        );

      case 'thirdParty':
        return (
          <Dropdown
            id="third-party"
            label="Third Party"
            items={['Prison', 'RNUD', 'GBV', 'Others']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('thirdParty', selectedItem)}
          />
        );

      case 'reportType':
        return (
          <Dropdown
            id="report-type"
            label="Report Type"
            items={['Ordinary Report', 'DCP Report', 'All']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('reportType', selectedItem)}
          />
        );

      case 'billStatus':
        return (
          <Dropdown
            id="bill-status"
            label="Bill Status"
            items={['Paid', 'Fully Paid', 'UnPaid', 'Partly Paid']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('billStatus', selectedItem)}
          />
        );

      case 'type':
        return (
          <Dropdown
            id="deposit-type"
            label="Deposit Report Type"
            items={['Deposit', 'Payment', 'Withdrawal']}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => handleChange('type', selectedItem)}
          />
        );

      case 'billCreator':
        return (
          <TextInput
            id="bill-creator"
            labelText="Bill Creator"
            placeholder="Enter user name"
            onChange={(e) => handleChange('billCreator', e.target.value)}
          />
        );

      case 'collector':
        return (
          <TextInput
            id="collector"
            labelText="Collector"
            placeholder="Enter user name"
            onChange={(e) => handleChange('collector', e.target.value)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '1.5rem', background: '#f9f9f9', borderRadius: '6px', marginTop: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: '1.5rem',
          alignItems: 'end',
        }}
      >
        {fields.map((field) => (
          <div key={field}>{renderField(field)}</div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-start' }}>
        <Button kind="primary" onClick={handleSearch}>
          Search
        </Button>
      </div>
    </div>
  );
};

export default ReportFilterForm;
