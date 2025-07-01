import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@openmrs/esm-framework';
import styles from './insurance-policy-table.scss';
import { InsurancePolicyTable } from './insurance-policy-table.component';
import InsurancePolicyDeskIcon from '../images/umbrella-icon.svg';
import { DatePicker } from '@carbon/react';
import { DatePickerInput } from '@carbon/react';

export const InsurancePolicy: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const userLocation = session?.sessionLocation?.display || 'Unknown Location';
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateChange = (dates) => {
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerWrapper}>
        <div className={styles.headerContainer}>
          <div className={styles.headerContent}>
            <div className={styles.leftSection}>
              <img src={InsurancePolicyDeskIcon} alt="Payments Desk Icon" className={styles.headerIcon} />
              <div>
                <p className={styles.location}>{userLocation}</p>
                <p className={styles.billingTitle}>Insurance Policy</p>
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

      <div className={styles.content}>
        <InsurancePolicyTable />
      </div>
    </div>
  );
};
