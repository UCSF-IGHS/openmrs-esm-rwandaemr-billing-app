import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { showToast } from '@openmrs/esm-framework';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  DataTableSkeleton,
  Pagination,
  Search,
  Dropdown,
  Tag,
  TableContainer,
  Layer,
  Tile,
} from '@carbon/react';
import { getConsommationById, getConsommationRates } from '../api/billing';
import BillItemsTable from '../consommation/bill-items-table.component';
import styles from './search-bill-header-cards.scss';
import { getConsommations, searchConsommations } from '../api/billing/consommations';

const PAGE_SIZE_OPTIONS = [10, 20, 30];

const ConsommationSearch = () => {
  const { t } = useTranslation();

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [startIndex, setStartIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, any>>({});

  const [searchTerm, setSearchTerm] = useState('');

  const STATUS_ITEMS = [
    { id: 'all', text: t('allBills', 'All') },
    { id: 'open', text: t('openBills', 'Open') },
    { id: 'closed', text: t('closedBills', 'Closed') },
  ] as const;
  type StatusId = (typeof STATUS_ITEMS)[number]['id'];

  const SEARCH_ITEMS = [
    { id: 'policy', text: t('policyId', 'Policy ID') },
    { id: 'name', text: t('beneficiaryName', 'Patient name') },
    { id: 'id', text: t('consommationId', 'Consommation ID') },
  ] as const;
  type SearchCatId = (typeof SEARCH_ITEMS)[number]['id'];

  const [searchCategory, setSearchCategory] = useState<SearchCatId>('policy');
  const [statusFilter, setStatusFilter] = useState<StatusId>('all');

  const [rowRates, setRowRates] = useState<Record<string, { insuranceRate: number; patientRate: number }>>({});

  const [insuranceDetails, setInsuranceDetails] = useState<
    Record<string, { insuranceName?: string; insuranceRate: number; patientRate: number; policyNumber?: string }>
  >({});

  const headers = [
    { key: 'billIdentifier', header: t('billIdentifier', 'Bill Identifier') },
    { key: 'insuranceCardNo', header: t('insuranceCardNo', 'Insurance Card No.') },
    { key: 'patientName', header: t('patientNames', 'Patient Names') },
    { key: 'department', header: t('department', 'Department') },
    { key: 'createdDate', header: t('createdDate', 'Created Date') },
    { key: 'amount', header: t('total', 'Total (RWF)') },
    { key: 'status', header: t('status', 'Status') },
  ];

  const transformToRow = (c: any, idx: number) => {
    const isClosed = Boolean(c?.patientBill?.payments?.length > 0 || c?.patientBill?.isPaid);
    const statusEl = (
      <Tag type={isClosed ? 'red' : 'green'} className={isClosed ? styles.unpaidStatus : styles.paidStatus}>
        {isClosed ? 'CLOSED' : 'OPEN'}
      </Tag>
    );

    const patientAmt = Number(c?.patientBill?.amount ?? 0);
    const insuranceAmt = Number(c?.insuranceBill?.amount ?? 0);
    const totalAmt = patientAmt + insuranceAmt;

    return {
      id: `${c.consommationId}-${idx}`,
      consommationId: c.consommationId,
      billIdentifier: `CONS-${c.consommationId}`,
      insuranceCardNo: c?.patientBill?.policyIdNumber || '--',
      patientName: c?.patientBill?.beneficiaryName || '--',
      department: c?.department?.name || '--',
      createdDate: c?.patientBill?.createdDate ? new Date(c.patientBill.createdDate).toLocaleDateString() : 'N/A',
      amount: `${totalAmt}`,
      status: statusEl,
      isClosed,
    };
  };

  const fetchAndUpdateRates = async (consommations: any[]) => {
    const ratePromises = consommations.map(async (consommation) => {
      try {
        const rates = await getConsommationRates(String(consommation.consommationId));
        return {
          consommationId: consommation.consommationId,
          insuranceRate: Number(rates?.insuranceRate ?? 0),
          patientRate: Number(rates?.patientRate ?? 100),
        };
      } catch (error) {
        console.warn(`Failed to fetch rates for consommation ${consommation.consommationId}:`, error);
        return {
          consommationId: consommation.consommationId,
          insuranceRate: 0,
          patientRate: 100,
        };
      }
    });

    try {
      const allRatesResults = await Promise.allSettled(ratePromises);

      setRows((currentRows) => {
        const updatedRows = [...currentRows];

        allRatesResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const { consommationId, insuranceRate, patientRate } = result.value;

            const rowIndex = updatedRows.findIndex((row) => row.consommationId === consommationId);
            if (rowIndex !== -1) {
              updatedRows[rowIndex] = {
                ...updatedRows[rowIndex],
                insurancePct: `${insuranceRate}%`,
                patientPct: `${patientRate}%`,
              };
            }
          }
        });

        return updatedRows;
      });
    } catch (error) {
      console.warn('Error fetching rates:', error);
    }
  };

  const fetchPage = useCallback(
    async (limit = pageSize, start = startIndex) => {
      setLoading(true);
      setErrorMessage('');
      try {
        let data: any;

        if (searchTerm && searchCategory === 'id') {
          const c = await getConsommationById(searchTerm.trim());
          data = { results: [c] };
        } else if (searchTerm && searchCategory === 'name') {
          data = await searchConsommations({
            patientName: searchTerm.trim(),
            limit,
            startIndex: start,
            orderBy: 'createdDate',
            orderDirection: 'desc',
          });
        } else if (searchTerm && searchCategory === 'policy') {
          data = await searchConsommations({
            policyIdNumber: searchTerm.trim(),
            limit,
            startIndex: start,
            orderBy: 'createdDate',
            orderDirection: 'desc',
          });
        } else {
          data = await getConsommations(limit, start, 'createdDate', 'desc');
        }

        const mapped = (data?.results || []).map(transformToRow);

        let filtered = mapped;
        if (statusFilter === 'open') filtered = mapped.filter((r: any) => !r.isClosed);
        if (statusFilter === 'closed') filtered = mapped.filter((r: any) => r.isClosed);

        setRows(filtered);

        const usedTotal =
          searchCategory === 'id'
            ? filtered.length
            : ((typeof data?.total === 'number' ? data.total : undefined) ??
              (typeof data?.count === 'number' ? data.count : undefined) ??
              (typeof data?.totalCount === 'number' ? data.totalCount : undefined) ??
              (typeof data?.paging?.total === 'number' ? data.paging.total : undefined) ??
              filtered.length);
        setTotal(Number(usedTotal));
      } catch (e: any) {
        setErrorMessage(t('errorFetchingData', 'An error occurred while fetching data.'));
        showToast({ title: t('error', 'Error'), description: e?.message || String(e), kind: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [pageSize, startIndex, t, searchTerm, searchCategory, statusFilter],
  );

  useEffect(() => {
    fetchPage();
    setExpandedRowId(null);
  }, [fetchPage]);

  useEffect(() => {
    const h = setTimeout(() => {
      setStartIndex(0);
      const performSearch = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
          let data: any;

          if (searchTerm && searchCategory === 'id') {
            const c = await getConsommationById(searchTerm.trim());
            data = { results: [c] };
          } else if (searchTerm && searchCategory === 'name') {
            data = await searchConsommations({
              patientName: searchTerm.trim(),
              limit: pageSize,
              startIndex: 0,
              orderBy: 'createdDate',
              orderDirection: 'desc',
            });
          } else if (searchTerm && searchCategory === 'policy') {
            data = await searchConsommations({
              policyIdNumber: searchTerm.trim(),
              limit: pageSize,
              startIndex: 0,
              orderBy: 'createdDate',
              orderDirection: 'desc',
            });
          } else {
            data = await getConsommations(pageSize, 0, 'createdDate', 'desc');
          }

          const mapped = (data?.results || []).map(transformToRow);
          let filtered = mapped;
          if (statusFilter === 'open') filtered = mapped.filter((r: any) => !r.isClosed);
          if (statusFilter === 'closed') filtered = mapped.filter((r: any) => r.isClosed);

          setRows(filtered);

          const usedTotal =
            searchCategory === 'id'
              ? filtered.length
              : ((typeof data?.total === 'number' ? data.total : undefined) ??
                (typeof data?.count === 'number' ? data.count : undefined) ??
                (typeof data?.totalCount === 'number' ? data.totalCount : undefined) ??
                (typeof data?.paging?.total === 'number' ? data.paging.total : undefined) ??
                filtered.length);
          setTotal(Number(usedTotal));
        } catch (e: any) {
          setErrorMessage(t('errorFetchingData', 'An error occurred while fetching data.'));
          showToast({ title: t('error', 'Error'), description: e?.message || String(e), kind: 'error' });
        } finally {
          setLoading(false);
        }
      };

      performSearch();
    }, 300);
    return () => clearTimeout(h);
  }, [searchTerm, statusFilter, pageSize, searchCategory, t]);

  const handleRowExpand = async (row: any) => {
    const id = row.id as string;
    const isExpanded = expandedRowId === id;
    setExpandedRowId(isExpanded ? null : id);

    if (!isExpanded && !expandedDetails[id]) {
      try {
        const details = await getConsommationById(
          String(
            row.original?.consommationId || row.cells.find((c: any) => c.info.header === 'billIdentifier').value,
          ).replace('CONS-', ''),
        );
        setExpandedDetails((prev) => ({ ...prev, [id]: details }));
        try {
          const rates = await getConsommationRates(String(details.consommationId));
          setInsuranceDetails((prev) => ({
            ...prev,
            [id]: {
              insuranceName: rates?.insuranceName,
              insuranceRate: Number(rates?.insuranceRate ?? 0),
              patientRate: Number(rates?.patientRate ?? 100),
              policyNumber: details?.patientBill?.policyIdNumber,
            },
          }));
        } catch {
          /* silently ignore */
        }
      } catch (e) {
        showToast({
          title: t('error', 'Error'),
          description: t('errorFetchingData', 'An error occurred while fetching data.'),
          kind: 'error',
        });
      }
    }
  };

  const renderExpanded = (rowId: string) => {
    const details = expandedDetails[rowId];
    if (!details) return <div className={styles.expandedContent}>{t('loading', 'Loading...')}</div>;

    const policyRate = insuranceDetails[rowId]?.insuranceRate;
    const insuranceRate = typeof policyRate === 'number' ? policyRate : 0;

    const computeItemName = (item: any, departmentName: string) => {
      if (item?.service?.facilityServicePrice?.name) return item.service.facilityServicePrice.name;
      if (item?.serviceOtherDescription) return item.serviceOtherDescription;
      if (item?.serviceOther) return item.serviceOther;
      return `${departmentName || 'Unknown Department'} Service Item`;
    };

    const itemsWithNames = (details.billItems || []).map((item: any) => ({
      ...item,
      description: computeItemName(item, details?.department?.name),
      itemName: computeItemName(item, details?.department?.name),
    }));

    return (
      <div className={styles.expandedContent}>
        <div className={styles.topGrid}>
          <div className={styles.detailsHeader}>
            <h4>{t('patientBillPayment', 'Patient Bill Payment')}</h4>
            <p>
              <strong>{t('consommationNumber', 'Consommation #')}:</strong> {details.consommationId}
            </p>
            <p>
              <strong>{t('department', 'Department')}:</strong> {details.department?.name || 'N/A'}
            </p>
          </div>

          {details?.patientBill?.isPaid !== true && (
            <aside className={styles.metaSection}>
              <h5>{t('insuranceDetails', 'Insurance Details')}</h5>
              <div className={styles.metaGridRight}>
                <div>
                  <strong>{t('insurer', 'Insurer')}:</strong> {insuranceDetails[rowId]?.insuranceName || t('na', 'N/A')}
                </div>
                <div>
                  <strong>{t('policyNumber', 'Policy No.')}:</strong>{' '}
                  {insuranceDetails[rowId]?.policyNumber || t('na', 'N/A')}
                </div>
                <div>
                  <strong>{t('insuranceRate', 'Insurance %')}:</strong> {insuranceDetails[rowId]?.insuranceRate ?? 0}%
                </div>
                <div>
                  <strong>{t('patientRate', 'Patient %')}:</strong> {insuranceDetails[rowId]?.patientRate ?? 100}%
                </div>
              </div>
            </aside>
          )}
        </div>

        <BillItemsTable items={itemsWithNames} insuranceRate={insuranceRate} />
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchContainer}>
        <div className={styles.searchFields}>
          {/* Filter by: All / Open / Closed */}
          <div className={styles.dropdownContainer}>
            <Dropdown
              id="status-filter"
              direction="bottom"
              initialSelectedItem={STATUS_ITEMS[0]}
              items={STATUS_ITEMS as unknown as Array<{ id: StatusId; text: string }>}
              itemToString={(item) => (item ? item.text : '')}
              onChange={({ selectedItem }) => setStatusFilter((selectedItem?.id ?? 'all') as StatusId)}
              titleText={t('filterBy', 'Filter by')}
              label={t('filterBy', 'Filter by')}
            />
          </div>

          {/* Search in: Policy ID / Patient name / Consommation ID */}
          <div className={styles.dropdownContainer}>
            <Dropdown
              id="search-category"
              direction="bottom"
              initialSelectedItem={SEARCH_ITEMS[0]}
              items={SEARCH_ITEMS as unknown as Array<{ id: SearchCatId; text: string }>}
              itemToString={(item) => (item ? item.text : '')}
              onChange={({ selectedItem }) => setSearchCategory((selectedItem?.id ?? 'policy') as SearchCatId)}
              titleText={t('searchIn', 'Search in')}
              label={t('searchIn', 'Search in')}
            />
          </div>

          <div className={styles.searchInputContainer}>
            <Search
              id="consommationUnifiedSearch"
              labelText=""
              placeholder={
                searchCategory === 'id'
                  ? t('consommationPlaceholder', 'Enter consommation ID')
                  : searchCategory === 'name'
                    ? t('patientNamePlaceholder', 'Search by patient name')
                    : t('insuranceCardPlaceholder', 'Search by Insurance Card No.')
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="lg"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <DataTableSkeleton columnCount={headers.length} rowCount={5} />
      ) : rows.length === 0 ? (
        <div className={styles.filterEmptyState}>
          <Layer level={0}>
            <Tile className={styles.filterEmptyStateTile}>
              <p className={styles.filterEmptyStateContent}>
                {errorMessage || t('noMatchingItemsToDisplay', 'No matching items to display')}
              </p>
            </Tile>
          </Layer>
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <DataTable rows={rows} headers={headers} useZebraStyles>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps, getTableContainerProps }) => (
                <TableContainer {...getTableContainerProps()}>
                  <Table {...getTableProps()} useZebraStyles>
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
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableExpandRow>
                          {expandedRowId === row.id && (
                            <TableExpandedRow colSpan={headers.length + 1}>
                              {renderExpanded(row.id as string)}
                            </TableExpandedRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </div>

          <div className={styles.paginationContainer}>
            <Pagination
              pageSizes={PAGE_SIZE_OPTIONS}
              totalItems={total}
              pageSize={pageSize}
              onChange={({ page, pageSize: newPageSize }) => {
                const newStart = (page - 1) * newPageSize;
                setPageSize(newPageSize);
                setStartIndex(newStart);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ConsommationSearch;
