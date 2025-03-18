import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './payment-receipt.scss';

interface PaymentReceiptProps {
  paymentData: {
    amountPaid: string;
    receivedCash?: string;
    change?: string;
    paymentMethod: string;
    deductedAmount?: string;
    dateReceived: string;
    collectorName: string;
  };
  consommationData: {
    consommationId: string;
    service: string;
  };
  selectedItems: Array<any>;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ 
  paymentData, 
  consommationData,
  selectedItems 
}) => {
  const { t } = useTranslation();
  
  return (
    <div className={styles.receiptContainer}>
      <div className={styles.receiptHeader}>
        <h2>{t('paymentReceipt', 'Payment Receipt')}</h2>
        <p className={styles.receiptDate}>
          {t('date', 'Date')}: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('paymentDetails', 'Payment Details')}</h3>
        <table className={styles.receiptTable}>
          <tbody>
            <tr>
              <td>{t('collector', 'Collector')}:</td>
              <td>{paymentData.collectorName}</td>
            </tr>
            <tr>
              <td>{t('receivedDate', 'Received Date')}:</td>
              <td>{paymentData.dateReceived}</td>
            </tr>
            <tr>
              <td>{t('paymentMethod', 'Payment Method')}:</td>
              <td>{paymentData.paymentMethod === 'cash' ? t('cash', 'Cash') : t('deposit', 'Deposit')}</td>
            </tr>
            {paymentData.paymentMethod === 'cash' && paymentData.receivedCash && (
              <>
                <tr>
                  <td>{t('receivedCash', 'Received Cash')}:</td>
                  <td>{parseFloat(paymentData.receivedCash).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>{t('change', 'Change')}:</td>
                  <td>{paymentData.change}</td>
                </tr>
              </>
            )}
            {paymentData.paymentMethod === 'deposit' && paymentData.deductedAmount && (
              <tr>
                <td>{t('deductedAmount', 'Deducted Amount')}:</td>
                <td>{parseFloat(paymentData.deductedAmount).toFixed(2)}</td>
              </tr>
            )}
            <tr>
              <td><strong>{t('amountPaid', 'Amount Paid')}:</strong></td>
              <td><strong>{parseFloat(paymentData.amountPaid).toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('consommationDetails', 'Consommation Details')}</h3>
        <table className={styles.receiptTable}>
          <tbody>
            <tr>
              <td>{t('consomId', 'Consommation ID')}:</td>
              <td>{consommationData.consommationId}</td>
            </tr>
            <tr>
              <td>{t('service', 'Service')}:</td>
              <td>{consommationData.service}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('itemsPaid', 'Items Paid')}</h3>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>{t('itemName', 'Item Name')}</th>
              <th>{t('quantity', 'Qty')}</th>
              <th>{t('unitPrice', 'Unit Price')}</th>
              <th>{t('itemTotal', 'Total')}</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item, index) => {
              const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
              
              return (
                <tr key={index}>
                  <td>{item.itemName || '-'}</td>
                  <td>{item.quantity || '1'}</td>
                  <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                  <td>{Number(itemTotal).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>{t('total', 'Total')}:</strong></td>
              <td>
                <strong>
                  {selectedItems
                    .reduce((total, item) => total + ((item.quantity || 1) * (item.unitPrice || 0)), 0)
                    .toFixed(2)}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className={styles.receiptFooter}>
        <p>{t('thankYou', 'Thank you for your payment')}</p>
      </div>
    </div>
  );
};

export default PaymentReceipt;
