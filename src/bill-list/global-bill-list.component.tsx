import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  SkeletonText, 
  InlineLoading, 
  Tile 
} from '@carbon/react';
import { usePatient, showSnackbar } from '@openmrs/esm-framework';
import Card from './card.component';
import styles from './global-bill-list.scss';
import { fetchGlobalBillsByInsuranceCard, fetchGlobalBillsByPatient, getInsuranceById } from '../api/billing';

interface GlobalBillHeaderProps {
  patientUuid?: string;
  insuranceCardNo?: string;
}

const GlobalBillHeader: React.FC<GlobalBillHeaderProps> = ({ patientUuid: propPatientUuid, insuranceCardNo: propInsuranceCardNo }) => {
  const { t } = useTranslation();
  
  const { patient } = usePatient();
  const contextPatientUuid = patient?.id;
  
  const insuranceCardNo = propInsuranceCardNo;
  const patientUuid = propPatientUuid || contextPatientUuid;

  const [insuranceData, setInsuranceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hadDataBefore, setHadDataBefore] = useState(false);

  useEffect(() => {
    async function fetchInsuranceData() {
      if (!insuranceCardNo && !patientUuid) {
        setLoading(false);
        return;
      }
      
      setLoading(true);

      try {
        let policyData = null;

        if (insuranceCardNo) {
          const response = await fetchGlobalBillsByInsuranceCard(insuranceCardNo);
          
          if (response.results?.length > 0) {
            policyData = response.results[0];
          }
        } 
        else if (patientUuid) {
          const response = await fetchGlobalBillsByPatient(patientUuid);
          
          if (response.results?.length > 0) {
            const globalBill = response.results[0];
            if (globalBill.admission?.insurancePolicy) {
              policyData = globalBill.admission.insurancePolicy;
              
              if (globalBill.insurance) {
                policyData.insurance = globalBill.insurance;
              }
            }
          }
        }

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
          setHadDataBefore(true);
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

    fetchInsuranceData();
  }, [insuranceCardNo, patientUuid, t]);

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
      title: t('insuranceCompany', 'Insurance Company'),
      details: [
        { 
          label: t('insurance', 'Insurance'), 
          value: insuranceData.insurance?.name || 'None' 
        },
        { 
          label: t('rate', 'Rate'), 
          value: formatRate(insuranceData.insurance?.rate) 
        },
        { 
          label: t('flatFee', 'Flat Fee'), 
          value: 'RWF' 
        },
        { 
          label: t('policyNumber', 'Policy Number'), 
          value: insuranceData.insuranceCardNo || 'N/A' 
        },
        {
          label: t('validity', 'Validity'),
          value: formatValidityDates(insuranceData.coverageStartDate, insuranceData.expirationDate)
        },
      ],
    };
  }, [insuranceData, t]);

  if (loading && (hadDataBefore || insuranceData !== null)) {
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

  // Only show the component if we have data
  return (
    <div className={styles.sectionContainer}>
      <Tile light className={styles.contentWrapper}>
        <div className={styles.container}>
          {insuranceInfo && (
            <Card 
              key={insuranceInfo.title} 
              title={insuranceInfo.title} 
              details={insuranceInfo.details} 
            />
          )}
        </div>
      </Tile>
    </div>
  );
};

export default GlobalBillHeader;
