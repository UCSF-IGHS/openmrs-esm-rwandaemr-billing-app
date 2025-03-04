import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BillingHeader from './header/BillingHeader';
import styles from './billing.scss';
import Department from './billing-admin/Department';
import Service from './billing-admin/Service';
import FacilityServicePrice from './billing-admin/FacilityServicePrice';
import Insurance from './billing-admin/Insurance';
import ThirdParty from './billing-admin/ThirdParty';
import BillConfirmation from './bill-tabs/bill-confirmation.component';
import SearchInsurance from './bill-tabs/search-insurance.component';
import GlobalBillSearch from './bill-tabs/global-bill-search.component';
import ConsommationSearch from './bill-tabs/consommation-search.component';

const Billing: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    setActiveSubTab(0); // Reset sub-tab when main tab changes
  };

  const handleSubTabChange = (tabIndex: number, subTabIndex: number) => {
    setActiveSubTab(subTabIndex);
  };

  const handleMenuItemSelect = (item: string) => {};

  const renderContent = () => {
    if (activeTab === 0) {
      if (activeSubTab === 0) {
        return <BillConfirmation />;
      } else {
        return <SearchInsurance />;
      }
    }

    if (activeTab === 1) {
      if (activeSubTab === 0) {
        return <GlobalBillSearch />;
      } else {
        return <ConsommationSearch />;
      }
    }
  };

  return (
    <div className={styles.billingWrapper}>
      <div className={styles.container}>
        <BillingHeader
          onTabChange={handleTabChange}
          onSubTabChange={handleSubTabChange}
          onMenuItemSelect={handleMenuItemSelect}
          activeTab={activeTab}
          activeSubTab={activeSubTab}
          isAdminView={false}
        />
        <div className={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
};

export default Billing;
