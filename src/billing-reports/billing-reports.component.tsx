import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './billing-reports.scss';
import { Dropdown } from '@carbon/react';
import { Document } from '@carbon/react/icons';
import { useSession, PageHeader, PageHeaderContent, MaybePictogram } from '@openmrs/esm-framework';
import CashierReport from './cashier-report.component';
import DepositsReport from './deposits-report.component';
import ServiceRevenueReport from './service-revenue-report.component';
import PaymentRefundReport from './payment-refund-report.component';
import InsuranceReport from './insurance-report.component';
import ThirdPartyReport from './third-party-report.component';
import ConsommationReport from './consommation-report.component';

const BillingReportsHome: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const [activeReport, setActiveReport] = useState('consommationReport');

  const handleReportChange = useCallback(({ selectedItem }) => {
    if (selectedItem?.key) {
      setActiveReport(selectedItem.key);
    }
  }, []);

  const reportTypes = useMemo(
    () => [
      { key: 'consommationReport', label: t('consommationReport', 'Consommation Report') },
      { key: 'cashierReport', label: t('cashierReport', 'Cashier Report') },
      { key: 'deposits', label: t('deposits', 'Deposits') },
      { key: 'serviceReport', label: t('serviceReport', 'Service Report') },
      { key: 'paymentRefundReport', label: t('paymentrefundReport', 'Payment Refund Report') },
      { key: 'insuranceReport', label: t('insuranceReport', 'Insurance Report') },
      { key: 'thirdPartyReport', label: t('thirdPartyReport', 'Third Party Report') },
    ],
    [t],
  );

  return (
    <div className={styles.billingWrapper} id="billing-component-instance">
      <div className={styles.billingContainer}>
        <PageHeader className={styles.billingHeader} data-testid="billing-reports-header">
          <PageHeaderContent
            illustration={
              <MaybePictogram
                pictogram="omrs-pict-billing"
                fallback={<Document size={80} className={styles.billingDocumentIcon} />}
              />
            }
            title={t('billingReports', 'Billing Reports')}
          />
          <div className={styles.billingRightJustifiedItems}>
            <Dropdown
              id="report-type-dropdown"
              items={reportTypes}
              itemToString={(item) => item?.label || ''}
              titleText={t('selectReportType', 'Select Report Type')}
              label={t('filterReportsByType', 'Filter reports by type')}
              onChange={handleReportChange}
              selectedItem={reportTypes.find((r) => r.key === activeReport)}
              size="md"
            />
          </div>
        </PageHeader>

        {/* Report Content */}
        <div className={styles.billingReportTableContainer}>
          {activeReport === 'consommationReport' && <ConsommationReport />}
          {activeReport === 'cashierReport' && <CashierReport />}
          {activeReport === 'deposits' && <DepositsReport />}
          {activeReport === 'serviceReport' && <ServiceRevenueReport />}
          {activeReport === 'paymentRefundReport' && <PaymentRefundReport />}
          {activeReport === 'insuranceReport' && <InsuranceReport />}
          {activeReport === 'thirdPartyReport' && <ThirdPartyReport />}
        </div>
      </div>
    </div>
  );
};

export default BillingReportsHome;
