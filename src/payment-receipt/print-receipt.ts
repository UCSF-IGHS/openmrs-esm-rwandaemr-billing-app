// Enhanced print-receipt.ts
interface PaymentData {
  amountPaid: string;
  receivedCash?: string;
  change?: string;
  paymentMethod: string;
  deductedAmount?: string;
  dateReceived: string;
  collectorName: string;
  patientName?: string;
  policyNumber?: string;
  thirdPartyAmount?: string;
  thirdPartyProvider?: string;
  totalAmount?: string;
  insuranceRate?: number;
  patientRate?: number;
  insuranceName?: string;
}

interface ConsommationInfo {
  service: string;
  date?: string;
}

interface ConsommationItem {
  patientServiceBillId?: number;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  paidAmount?: number;
  consommationId?: string;
  drugFrequency?: string;
}

import { type FacilityInfo } from '../api/billing/facility-info';

export const printReceipt = (
  paymentData: PaymentData,
  groupedConsommationData: Record<string, ConsommationInfo>,
  allConsommationItems: ConsommationItem[],
  facilityInfo?: FacilityInfo,
) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');

  if (!printWindow) {
    alert('Please allow pop-ups to print the receipt');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Payment Receipt - ${new Date().toLocaleDateString()}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.4;
          }
          
          .receiptContainer {
            max-width: 800px;
            margin: 0 auto;
            padding: 30px;
            background-color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            border-radius: 8px;
          }
          
          .facilityHeader {
            text-align: center;
            margin-bottom: 20px;
            padding: 20px 0;
            border-bottom: 2px solid #0056b3;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          }
          
          .republicHeader {
            margin-bottom: 15px;
          }
          
          .republicHeader h1 {
            color: #0056b3;
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .facilityInfoSection {
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            align-items: center;
            gap: 20px;
            min-height: 160px;
            width: 100%;
          }

          .facilityLogo {
            display: flex;
            justify-content: flex-start;
            align-items: center;
          }

          .logoImage {
            max-height: 140px;
            max-width: 180px;
            height: 140px;
            width: auto;
            object-fit: contain;
            border-radius: 4px;
          }

          .facilityDetails {
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            grid-column: 2;
          }

          .facilitySpacer {
            /* Empty column for balance */
          }
          
          .facilityName {
            color: #333;
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 8px 0;
            text-transform: uppercase;
          }
          
          .facilityAddress,
          .facilityEmail {
            color: #555;
            font-size: 14px;
            margin: 4px 0;
            font-weight: 500;
          }
          
          .facilityEmail {
            color: #0056b3;
            font-weight: 600;
          }
          
          .receiptHeader {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
          }
          
          .receiptHeader h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
            font-weight: bold;
          }
          
          .receiptDate {
            font-size: 14px;
            color: #666;
            font-weight: 500;
          }
          
          .receiptSection {
            margin-bottom: 25px;
          }
          
          .receiptSection h3 {
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ddd;
            color: #333;
            font-size: 18px;
            font-weight: 600;
          }
          
          .receiptTable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .receiptTable td {
            padding: 10px 12px;
            vertical-align: top;
            border-bottom: 1px solid #f0f0f0;
          }
          
          .receiptTable td:first-child {
            width: 35%;
            font-weight: 600;
            color: #333;
          }
          
          .receiptTable td:last-child {
            color: #555;
          }
          
          .itemsTable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            border: 1px solid #ddd;
          }
          
          .itemsTable th, .itemsTable td {
            padding: 12px 8px;
            border: 1px solid #ddd;
            text-align: left;
            font-size: 13px;
          }
          
          .itemsTable th {
            background-color: #f8f9fa;
            font-weight: 700;
            color: #333;
            text-transform: uppercase;
            font-size: 12px;
          }
          
          .itemsTable tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          .itemsTable tbody tr:hover {
            background-color: #f0f8ff;
          }
          
          .itemsTable tfoot {
            font-weight: bold;
            background-color: #e9ecef;
          }
          
          .itemsTable tfoot td {
            border-top: 2px solid #333;
            font-weight: 700;
          }
          
          .receiptFooter {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #333;
            font-style: italic;
            color: #666;
          }
          
          .receiptFooter p {
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .consommation-section {
            margin-bottom: 2rem;
            border: 1px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .consommation-header {
            background-color: #f8f9fa;
            padding: 1rem;
            border-bottom: 1px solid #ddd;
          }
          
          .consommation-header h4 {
            margin: 0 0 0.5rem 0;
            color: #0056b3;
            font-size: 1.1rem;
            font-weight: 600;
          }
          
          .consommation-date {
            margin: 0;
            font-size: 0.9rem;
            color: #666;
            font-style: italic;
          }
          
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          
          .consommation-section {
            margin-bottom: 2rem;
            border: 1px solid #ddd;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .consommation-header {
            background-color: #f8f9fa;
            padding: 1rem;
            border-bottom: 1px solid #ddd;
          }
          
          .consommation-header h4 {
            margin: 0 0 0.5rem 0;
            color: #0056b3;
            font-size: 1.1rem;
            font-weight: 600;
          }
          
          .consommation-date {
            margin: 0;
            font-size: 0.9rem;
            color: #666;
            font-style: italic;
          }
          
          .grand-totals {
            margin-top: 2rem;
            border: 2px solid #333;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .signature-box {
            width: 200px;
            text-align: center;
          }
          
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 8px;
            font-size: 12px;
            color: #666;
          }
          
          .amount-highlight {
            font-size: 18px;
            font-weight: bold;
            color: #0056b3;
          }
          
          .print-controls {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 6px;
          }
          
          .print-btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
            margin: 0 10px;
            transition: background-color 0.2s;
          }
          
          .print-btn:hover {
            background-color: #0056b3;
          }
          
          .close-btn {
            background-color: #6c757d;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 4px;
            margin: 0 10px;
          }
          
          .close-btn:hover {
            background-color: #545b62;
          }
          
          @media print {
            body {
              background-color: white;
              padding: 0;
            }
            
            .receiptContainer {
              box-shadow: none;
              border-radius: 0;
              padding: 20px;
            }
            
            .print-controls {
              display: none;
            }
            
            .facilityHeader {
              background: white !important;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              margin-bottom: 15px;
              padding: 10px 0;
            }
            
            .republicHeader h1 {
              font-size: 20px;
            }
            
            .facilityInfoSection {
              gap: 15px;
              min-height: 120px;
              grid-template-columns: 1fr 2fr 1fr;
            }

            .logoImage {
              max-height: 100px;
              max-width: 130px;
              height: 100px;
            }
            
            .facilityName {
              font-size: 18px;
            }
            
            .facilityAddress,
            .facilityEmail {
              font-size: 12px;
            }
            
            .itemsTable {
              font-size: 12px;
            }
            
            .itemsTable th, .itemsTable td {
              padding: 8px 6px;
            }
          }
          
          @page {
            size: A4;
            margin: 1cm;
          }
        </style>
      </head>
      <body>
  `);

  printWindow.document.write(`
    <div class="receiptContainer">
      ${
        facilityInfo
          ? `
      <div class="facilityHeader">
        <div class="republicHeader">
          <h1>REPUBLIQUE DU RWANDA</h1>
        </div>
        <div class="facilityInfoSection">
          <div class="facilityLogo">
            ${facilityInfo.logoUrl ? `<img src="${facilityInfo.logoUrl}" alt="Facility Logo" class="logoImage" onerror="console.error('Failed to load logo image')" />` : ''}
          </div>
          <div class="facilityDetails">
            <h2 class="facilityName">${facilityInfo.name}</h2>
            ${facilityInfo.physicalAddress ? `<p class="facilityAddress">${facilityInfo.physicalAddress}</p>` : ''}
            ${facilityInfo.email ? `<p class="facilityEmail">${facilityInfo.email}</p>` : ''}
          </div>
          <div class="facilitySpacer"></div>
        </div>
      </div>
      `
          : ''
      }
      
      <div class="receiptHeader">
        <h1>Payment Receipt</h1>
        <p class="receiptDate">
          Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </p>
      </div>
      
      <div class="print-controls">
        <button class="print-btn" onclick="window.print();">🖨️ Print Receipt</button>
        <button class="close-btn" onclick="window.close();">✖️ Close Window</button>
      </div>
      
      <div class="receiptSection">
        <h3>Payment Information</h3>
        <table class="receiptTable">
          <tbody>
            ${
              paymentData.patientName
                ? `
            <tr>
              <td>Patient Name:</td>
              <td><strong>${paymentData.patientName}</strong></td>
            </tr>
            `
                : ''
            }
            ${
              paymentData.policyNumber
                ? `
            <tr>
              <td>Policy Number:</td>
              <td>${paymentData.policyNumber}</td>
            </tr>
            `
                : ''
            }
            ${
              paymentData.insuranceName
                ? `
            <tr>
              <td>Insurance Provider:</td>
              <td><strong>${paymentData.insuranceName}</strong></td>
            </tr>
            `
                : ''
            }
            ${
              paymentData.insuranceRate !== undefined
                ? `
            <tr>
              <td>Insurance Coverage:</td>
              <td><strong>${paymentData.insuranceRate}%</strong></td>
            </tr>
            <tr>
              <td>Patient Coverage:</td>
              <td><strong>${paymentData.patientRate || 100 - paymentData.insuranceRate}%</strong></td>
            </tr>
            `
                : ''
            }
            <tr>
              <td>Collector:</td>
              <td>${paymentData.collectorName}</td>
            </tr>
            <tr>
              <td>Payment Date:</td>
              <td>${paymentData.dateReceived}</td>
            </tr>
            ${
              paymentData.paymentMethod === 'cash' && paymentData.receivedCash
                ? `
              <tr>
                <td>Cash Received:</td>
                <td>${parseFloat(paymentData.receivedCash).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Change Given:</td>
                <td>${paymentData.change}</td>
              </tr>
            `
                : ''
            }
            ${
              paymentData.paymentMethod === 'deposit' && paymentData.deductedAmount
                ? `
              <tr>
                <td>Amount Deducted:</td>
                <td>${parseFloat(paymentData.deductedAmount).toFixed(2)}</td>
              </tr>
            `
                : ''
            }
            <tr>
              <td><strong>${paymentData.paymentMethod === 'N/A' ? 'Total Amount:' : paymentData.paymentMethod === 'pending' ? 'Amount Due:' : 'Total Amount Paid:'}</strong></td>
              <td class="amount-highlight">${paymentData.amountPaid}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="receiptSection">
        <h3>Services & Itemized Payment Details</h3>
        ${Object.entries(groupedConsommationData)
          .map(([consommationId, consommationInfo]) => {
            const consommationItems = allConsommationItems.filter((item) => item.consommationId === consommationId);

            return `
            <div class="consommation-section">
              <div class="consommation-header">
                <h4>Consommation #${consommationId} - ${consommationInfo.service}</h4>
                <p class="consommation-date">Date: ${consommationInfo.date || 'N/A'}</p>
              </div>
              
              <table class="itemsTable">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total Amount</th>
                    <th>Insurance % Cover</th>
                    <th>Patient % Cover</th>
                    <th>Paid Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${consommationItems
                    .map((item) => {
                      const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                      const paidAmount = item.paidAmount || 0;
                      const insuranceRate = paymentData.insuranceRate || 0;
                      const patientRate = 100 - insuranceRate;
                      const insuranceCoverAmount = (itemTotal * insuranceRate) / 100;
                      const patientCoverAmount = (itemTotal * patientRate) / 100;

                      return `
                      <tr>
                        <td><strong>${item.itemName || 'Unnamed Item'}</strong></td>
                        <td style="text-align: center;">${item.quantity || '1'}</td>
                        <td style="text-align: right;">${Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td style="text-align: right;">${Number(itemTotal).toFixed(2)}</td>
                        <td style="text-align: right;">${insuranceRate.toFixed(1)}% (${insuranceCoverAmount.toFixed(2)})</td>
                        <td style="text-align: right;">${patientRate.toFixed(1)}% (${patientCoverAmount.toFixed(2)})</td>
                        <td style="text-align: right;"><strong>${Number(paidAmount).toFixed(2)}</strong></td>
                      </tr>
                    `;
                    })
                    .join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="4"><strong>Consommation Totals:</strong></td>
                    <td style="text-align: right;">
                      <strong>
                        ${consommationItems
                          .reduce((total, item) => {
                            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                            const insuranceRate = paymentData.insuranceRate || 0;
                            return total + (itemTotal * insuranceRate) / 100;
                          }, 0)
                          .toFixed(2)}
                      </strong>
                    </td>
                    <td style="text-align: right;">
                      <strong>
                        ${consommationItems
                          .reduce((total, item) => {
                            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                            const patientRate = 100 - (paymentData.insuranceRate || 0);
                            return total + (itemTotal * patientRate) / 100;
                          }, 0)
                          .toFixed(2)}
                      </strong>
                    </td>
                    <td style="text-align: right;">
                      <strong>
                        ${consommationItems.reduce((total, item) => total + (item.paidAmount || 0), 0).toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
          })
          .join('')}
        
        <div class="grand-totals">
          <table class="itemsTable">
            <tfoot>
              <tr style="background-color: #e9ecef; font-weight: bold;">
                <td colspan="4"><strong>GRAND TOTALS:</strong></td>
                <td style="text-align: right;">
                  <strong>
                    ${allConsommationItems
                      .reduce((total, item) => {
                        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                        const insuranceRate = paymentData.insuranceRate || 0;
                        return total + (itemTotal * insuranceRate) / 100;
                      }, 0)
                      .toFixed(2)}
                  </strong>
                </td>
                <td style="text-align: right;">
                  <strong>
                    ${allConsommationItems
                      .reduce((total, item) => {
                        const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                        const patientRate = 100 - (paymentData.insuranceRate || 0);
                        return total + (itemTotal * patientRate) / 100;
                      }, 0)
                      .toFixed(2)}
                  </strong>
                </td>
                <td style="text-align: right;">
                  <strong>
                    ${allConsommationItems.reduce((total, item) => total + (item.paidAmount || 0), 0).toFixed(2)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">Patient/Representative</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">Cashier/Collector</div>
        </div>
      </div>
      
      <div class="receiptFooter">
        <p><strong>Thank you for your payment!</strong></p>
        <p>Please keep this receipt for your records.</p>
        <p style="font-size: 12px; margin-top: 20px;">
          Receipt generated electronically on ${new Date().toLocaleString()}<br>
          This is a valid payment receipt.
        </p>
      </div>
    </div>
  `);

  printWindow.document.write('</body></html>');
  printWindow.document.close();

  // Focus the print window
  printWindow.focus();

  // Auto-trigger print dialog after a short delay
  setTimeout(() => {
    if (printWindow && !printWindow.closed) {
      printWindow.print();
    }
  }, 500);
};
