import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, Tabs, TabList, DatePicker, DatePickerInput } from '@carbon/react';
import { Receipt, Currency } from '@carbon/react/icons';
import PaymentsDeskIcon from '../images/payments-desk-icon.svg';
import { useSession } from '@openmrs/esm-framework';
import styles from './billing-header.scss';

interface BillingHeaderProps {
  onTabChange: (tabIndex: number) => void;
  onMenuItemSelect?: (item: string) => void;
  activeTab: number;

  // Make these props optional
  onSubTabChange?: (tabIndex: number, subTabIndex: number) => void;
  activeSubTab?: number;

  isAdminView?: boolean;

  // New prop to disable sub-navigation
  showSubNavigation?: boolean;
}

const BillingHeader: React.FC<BillingHeaderProps> = ({
  onTabChange,
  onSubTabChange,
  activeTab,
  activeSubTab = 0, 
  isAdminView = false,
  showSubNavigation = true, 
  onMenuItemSelect,
}) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const session = useSession();

  const userLocation = session?.sessionLocation?.display || 'Unknown Location';

  const handleTabClick = (event: { selectedIndex: number }) => {
    const index = event.selectedIndex;
    onTabChange(index);
  };

  const handleSubTabClick = (mainTabIndex: number, subTabIndex: number) => {
    // Only call onSubTabChange if it's provided
    if (onSubTabChange) {
      onSubTabChange(mainTabIndex, subTabIndex);
    }
  };

  return (
    <div className={styles.headerWrapper}>
      {/* Header with icon and title */}
      <div className={styles.headerContainer}>
        <div className={styles.headerContent}>
          <div className={styles.leftSection}>
            <div className={styles.iconContainer}>
              <img src={PaymentsDeskIcon} alt="Payments Desk" width={32} height={32} />
            </div>
            <div className={styles.titleContainer}>
              <p className={styles.location}>{userLocation}</p>
              <h1 className={styles.billingTitle}>{t('billing', 'Billing')}</h1>
            </div>
          </div>
          <div className={styles.rightSection}>
            <div className={styles.datePickerContainer}>
              <DatePicker datePickerType="single" value={selectedDate} onChange={([date]) => setSelectedDate(date)}>
                <DatePickerInput
                  id="date-picker-input-id"
                  placeholder="mm/dd/yyyy"
                  labelText=""
                  type="text"
                  size="md"
                />
              </DatePicker>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.navigationContainer}>
        <Tabs selectedIndex={isAdminView ? -1 : activeTab} onChange={handleTabClick}>
          <TabList aria-label="Billing Navigation" contained>
            <Tab renderIcon={Receipt} disabled={isAdminView}>
              {t('bill', 'Bill')}
            </Tab>
            <Tab renderIcon={Currency} disabled={isAdminView}>
              {t('managePayments', 'Manage Payments')}
            </Tab>
          </TabList>
        </Tabs>

        {/* Only show sub-navigation if not in admin view AND showSubNavigation is true */}
        {!isAdminView && showSubNavigation && (
          <div className={styles.subTabsContainer}>
            {activeTab === 0 && (
              <Tabs selectedIndex={activeSubTab} onChange={(evt) => handleSubTabClick(0, evt.selectedIndex)}>
                <TabList aria-label="Bill Sub-navigation" contained>
                  <Tab>{t('billConfirmation', 'Bill Confirmation')}</Tab>
                  <Tab>{t('searchInsurancePolicy', 'Search Insurance Policy')}</Tab>
                </TabList>
              </Tabs>
            )}
            {activeTab === 1 && (
              <Tabs selectedIndex={activeSubTab} onChange={(evt) => handleSubTabClick(1, evt.selectedIndex)}>
                <TabList aria-label="Manage Payments Sub-navigation" contained>
                  <Tab>{t('searchGlobalBill', 'Search Global Bill')}</Tab>
                  <Tab>{t('searchConsommations', 'Search Consommations')}</Tab>
                </TabList>
              </Tabs>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingHeader;
