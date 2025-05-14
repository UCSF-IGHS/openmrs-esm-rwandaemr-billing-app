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
  Layer
} from '@carbon/react';
import { isDesktop, useLayoutType, usePagination, ErrorState } from '@openmrs/esm-framework';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import { getPatientBills } from '../api/billing';
import styles from './bill-list-table.scss';

const BillListTable: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  
  const [bills, setBills] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [billPaymentStatus, setBillPaymentStatus] = useState('');
  const [searchString, setSearchString] = useState('');
  const [searchCategory, setSearchCategory] = useState('policyId');
  
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  useEffect(() => {
    const fetchBills = async () => {
      try {
        setIsLoading(true);
        const response = await getPatientBills(startDate, endDate, 0, 100);
        
        const billsWithDefaults = response.results.map(bill => ({
          ...bill,
          beneficiaryName: bill.beneficiaryName || '--',
          policyIdNumber: bill.policyIdNumber || '--',
          insuranceName: bill.insuranceName || '--',
          creator: bill.creator || '--',
          departmentName: bill.departmentName || '--',
          // Use the service name directly from the response with TypeScript type assertion
          serviceName: (bill as any).serviceName || bill.departmentName || '--'
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

  const getBillStatus = (bill: any) => {
    if (bill.payments && bill.payments.length > 0) {
      const totalPaid = bill.payments.reduce((sum, payment) => sum + (payment.amountPaid || 0), 0);
      return totalPaid >= bill.amount ? 'PAID' : 'PENDING';
    }
    return 'PENDING';
  };

  const filteredBills = React.useMemo(() => {
    if (!bills?.length) return bills;

    return bills
      .filter((bill) => {
        const billStatus = getBillStatus(bill);
        
        const statusMatch = billPaymentStatus === '' ? true : billStatus === billPaymentStatus;
        
        let searchMatch = true;
        
        if (searchString) {
          const lowerSearchString = searchString.toLowerCase();
          
          switch (searchCategory) {
            case 'beneficiary':
              searchMatch = bill.beneficiaryName?.toLowerCase().includes(lowerSearchString);
              break;
            case 'billedItems':
              searchMatch = bill.serviceName?.toLowerCase().includes(lowerSearchString);
              break;
            case 'policyId':
              searchMatch = bill.policyIdNumber?.toLowerCase().includes(lowerSearchString);
              break;
            default:
              searchMatch = 
                bill.beneficiaryName?.toLowerCase().includes(lowerSearchString) ||
                bill.policyIdNumber?.toLowerCase().includes(lowerSearchString) ||
                bill.serviceName?.toLowerCase().includes(lowerSearchString);
              break;
          }
        }

        return statusMatch && searchMatch;
      });
  }, [bills, searchString, billPaymentStatus, searchCategory]);

  const { paginated, goTo, results, currentPage } = usePagination(filteredBills, pageSize);

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '--';
    try {
      const date = new Date(dateString);
      return `${date.getDate()}-${getMonthShortName(date.getMonth())}-${date.getFullYear()}`;
    } catch (e) {
      return dateString;
    }
  };

  const getMonthShortName = (monthIndex: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIndex];
  };

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
    }
  ];

  const filterItems = [
    { id: '', text: t('allBills', 'All bills') },
    { id: 'PAID', text: t('paidBills', 'Paid bills') },
    { id: 'PENDING', text: t('pendingBills', 'Pending bills') },
  ];

  const searchCategories = [
    { id: 'policyId', text: t('policyId', 'Policy ID') },
    { id: 'beneficiary', text: t('beneficiaryName', 'Beneficiary name') },
    { id: 'billedItems', text: t('billedItems', 'Billed items') }
  ];

  const rowData = results?.map((bill, index) => {
    const totalPaid = bill.payments?.reduce((sum, payment) => sum + (payment.amountPaid || 0), 0) || 0;
    
    const status = getBillStatus(bill);
    
    // Use the serviceName directly from the bill
    const billItems = bill.serviceName || bill.departmentName || '--';
    
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
      billedItems: billItems
    };
  });

  const handleSearch = useCallback(
    (e) => {
      goTo(1);
      setSearchString(e.target.value);
    },
    [goTo],
  );

  const handleFilterChange = useCallback(
    ({ selectedItem }) => {
      setBillPaymentStatus(selectedItem.id);
      goTo(1);
    },
    [goTo],
  );

  const handleSearchCategoryChange = useCallback(
    ({ selectedItem }) => {
      setSearchCategory(selectedItem.id);
      if (searchString) {
        goTo(1);
      }
    },
    [goTo, searchString],
  );

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
      <div className={styles.desktopHeading}>
        <h4>{t('recentBills', 'Recent Bills')}</h4>
      </div>

      <div className={styles.billHistoryContainer}>
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
            <DataTable
              rows={rowData}
              headers={headerData}
              size="sm"
              useZebraStyles
              isSortable={false}
              overflowMenuOnHover={false}
              className={styles.dataTable}
            >
              {({ rows, headers, getTableProps, getTableContainerProps, getHeaderProps, getRowProps }) => (
                <TableContainer {...getTableContainerProps()}>
                  <Table className={styles.table} {...getTableProps()} aria-label="Recent bills">
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader
                            key={header.key}
                            {...getHeaderProps({
                              header,
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
                            if (cell.info.header === 'date') {
                              return (
                                <TableCell key={cell.id} className={`${styles.tableCells} ${styles.dateCell}`}>
                                  {cell.value}
                                </TableCell>
                              );
                            }

                            if (cell.info.header === 'refId') {
                              return (
                                <TableCell key={cell.id} className={`${styles.tableCells} ${styles.refIdCell}`}>
                                  {cell.value}
                                </TableCell>
                              );
                            }

                            if (cell.info.header === 'billStatus') {
                              const statusClass = cell.value === 'PAID' ? styles.paidStatus : styles.pendingStatus;
                              return (
                                <TableCell key={cell.id} className={styles.tableCells}>
                                  <span className={statusClass}>{cell.value}</span>
                                </TableCell>
                              );
                            }

                            if (cell.info.header === 'billedItems') {
                              return (
                                <TableCell key={cell.id} className={`${styles.tableCells} ${styles.billedItemsCell}`}>
                                  {cell.value}
                                </TableCell>
                              );
                            }

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
