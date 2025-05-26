import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { Printer, Download } from '@carbon/react/icons';
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
    patientName?: string;
    policyNumber?: string;
  };
  consommationData: {
    consommationId: string;
    service: string;
  };
  selectedItems: Array<any>;
  onPrint?: () => void;
  showPrintButton?: boolean;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ 
  paymentData, 
  consommationData,
  selectedItems,
  onPrint,
  showPrintButton = true
}) => {
  const { t } = useTranslation();
  
  const getItemStatus = (item: any) => {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const paidAmount = item.paidAmount || 0;
    
    if (paidAmount >= itemTotal) {
      return { text: t('paid', 'Paid'), class: styles.paidStatus };
    } else if (paidAmount > 0) {
      return { text: t('partiallyPaid', 'Partially Paid'), class: styles.partiallyPaidStatus };
    }
    return { text: t('unpaid', 'Unpaid'), class: styles.unpaidStatus };
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const calculateTotals = () => {
    const totalAmount = selectedItems.reduce((total, item) => 
      total + ((item.quantity || 1) * (item.unitPrice || 0)), 0
    );
    const totalPaid = selectedItems.reduce((total, item) => 
      total + (item.paidAmount || 0), 0
    );
    const balance = totalAmount - totalPaid;
    
    return { totalAmount, totalPaid, balance };
  };

  const { totalAmount, totalPaid, balance } = calculateTotals();
  
  return (
    <div className={styles.receiptContainer}>
      <div className={styles.receiptHeader}>
        <h2>{t('paymentReceipt', 'Payment Receipt')}</h2>
        <p className={styles.receiptDate}>
          {t('generatedOn', 'Generated on')}: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
        
        {showPrintButton && (
          <div className={styles.printActions}>
            <Button
              kind="primary"
              renderIcon={Printer}
              onClick={handlePrint}
              size="sm"
            >
              {t('printReceipt', 'Print Receipt')}
            </Button>
          </div>
        )}
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('paymentDetails', 'Payment Details')}</h3>
        <table className={styles.receiptTable}>
          <tbody>
            {paymentData.patientName && (
              <tr>
                <td>{t('patient', 'Patient')}:</td>
                <td><strong>{paymentData.patientName}</strong></td>
              </tr>
            )}
            {paymentData.policyNumber && (
              <tr>
                <td>{t('policyNumber', 'Policy Number')}:</td>
                <td>{paymentData.policyNumber}</td>
              </tr>
            )}
            <tr>
              <td>{t('collector', 'Collector')}:</td>
              <td>{paymentData.collectorName}</td>
            </tr>
            <tr>
              <td>{t('paymentDate', 'Payment Date')}:</td>
              <td>{paymentData.dateReceived}</td>
            </tr>
            <tr>
              <td>{t('paymentMethod', 'Payment Method')}:</td>
              <td>
                <strong>
                  {paymentData.paymentMethod === 'cash' ? t('cash', 'Cash') : t('deposit', 'Deposit')}
                </strong>
              </td>
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
            <tr className={styles.totalRow}>
              <td><strong>{t('amountPaid', 'Amount Paid')}:</strong></td>
              <td className={styles.amountHighlight}>
                <strong>{parseFloat(paymentData.amountPaid).toFixed(2)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('serviceDetails', 'Service Details')}</h3>
        <table className={styles.receiptTable}>
          <tbody>
            <tr>
              <td>{t('consommationId', 'Consommation ID')}:</td>
              <td>#{consommationData.consommationId}</td>
            </tr>
            <tr>
              <td>{t('serviceDepartment', 'Service Department')}:</td>
              <td>{consommationData.service}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className={styles.receiptSection}>
        <h3>{t('itemizedDetails', 'Itemized Payment Details')}</h3>
        <table className={styles.itemsTable}>
          <thead>
            <tr>
              <th>{t('itemName', 'Item Name')}</th>
              <th>{t('quantity', 'Qty')}</th>
              <th>{t('unitPrice', 'Unit Price')}</th>
              <th>{t('totalAmount', 'Total')}</th>
              <th>{t('paidAmount', 'Paid')}</th>
              <th>{t('status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {selectedItems.map((item, index) => {
              const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
              const paidAmount = item.paidAmount || 0;
              const status = getItemStatus(item);
              
              return (
                <tr key={index}>
                  <td><strong>{item.itemName || t('unnamedItem', 'Unnamed Item')}</strong></td>
                  <td className={styles.centerAlign}>{item.quantity || '1'}</td>
                  <td className={styles.rightAlign}>{Number(item.unitPrice || 0).toFixed(2)}</td>
                  <td className={styles.rightAlign}>{Number(itemTotal).toFixed(2)}</td>
                  <td className={styles.rightAlign}>
                    <strong>{Number(paidAmount).toFixed(2)}</strong>
                  </td>
                  <td className={styles.centerAlign}>
                    <span className={status.class}>{status.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}><strong>{t('summaryTotals', 'Summary Totals')}:</strong></td>
              <td className={styles.rightAlign}>
                <strong>{totalAmount.toFixed(2)}</strong>
              </td>
              <td className={styles.rightAlign}>
                <strong>{totalPaid.toFixed(2)}</strong>
              </td>
              <td></td>
            </tr>
            <tr className={styles.balanceRow}>
              <td colSpan={3}><strong>{t('outstandingBalance', 'Outstanding Balance')}:</strong></td>
              <td colSpan={2} className={styles.rightAlign}>
                <strong className={balance > 0 ? styles.balanceOwed : styles.balancePaid}>
                  {balance.toFixed(2)}
                </strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className={styles.receiptFooter}>
        <div className={styles.signatureSection}>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}></div>
            <p>{t('patientSignature', 'Patient/Representative')}</p>
          </div>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}></div>
            <p>{t('cashierSignature', 'Cashier/Collector')}</p>
          </div>
        </div>
        
        <div className={styles.footerMessage}>
          <p><strong>{t('thankYou', 'Thank you for your payment!')}</strong></p>
          <p>{t('keepReceipt', 'Please keep this receipt for your records.')}</p>
          <div className={styles.receiptInfo}>
            <p>{t('validReceipt', 'This is a valid payment receipt.')}</p>
            <p>{t('electronicallyGenerated', 'Electronically generated on')} {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;
