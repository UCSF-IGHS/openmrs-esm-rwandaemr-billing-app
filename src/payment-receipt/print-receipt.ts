// print-receipt.ts
export const printReceipt = (paymentData, consommationData, selectedItems) => {
  // Helper function to determine item status
  const getItemStatus = (item) => {
    const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
    const paidAmount = item.paidAmount || 0;
    
    if (paidAmount >= itemTotal) {
      return { text: 'Paid', class: 'paidStatus' };
    } else if (paidAmount > 0) {
      return { text: 'Partially Paid', class: 'partiallyPaidStatus' };
    }
    return { text: 'Unpaid', class: 'unpaidStatus' };
  };

  // Create a new window for the receipt
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('Please allow pop-ups to print the receipt');
    return;
  }
  
  // Load styles
  printWindow.document.write(`
    <html>
      <head>
        <title>Payment Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          
          .receiptContainer {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
          }
          
          .receiptHeader {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ccc;
          }
          
          .receiptDate {
            font-size: 0.9rem;
            color: #555;
          }
          
          .receiptSection {
            margin-bottom: 20px;
          }
          
          .receiptSection h3 {
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #eee;
          }
          
          .receiptTable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          
          .receiptTable td {
            padding: 8px;
            vertical-align: top;
          }
          
          .receiptTable td:first-child {
            width: 40%;
            font-weight: 500;
          }
          
          .itemsTable {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .itemsTable th, .itemsTable td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
          }
          
          .itemsTable th {
            background-color: #f5f5f5;
            font-weight: 600;
          }
          
          .itemsTable tfoot {
            font-weight: bold;
            background-color: #f9f9f9;
          }
          
          .paidStatus {
            display: inline-block;
            padding: 2px 6px;
            background-color: #deffde;
            color: #24a148;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .partiallyPaidStatus {
            display: inline-block;
            padding: 2px 6px;
            background-color: #fff8e1;
            color: #ff832b;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .unpaidStatus {
            display: inline-block;
            padding: 2px 6px;
            background-color: #ffebeb;
            color: #da1e28;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }
          
          .receiptFooter {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            font-style: italic;
          }
          
          @media print {
            .noPrint {
              display: none;
            }
          }
        </style>
      </head>
      <body>
  `);
  
  // Generate receipt content
  printWindow.document.write(`
    <div class="receiptContainer">
      <div class="receiptHeader">
        <h2>Payment Receipt</h2>
        <p class="receiptDate">
          Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
        </p>
      </div>
      
      <div class="receiptSection">
        <h3>Payment Details</h3>
        <table class="receiptTable">
          <tbody>
            <tr>
              <td>Patient:</td>
              <td>${paymentData.patientName || 'Unknown'}</td>
            </tr>
            ${paymentData.policyNumber ? `
            <tr>
              <td>Policy Number:</td>
              <td>${paymentData.policyNumber}</td>
            </tr>
            ` : ''}
            <tr>
              <td>Collector:</td>
              <td>${paymentData.collectorName}</td>
            </tr>
            <tr>
              <td>Received Date:</td>
              <td>${paymentData.dateReceived}</td>
            </tr>
            <tr>
              <td>Payment Method:</td>
              <td>${paymentData.paymentMethod === 'cash' ? 'Cash' : 'Deposit'}</td>
            </tr>
            ${paymentData.paymentMethod === 'cash' && paymentData.receivedCash ? `
              <tr>
                <td>Received Cash:</td>
                <td>${parseFloat(paymentData.receivedCash).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Change:</td>
                <td>${paymentData.change}</td>
              </tr>
            ` : ''}
            ${paymentData.paymentMethod === 'deposit' && paymentData.deductedAmount ? `
              <tr>
                <td>Deducted Amount:</td>
                <td>${parseFloat(paymentData.deductedAmount).toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr>
              <td><strong>Amount Paid:</strong></td>
              <td><strong>${paymentData.amountPaid}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="receiptSection">
        <h3>Consommation Details</h3>
        <table class="receiptTable">
          <tbody>
            <tr>
              <td>Consommation ID:</td>
              <td>${consommationData.consommationId}</td>
            </tr>
            <tr>
              <td>Service:</td>
              <td>${consommationData.service}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="receiptSection">
        <h3>Items</h3>
        <table class="itemsTable">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Paid Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedItems.map(item => {
              const itemTotal = (item.quantity || 1) * (item.unitPrice || 0);
              const paidAmount = item.paidAmount || 0;
              const status = getItemStatus(item);
              return `
                <tr>
                  <td>${item.itemName || '-'}</td>
                  <td>${item.quantity || '1'}</td>
                  <td>${Number(item.unitPrice || 0).toFixed(2)}</td>
                  <td>${Number(itemTotal).toFixed(2)}</td>
                  <td>${Number(paidAmount).toFixed(2)}</td>
                  <td><span class="${status.class}">${status.text}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>Total Amount:</strong></td>
              <td>
                <strong>
                  ${selectedItems
                    .reduce((total, item) => total + ((item.quantity || 1) * (item.unitPrice || 0)), 0)
                    .toFixed(2)}
                </strong>
              </td>
              <td colspan="2"></td>
            </tr>
            <tr>
              <td colspan="3"><strong>Total Paid:</strong></td>
              <td colspan="2">
                <strong>
                  ${selectedItems
                    .reduce((total, item) => total + (item.paidAmount || 0), 0)
                    .toFixed(2)}
                </strong>
              </td>
              <td></td>
            </tr>
            <tr>
              <td colspan="3"><strong>Balance Due:</strong></td>
              <td colspan="2">
                <strong>
                  ${(selectedItems
                    .reduce((total, item) => total + ((item.quantity || 1) * (item.unitPrice || 0)), 0) - 
                    selectedItems
                    .reduce((total, item) => total + (item.paidAmount || 0), 0))
                    .toFixed(2)}
                </strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div class="receiptFooter">
        <p>Thank you for your payment</p>
      </div>
      
      <div class="noPrint" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print();" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
          Print Receipt
        </button>
      </div>
    </div>
  `);
  
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  
  // Print automatically after the content is loaded
  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
};
