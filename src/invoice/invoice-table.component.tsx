import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import fuzzy from 'fuzzy';
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

interface InvoiceTableProps {
  patientUuid?: string;
  insuranceCardNo?: string;
}

const InvoiceTable: React.FC<InvoiceTableProps> = (props) => {
  const { t } = useTranslation();

  const config = useConfig();
  const defaultCurrency = config?.defaultCurrency || 'RWF';
  const showEditBillButton = config?.showEditBillButton || false;
  const pageSize = config?.pageSize || 10;

  const layout = useLayoutType();

  const { patient } = usePatient();
  const patientUuid = props.patientUuid || patient?.id || '';

  const insuranceCardNo = props.insuranceCardNo || '';

  const patientBillResponse = usePatientBill(patientUuid || '');
  const insuranceBillResponse = useInsuranceCardBill(insuranceCardNo || '');

  const usePatientData = Boolean(patientUuid);
  const useInsuranceData = Boolean(insuranceCardNo) && !usePatientData;

  const lineItems = useMemo(() => {
    const items = usePatientData ? patientBillResponse.bills : useInsuranceData ? insuranceBillResponse.bills : [];

    const itemsArray = Array.isArray(items) ? items : [];

    return [...itemsArray].sort((a, b) => {
      if (!a || !b) return 0;

      const getDateValue = (item) => {
        if (!item.date) return 0;

        if (typeof item.date === 'string' && item.date.includes('Today')) {
          return new Date().getTime();
        }

        try {
          return new Date(item.date).getTime();
        } catch (e) {
          return 0;
        }
      };

      const dateA = getDateValue(a);
      const dateB = getDateValue(b);

      return dateB - dateA;
    });
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
  const [currentGlobalBillId, setCurrentGlobalBillId] = useState<string | null>(null);

  const [calculatorItems, setCalculatorItems] = useState([]);

  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const { paginated, goTo, results, currentPage } = usePagination(lineItems || [], currentPageSize);
  const { pageSizes } = usePaginationInfo(pageSize, lineItems?.length || 0, currentPage, results?.length || 0);

  const paidLineItems = useMemo(() => lineItems?.filter((item) => item?.paymentStatus === 'PAID') ?? [], [lineItems]);
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const isTablet = layout === 'tablet';
  const isDesktopLayout = layout === 'small-desktop' || layout === 'large-desktop';

  const [selectedLineItems, setSelectedLineItems] = useState(paidLineItems ?? []);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);

  const filteredLineItems = useMemo(() => {
    if (!debouncedSearchTerm) {
      return results || [];
    }

    return debouncedSearchTerm
      ? fuzzy
          .filter(debouncedSearchTerm, results || [], {
            extract: (lineItem: any) =>
              `${lineItem?.item || ''} ${lineItem?.globalBillId || ''} ${lineItem?.billIdentifier || ''}`,
          })
          .sort((r1, r2) => r1.score - r2.score)
          .map((result) => result.original)
      : results || [];
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
        ?.map((item, index) => {
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

  const handleRowExpand = (row) => {
    setExpandedRowId(expandedRowId === row.id ? null : row.id);
  };

  const createNewInvoice = useCallback(
    (globalBillId: string) => {
      const currentBill = lineItems.find((item) => item.globalBillId?.toString() === globalBillId.toString());
      const isGlobalBillClosed = currentBill?.paymentStatus === 'PAID';

      if (isGlobalBillClosed) {
        showToast({
          title: t('closedBill', 'Closed Bill'),
          description: t('cannotAddToClosedBill', 'Cannot add items to a closed bill'),
          kind: 'error',
        });
        return;
      }

      setCurrentGlobalBillId(globalBillId.toString());
      setIsCalculatorOpen(true);
      setCalculatorItems([]);
    },
    [lineItems, t],
  );

  const handleCalculatorClose = useCallback(() => {
    setIsCalculatorOpen(false);
    setIsSaving(false);
    setCurrentGlobalBillId(null);
  }, []);

  const consommationListRef = React.useRef(null);

  const handleCalculatorSave = useCallback(async () => {
    if (!calculatorItems || calculatorItems.length === 0) {
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setShowError(false);

    try {
      const globalBillId = currentGlobalBillId;

      if (!globalBillId) {
        throw new Error('No global bill ID found. Please create a global bill first.');
      }
      let policyNumber = insuranceCardNo;
      if (!policyNumber) {
        if (patientUuid) {
          const policies = await getInsurancePoliciesByPatient(patientUuid);
          if (policies.length > 0 && policies[0].insuranceCardNo) {
            policyNumber = policies[0].insuranceCardNo;
          }
        }
      }

      let beneficiaryId;
      if (policyNumber) {
        beneficiaryId = await findBeneficiaryByPolicyNumber(policyNumber);
      }

      if (!beneficiaryId) {
        throw new Error('Could not determine beneficiary ID. Please verify patient insurance details.');
      }
      const itemsByDepartment = {};

      calculatorItems.forEach((item) => {
        if (!itemsByDepartment[item.departmentId]) {
          itemsByDepartment[item.departmentId] = {
            departmentId: item.departmentId,
            departmentName: item.departmentName,
            items: [],
          };
        }

        let serviceIdForPayload;

        if (item.billableServiceId) {
          serviceIdForPayload = item.billableServiceId;
        } else if (item.originalData?.serviceId) {
          serviceIdForPayload = item.originalData.serviceId;
        } else if (item.facilityServicePriceId) {
          serviceIdForPayload = item.facilityServicePriceId;
        } else {
          serviceIdForPayload = item.serviceId;
        }

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
      let errors = [];

      for (const deptId in itemsByDepartment) {
        const dept = itemsByDepartment[deptId];
        const deptIdNumber = parseInt(deptId, 10);

        if (isNaN(deptIdNumber)) {
          console.warn(`Skipping department with invalid ID: ${deptId}`);
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
              console.warn(
                `Note: All ${expectedItems} items were saved in the database, but only ${actualItems} were returned in the response. This is due to an API limitation.`,
              );
            }
          } else {
            throw new Error('Unexpected response format');
          }
        } catch (error) {
          const errorMsg = `Failed to create consommation for department ${dept.departmentName}: ${error.message}`;
          console.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      // Process results
      if (successCount === 0) {
        // If we have detailed errors, show them
        if (errors.length > 0) {
          throw new Error(`Failed to create consommations: ${errors.join('. ')}`);
        } else {
          throw new Error(`Failed to create any consommations. Please check the console for details.`);
        }
      } else {
        // Even if there were some errors, show success for those that worked
        const successMessage =
          totalItemsCreated === 1 ? `Added 1 item to the bill.` : `Added ${totalItemsCreated} items to the bill.`;

        let finalMessage = successMessage;

        // If there were partial errors, add a warning
        if (errors.length > 0) {
          finalMessage += ` Note: Some items could not be added. Please check the console for details.`;
        }

        showToast({
          title: t('itemsAdded', 'Items Added'),
          description: finalMessage,
          kind: errors.length > 0 ? 'warning' : 'success',
        });

        // Refresh data and close modal
        mutate();
        setIsCalculatorOpen(false);
        setCurrentGlobalBillId(null);

        // Mutate the embedded consommations list if it exists
        if (consommationListRef.current?.mutate) {
          await consommationListRef.current.mutate();
        }
      }
    } catch (error) {
      console.error('Error saving bill items:', error);
      const errorMessage = typeof error === 'string' ? error : error.message || 'Failed to save bill items';

      setErrorMessage(errorMessage);
      setShowError(true);
    } finally {
      setIsSaving(false);
    }
  }, [calculatorItems, currentGlobalBillId, patientUuid, insuranceCardNo, mutate, t]);

  const handleCalculatorUpdate = useCallback((items) => {
    setCalculatorItems(items);
  }, []);

  const renderConsommationsTable = (globalBillId) => {
    const currentBill = lineItems.find((item) => item.globalBillId?.toString() === globalBillId?.toString());
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

  if (!patientUuid && !insuranceCardNo) {
    return (
      <div className={styles.errorContainer}>
        <InlineNotification
          kind="warning"
          title={t('missingIdentifier', 'Missing Identifier')}
          subtitle={t(
            'identifierRequired',
            'Either Patient UUID or Insurance Card Number is required to fetch billing data',
          )}
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

  const getPolicyIdFromFirstBill = (): string | undefined => {
    if (lineItems && lineItems.length > 0 && lineItems[0]) {
      return lineItems[0].policyId || '';
    }
    return insuranceCardNo;
  };

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('globalBillList', 'Global Bill List')}>
        <span>{isValidating ? <InlineLoading /> : null}</span>
      </CardHeader>

      {(patientUuid || insuranceCardNo) && (
        <div className={styles.insuranceInfoContainer}>
          <GlobalBillHeader
            patientUuid={patientUuid || undefined}
            insuranceCardNo={getPolicyIdFromFirstBill() || undefined}
          />
        </div>
      )}

      <div className={styles.tableContainer}>
        <DataTable headers={tableHeaders} isSortable rows={tableRows} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
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
                      <TableHeader
                        className={styles.tableHeader}
                        {...getHeaderProps({
                          header,
                        })}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <TableExpandRow
                        {...getRowProps({ row })}
                        isExpanded={expandedRowId === row.id}
                        onExpand={() => handleRowExpand(row)}
                      >
                        {row.cells.map((cell) => {
                          // Determine appropriate class for this cell
                          const cellClassName = `${cell.info.header === 'billIdentifier' ? styles.colBillId : ''} ${
                            cell.info.header === 'globalBillId' ? styles.colGlobalBillId : ''
                          } ${cell.info.header === 'date' ? styles.colDate : ''} ${
                            cell.info.header === 'createdBy' ? styles.colCreatedBy : ''
                          } ${cell.info.header === 'policyId' ? styles.colBillId : ''} ${
                            cell.info.header === 'admissionDate' ? styles.colAdmissionDate : ''
                          } ${cell.info.header === 'dischargeDate' ? styles.colDischargeDate : ''} ${
                            cell.info.header === 'patientDueAmount' ? styles.colAmount : ''
                          } ${cell.info.header === 'paidAmount' ? styles.colPaid : ''} ${
                            cell.info.header === 'paymentStatus' ? styles.colStatus : ''
                          }`.trim();

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

        {filteredLineItems?.length === 0 && lineItems.length > 0 && (
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

      {/* Calculator Modal */}
      {isCalculatorOpen && currentGlobalBillId && (
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
