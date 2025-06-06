import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { navigate, showToast } from '@openmrs/esm-framework';
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Layer,
  Tile,
  Search,
  Button,
  Form,
  Stack,
} from '@carbon/react';
import { getGlobalBillByIdentifier } from '../api/billing';
import styles from './search-bill-header-cards.scss';

const GlobalBillSearch: React.FC = () => {
  const { t } = useTranslation();
  const [globalBillIdentifier, setGlobalBillIdentifier] = useState('');
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGlobalBillSearch = async () => {
    setErrorMessage('');
    setSearchResult([]);
    setHasSearched(true);
    setIsLoading(true);

    try {
      if (!globalBillIdentifier) {
        setErrorMessage(t('enterValue', 'Please enter a global bill identifier.'));
        return;
      }

      const result = await getGlobalBillByIdentifier(globalBillIdentifier);
      
      if (!result?.results || result.results.length === 0) {
        setErrorMessage(t('noResults', 'No results found.'));
      } else {
        const validResults = result.results.filter(item => item !== null);
        if (validResults.length === 0) {
          setErrorMessage(t('noResults', 'No results found.'));
        } else {
          setSearchResult(validResults);
        }
      }
    } catch (error) {
      setErrorMessage(t('errorFetchingData', 'An error occurred while fetching data.'));
      showToast({
        title: t('error', 'Error'),
        description: error.message,
        kind: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRowClick = (result) => {
    navigate({ to: `${window.getOpenmrsSpaBase()}home/billing/invoice/${result.admission.insurancePolicy.insuranceCardNo}` });
  };

  const renderResultsTable = () => {
    if (!hasSearched || isLoading) {
      return null;
    }

    if (!searchResult || searchResult.length === 0 || searchResult.every(item => item === null)) {
      return (
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
      );
    }

    const headers = [
      { header: t('billIdentifier', 'Bill Identifier'), key: 'billId' },
      { header: t('insuranceCardNo', 'Insurance Card No.'), key: 'insuranceNo' },
      { header: t('patientNames', 'Patient Names'), key: 'patientName' },
      { header: t('department', 'Department'), key: 'department' },
      { header: t('createdDate', 'Created Date'), key: 'createdDate' },
      { header: t('amount', 'Amount (RWF)'), key: 'amount' },
      { header: t('status', 'Status'), key: 'status' },
    ];

    const rows = searchResult.map((result, index) => ({
      id: index.toString(),
      billId: result.billIdentifier || result.globalBillIdentifier,
      insuranceNo: result.admission.insurancePolicy.insuranceCardNo,
      patientName: result.admission.insurancePolicy.owner.display,
      department: result.department || 'N/A',
      createdDate: new Date(result.admission.admissionDate).toLocaleDateString(),
      amount: result.globalAmount,
      status: result.closed ? 'Closed' : 'Open',
    }));

    return (
      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <Table {...getTableProps()} useZebraStyles>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow {...getRowProps({ row })} onClick={() => handleRowClick(searchResult[parseInt(row.id)])}>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    );
  };

  return (
    <div className={styles.container}>
      <Form className={styles.searchContainer}>
        <Stack gap={5}>
          <h4 className={styles.heading}>{t('findGlobalBill', 'Search Global Bill')}</h4>
          <div className={styles.searchForm}>
            <label htmlFor="globalBillSearch" className={styles.label}>
              {t('globalBillIdentifier', 'Global Bill Identifier')}
            </label>
            <Search
              id="globalBillSearch"
              labelText=""
              placeholder={t('globalBillPlaceholder', 'Enter global bill number to search')}
              value={globalBillIdentifier}
              onChange={(e) => setGlobalBillIdentifier(e.target.value)}
              size="lg"
            />
            <Button
              onClick={handleGlobalBillSearch}
              disabled={isLoading}
              kind="primary"
            >
              {isLoading ? t('searching', 'Searching...') : t('search', 'Search')}
            </Button>
          </div>
        </Stack>
      </Form>

      {errorMessage && <div className={styles.error}>{errorMessage}</div>}
      {renderResultsTable()}
    </div>
  );
};

export default GlobalBillSearch;
