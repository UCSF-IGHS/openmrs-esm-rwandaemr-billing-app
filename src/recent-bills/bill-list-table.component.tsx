import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Pagination,
  Search,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Tile,
  Layer,
  DefinitionTooltip // Changed from TooltipDefinition to DefinitionTooltip
} from '@carbon/react';
import { isDesktop, useLayoutType, usePagination, ErrorState } from '@openmrs/esm-framework';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import { getPatientBills, getConsommationsByGlobalBillId, getConsommationById, getConsommationItems } from '../api/billing';
import { ConsommationListResponse } from '../types';
import styles from './bill-list-table.scss';

const BillListTable: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  
  // State for data fetching and management
  const [bills, setBills] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filtering and searching
  const [billPaymentStatus, setBillPaymentStatus] = useState('');
  const [searchString, setSearchString] = useState('');
  const [searchCategory, setSearchCategory] = useState('policyId');
  
  // Pagination configuration
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  // Date range for fetching bills - default to showing recent bills (last 60 days)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Fetch bills from the API
  useEffect(() => {
    const fetchBills = async () => {
      try {
        setIsLoading(true);
        const response = await getPatientBills(startDate, endDate, 0, 100);
        
        // Set default values for any missing fields
        const billsWithDefaults = response.results.map(bill => ({
          ...bill,
          beneficiaryName: bill.beneficiaryName || '--',
          policyIdNumber: bill.policyIdNumber || '--',
          insuranceName: bill.insuranceName || '--',
          creator: bill.creator || '--'
        }));
        
        setBills(billsWithDefaults);
        setTotalItems(response.results?.length || 0);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };
    
    fetchBills();
  }, [startDate, endDate]);

  // Additional data processing - try to get missing fields for each bill using existing endpoints
  useEffect(() => {
    const fetchDetailsForBills = async () => {
      if (!bills.length || isLoading) return;
      
      try {
        // Create a copy of the bills to update
        const enrichedBills = [...bills];
        
        // Process bills in batches to avoid overwhelming the server
        for (let i = 0; i < Math.min(enrichedBills.length, 10); i++) {
          const bill = enrichedBills[i];
          
          try {
            // Try to find a consommation associated with this bill
            try {
              const consommation = await getConsommationById(bill.patientBillId.toString());
              
              if (consommation && consommation.patientBill) {
                // Extract the data we need from the consommation object
                bill.beneficiaryName = consommation.patientBill.beneficiaryName || '--';
                bill.policyIdNumber = consommation.patientBill.policyIdNumber || '--';
                bill.insuranceName = consommation.patientBill.insuranceName || '--';
                bill.departmentName = consommation.department?.name || '--';
                
                // Get the consommation items to display the service names
                if (consommation.billItems && consommation.billItems.length > 0) {
                  try {
                    const items = await getConsommationItems(bill.patientBillId.toString());
                    
                    if (items && items.length > 0) {
                      // Store the service item names in the bill object with all detailed information
                      bill.serviceItems = items.map(item => ({
                        name: item.itemName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total
                      }));
                      
                      // Create a summary of all service items
                      bill.serviceItemsSummary = items.map(item => item.itemName)
                        .filter((name, index, self) => self.indexOf(name) === index) // Deduplicate
                        .slice(0, 3) // Take only first 3 items
                        .join(', ') + 
                        (items.length > 3 ? ` + ${items.length - 3} more` : '');
                    }
                  } catch (error) {
                    console.debug(`Error fetching consommation items for bill ${bill.patientBillId}`, error);
                  }
                }
              }
            } catch (error) {
              console.debug(`Could not find consommation for bill ${bill.patientBillId}`, error);
              // If that fails, we'll just leave the placeholders
              bill.beneficiaryName = bill.beneficiaryName || '--';
              bill.policyIdNumber = bill.policyIdNumber || '--';
              bill.insuranceName = bill.insuranceName || '--';
            }
          } catch (error) {
            console.error(`Error fetching details for bill ${bill.patientBillId}:`, error);
          }
        }
        
        setBills(enrichedBills);
      } catch (error) {
        console.error('Error enriching bills data:', error);
      }
    };
    
    fetchDetailsForBills();
  }, [bills.length, isLoading]);

  // Helper function to determine payment status
  const getBillStatus = (bill: any) => {
    // If there are payments, check if total paid equals or exceeds the amount
    if (bill.payments && bill.payments.length > 0) {
      const totalPaid = bill.payments.reduce((sum, payment) => sum + (payment.amountPaid || 0), 0);
      return totalPaid >= bill.amount ? 'PAID' : 'PENDING';
    }
    // No payments means pending
    return 'PENDING';
  };

  // Filter and search logic
  const filteredBills = React.useMemo(() => {
    if (!bills?.length) return bills;

    return bills
      .filter((bill) => {
        // Determine bill status
        const billStatus = getBillStatus(bill);
        
        // Status filtering
        const statusMatch = billPaymentStatus === '' ? true : billStatus === billPaymentStatus;
        
        // Search filtering based on selected category
        let searchMatch = true;
        
        if (searchString) {
          const lowerSearchString = searchString.toLowerCase();
          
          switch (searchCategory) {
            case 'beneficiary':
              searchMatch = bill.beneficiaryName?.toLowerCase().includes(lowerSearchString);
              break;
            case 'insuranceName':
              searchMatch = bill.insuranceName?.toLowerCase().includes(lowerSearchString);
              break;
            case 'policyId':
              searchMatch = bill.policyIdNumber?.toLowerCase().includes(lowerSearchString);
              break;
            default:
              searchMatch = 
                bill.beneficiaryName?.toLowerCase().includes(lowerSearchString) ||
                bill.insuranceName?.toLowerCase().includes(lowerSearchString) ||
                bill.policyIdNumber?.toLowerCase().includes(lowerSearchString);
              break;
          }
        }

        return statusMatch && searchMatch;
      });
  }, [bills, searchString, billPaymentStatus, searchCategory]);

  // Pagination logic
  const { paginated, goTo, results, currentPage } = usePagination(filteredBills, pageSize);

  // Format date for display
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '--';
    try {
      const date = new Date(dateString);
      return `${date.getDate()}-${getMonthShortName(date.getMonth())}-${date.getFullYear()}`;
    } catch (e) {
      return dateString;
    }
  };

  // Helper to get short month name
  const getMonthShortName = (monthIndex: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
  };

  // Table headers
  const headerData = [
    {
      header: t('date', 'Date'),
      key: 'date'
    },
    {
      header: t('policyId', 'Policy ID'),
      key: 'policyId'
    },
    {
      header: t('beneficiary', 'Beneficiary'),
      key: 'beneficiary'
    },
    {
      header: t('insuranceName', 'Insurance Name'),
      key: 'insuranceName'
    },
    {
      header: t('billedItems', 'Billed Items'),
      key: 'billedItems'
    },
    {
      header: t('total', 'Total'),
      key: 'total'
    },
    {
      header: t('patientDue', 'Patient Due'),
      key: 'patientDue'
    },
    {
      header: t('paidAmount', 'Paid Amount'),
      key: 'paidAmount'
    },
    {
      header: t('billStatus', 'Bill Status'),
      key: 'billStatus'
    },
    {
      header: t('refId', 'Ref ID'),
      key: 'refId'
    },
    // Hidden column to carry the original bill data for reference
    {
      header: '',
      key: 'originalBill',
      hidden: true
    }
  ];

  // Filter dropdown options
  const filterItems = [
    { id: '', text: t('allBills', 'All bills') },
    { id: 'PAID', text: t('paidBills', 'Paid bills') },
    { id: 'PENDING', text: t('pendingBills', 'Pending bills') },
  ];

  // Search categories dropdown options
  const searchCategories = [
    { id: 'policyId', text: t('policyId', 'Policy ID') },
    { id: 'beneficiary', text: t('beneficiaryName', 'Beneficiary name') },
    { id: 'insuranceName', text: t('insuranceName', 'Insurance name') }
  ];

  // Prepare row data for the table
  const rowData = results?.map((bill, index) => {
    // Calculate total paid amount
    const totalPaid = bill.payments?.reduce((sum, payment) => sum + (payment.amountPaid || 0), 0) || 0;
    
    // Determine payment status
    const status = getBillStatus(bill);
    
    // Format service names for display - prefer detailed item names from getConsommationItems
    const billItems = bill.serviceItemsSummary || bill.departmentName || 'Medical Services';
    
    return {
      id: `${index}`,
      date: formatDateDisplay(bill.createdDate),
      policyId: bill.policyIdNumber || '--',
      beneficiary: bill.beneficiaryName || '--',
      insuranceName: bill.insuranceName || '--',
      total: bill.amount ? bill.amount.toFixed(2) : '0.00',
      patientDue: bill.amount ? bill.amount.toFixed(2) : '0.00',
      paidAmount: totalPaid.toFixed(2),
      billStatus: status,
      refId: bill.patientBillId?.toString() || '--',
      billedItems: billItems,
      // Store the original bill for reference in the table cells
      originalBill: bill
    };
  });

  // Event handlers
  const handleSearch = useCallback(
    (e) => {
      goTo(1); // Reset to first page when search changes
      setSearchString(e.target.value);
    },
    [goTo],
  );

  const handleFilterChange = useCallback(
    ({ selectedItem }) => {
      setBillPaymentStatus(selectedItem.id);
      goTo(1); // Reset to first page when filter changes
    },
    [goTo],
  );

  const handleSearchCategoryChange = useCallback(
    ({ selectedItem }) => {
      setSearchCategory(selectedItem.id);
      if (searchString) {
        goTo(1); // Reset to first page when search category changes
      }
    },
    [goTo, searchString],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <DataTableSkeleton
          rowCount={pageSize}
          showHeader={false}
          showToolbar={false}
          zebra
          columnCount={headerData?.length}
          size={responsiveSize}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Layer>
          <ErrorState error={error} headerTitle={t('recentBills', 'Recent Bills')} />
        </Layer>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header with "Recent Bills" */}
      <div className={styles.desktopHeading}>
        <h4>{t('recentBills', 'Recent Bills')}</h4>
      </div>

      <div className={styles.billHistoryContainer}>
        {/* Filter and search controls */}
        <div className={styles.controlsContainer}>
          <div className={styles.filterContainer}>
            <span className={styles.filterByLabel}>{t('filterBy', 'Filter by')}:</span>
            <Dropdown
              className={styles.filterDropdown}
              direction="bottom"
              id="filter-dropdown"
              initialSelectedItem={filterItems[0]}
              items={filterItems}
              itemToString={(item) => (item ? item.text : '')}
              onChange={handleFilterChange}
              size={responsiveSize}
              type="inline"
              titleText=""
              label=""
            />
          </div>
          
          <div className={styles.searchContainer}>
            <span className={styles.searchInLabel}>{t('searchIn', 'Search in')}:</span>
            <Dropdown
              className={styles.searchCategoryDropdown}
              direction="bottom"
              id="search-category-dropdown"
              initialSelectedItem={searchCategories[0]}
              items={searchCategories}
              itemToString={(item) => (item ? item.text : '')}
              onChange={handleSearchCategoryChange}
              size={responsiveSize}
              type="inline"
              titleText=""
              label=""
            />
            
            <Search
              className={styles.searchInput}
              id="bill-search"
              labelText=""
              placeholder={t('searchBills', 'Search bills')}
              onChange={handleSearch}
              size={responsiveSize}
            />
          </div>
        </div>

        {filteredBills?.length > 0 ? (
          <>
            {/* Data table */}
            <DataTable
              rows={rowData}
              headers={headerData}
              size="sm"
              useZebraStyles
              isSortable={false}
              overflowMenuOnHover={false}
              className={styles.dataTable}
            >
              {({
                rows,
                headers,
                getTableProps,
                getTableContainerProps,
                getHeaderProps,
                getRowProps,
              }) => (
                <TableContainer {...getTableContainerProps()}>
                  <Table className={styles.table} {...getTableProps()} aria-label="Recent bills">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader
                            key={header.key}
                            {...getHeaderProps({
                              header
                            })}
                            className={header.key === 'date' || header.key === 'refId' ? styles.specialPadding : ''}
                          >
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id} {...getRowProps({ row })}>
                          {row.cells.map((cell) => {
                            // Special handling for date column
                            if (cell.info.header === 'date') {
                              return (
                                <TableCell key={cell.id} className={`${styles.tableCells} ${styles.dateCell}`}>
                                  {cell.value}
                                </TableCell>
                              );
                            }
                            
                            // Special handling for ref ID column
                            if (cell.info.header === 'refId') {
                              return (
                                <TableCell key={cell.id} className={`${styles.tableCells} ${styles.refIdCell}`}>
                                  {cell.value}
                                </TableCell>
                              );
                            }
                            
                            // Special handling for billed items column
                            if (cell.info.header === 'billedItems') {
                              // Get the original bill to access full service item details
                              const originalBill = row.cells.find(c => c.info.header === 'originalBill')?.value;
                              
                              if (originalBill && originalBill.serviceItems && originalBill.serviceItems.length > 0) {
                                // Create a detailed tooltip with item name, quantity, and price
                                const tooltipContent = originalBill.serviceItems.map(item => 
                                  `${item.name} (${item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)})`
                                ).join('\n');
                                
                                return (
                                  <TableCell key={cell.id} className={styles.tableCells}>
                                    <DefinitionTooltip
                                      align="center"
                                      direction="bottom"
                                      tooltipText={tooltipContent}
                                    >
                                      {cell.value}
                                    </DefinitionTooltip>
                                  </TableCell>
                                );
                              }
                              
                              // Default display if no detailed items available
                              return (
                                <TableCell key={cell.id} className={styles.tableCells}>
                                  {cell.value}
                                </TableCell>
                              );
                            }
                            // Special handling for bill status column
                            if (cell.info.header === 'billStatus') {
                              // Add status styling for bill status column
                              const statusClass = cell.value === 'PAID' ? styles.paidStatus : styles.pendingStatus;
                              return (
                                <TableCell key={cell.id} className={styles.tableCells}>
                                  <span className={statusClass}>{cell.value}</span>
                                </TableCell>
                              );
                            }
                            
                            // Skip rendering the original bill cell
                            if (cell.info.header === 'originalBill') {
                              return null;
                            }
                            
                            // Default rendering for other columns
                            return (
                              <TableCell key={cell.id} className={styles.tableCells}>
                                {cell.value}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>

            {/* Empty state for when search returns no results */}
            {filteredBills?.length === 0 && (
              <div className={styles.filterEmptyState}>
                <Layer level={0}>
                  <Tile className={styles.filterEmptyStateTile}>
                    <p className={styles.filterEmptyStateContent}>
                      {t('noMatchingBillsToDisplay', 'No matching bills to display')}
                    </p>
                    <p className={styles.filterEmptyStateHelper}>{t('checkFilters', 'Check the filters above')}</p>
                  </Tile>
                </Layer>
              </div>
            )}

            {/* Pagination - Use Carbon's built-in pagination only, removing duplicated controls */}
            {paginated && (
              <div className={styles.paginationContainer}>
                <Pagination
                  forwardText={t('nextPage', 'Next page')}
                  backwardText={t('previousPage', 'Previous page')}
                  page={currentPage}
                  pageSize={pageSize}
                  pageSizes={[10, 20, 30, 40, 50]}
                  totalItems={filteredBills?.length}
                  className={styles.pagination}
                  size="sm"
                  onChange={({ page, pageSize: newPageSize }) => {
                    if (newPageSize !== pageSize) {
                      setPageSize(newPageSize);
                    }
                    goTo(page);
                  }}
                  itemsPerPageText={t('itemsPerPage', 'Items per page')}
                  itemsPerPageFollowsText={true}
                  pageInputDisabled={false}
                  pagesUnknown={false}
                  isLastPage={false}
                />
              </div>
            )}
          </>
        ) : (
          /* Empty state when there are no bills */
          <Layer className={styles.emptyStateContainer}>
            <Tile className={styles.tile}>
              <div className={styles.illo}>
                <EmptyDataIllustration />
              </div>
              <p className={styles.content}>{t('noBillsToDisplay', 'There are no bills to display.')}</p>
            </Tile>
          </Layer>
        )}
      </div>
    </div>
  );
};

export default BillListTable;
