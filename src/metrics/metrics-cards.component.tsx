// metrics-cards.component.tsx
import React, { useMemo } from 'react';
import { InlineLoading } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { formatNumberCurrency } from './metrics.resources';
import styles from './metrics-cards.scss';

interface CardProps {
  title: string;
  value: number;
}

const MetricCard: React.FC<CardProps> = ({ title, value }) => {
  const { t } = useTranslation();
  
  return (
    <div className={styles.metricCard}>
      <h3 className={styles.metricTitle}>{t(title.toLowerCase().replace(/\s+/g, ''), title)}</h3>
      <p className={styles.metricValue}>{formatNumberCurrency(value)}</p>
    </div>
  );
};

interface MetricsCardsProps {
  bills: Array<any>;
  isLoading?: boolean;
  error?: Error | null;
}

const MetricsCards: React.FC<MetricsCardsProps> = ({ 
  bills, 
  isLoading = false, 
  error = null 
}) => {
  const { t } = useTranslation();
  
  // Calculate metrics from bills
  const metrics = useMemo(() => {
    if (!bills || !Array.isArray(bills) || bills.length === 0) {
      return {
        cumulativeBills: 0,
        pendingBills: 0,
        paidBills: 0
      };
    }

    const cumulativeBills = bills.reduce(
      (sum, bill) => sum + (parseFloat(bill.amount) || 0), 
      0
    );
    
    const pendingBills = bills
      .filter(bill => !bill.paymentConfirmedDate || bill.status !== 'Paid')
      .reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);
    
    const paidBills = bills
      .filter(bill => bill.paymentConfirmedDate && bill.status === 'Paid')
      .reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0);

    return {
      cumulativeBills,
      pendingBills,
      paidBills
    };
  }, [bills]);

  // Define metric cards
  const cards = useMemo(() => [
    { title: 'Cumulative Bills', value: metrics.cumulativeBills },
    { title: 'Pending Bills', value: metrics.pendingBills },
    { title: 'Paid Bills', value: metrics.paidBills },
  ], [metrics]);

  if (isLoading) {
    return (
      <section className={styles.container}>
        <InlineLoading 
          status="active" 
          iconDescription="Loading" 
          description={t('loadingBillMetrics', 'Loading bill metrics...')} 
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.container}>
        <p className={styles.error}>
          {t('errorLoadingMetrics', 'Error loading metrics')}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      <div className={styles.metricsCards}>
        {cards.map((card) => (
          <MetricCard 
            key={card.title} 
            title={card.title} 
            value={card.value} 
          />
        ))}
      </div>
    </section>
  );
};

export default MetricsCards;
