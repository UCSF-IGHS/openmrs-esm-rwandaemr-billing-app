import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './billing-reports.scss';
import PaymentsDeskIcon from '../images/payments-desk-icon.svg';
import { DatePicker, DatePickerInput, Dropdown } from '@carbon/react';
import { useSession } from '@openmrs/esm-framework';
import FindBillsReport from './find-bills-report.component';
import CashierReport from './cashier-report.component';
import DepositsReport from './deposits-report.component';
import ServiceRevenueReport from './service-revenue-report.component';
import RefundReport from './refund-report.component';
import InsuranceReport from './insurance-report.component';
import ThirdPartyReport from './third-party-report.component';
import DcpProviderReport from './third-party-report.component';

const reportTypes = [
  'Find Bills',
  'Cashier Report',
  'Deposits',
  'Service Report',
  'Refund Report',
  'Insurance Report',
  'Third Party Report',
  'DCP Provider Report',
];

const BillingReportsHome: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeReport, setActiveReport] = useState('Find Bills');
  const userLocation = session?.sessionLocation?.display || 'Unknown Location';

  const handleDateChange = (dates) => {
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  };

  return (
    <div className={styles.billingWrapper} id="billing-component-instance">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.headerWrapper}>
          <div className={styles.headerContainer}>
            <div className={styles.headerContent}>
              <div className={styles.leftSection}>
                <img src={PaymentsDeskIcon} alt="Payments Desk Icon" className={styles.headerIcon} />
                <div>
                  <p className={styles.location}>{userLocation}</p>
                  <p className={styles.billingTitle}>Billing Reports</p>
                </div>
              </div>
              <div className={styles.rightSection}>
                <div className="cds--date-picker-input__wrapper">
                  <span>
                    <DatePicker
                      datePickerType="single"
                      dateFormat="d-M-Y"
                      value={selectedDate}
                      onChange={handleDateChange}
                    >
                      <DatePickerInput
                        id="billing-date-picker"
                        pattern="\d{1,2}\/\d{1,2}\/\d{4}"
                        placeholder="DD-MMM-YYYY"
                        labelText=""
                        size="md"
                        style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none', maxWidth: '10rem' }}
                      />
                    </DatePicker>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown for Report Selection */}
        <div style={{ maxWidth: '300px', marginTop: '2rem', marginLeft: '1rem' }}>
          <Dropdown
            id="report-dropdown"
            titleText="Select Report Type"
            label={activeReport}
            items={reportTypes}
            itemToString={(item) => item}
            onChange={({ selectedItem }) => setActiveReport(selectedItem)}
          />
        </div>

        {/* Report Content Area */}
        <div className={styles.reportTableContainer}>
          {activeReport === 'Find Bills' && <FindBillsReport />}
          {activeReport === 'Cashier Report' && <CashierReport />}
          {activeReport === 'Deposits' && <DepositsReport />}
          {activeReport === 'Service Report' && <ServiceRevenueReport />}
          {activeReport === 'Refund Report' && <RefundReport />}
          {activeReport === 'Insurance Report' && <InsuranceReport />}
          {activeReport === 'Third Party Report' && <ThirdPartyReport />}
          {activeReport === 'DCP Provider Report' && <DcpProviderReport />}
        </div>
      </div>
    </div>
  );
};

export default BillingReportsHome;
