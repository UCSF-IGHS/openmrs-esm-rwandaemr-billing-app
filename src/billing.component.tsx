import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './billing.scss';
import PaymentsDeskIcon from './images/payments-desk-icon.svg';
import { useSession } from '@openmrs/esm-framework';
import { CodeSnippetSkeleton, Tabs, Tab, TabList, TabPanel, TabPanels, TextInput } from '@carbon/react';
import { getGlobalBillSummary } from './api/billing';
import { formatNumberCurrency } from './metrics/metrics.resources';

type SearchOption = 'bill-confirmation' | 'search-insurance' | 'global-bill' | 'consommation';

const LazyGlobalBills = lazy(() =>
  import('./invoice/invoice-table.component').then((m) => ({ default: m.BillingHomeGlobalBillsTable })),
);
const LazyConsommationSearch = lazy(() => import('./bill-tabs/consommation-search.component'));

const Billing: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const userLocation = session?.sessionLocation?.display || 'Unknown Location';

  const [patientUuidInput, setPatientUuidInput] = useState('');
  const [insuranceCardNoInput, setInsuranceCardNoInput] = useState('');

  const [active, setActive] = useState(0);

  const [metrics, setMetrics] = useState({
    cumulativeBills: 0,
    pendingBills: 0,
    paidBills: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGlobalBillSummary();
      setMetrics({
        cumulativeBills: data.total,
        pendingBills: data.open,
        paidBills: data.closed,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch bill summary:', err);
      setError('Failed to load bill summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const handleGlobalBillCreated = (event: CustomEvent) => {
      setTimeout(() => {
        fetchMetrics();
      }, 1000); 
    };

    window.addEventListener('globalBillCreated', handleGlobalBillCreated as EventListener);

    return () => {
      window.removeEventListener('globalBillCreated', handleGlobalBillCreated as EventListener);
    };
  }, [fetchMetrics]);

  const formatCurrency = (value: number): string => {
    return `RWF ${value.toFixed(2)}`;
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
                  <p className={styles.billingTitle}>Billing</p>
                </div>
              </div>
              <div className={styles.rightSection}></div>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className={styles.metricsContainer}>
          {loading ? (
            <CodeSnippetSkeleton className={styles.loadingSkeleton} />
          ) : error ? (
            <p style={{ color: 'red' }}>{error}</p>
          ) : (
            <div className={styles.metricsCards}>
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>{t('cumulativeBills', 'Cumulative Bills')}</h3>
                <span className={styles.count}>{formatNumberCurrency(metrics.cumulativeBills)}</span>
              </div>
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>{t('pendingBills', 'Pending Bills')}</h3>
                <span className={styles.count}>{formatNumberCurrency(metrics.pendingBills)}</span>
              </div>
              <div className={styles.metricCard}>
                <h3 className={styles.metricTitle}>{t('paidBills', 'Paid Bills')}</h3>
                <span className={styles.count}>{formatNumberCurrency(metrics.paidBills)}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.content}>
          <Tabs onChange={({ selectedIndex }) => setActive(selectedIndex)}>
            <TabList aria-label="Billing views">
              <Tab>Global Bills</Tab>
              <Tab>Consommations</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                {/* Search inputs for Global Bills */}
                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                  <TextInput
                    id="patient-uuid-input"
                    labelText={t('patientUuid', 'Patient UUID')}
                    placeholder={t('enterPatientUuid', 'Enter patient UUID')}
                    value={patientUuidInput}
                    onChange={(e) => setPatientUuidInput(e.target.value)}
                  />
                  <TextInput
                    id="insurance-card-input"
                    labelText={t('insuranceCardNumber', 'Insurance Card Number')}
                    placeholder={t('enterInsuranceCardNumber', 'Enter insurance card number')}
                    value={insuranceCardNoInput}
                    onChange={(e) => setInsuranceCardNoInput(e.target.value)}
                  />
                </div>
                <Suspense fallback={null}>
                  {active === 0 && (
                    <LazyGlobalBills
                      patientQuery={patientUuidInput || undefined}
                      policyIdQuery={insuranceCardNoInput || undefined}
                    />
                  )}
                </Suspense>
              </TabPanel>

              <TabPanel>
                <Suspense fallback={null}>{active === 1 && <LazyConsommationSearch />}</Suspense>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Billing;
