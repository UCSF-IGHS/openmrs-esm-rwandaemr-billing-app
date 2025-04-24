import React, { useCallback, useMemo, useState } from 'react';
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
  type DataTableRow,
} from '@carbon/react';
import { isDesktop, useConfig, useDebounce, useLayoutType, usePatient, usePagination, showToast } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import styles from './invoice-table.scss';
import { usePatientBill, useInsuranceCardBill } from './invoice.resource';
import GlobalBillHeader from '.././bill-list/global-bill-list.component';
import EmbeddedConsommationsList from '../consommation/embedded-consommations-list.component';
import ServiceCalculator from './service-calculator.component';
import { createBillItems, createDirectConsommation } from '../api/billing';

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
  const [currentGlobalBillId, setCurrentGlobalBillId] = useState<string | null>(null);
  
  // State for calculator items
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

  const createNewInvoice = useCallback((globalBillId: string) => {
    const currentBill = lineItems.find(item => item.globalBillId?.toString() === globalBillId.toString());
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
  }, [lineItems, t]);
  
  const handleCalculatorClose = useCallback(() => {
    setIsCalculatorOpen(false);
    setIsSaving(false);
    setCurrentGlobalBillId(null);
  }, []);
  
  const handleCalculatorSave = useCallback(async () => {
    if (!calculatorItems || calculatorItems.length === 0) {
      return;
    }
    
    setIsSaving(true);
    setErrorMessage('');
    setShowError(false);
    
    try {
      const itemsByDepartment: Record<string, any> = {};
      
      calculatorItems.forEach(item => {
        if (!itemsByDepartment[item.departmentId]) {
          itemsByDepartment[item.departmentId] = {
            departmentId: item.departmentId,
            departmentName: item.departmentName,
            items: []
          };
        }
        
        itemsByDepartment[item.departmentId].items.push({
          serviceId: item.serviceId,
          quantity: item.quantity,
          price: item.price,
          drugFrequency: item.drugFrequency || ""
        });
      });
      
      const globalBillId = currentGlobalBillId;
      
      if (!globalBillId) {
        throw new Error("No global bill ID found. Please create a global bill first.");
      }

      const globalBillIdNumber = parseInt(globalBillId, 10);
      
      if (isNaN(globalBillIdNumber)) {
        throw new Error("Invalid global bill ID format. Expected a number.");
      }
      
      let successCount = 0;
      let totalItemsCreated = 0;
      
      for (const deptId in itemsByDepartment) {
        const dept = itemsByDepartment[deptId];
        const deptIdNumber = parseInt(deptId, 10);
        
        try {
          try {
            const result = await createDirectConsommation(
              globalBillIdNumber, 
              deptIdNumber, 
              dept.items
            );
            
            if (result.success) {
              totalItemsCreated += result.count;
              successCount++;
              continue;
            }
          } catch (directError) {
            console.error(`Direct consommation creation failed:`, directError);
          }
          
          const result = await createBillItems(
            globalBillIdNumber, 
            deptIdNumber, 
            dept.items
          );
          
          if (result.success) {
            totalItemsCreated += result.count;
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to create billing items for department ${dept.departmentName}:`, error);
        }
      }
      
      if (successCount === 0) {
        throw new Error(`Failed to create any billing items. Please check the console for details.`);
      } else {
        const successMessage = totalItemsCreated === 1 
          ? `Added 1 item to the bill.` 
          : `Added ${totalItemsCreated} items to the bill.`;
        
        showToast({
          title: t('itemsAdded', 'Items Added'),
          description: successMessage,
          kind: 'success',
        });
      }
      mutate();
      setIsCalculatorOpen(false);
      setCurrentGlobalBillId(null);
    } catch (error) {
      console.error('Error saving bill items:', error);
      setErrorMessage(typeof error === 'string' ? error : error.message || 'Failed to save bill items');
      setShowError(true);
    } finally {
      setIsSaving(false);
    }
  }, [calculatorItems, currentGlobalBillId, mutate, setErrorMessage, setShowError, t]);
  
  const handleCalculatorUpdate = useCallback((items) => {
    setCalculatorItems(items);
  }, []);

  const renderConsommationsTable = (globalBillId) => {
    // Find the corresponding lineItem to check its status
    const currentBill = lineItems.find(item => item.globalBillId?.toString() === globalBillId?.toString());
    const isGlobalBillClosed = currentBill?.paymentStatus === 'PAID';
    
    return (
      <div className={styles.expandedContent}>
        <EmbeddedConsommationsList 
          globalBillId={globalBillId.toString()} 
          patientUuid={patientUuid} 
          insuranceCardNo={insuranceCardNo} 
          onConsommationClick={() => {
            // Function intentionally left empty
          }}
          onAddNewInvoice={createNewInvoice}
          isGlobalBillClosed={isGlobalBillClosed}
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
        launchForm={() => {}}
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
