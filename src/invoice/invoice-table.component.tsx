import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import fuzzy from 'fuzzy';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectRow,
  TableToolbarSearch,
  Tile,
  type DataTableRow,
} from '@carbon/react';
import { Delete, Edit } from '@carbon/react/icons';
import { isDesktop, useConfig, useDebounce, useLayoutType } from '@openmrs/esm-framework';
import styles from './invoice-table.scss';
import { usePatientBill } from './invoice.resource';
import { useParams, useNavigate } from 'react-router-dom';
import GlobalBillHeader from '.././bill-list/global-bill-list.component';

const InvoiceTable: React.FC = () => {
  const { t } = useTranslation();
  const params = useParams();
  const { defaultCurrency, showEditBillButton } = useConfig();
  const layout = useLayoutType();
  const navigate = useNavigate();

  const { bills: lineItems, isLoading } = usePatientBill(params?.insuranceCardNo);
  const paidLineItems = useMemo(() => lineItems?.filter((item) => item.paymentStatus === 'PAID') ?? [], [lineItems]);
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';

  const [selectedLineItems, setSelectedLineItems] = useState(paidLineItems ?? []);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const filteredLineItems = useMemo(() => {
    if (!debouncedSearchTerm) {
      return lineItems;
    }

    return debouncedSearchTerm
      ? fuzzy
          .filter(debouncedSearchTerm, lineItems, {
            extract: (lineItem: any) => `${lineItem.item}`,
          })
          .sort((r1, r2) => r1.score - r2.score)
          .map((result) => result.original)
      : lineItems;
  }, [debouncedSearchTerm, lineItems]);

  const tableHeaders = [
    { header: 'No', key: 'no', width: 7 },
    { header: 'Global Bill ID', key: 'globalBillId', width: 15 },
    { header: 'Date of Bill', key: 'date', width: 15 },
    { header: 'Created by', key: 'createdBy', width: 15 },
    { header: 'Policy ID Node.', key: 'policyId', width: 7 },
    { header: 'Admission Date', key: 'admissionDate', width: 20 },
    { header: 'Discharge Date', key: 'dischargeDate', width: 20 },
    { header: 'Bill Identifier', key: 'billIdentifier', width: 25 },
    { header: 'Patient Due Amount', key: 'patientDueAmount', width: 10 },
    { header: 'Paid Amount', key: 'paidAmount', width: 10 },
    { header: 'Payment Status', key: 'paymentStatus', width: 7 },
    { header: t('status', 'Status'), key: 'actionButton', width: 10 },
  ];

  const tableRows: Array<typeof DataTableRow> = useMemo(
    () =>
      filteredLineItems?.map((item, index) => {
        return {
          no: `${index + 1}`,
          id: `${item.globalBillId}`,
          globalBillId: item.globalBillId,
          date: item.date,
          createdBy: item.createdBy,
          policyId: item.policyId,
          admissionDate: item.admissionDate,
          dischargeDate: item.dischargeDate,
          billIdentifier: item.billIdentifier,
          patientDueAmount: item.patientDueAmount,
          paidAmount: item.paidAmount,
          paymentStatus: item.paymentStatus,
          actionButton: (
            <span>
              {item.bill && (
                <>
                  <Button
                    data-testid={`edit-button-${item.uuid}`}
                    renderIcon={Edit}
                    hasIconOnly
                    kind="ghost"
                    iconDescription={t('editThisBillItem', 'Edit this bill item')}
                    tooltipPosition="left"
                    //   onClick={() => handleSelectBillItem(item)}
                  />
                  <Button
                    data-testid={`delete-button-${item.uuid}`}
                    renderIcon={Delete}
                    hasIconOnly
                    kind="ghost"
                    iconDescription={t('deleteThisBillItem', 'Delete this bill item')}
                    tooltipPosition="left"
                    //   onClick={() => handleSelectBillItem(item)}
                  />
                </>
              )}
            </span>
          ),
        };
      }) ?? [],
    [filteredLineItems, defaultCurrency, showEditBillButton, t],
  );

  const handleRowClick = useCallback(
    (row) => {
      if (row.id) {
        navigate(`/consommations/${row.id}`, {
          state: { insuranceCardNo: params.insuranceCardNo },
        });
      }
    },
    [navigate, params.insuranceCardNo],
  );

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <DataTableSkeleton
          data-testid="loader"
          columnCount={tableHeaders.length}
          showHeader={false}
          showToolbar={false}
          size={responsiveSize}
          zebra
        />
      </div>
    );
  }

  const handleRowSelection = (row: typeof DataTableRow, checked: boolean) => {
    const matchingRow = filteredLineItems.find((item) => item.uuid === row.id);
    let newSelectedLineItems;

    if (checked) {
      newSelectedLineItems = [...selectedLineItems, matchingRow];
    } else {
      newSelectedLineItems = selectedLineItems.filter((item) => item.uuid !== row.id);
    }
    setSelectedLineItems(newSelectedLineItems);
  };

  return (
    <>
      <div>
        <span className={styles.tableDescription}>
          <span className={styles.pageTitle}>{t('globalBillList', 'Global Bill List')}</span>
        </span>
      </div>
      <div>
        <GlobalBillHeader insuranceCardNo={params.insuranceCardNo || ''} />
      </div>
      <div className={styles.invoiceContainer}>
        <DataTable headers={tableHeaders} isSortable rows={tableRows} size={responsiveSize} useZebraStyles>
          {({ rows, headers, getRowProps, getSelectionProps, getTableProps, getToolbarProps }) => (
            <TableContainer title={t('globalBillList', 'Global Bill List')}>
              <TableToolbarSearch
                className={styles.searchbox}
                expanded
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder={t('searchThisTable', 'Search this table')}
                size={responsiveSize}
              />
              <Table
                {...getTableProps()}
                aria-label="Invoice line items"
                className={`${styles.invoiceTable} billingTable`}
              >
                <TableHead>
                  <TableRow>
                    {rows.length > 1 ? <TableHeader /> : null}
                    {headers.map((header) => (
                      <TableHeader key={header.key}>{header.header}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => {
                    return (
                      <TableRow
                        key={row.id}
                        {...getRowProps({
                          row,
                        })}
                        onClick={() => handleRowClick(row)}
                        className={styles.clickableRow}
                      >
                        {rows.length > 1 && (
                          <TableSelectRow
                            aria-label="Select row"
                            {...getSelectionProps({ row })}
                            disabled={tableRows[index].status === 'PAID'}
                            onChange={(checked: boolean) => handleRowSelection(row, checked)}
                            checked={
                              tableRows[index].status === 'PAID' ||
                              Boolean(selectedLineItems?.find((item) => item?.uuid === row?.id))
                            }
                          />
                        )}
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
        {filteredLineItems?.length === 0 && (
          <div className={styles.filterEmptyState}>
            <Layer>
              <Tile className={styles.filterEmptyStateTile}>
                <p className={styles.filterEmptyStateContent}>
                  {t('noMatchingItemsToDisplay', 'No matching items to display')}
                </p>
                <p className={styles.filterEmptyStateHelper}>{t('checkFilters', 'Check the filters above')}</p>
              </Tile>
            </Layer>
          </div>
        )}
      </div>
    </>
  );
};

export default InvoiceTable;
