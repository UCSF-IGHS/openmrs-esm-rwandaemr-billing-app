interface GlobalBillData {
  globalBillId: string;
  patientName?: string;
  policyNumber?: string;
  insuranceName?: string;
  insuranceRate?: number;
  patientRate?: number;
  admissionDate?: string;
  department?: string;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  status?: string;
  closed?: boolean;
}

interface ConsommationData {
  consommationId: string;
  service: string;
  createdDate: string;
  items: ConsommationItem[];
  insuranceRates: {
    insuranceRate: number;
    patientRate: number;
  };
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
}

interface ConsommationItem {
  patientServiceBillId?: number;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  paidAmount?: number;
  serviceDate?: string;
  drugFrequency?: string;
}

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

import { type FacilityInfo } from '../api/billing/facility-info';

export const printGlobalBill = (
  globalBillData: GlobalBillData,
  consommationsData: ConsommationData[],
  collectorName: string = 'System',
  paymentData?: PaymentData,
  facilityInfo?: FacilityInfo,
) => {
  if (facilityInfo?.logoUrl) {
    // Logo is available from endpoint, will be displayed
  }

  const printWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes');

  if (!printWindow) {
    alert('Please allow pop-ups to print the global bill');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Global Bill - ${globalBillData.globalBillId} - ${new Date().toLocaleDateString()}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 10px;
            background-color: #f5f5f5;
            line-height: 1.3;
            font-size: 12px;
          }
          
          .billContainer {
            max-width: 800px;
            margin: 0 auto;
            padding: 10px;
            background-color: white;
            box-shadow: 0 0 5px rgba(0,0,0,0.1);
            border-radius: 4px;
          }
          
          .facilityHeader {
            text-align: center;
            margin-bottom: 15px;
            padding: 15px 0;
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
          
          .billHeader {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #0056b3;
          }
          
          .billHeader h1 {
            color: #0056b3;
            margin-bottom: 5px;
            font-size: 24px;
            font-weight: bold;
          }
          
          .billHeader h2 {
            color: #333;
            margin-bottom: 3px;
            font-size: 18px;
            font-weight: 600;
          }
          
          .billDate {
            font-size: 12px;
            color: #666;
            font-weight: 500;
          }
          
          .billSection {
            margin-bottom: 15px;
          }
          
          .billSection h3 {
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #0056b3;
            color: #0056b3;
            font-size: 16px;
            font-weight: 600;
          }
          
          .billTable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 10px;
          }
          
          .billTable td {
            padding: 4px 6px;
            vertical-align: top;
            border: 1px solid #dee2e6;
            font-size: 10px;
          }
          
          .billTable td:first-child {
            width: 25%;
            font-weight: 600;
            color: #333;
            background-color: #f8f9fa;
          }
          
          .billTable td:last-child {
            color: #555;
          }

          .compactGrid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 15px;
            font-size: 10px;
          }

          .compactGridItem {
            display: flex;
            justify-content: space-between;
            padding: 4px 8px;
            border: 1px solid #dee2e6;
            background-color: #f8f9fa;
            border-radius: 3px;
          }

          .compactGridItem .label {
            font-weight: 600;
            color: #333;
          }

          .compactGridItem .value {
            color: #555;
            font-weight: 500;
          }
          
          .consommationSection {
            margin-bottom: 0.5rem;
            border: 1px solid #e9ecef;
            border-radius: 3px;
            overflow: hidden;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          
          .consommationHeader {
            background: linear-gradient(135deg, #0056b3, #007bff);
            color: white;
            padding: 6px 10px;
            border-bottom: 1px solid #004085;
          }
          
          .consommationHeader h4 {
            margin: 0 0 2px 0;
            font-size: 12px;
            font-weight: 700;
          }
          
          .consommationMeta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 0;
            font-size: 10px;
            opacity: 0.9;
          }
          
          .consommationStatus {
            background-color: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 10px;
          }
          
          .itemsTable {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            font-size: 9px;
          }
          
          .itemsTable th, .itemsTable td {
            padding: 3px 4px;
            border: 1px solid #dee2e6;
            text-align: left;
            font-size: 9px;
            line-height: 1.2;
          }
          
          .itemsTable th {
            background-color: #f8f9fa;
            font-weight: 700;
            color: #495057;
            text-transform: uppercase;
            font-size: 8px;
            border-bottom: 2px solid #dee2e6;
            padding: 2px 3px;
          }
          
          .itemsTable tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          .itemsTable tbody tr:hover {
            background-color: #e3f2fd;
          }
          
          .itemsTable tfoot {
            font-weight: bold;
            background-color: #e9ecef;
            border-top: 3px solid #0056b3;
          }
          
          .itemsTable tfoot td {
            border-top: 2px solid #0056b3;
            font-weight: 700;
            font-size: 14px;
          }
          
          .summarySection {
            margin-top: 2rem;
            border: 3px solid #0056b3;
            border-radius: 8px;
            overflow: hidden;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
          }
          
          .summaryHeader {
            background: linear-gradient(135deg, #0056b3, #007bff);
            color: white;
            padding: 1rem;
            text-align: center;
          }
          
          .summaryHeader h3 {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 700;
          }
          
          .summaryTable {
            width: 100%;
            border-collapse: collapse;
          }
          
          .summaryTable td {
            padding: 15px 20px;
            border-bottom: 1px solid #dee2e6;
            font-size: 16px;
          }
          
          .summaryTable td:first-child {
            font-weight: 600;
            color: #333;
            width: 40%;
          }
          
          .summaryTable td:last-child {
            text-align: right;
            font-weight: 700;
            color: #0056b3;
          }
          
          .summaryTable tr:last-child td {
            border-bottom: none;
            background-color: #0056b3;
            color: white;
            font-size: 18px;
            font-weight: 800;
          }
          
          .signatureSection {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            padding: 20px 0;
          }
          
          .signatureBox {
            width: 250px;
            text-align: center;
          }
          
          .signatureLine {
            border-top: 2px solid #333;
            margin-top: 50px;
            padding-top: 10px;
            font-size: 14px;
            color: #666;
            font-weight: 600;
          }
          
          .printControls {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
          }
          
          .printBtn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 6px;
            margin: 0 10px;
            transition: all 0.3s;
            font-weight: 600;
          }
          
          .printBtn:hover {
            background: linear-gradient(135deg, #0056b3, #004085);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          
          .closeBtn {
            background: linear-gradient(135deg, #6c757d, #545b62);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            cursor: pointer;
            border-radius: 6px;
            margin: 0 10px;
            transition: all 0.3s;
            font-weight: 600;
          }
          
          .closeBtn:hover {
            background: linear-gradient(135deg, #545b62, #495057);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          
          .statusBadge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .statusPaid {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          
          .statusUnpaid {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          
          .statusPartiallyPaid {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
          }
          
          .statusClosed {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
          }
          
          @media print {
            body {
              background-color: white;
              padding: 0;
              font-size: 9px;
              line-height: 1.1;
            }
            
            .billContainer {
              box-shadow: none;
              border-radius: 0;
              padding: 5px;
              max-width: 100%;
            }
            
            .printControls {
              display: none;
            }
            
            .facilityHeader {
              background: white !important;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
              margin-bottom: 10px;
              padding: 8px 0;
            }
            
            .republicHeader h1 {
              font-size: 18px;
            }
            
            .facilityInfoSection {
              gap: 10px;
              min-height: 100px;
              grid-template-columns: 1fr 2fr 1fr;
            }

            .logoImage {
              max-height: 80px;
              max-width: 110px;
              height: 80px;
            }
            
            .facilityName {
              font-size: 16px;
            }
            
            .facilityAddress,
            .facilityEmail {
              font-size: 10px;
            }
            
            .billHeader {
              margin-bottom: 10px;
              padding-bottom: 6px;
            }
            
            .billHeader h1 {
              font-size: 18px;
            }
            
            .billHeader h2 {
              font-size: 14px;
            }
            
            .billSection {
              margin-bottom: 10px;
            }
            
            .billSection h3 {
              font-size: 12px;
              margin-bottom: 6px;
            }
            
            .consommationSection {
              margin-bottom: 0.5rem;
            }
            
            .consommationHeader {
              padding: 4px 8px;
            }
            
            .consommationHeader h4 {
              font-size: 10px;
            }
            
            .consommationMeta {
              font-size: 8px;
            }
            
            .itemsTable {
              font-size: 8px;
            }
            
            .itemsTable th, .itemsTable td {
              padding: 2px 3px;
              font-size: 8px;
            }
            
            .consommationHeader {
              background: #0056b3 !important;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            
            .summaryHeader {
              background: #0056b3 !important;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            
            .summaryTable td {
              padding: 6px 8px;
              font-size: 10px;
            }

            .compactGrid {
              gap: 4px;
              margin-bottom: 10px;
              font-size: 8px;
            }

            .compactGridItem {
              padding: 3px 6px;
            }

            .billTable {
              font-size: 8px;
            }

            .billTable td {
              padding: 3px 4px;
              font-size: 8px;
            }
          }
          
          @page {
            size: A4;
            margin: 0.5cm;
          }
        </style>
      </head>
      <body>
  `);

  printWindow.document.write(`
    <div class="billContainer">
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
      
      <div class="billHeader">
        <h1>GLOBAL BILL</h1>
        <h2>Bill #${globalBillData.globalBillId}</h2>
        <p class="billDate">
          Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
        </p>
      </div>
      
      <div class="printControls">
        <button class="printBtn" onclick="window.print();">🖨️ Print Global Bill</button>
        <button class="closeBtn" onclick="window.close();">✖️ Close Window</button>
      </div>
      
      <div class="billSection">
        <h3>Bill Information</h3>
        <div class="compactGrid">
          ${
            globalBillData.patientName
              ? `
          <div class="compactGridItem">
            <span class="label">Patient Name:</span>
            <span class="value"><strong>${globalBillData.patientName}</strong></span>
          </div>
          `
              : ''
          }
          ${
            globalBillData.policyNumber
              ? `
          <div class="compactGridItem">
            <span class="label">Policy Number:</span>
            <span class="value">${globalBillData.policyNumber}</span>
          </div>
          `
              : ''
          }
          ${
            globalBillData.insuranceName
              ? `
          <div class="compactGridItem">
            <span class="label">Insurance Provider:</span>
            <span class="value"><strong>${globalBillData.insuranceName}</strong></span>
          </div>
          `
              : ''
          }
          ${
            globalBillData.admissionDate
              ? `
          <div class="compactGridItem">
            <span class="label">Admission Date:</span>
            <span class="value">${new Date(globalBillData.admissionDate).toLocaleDateString()}</span>
          </div>
          `
              : ''
          }
          ${
            globalBillData.department
              ? `
          <div class="compactGridItem">
            <span class="label">Department:</span>
            <span class="value">${globalBillData.department}</span>
          </div>
          `
              : ''
          }
          <div class="compactGridItem">
            <span class="label">Generated By:</span>
            <span class="value">${collectorName}</span>
          </div>
          <div class="compactGridItem">
            <span class="label">Total Amount:</span>
            <span class="value"><strong>${consommationsData.reduce((sum, c) => sum + (c.totalAmount || 0), 0).toFixed(2)} RWF</strong></span>
          </div>
        </div>
      </div>
      
      <div class="billSection">
        <h3>Consommations & Services</h3>
        ${consommationsData
          .map((consommation) => {
            const totalAmount = consommation.totalAmount || 0;
            const paidAmount = consommation.paidAmount || 0;
            const dueAmount = consommation.dueAmount || 0;
            const insuranceRate = paymentData?.insuranceRate ?? consommation.insuranceRates?.insuranceRate ?? 0;
            const patientRate = paymentData?.patientRate ?? consommation.insuranceRates?.patientRate ?? 100;

            return `
            <div class="consommationSection">
              <div class="consommationHeader">
                <h4>Consommation #${consommation.consommationId} - ${consommation.service}</h4>
                <div class="consommationMeta">
                  <span>Date: ${new Date(consommation.createdDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              <table class="itemsTable">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Service Date</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total Amount</th>
                    <th>Insurance (${insuranceRate}%)</th>
                    <th>Patient (${patientRate}%)</th>
                    <th>Paid Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    consommation.items && consommation.items.length > 0
                      ? consommation.items
                          .map((item) => {
                            const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
                            const insuranceAmount = (itemTotal * insuranceRate) / 100;
                            const patientAmount = (itemTotal * patientRate) / 100;
                            const paidAmount = item.paidAmount || 0;

                            return `
                      <tr>
                        <td><strong>${item.itemName || 'Unnamed Item'}</strong></td>
                        <td>${item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : '-'}</td>
                        <td style="text-align: center;">${item.quantity || '1'}</td>
                        <td style="text-align: right;">${Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td style="text-align: right;"><strong>${Number(itemTotal).toFixed(2)}</strong></td>
                        <td style="text-align: right;">${insuranceAmount.toFixed(2)}</td>
                        <td style="text-align: right;">${patientAmount.toFixed(2)}</td>
                        <td style="text-align: right;"><strong>${Number(paidAmount).toFixed(2)}</strong></td>
                      </tr>
                    `;
                          })
                          .join('')
                      : `
                    <tr>
                      <td colspan="8" style="text-align: center; font-style: italic; color: #666; padding: 20px;">
                        No items available for this consommation
                      </td>
                    </tr>
                  `
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="4"><strong>Consommation Totals:</strong></td>
                    <td style="text-align: right;"><strong>${totalAmount.toFixed(2)}</strong></td>
                    <td style="text-align: right;"><strong>${((totalAmount * insuranceRate) / 100).toFixed(2)}</strong></td>
                    <td style="text-align: right;"><strong>${((totalAmount * patientRate) / 100).toFixed(2)}</strong></td>
                    <td style="text-align: right;"><strong>${paidAmount.toFixed(2)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          `;
          })
          .join('')}
      </div>
      
      <div class="signatureSection">
        <div class="signatureBox">
          <div class="signatureLine">Patient/Representative Signature</div>
        </div>
        <div class="signatureBox">
          <div class="signatureLine">Cashier/Collector Signature</div>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #0056b3; font-style: italic; color: #666;">
        <p><strong>Thank you for choosing our services!</strong></p>
        <p>Please keep this bill for your records.</p>
        <p style="font-size: 12px; margin-top: 20px;">
          Global Bill generated electronically on ${new Date().toLocaleString()}<br>
          This is an official billing document.
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
