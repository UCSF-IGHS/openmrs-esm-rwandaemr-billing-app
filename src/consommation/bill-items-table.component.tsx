import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import styles from './bill-items-table.scss';

const BillItemsTable = ({ items, insuranceRate, insuranceAmount, patientAmount }) => {
  const { t } = useTranslation();

  if (!items || items.length === 0) {
    return <p>{t('noBillItems', 'No bill items available')}</p>;
  }

  const headers = [
    { key: 'no', header: t('no', 'No.') },
    { key: 'serviceDate', header: t('serviceDate', 'Service Date') },
    { key: 'description', header: t('itemName', 'Item Name') },
    { key: 'qty', header: t('qty', 'Qty') },
    { key: 'paidQty', header: t('paidQty', 'Paid Qty') },
    { key: 'unitPrice', header: t('unitPrice', 'Unit Price (RWF)') },
    { key: 'total', header: t('total', 'Total (RWF)') },
    { key: 'insurance', header: t('insurance', 'Insurance: ' + insuranceRate.toFixed(1) + '%') },
    { key: 'patient', header: t('patient', 'Patient: ' + (100 - insuranceRate).toFixed(1) + '%') },
  ];

  const rows = items.map((item, index) => {
    const totalPrice = item.unitPrice * item.quantity;

    // Based on backend insurance and patient amounts
    const totalConsommationAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const itemProportion = totalConsommationAmount > 0 ? totalPrice / totalConsommationAmount : 0;

    const itemInsuranceAmount = (insuranceAmount || 0) * itemProportion;
    const itemPatientAmount = (patientAmount || 0) * itemProportion;

    return {
      id: (index + 1).toString(),
      no: index + 1,
      serviceDate: new Date(item.serviceDate).toLocaleDateString(),
      description:
        item.itemName ||
        item?.service?.facilityServicePrice?.name ||
        item.serviceOtherDescription ||
        item.serviceOther ||
        t('noDescription', 'No description'),
      qty: item.quantity,
      paidQty: item.paidQuantity,
      unitPrice: item.unitPrice.toLocaleString(),
      total: totalPrice.toLocaleString(),
      insurance: itemInsuranceAmount.toLocaleString(),
      patient: itemPatientAmount.toLocaleString(),
    };
  });

  // Use the provided backend amounts for totals
  const totalConsommationAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const totals = {
    total: totalConsommationAmount,
    insurance: insuranceAmount || 0,
    patient: patientAmount || 0,
  };

  return (
    <div className={styles.tableContainer}>
      <DataTable rows={rows} headers={headers} useZebraStyles size="sm">
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow {...getRowProps({ row })}>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className={styles.totalRow}>
                <TableCell colSpan={6}>{t('total', 'Total')}</TableCell>
                <TableCell>{totals.total.toLocaleString()}</TableCell>
                <TableCell>{totals.insurance.toLocaleString()}</TableCell>
                <TableCell>{totals.patient.toLocaleString()}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
};

export default BillItemsTable;
