import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './billing-reports.scss';
import { Receipt, Currency, Umbrella, Money } from '@carbon/react/icons';
import { DatePicker, DatePickerInput, Dropdown } from '@carbon/react';
import { useSession } from '@openmrs/esm-framework';
// Fallback: Use Money icon from Carbon with proper styling until styleguide compatibility is resolved
import CashierReport from './cashier-report.component';
import DepositsReport from './deposits-report.component';
import ServiceRevenueReport from './service-revenue-report.component';
import PaymentRefundReport from './payment-refund-report.component';
import InsuranceReport from './insurance-report.component';
import ThirdPartyReport from './third-party-report.component';
import DcpProviderReport from './dcp-provider-report.component';
import ConsommationReport from './consommation-report.component';

const BillingReportsHome: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeReport, setActiveReport] = useState('consommationReport');
  const userLocation = session?.sessionLocation?.display || t('unknownLocation', 'Unknown Location');

  const handleDateChange = (dates) => {
    if (Array.isArray(dates) && dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  };

  const reportTypes = useMemo(
    () => [
      { key: 'consommationReport', label: t('consommationReport', 'Consommation Report') },
      { key: 'cashierReport', label: t('cashierReport', 'Cashier Report') },
      { key: 'deposits', label: t('deposits', 'Deposits') },
      { key: 'serviceReport', label: t('serviceReport', 'Service Report') },
      { key: 'paymentRefundReport', label: t('paymentrefundReport', 'Payment Refund Report') },
      { key: 'insuranceReport', label: t('insuranceReport', 'Insurance Report') },
      { key: 'thirdPartyReport', label: t('thirdPartyReport', 'Third Party Report') },
      { key: 'dcpProviderReport', label: t('dcpProviderReport', 'DCP Provider Report') },
    ],
    [t],
  );

  const activeReportLabel = reportTypes.find((r) => r.key === activeReport)?.label || '';

  return (
    <div className={styles.billingWrapper} id="billing-component-instance">
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.headerWrapper}>
          <div className={styles.headerContainer}>
            <div className={styles.headerContent}>
              <div className={styles.leftSection}>
                {/* Fallback: Use Money icon with proper container styling */}
                <div className={styles.iconContainer}>
                  <Money size={32} />
                </div>
                <div>
                  <p className={styles.location}>{userLocation}</p>
                  <p className={styles.billingTitle}>{t('billingReports', 'Billing Reports')}</p>
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
                        placeholder={t('datePlaceholder', 'DD-MMM-YYYY')}
                        labelText=""
                        size="md"
                        style={{
                          cursor: 'pointer',
                          backgroundColor: 'transparent',
                          border: 'none',
                          maxWidth: '10rem',
                        }}
                      />
                    </DatePicker>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown for Report Selection */}
        <div className={styles.reportDropdownWrapper}>
          <Dropdown
            id="report-dropdown"
            titleText={t('selectReportType', 'Select Report Type')}
            label={activeReportLabel}
            items={reportTypes}
            itemToString={(item) => item?.label || ''}
            onChange={({ selectedItem }) => setActiveReport(selectedItem?.key)}
          />
        </div>

        <div className={styles.reportTableContainer}>
          {activeReport === 'consommationReport' && <ConsommationReport />}
          {activeReport === 'cashierReport' && <CashierReport />}
          {activeReport === 'deposits' && <DepositsReport />}
          {activeReport === 'serviceReport' && <ServiceRevenueReport />}
          {activeReport === 'paymentRefundReport' && <PaymentRefundReport />}
          {activeReport === 'insuranceReport' && <InsuranceReport />}
          {activeReport === 'thirdPartyReport' && <ThirdPartyReport />}
          {activeReport === 'dcpProviderReport' && <DcpProviderReport />}
        </div>
      </div>
    </div>
  );
};

export default BillingReportsHome;