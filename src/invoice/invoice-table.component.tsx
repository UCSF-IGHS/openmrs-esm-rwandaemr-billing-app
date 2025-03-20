import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import fuzzy from 'fuzzy';
import { getBillableServiceById } from '../api/billing';
import {
  Button,
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
  TableSelectRow,
  TableToolbarSearch,
  Tile,
  InlineNotification,
  InlineLoading,
  Pagination,
  Modal,
  type DataTableRow,
} from '@carbon/react';
import { AddIcon, isDesktop, useConfig, useDebounce, useLayoutType, usePatient, usePagination, showNotification, showToast, openmrsFetch } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import styles from './invoice-table.scss';
import { usePatientBill, useInsuranceCardBill } from './invoice.resource';
import GlobalBillHeader from '.././bill-list/global-bill-list.component';
import EmbeddedConsommationsList from '../consommation/embedded-consommations-list.component';
import ServiceCalculator from './service-calculator.component';
import { createBillItems, createConsommation, type GlobalBillResponse, type GlobalBill, getGlobalBills, fetchGlobalBillsByPatient, getBeneficiaryByPolicyNumber } from '../api/billing';


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
  
  const lineItems = useMemo(() => 
    usePatientData ? patientBillResponse.bills : 
    useInsuranceData ? insuranceBillResponse.bills : [],
  [usePatientData, patientBillResponse.bills, useInsuranceData, insuranceBillResponse.bills]);
  
  const isLoading = usePatientData ? patientBillResponse.isLoading : 
                   useInsuranceData ? insuranceBillResponse.isLoading : false;
  const error = usePatientData ? patientBillResponse.error : 
               useInsuranceData ? insuranceBillResponse.error : null;
  const isValidating = usePatientData ? patientBillResponse.isValidating : 
                      useInsuranceData ? insuranceBillResponse.isValidating : false;
  const mutate = useMemo(() => 
    usePatientData ? patientBillResponse.mutate : 
    useInsuranceData ? insuranceBillResponse.mutate : () => {},
  [usePatientData, patientBillResponse.mutate, useInsuranceData, insuranceBillResponse.mutate]);
  
  // State for calculator modal
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // State for calculator items - using direct state instead of ref
  const [calculatorItems, setCalculatorItems] = useState([]);
  
  // Pagination setup
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
  const BASE_API_URL = '/ws/rest/v1/mohbilling';


  const filteredLineItems = useMemo(() => {
    if (!debouncedSearchTerm) {
      return results || [];
    }

    return debouncedSearchTerm
      ? fuzzy
          .filter(debouncedSearchTerm, results || [], {
            extract: (lineItem: any) => `${lineItem?.item || ''} ${lineItem?.globalBillId || ''} ${lineItem?.billIdentifier || ''}`,
          })
          .sort((r1, r2) => r1.score - r2.score)
          .map((result) => result.original)
      : results || [];
  }, [debouncedSearchTerm, results]);

  const tableHeaders = [
    { key: 'no', header: t('no', 'No') },
    { key: 'globalBillId', header: t('globalBillId', 'Global Bill ID') },
    { key: 'date', header: t('dateOfBill', 'Date of Bill') },
    { key: 'createdBy', header: t('createdBy', 'Created by') },
    { key: 'policyId', header: t('policyId', 'Policy ID') },
    { key: 'admissionDate', header: t('admissionDate', 'Admission Date') },
    { key: 'dischargeDate', header: t('dischargeDate', 'Discharge Date') },
    { key: 'billIdentifier', header: t('billIdentifier', 'Bill ID') }, 
    { key: 'patientDueAmount', header: t('patientDueAmount', 'Due Amount') }, 
    { key: 'paidAmount', header: t('paidAmount', 'Paid') }, 
    { key: 'paymentStatus', header: t('paymentStatus', 'Status') }
  ];

  const tableRows: Array<typeof DataTableRow> = useMemo(
    () =>
      (filteredLineItems || [])?.map((item, index) => {
        if (!item) return null;
        return {
          no: `${index + 1}`,
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
          paymentStatus: item.paymentStatus || ''
        };
      }).filter(Boolean) ?? [],
    [filteredLineItems],
  );

  const handleRowSelection = (row: typeof DataTableRow, checked: boolean) => {
    const matchingRow = filteredLineItems?.find((item) => item?.uuid === row.id);
    let newSelectedLineItems;

    if (checked && matchingRow) {
      newSelectedLineItems = [...selectedLineItems, matchingRow];
    } else {
      newSelectedLineItems = selectedLineItems.filter((item) => item?.uuid !== row.id);
    }
    setSelectedLineItems(newSelectedLineItems);
  };

  const handleRowExpand = (row) => {
    setExpandedRowId(expandedRowId === row.id ? null : row.id);
  };

  const createNewInvoice = useCallback(() => {
    setIsCalculatorOpen(true);
    setCalculatorItems([]);
  }, []);
  
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
      // Validate calculator items and fetch missing billableServiceId
      const invalidItems = [];
      for (let i = 0; i < calculatorItems.length; i++) {
        const item = calculatorItems[i];
        if (!item.billableServiceId) {
          try {
            const billableService = await getBillableServiceById(item.billableServiceId || item.facilityServicePriceId);
            if (billableService?.serviceId) {
              item.billableServiceId = billableService.serviceId;
            } else {
              console.error('Failed to fetch billableServiceId for item:', item);
              invalidItems.push(item);
            }
          } catch (fetchError) {
            console.error('Error fetching billableServiceId for item:', item, fetchError);
            invalidItems.push(item);
          }
        } else if (!item.facilityServicePriceId || !item.departmentId || !item.quantity || !item.price) {
          invalidItems.push(item);
        }
      }

      if (invalidItems.length > 0) {
        console.error('Invalid items:', invalidItems);
        throw new Error('Some bill items are missing required information');
      }
  
      // Log the calculator items for debugging
      console.log('Calculator items to save:', calculatorItems);
  
      // Fetch global bills for the current patient
      const globalBillsResponse = await fetchGlobalBillsByPatient(patientUuid);
      
      if (!globalBillsResponse || !globalBillsResponse.results) {
        throw new Error('Failed to fetch global bills for the patient');
      }
      
      const globalBills = globalBillsResponse.results;
  
      // Find the most recent open global bill
      const mostRecentOpenBill = globalBills.find((bill) => !bill.closed);
  
      if (!mostRecentOpenBill) {
        throw new Error('No open global bill found. Please create a new global bill first.');
      }
  
      const globalBillId = mostRecentOpenBill.globalBillId;
      
      if (!globalBillId) {
        throw new Error('Invalid global bill ID found');
      }
      
      // Extract insurance policy number
      let insurancePolicyNumber = null;
      if (mostRecentOpenBill.admission && 
          mostRecentOpenBill.admission.insurancePolicy && 
          mostRecentOpenBill.admission.insurancePolicy.insuranceCardNo) {
        insurancePolicyNumber = mostRecentOpenBill.admission.insurancePolicy.insuranceCardNo;
      } else {
        throw new Error('Could not find insurance policy number in the global bill');
      }
      
      // Get beneficiary ID
      const beneficiaryId = await getBeneficiaryByPolicyNumber(insurancePolicyNumber);
      
      if (!beneficiaryId) {
        throw new Error(`Could not find beneficiary for insurance policy: ${insurancePolicyNumber}`);
      }
  
      // Group items by department
      const itemsByDepartment: Record<string, any> = {};
  
      calculatorItems.forEach((item) => {
        if (!itemsByDepartment[item.departmentId]) {
          itemsByDepartment[item.departmentId] = {
            departmentId: item.departmentId,
            departmentName: item.departmentName || 'Unknown Department',
            items: [],
          };
        }
  
        // Ensure billableServiceId is used correctly
        if (!item.billableServiceId) {
          console.error('Missing billableServiceId for item:', item);
          throw new Error(`Missing billableServiceId for item: ${item.name}`);
        }
  
        itemsByDepartment[item.departmentId].items.push({
          facilityServicePriceId: item.facilityServicePriceId,
          quantity: item.quantity,
          price: item.price,
          drugFrequency: item.drugFrequency || '',
          service: {
            serviceId: item.billableServiceId || item.facilityServicePriceId,
            name: item.name,
            displayName: item.name,
            description: item.description || '',
          },
        });
        console.log('Mapped serviceId:', item.billableServiceId || item.facilityServicePriceId);
      });
  
      console.log('Items by department:', itemsByDepartment);
  
      // Create bill items for each department
      const results = [];
      for (const deptId in itemsByDepartment) {
        const dept = itemsByDepartment[deptId];
        try {
          console.log(`Creating bill items for department ${deptId}:`, dept.items);
          
          const result = await createBillItems(globalBillId, parseInt(deptId), dept.items, beneficiaryId);
          results.push(result);
          
          console.log(`Successfully created bill items for department ${deptId}:`, result);
        } catch (deptError) {
          console.error(`Error creating bill items for department ${deptId}:`, deptError);
          
          const errorDetails = dept.items.map(item => 
            `Service: ${item.service.serviceId}, Quantity: ${item.quantity}`
          ).join('; ');
          
          throw new Error(`Failed to create items for ${dept.departmentName}: ${errorDetails} - ${deptError.message}`);
        }
      }
  
      // Show success message
      showToast({
        kind: 'success',
        title: t('itemsAdded', 'Items Added'),
        description: t('billItemsCreatedSuccessfully', 'Bill items created successfully')
      });
      
      // Refresh the data
      mutate();
      setIsCalculatorOpen(false);
    } catch (error) {
      console.error('Error saving bill items:', error);
      
      let errorMsg = 'Failed to save bill items';
      if (error.message) {
        errorMsg = error.message;
      } else if (error.response && error.response.data && error.response.data.error) {
        errorMsg = error.response.data.error.message || errorMsg;
      }
      
      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setIsSaving(false);
    }
  }, [calculatorItems, patientUuid, mutate, t, showToast, getBeneficiaryByPolicyNumber, createBillItems]);
  
  const handleCalculatorUpdate = useCallback((items) => {
    setCalculatorItems(items);
  }, []);

  const renderConsommationsTable = (globalBillId) => {
    return (
      <div className={styles.expandedContent}>
        <EmbeddedConsommationsList 
          globalBillId={globalBillId} 
          patientUuid={patientUuid} 
          insuranceCardNo={insuranceCardNo} 
          onConsommationClick={() => {
            // Function intentionally left empty
          }}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <DataTableSkeleton 
        role="progressbar" 
        compact={isDesktopLayout} 
        zebra 
        headers={tableHeaders}
      />
    );
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
          subtitle={t('identifierRequired', 'Either Patient UUID or Insurance Card Number is required to fetch billing data')}
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
        launchForm={createNewInvoice}
      />
    );
  }

  // Determine if we should get the policyId (insuranceCardNo) from the first bill
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
        <Button
          kind="ghost"
          renderIcon={(props) => <AddIcon size={16} {...props} />}
          iconDescription={t('addInvoice', 'Add invoice')}
          onClick={createNewInvoice}
        >
          {t('add', 'Add Item')}
        </Button>
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
                light
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
                          isSortable: header.isSortable,
                        })}
                      >
                        {header.header?.content ?? header.header}
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
                        {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={cell.info.header === 'billIdentifier' ? styles.colBillId : ''}>
                          {cell.value?.content ?? cell.value}
                        </TableCell>
                        ))}
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

      {/* Calculator Modal for when there are existing items */}
      {isCalculatorOpen && lineItems.length > 0 && (
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
