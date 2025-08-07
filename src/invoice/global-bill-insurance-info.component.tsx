import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText, InlineLoading, Tile } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import Card from '../bill-list/card.component';
import styles from '../bill-list/global-bill-list.scss';
import { getInsuranceById, getGlobalBillById } from '../api/billing';

interface GlobalBillInsuranceInfoProps {
  globalBillId: string | null;
}

const GlobalBillInsuranceInfo: React.FC<GlobalBillInsuranceInfoProps> = ({ globalBillId }) => {
  const { t } = useTranslation();
  const [insuranceData, setInsuranceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsuranceInfo() {
      if (!globalBillId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Fetch the global bill data first
        const globalBillData = await getGlobalBillById(globalBillId);

        let policyData = null;

        // Extract insurance policy from global bill data
        if (globalBillData?.admission?.insurancePolicy) {
          policyData = globalBillData.admission.insurancePolicy;

          if (globalBillData.insurance) {
            policyData.insurance = globalBillData.insurance;
          }
        }

        // Fetch detailed insurance information if we have an insurance ID
        if (policyData?.insurance?.insuranceId) {
          try {
            const insuranceDetails = await getInsuranceById(policyData.insurance.insuranceId);
            if (insuranceDetails) {
              policyData.insurance = insuranceDetails;
            }
          } catch (insuranceError) {
            console.error('Error fetching insurance details:', insuranceError);
          }
        }

        if (policyData) {
          setInsuranceData(policyData);
        } else {
          setInsuranceData(null);
        }
      } catch (error) {
        console.error('Error loading insurance data:', error);
        showSnackbar({
          title: t('errorLoadingInsurance', 'Error loading insurance information'),
          kind: 'error',
          subtitle: error?.message ?? t('unknownError', 'An unknown error occurred'),
        });
        setInsuranceData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchInsuranceInfo();
  }, [globalBillId, t]);

  const insuranceInfo = React.useMemo(() => {
    if (!insuranceData) return null;

    const formatRate = (rate) => {
      if (rate === null || rate === undefined) {
        return '0.0%';
      }
      return `${rate}%`;
    };

    const formatValidityDates = (startDate, endDate) => {
      if (!startDate && !endDate) {
        return 'N/A';
      }

      let formattedStart = startDate ? new Date(startDate).toLocaleDateString() : 'Unknown';
      let formattedEnd = endDate ? new Date(endDate).toLocaleDateString() : 'Active';

      return `${formattedStart} – ${formattedEnd}`;
    };

    return {
      title: t('insuranceDetails', 'Insurance details'),
      details: [
        {
          label: t('insurance', 'Insurance'),
          value: insuranceData.insurance?.name || 'None',
        },
        {
          label: t('rate', 'Rate'),
          value: formatRate(insuranceData.insurance?.rate),
        },
        {
          label: t('flatFee', 'Flat Fee'),
          value: 'RWF',
        },
        {
          label: t('policyNumber', 'Policy Number'),
          value: insuranceData.insuranceCardNo || 'N/A',
        },
        {
          label: t('validity', 'Validity'),
          value: formatValidityDates(insuranceData.coverageStartDate, insuranceData.expirationDate),
        },
      ],
    };
  }, [insuranceData, t]);

  if (loading) {
    return (
      <div className={styles.sectionContainer}>
        <InlineLoading description={t('loading', 'Loading insurance details...')} />
        <div className={styles.skeletonContainer}>
          <Tile>
            <SkeletonText heading width="100%" />
            <SkeletonText paragraph lineCount={3} />
          </Tile>
        </div>
      </div>
    );
  }

  if (!insuranceData) {
    return null;
  }

  return (
    <div className={styles.sectionContainer}>
      <Tile light className={styles.contentWrapper}>
        <div className={styles.container}>
          {insuranceInfo && (
            <Card key={insuranceInfo.title} title={insuranceInfo.title} details={insuranceInfo.details} />
          )}
        </div>
      </Tile>
    </div>
  );
};

export default GlobalBillInsuranceInfo;
