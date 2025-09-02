import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { errorHandler, commonErrorMessages } from '../utils/error-handler';
import {
  DataTable,
  DataTableSkeleton,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbarSearch,
  Tile,
  InlineNotification,
  InlineLoading,
  Pagination,
  Modal,
  Tag,
  type DataTableRow,
  Button,
} from '@carbon/react';
import {
  isDesktop,
  useConfig,
  useDebounce,
  useLayoutType,
  usePatient,
  usePagination,
  showToast,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import styles from './invoice-table.scss';
import { usePatientBill, useInsuranceCardBill } from './invoice.resource';
import GlobalBillHeader from '.././bill-list/global-bill-list.component';
import EmbeddedConsommationsList from '../consommation/embedded-consommations-list.component';
import ServiceCalculator from './service-calculator.component';
import {
  createDirectConsommationWithBeneficiary,
  findBeneficiaryByPolicyNumber,
  getInsurancePoliciesByPatient,
} from '../api/billing';
import { fetchGlobalBillsPage } from '../api/billing/global-bills';

interface InvoiceTableProps {
  patientUuid?: string;
  insuranceCardNo?: string;
}

export const BillingHomeGlobalBillsTable: React.FC<{ patientQuery?: string; policyIdQuery?: string }> = ({
  patientQuery,
  policyIdQuery,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const formatAmt = (v: any) =>
    v === null || typeof v === 'undefined' || v === '' ? '--' : Number(v).toLocaleString();

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let results: any[] = [];
      let totalCount = 0;
      if (patientQuery) {
        const resp = await import('../api/billing/global-bills').then((m) =>
          m.fetchGlobalBillsByPatientQuery({ query: patientQuery, limit: pageSize, page, includeTotals: true }),
        );
        results = resp.results || [];
        totalCount = resp.totalCount ?? results.length;
      } else if (policyIdQuery) {
        const resp = await import('../api/billing/global-bills').then((m) =>
          m.fetchGlobalBillsByPolicyId({ policyId: policyIdQuery, limit: pageSize, page, includeTotals: true }),
        );
        results = resp.results || [];
        totalCount = resp.totalCount ?? results.length;
      } else {
        const resp = await fetchGlobalBillsPage({
          limit: pageSize,
          page,
          includeTotals: true,
        });
        results = resp.results || [];
        totalCount = resp.totalCount ?? results.length;
      }
      setRows(results);
      setTotal(totalCount);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, patientQuery, policyIdQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const headers = useMemo(
    () => [
      { key: 'patient', header: t('patient', 'Patient Name') },
      { key: 'policy', header: t('policyNo', 'Policy ID') },
      { key: 'billId', header: t('billId', 'Bill ID') },
      { key: 'admission', header: t('admissionDate', 'Admission Date') },
      { key: 'due', header: t('dueAmount', 'Due Amount') },
      { key: 'paid', header: t('paid', 'Paid') },
      { key: 'status', header: t('status', 'Status') },
    ],
    [t],
  );

  const filteredRows = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay =
        `${r.patientName || ''} ${r.policyNumber || ''} ${r.globalBillId || ''} ${r.billIdentifier || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, searchTerm]);

  const handleRowExpand = (row: any) => {
    const isExpanding = expandedRowId !== row.id;
    setExpandedRowId(isExpanding ? row.id : null);
  };

  if (isLoading) return <DataTableSkeleton columnCount={headers.length} rowCount={5} />;

  if (error) {
    return (
      <Layer>
        <Tile style={{ padding: 16 }}>
          <p style={{ color: 'red' }}>
            {t('failedToLoadRecentBills', 'Failed to load global bills')} — {error}
          </p>
          <p style={{ marginTop: 4, opacity: 0.7 }}>
            {t('tryChangingPageOrSize', 'Tip: try a different page or a smaller page size if the server times out.')}
          </p>
        </Tile>
      </Layer>
    );
  }

  const tableRows = filteredRows.map((r) => ({
    id: r.globalBillId,
    patient: r.patientName,
    policy: r.policyNumber,
    billId: r.billIdentifier,
    admission: r.admissionDate ? new Date(r.admissionDate).toLocaleDateString() : '--',
    due: formatAmt(r.dueAmount),
    paid: formatAmt(r.paidAmount),
    status: r.status,
    closed: r.closed,
    rawData: r,
  }));

  return (
    <div>
      <p style={{ margin: '0 0 16px', color: '#525252', fontSize: '14px' }}>
        Click the expand icon to view consommation details for each bill
      </p>

      <TableToolbarSearch
        expanded
        persistent
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        placeholder={t('searchByPatientOrPolicy', 'Search by patient, policy or bill ID')}
      />

      <DataTable rows={tableRows} headers={headers} useZebraStyles>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer className={styles.tableBodyScroll}>
            <Table {...getTableProps()} aria-label="Global bills" className={styles.invoiceTable}>
              <TableHead>
                <TableRow>
                  <TableExpandHeader />
                  {headers.map((header) => (
                    <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <React.Fragment key={row.id}>
                    <TableExpandRow
                      {...getRowProps({ row })}
                      isExpanded={expandedRowId === row.id}
                      onExpand={() => handleRowExpand(row)}
                    >
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>
                          {cell.info.header === 'status' ? (
                            <Tag
                              type={
                                cell.value === 'CLOSED'
                                  ? 'cool-gray'
                                  : cell.value === 'FULLY PAID' || cell.value === 'PAID'
                                    ? 'green'
                                    : 'red'
                              }
                            >
                              {cell.value}
                            </Tag>
                          ) : (
                            cell.value
                          )}
                        </TableCell>
                      ))}
                    </TableExpandRow>
                    {expandedRowId === row.id && (
                      <TableExpandedRow colSpan={headers.length + 1}>
                        <div className={styles.globalBillExpandedContent}>
                          <EmbeddedConsommationsList
                            globalBillId={row.id}
                            isGlobalBillClosed={tableRows.find((r) => r.id === row.id)?.closed}
                            onBillClosed={() => {
                              showToast({
                                title: t('billClosed', 'Bill closed'),
                                description: t('billClosedDesc', 'The bill was closed successfully.'),
                                kind: 'success',
                              });
                              load();
                            }}
                          />
                        </div>
                      </TableExpandedRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={total}
        pageSizes={[10, 20, 50, 100]}
        onChange={({ page: p, pageSize: ps }) => {
          if (ps !== pageSize) setPageSize(ps);
          setPage(p);
        }}
      />
    </div>
  );
};

const InvoiceTable: React.FC<InvoiceTableProps> = ({ patientUuid, insuranceCardNo }) => {
  return <InvoiceTableWithIdentifiers patientUuid={patientUuid} insuranceCardNo={insuranceCardNo} />;
};

interface InvoiceTableWithIdentifiersProps {
  patientUuid?: string;
  insuranceCardNo?: string;
}

const InvoiceTableWithIdentifiers: React.FC<InvoiceTableWithIdentifiersProps> = ({
  patientUuid = '',
  insuranceCardNo = '',
}) => {
  const { t } = useTranslation();
  const config = useConfig();
  const pageSize = config?.pageSize || 10;
  const layout = useLayoutType();

  const patientBillResponse = usePatientBill(patientUuid || '');
  const insuranceBillResponse = useInsuranceCardBill(insuranceCardNo || '');

  useEffect(() => {
    const handleGlobalBillCreated = (event: CustomEvent) => {
      if (patientUuid && (event as any).detail?.patientUuid === patientUuid) {
        patientBillResponse.mutate();
        if ((event as any).detail?.globalBillId) {
          setSelectedGlobalBillId((event as any).detail.globalBillId.toString());
        }
      }

      if (insuranceCardNo && (event as any).detail?.insuranceCardNumber === insuranceCardNo) {
        insuranceBillResponse.mutate();
        if ((event as any).detail?.globalBillId) {
          setSelectedGlobalBillId((event as any).detail.globalBillId.toString());
        }
      }
    };

    window.addEventListener('globalBillCreated', handleGlobalBillCreated as EventListener);
    return () => window.removeEventListener('globalBillCreated', handleGlobalBillCreated as EventListener);
  }, [patientUuid, insuranceCardNo, patientBillResponse, insuranceBillResponse]);

  const usePatientData = Boolean(patientUuid);
  const useInsuranceData = Boolean(insuranceCardNo) && !usePatientData;

  const lineItems = useMemo(() => {
    const items = usePatientData ? patientBillResponse.bills : useInsuranceData ? insuranceBillResponse.bills : [];
    const itemsArray = Array.isArray(items) ? items : [];
    return itemsArray;
  }, [usePatientData, patientBillResponse.bills, useInsuranceData, insuranceBillResponse.bills]);

  const isLoading = usePatientData
    ? patientBillResponse.isLoading
    : useInsuranceData
      ? insuranceBillResponse.isLoading
      : false;

  const error = usePatientData ? patientBillResponse.error : useInsuranceData ? insuranceBillResponse.error : null;
  const isValidating = usePatientData
    ? patientBillResponse.isValidating
    : useInsuranceData
      ? insuranceBillResponse.isValidating
      : false;

  const mutate = useMemo(
    () => (usePatientData ? patientBillResponse.mutate : useInsuranceData ? insuranceBillResponse.mutate : () => {}),
    [usePatientData, patientBillResponse.mutate, useInsuranceData, insuranceBillResponse.mutate],
  );

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGlobalBillId, setSelectedGlobalBillId] = useState<string | null>(null);

  const [calculatorItems, setCalculatorItems] = useState<any[]>([]);

  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const { paginated, goTo, results, currentPage } = usePagination(lineItems || [], currentPageSize);
  const { pageSizes } = usePaginationInfo(pageSize, lineItems?.length || 0, currentPage, results?.length || 0);

  const paidLineItems = useMemo(
    () => lineItems?.filter((item: any) => item?.paymentStatus === 'PAID') ?? [],
    [lineItems],
  );
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const isTablet = layout === 'tablet';
  const isDesktopLayout = layout === 'small-desktop' || layout === 'large-desktop';

  const [selectedLineItems, setSelectedLineItems] = useState(paidLineItems ?? []);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    if (lineItems && lineItems.length > 0 && !selectedGlobalBillId) {
      setSelectedGlobalBillId(lineItems[0].globalBillId?.toString() || null);
    }
  }, [lineItems, selectedGlobalBillId]);

  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  const filteredLineItems = useMemo(() => {
    if (!debouncedSearchTerm) return results || [];
    const term = String(debouncedSearchTerm).toLowerCase().trim();
    return (results || []).filter((lineItem: any) => {
      const hay =
        `${lineItem?.item || ''} ${lineItem?.globalBillId || ''} ${lineItem?.billIdentifier || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [debouncedSearchTerm, results]);

  const tableHeaders = [
    { key: 'globalBillId', header: t('globalBillId', 'Global Bill ID') },
    { key: 'date', header: t('dateOfBill', 'Date of Bill') },
    { key: 'createdBy', header: t('createdBy', 'Created by') },
    { key: 'policyId', header: t('policyId', 'Policy ID') },
    { key: 'admissionDate', header: t('admissionDate', 'Admission Date') },
    { key: 'dischargeDate', header: t('dischargeDate', 'Discharge Date') },
    { key: 'billIdentifier', header: t('billIdentifier', 'Bill ID') },
    { key: 'patientDueAmount', header: t('patientDueAmount', 'Due Amount') },
    { key: 'paidAmount', header: t('paidAmount', 'Paid') },
    { key: 'paymentStatus', header: t('paymentStatus', 'Status') },
  ];

  const tableRows: any[] = useMemo(
    () =>
      (filteredLineItems || [])
        ?.map((item: any) => {
          if (!item) return null;
          const statusContent = {
            content: (
              <Tag
                type={item.isPaid === true || item.paymentStatus === 'PAID' ? 'green' : 'red'}
                className={
                  item.isPaid === true || item.paymentStatus === 'PAID' ? styles.paidStatus : styles.unpaidStatus
                }
              >
                {item.isPaid === true ? 'PAID' : item.paymentStatus || 'UNPAID'}
              </Tag>
            ),
          };
          return {
            id: `${item.globalBillId || ''}`,
            globalBillId: item.globalBillId || '',
            date: item.date || '',
            createdBy: item.createdBy || '',
            policyId: item.policyId || '',
            admissionDate: item.admissionDate || '',
            dischargeDate: item.dischargeDate || '',
            billIdentifier: item.billIdentifier || '',
            patientDueAmount: item.patientDueAmount || '',
            paidAmount: item.paidAmount || '',
            paymentStatus: statusContent,
          };
        })
        .filter(Boolean) ?? [],
    [filteredLineItems],
  );

  const consommationListRef = useRef<any>(null);

  const handleRowExpand = (row: any) => {
    const isExpanding = expandedRowId !== row.id;
    setExpandedRowId(isExpanding ? row.id : null);
    if (isExpanding) {
      setSelectedGlobalBillId(row.id);
      setTimeout(() => {
        if (consommationListRef.current?.refreshRates) {
          consommationListRef.current.refreshRates();
        }
      }, 500);
    }
  };

  const createNewInvoice = useCallback(
    (globalBillId: string) => {
      const currentBill = lineItems.find((item: any) => item.globalBillId?.toString() === globalBillId.toString());
      const isGlobalBillClosed = currentBill?.paymentStatus === 'PAID';
      if (isGlobalBillClosed) {
        showToast({
          title: t('closedBill', 'Closed Bill'),
          description: t('cannotAddToClosedBill', 'Cannot add items to a closed bill'),
          kind: 'error',
        });
        return;
      }
      setSelectedGlobalBillId(globalBillId.toString());
      setIsCalculatorOpen(true);
      setCalculatorItems([]);
    },
    [lineItems, t],
  );

  const handleCalculatorClose = useCallback(() => {
    setIsCalculatorOpen(false);
    setIsSaving(false);
  }, []);

  const handleCalculatorSave = useCallback(async () => {
    if (!calculatorItems || calculatorItems.length === 0) {
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setShowError(false);
    try {
      const globalBillId = selectedGlobalBillId;
      if (!globalBillId) {
        throw new Error('No global bill ID found. Please create a global bill first.');
      }
      let policyNumber = insuranceCardNo;
      if (!policyNumber && patientUuid) {
        const policies = await getInsurancePoliciesByPatient(patientUuid);
        if (policies.length > 0 && policies[0].insuranceCardNo) {
          policyNumber = policies[0].insuranceCardNo;
        }
      }
      let beneficiaryId: any;
      if (policyNumber) {
        beneficiaryId = await findBeneficiaryByPolicyNumber(policyNumber);
      }
      if (!beneficiaryId) {
        throw new Error('Could not determine beneficiary ID. Please verify patient insurance details.');
      }
      const itemsByDepartment: Record<string, any> = {};
      calculatorItems.forEach((item: any) => {
        if (!itemsByDepartment[item.departmentId]) {
          itemsByDepartment[item.departmentId] = {
            departmentId: item.departmentId,
            departmentName: item.departmentName,
            items: [],
          };
        }
        let serviceIdForPayload;
        if (item.billableServiceId) serviceIdForPayload = item.billableServiceId;
        else if (item.originalData?.serviceId) serviceIdForPayload = item.originalData.serviceId;
        else if (item.facilityServicePriceId) serviceIdForPayload = item.facilityServicePriceId;
        else serviceIdForPayload = item.serviceId;

        itemsByDepartment[item.departmentId].items.push({
          serviceId: serviceIdForPayload,
          price: item.price,
          quantity: item.quantity,
          drugFrequency: item.drugFrequency || '',
          hopServiceId: item.hopServiceId || item.departmentId,
        });
      });

      let successCount = 0;
      let totalItemsCreated = 0;
      const errors: string[] = [];
      for (const deptId in itemsByDepartment) {
        const dept = itemsByDepartment[deptId];
        const deptIdNumber = parseInt(deptId, 10);
        if (isNaN(deptIdNumber)) {
          errorHandler.handleWarning(`Skipping department with invalid ID: ${deptId}`, null, {
            component: 'invoice-table',
            action: 'handleSaveItems',
          });
          continue;
        }
        try {
          const response = await createDirectConsommationWithBeneficiary(
            parseInt(globalBillId, 10),
            deptIdNumber,
            beneficiaryId,
            dept.items,
          );
          if (response && response.consommationId) {
            const expectedItems = response._itemsCount || dept.items.length;
            const actualItems = response._actualItemsReturned || (response.billItems ? response.billItems.length : 0);
            totalItemsCreated += expectedItems;
            successCount++;
            if (actualItems !== expectedItems) {
              errorHandler.handleWarning(
                `Note: All ${expectedItems} items were saved in the database, but only ${actualItems} were returned in the response. This is due to an API limitation.`,
                { expectedItems, actualItems },
                { component: 'invoice-table', action: 'handleSaveItems' },
              );
            }
          } else {
            throw new Error('Unexpected response format');
          }
        } catch (error: any) {
          const errorMsg = `Failed to create consommation for department ${dept.departmentName}: ${error.message}`;
          errorHandler.handleError(error, {
            component: 'invoice-table',
            action: 'handleSaveItems',
            metadata: { departmentName: dept.departmentName },
          });
          errors.push(errorMsg);
        }
      }

      if (successCount === 0) {
        if (errors.length > 0) throw new Error(`Failed to create consommations: ${errors.join('. ')}`);
        else throw new Error('Failed to create any consommations. Please check the console for details.');
      } else {
        const successMessage =
          totalItemsCreated === 1 ? `Added 1 item to the bill.` : `Added ${totalItemsCreated} items to the bill.`;
        let finalMessage = successMessage;
        if (errors.length > 0)
          finalMessage += ` Note: Some items could not be added. Please check the console for details.`;
        showToast({
          title: t('itemsAdded', 'Items Added'),
          description: finalMessage,
          kind: errors.length > 0 ? 'warning' : 'success',
        });
        mutate();
        setIsCalculatorOpen(false);
        if (consommationListRef.current?.mutate) {
          await consommationListRef.current.mutate();
        }
      }
    } catch (error: any) {
      errorHandler.handleError(
        error,
        { component: 'invoice-table', action: 'handleSaveItems' },
        { title: 'Save Failed', subtitle: 'Unable to save bill items. Please try again.', kind: 'error' },
      );
      const errorMessage = typeof error === 'string' ? error : error.message || 'Failed to save bill items';
      setErrorMessage(errorMessage);
      setShowError(true);
    } finally {
      setIsSaving(false);
    }
  }, [calculatorItems, selectedGlobalBillId, patientUuid, insuranceCardNo, mutate, t]);

  const handleCalculatorUpdate = useCallback((items: any[]) => {
    setCalculatorItems(items);
  }, []);

  const renderConsommationsTable = (globalBillId: any) => {
    const currentBill = lineItems.find((item: any) => item.globalBillId?.toString() === globalBillId?.toString());
    const isGlobalBillClosed = currentBill?.paymentStatus === 'PAID';
    return (
      <div className={styles.expandedContent}>
        <EmbeddedConsommationsList
          globalBillId={globalBillId.toString()}
          patientUuid={patientUuid}
          insuranceCardNo={insuranceCardNo}
          onConsommationClick={() => {}}
          onAddNewInvoice={createNewInvoice}
          isGlobalBillClosed={isGlobalBillClosed}
          ref={consommationListRef}
        />
      </div>
    );
  };

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" compact={isDesktopLayout} zebra headers={tableHeaders} />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <InlineNotification
          kind="error"
          title={t('error', 'Error')}
          subtitle={typeof error === 'string' ? error : t('failedToLoadBillingData', 'Failed to load billing data')}
          hideCloseButton
        />
      </div>
    );
  }

  if (lineItems.length === 0 && !isLoading) {
    return (
      <EmptyState
        displayText={t('invoicesInLowerCase', 'invoices')}
        headerTitle={t('globalBillList', 'Global Bill List')}
        launchForm={() => {}}
      />
    );
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('globalBillList', 'Global Bill List')}>
        <span>{isValidating ? <InlineLoading /> : null}</span>
      </CardHeader>

      <div className={styles.tableContainer}>
        <DataTable headers={tableHeaders} rows={tableRows} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getSelectionProps, getTableProps }) => (
            <TableContainer className={styles.tableBodyScroll}>
              <TableToolbarSearch
                className={styles.searchbox}
                expanded
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder={t('searchThisTable', 'Search this table')}
                size={responsiveSize}
                persistent
              />
              <Table {...getTableProps()} aria-label="Invoice line items" className={styles.invoiceTable}>
                <TableHead>
                  <TableRow>
                    <TableExpandHeader />
                    {headers.map((header) => (
                      <TableHeader className={styles.tableHeader} {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <TableExpandRow
                        {...getRowProps({ row })}
                        isExpanded={expandedRowId === row.id}
                        onExpand={() => handleRowExpand(row)}
                      >
                        {row.cells.map((cell) => {
                          const cellClassName =
                            `${cell.info.header === 'billIdentifier' ? styles.colBillId : ''} ${cell.info.header === 'globalBillId' ? styles.colGlobalBillId : ''} ${cell.info.header === 'date' ? styles.colDate : ''} ${cell.info.header === 'createdBy' ? styles.colCreatedBy : ''} ${cell.info.header === 'policyId' ? styles.colBillId : ''} ${cell.info.header === 'admissionDate' ? styles.colAdmissionDate : ''} ${cell.info.header === 'dischargeDate' ? styles.colDischargeDate : ''} ${cell.info.header === 'patientDueAmount' ? styles.colAmount : ''} ${cell.info.header === 'paidAmount' ? styles.colPaid : ''} ${cell.info.header === 'paymentStatus' ? styles.colStatus : ''}`.trim();
                          return (
                            <TableCell key={cell.id} className={cellClassName}>
                              {cell.value?.content ?? cell.value}
                            </TableCell>
                          );
                        })}
                      </TableExpandRow>
                      {expandedRowId === row.id && (
                        <TableExpandedRow colSpan={headers.length + 1}>
                          {renderConsommationsTable(row.id)}
                        </TableExpandedRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>

        {filteredLineItems?.length === 0 && lineItems.length > pageSize && (
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

        {paginated && lineItems.length > pageSize && (
          <Pagination
            forwardText={t('nextPage', 'Next page')}
            backwardText={t('previousPage', 'Previous page')}
            page={currentPage}
            pageSize={currentPageSize}
            pageSizes={pageSizes}
            totalItems={lineItems.length}
            onChange={({ page: newPage, pageSize }) => {
              if (newPage !== currentPage) {
                goTo(newPage);
              }
              setCurrentPageSize(pageSize);
            }}
          />
        )}
      </div>

      {isCalculatorOpen && selectedGlobalBillId && (
        <Modal
          open={isCalculatorOpen}
          modalHeading={t('addNewInvoice', 'Patient Bill Calculations')}
          primaryButtonText={isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
          secondaryButtonText={t('cancel', 'Cancel')}
          onRequestClose={handleCalculatorClose}
          onRequestSubmit={handleCalculatorSave}
          size="lg"
          preventCloseOnClickOutside
          primaryButtonDisabled={isSaving || calculatorItems.length === 0}
        >
          <ServiceCalculator
            patientUuid={patientUuid}
            insuranceCardNo={insuranceCardNo}
            onClose={handleCalculatorClose}
            onSave={handleCalculatorUpdate}
          />
        </Modal>
      )}
      {showError && (
        <InlineNotification
          kind="error"
          title={t('error', 'Error')}
          subtitle={errorMessage}
          onCloseButtonClick={() => setShowError(false)}
          lowContrast
        />
      )}
    </div>
  );
};

export default InvoiceTable;
