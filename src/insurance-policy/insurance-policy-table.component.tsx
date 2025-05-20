import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
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
} from '@carbon/react';
import {
  ErrorState,
  ExtensionSlot,
  isDesktop,
  launchWorkspace,
  useDebounce,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import { Umbrella } from '@carbon/react/icons';
import styles from './insurance-policy-table.scss';
import { useInsurancePolicy } from './insurance-policy.resource';
import { TableToolbarSearch } from '@carbon/react';

export const InsurancePolicyTable: React.FC = () => {
  const { t } = useTranslation();
  const [searchString, setSearchString] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isPhone = layout === 'phone';
  const tableSize = isTablet ? 'lg' : isPhone ? 'lg' : 'sm';

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  // Format dates properly for the API
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const {
    isLoading,
    error,
    data: policies,
    totalCount,
  } = useInsurancePolicy(startDate, endDate, pageSize, currentPage);

  const tableHeaders = [
    { header: t('insurancePolicyNo', 'Insurance Policy No.'), key: 'insurancePolicyNo' },
    { header: t('insurance', 'Insurance'), key: 'insurance' },
    { header: t('cardNumber', 'Insurance Card No.'), key: 'insuranceCardNo' },
    { header: t('patientName', 'Patient Name'), key: 'patientName' },
    { header: t('age', 'Age'), key: 'age' },
    { header: t('gender', 'Gender'), key: 'gender' },
    { header: t('birthdate', 'Birthdate'), key: 'birthdate' },
  ];

  const { paginated, goTo, results } = usePagination(policies, pageSize);

  const filteredPolicies = React.useMemo(() => {
    if (!debouncedSearchTerm) return policies || [];

    const searchLower = debouncedSearchTerm.toLowerCase();
    return (results || []).filter(
      (policy) =>
        (policy.patientName && policy?.patientName.toLowerCase().includes(searchLower)) ||
        (policy.insurance && policy?.insurance.toLowerCase().includes(searchLower)) ||
        (policy.insuranceCardNo && policy?.insuranceCardNo.toLowerCase().includes(searchLower)),
    );
  }, [debouncedSearchTerm, results, policies]);

  if (isLoading) {
    return (
      <DataTableSkeleton rowCount={pageSize} columnCount={tableHeaders.length} showHeader={false} showToolbar={false} />
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <Layer>
          <ErrorState error={error} headerTitle={t('insurancePolicy', 'Insurance policy')} />
        </Layer>
      </div>
    );
  }

  const launchCreateInsurancePolicyForm = (patientUuid) => {
    const props = { patientUuid: patientUuid, context: 'creating', mutate: () => {} };

    launchWorkspace('insurance-form-workspace', { ...props });
  };

  return (
    <div>
      <div className={styles.tableHeaderContainer}>
        <h4>{t('insurancePolicies', 'Insurance Policies')}</h4>
        <ExtensionSlot
          name="patient-search-button-slot"
          state={{
            selectPatientAction: launchCreateInsurancePolicyForm,
            buttonText: t('addInsurance', 'Add insurance'),
            overlayHeader: t('createNewInsurancePolicy', 'Create new insurance policy'),
            buttonProps: {
              kind: 'primary',
              renderIcon: (props) => <Umbrella size={32} {...props} />,
              size: tableSize,
            },
          }}
        />
      </div>

      {filteredPolicies?.length > 0 ? (
        <>
          <DataTable
            headers={tableHeaders}
            isSortable
            rows={filteredPolicies.map((policy) => ({
              id: policy.insuranceCardNo,
              insurancePolicyNo: policy.insurancePolicyNo,
              insurance: policy.insurance,
              insuranceCardNo: policy.insuranceCardNo,
              patientName: policy.patientName,
              age: policy.age || '--',
              gender: policy.gender || '--',
              birthdate: policy.birthdate || '--',
            }))}
            size={tableSize}
            useZebraStyles
          >
            {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
              <TableContainer className={styles.tableContainer}>
                <TableToolbarSearch
                  className={styles.searchbox}
                  expanded
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder={t('searchThisTable', 'Search this table')}
                  size={tableSize}
                  persistent
                  light
                />
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          {...getHeaderProps({
                            header,
                            // isSortable: header.isSortable,
                          })}
                        >
                          {header.header?.content ?? header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody style={{ overflow: 'hidden', padding: '1rem !important' }}>
                    {rows.map((row) => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map((cell) => {
                          return <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          {pageSize && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={pageSize}
              pageSizes={[50]}
              totalItems={totalCount}
              size="sm"
              onChange={({ page, pageSize: newPageSize }) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                }
                setCurrentPage(page);
                goTo(page);
              }}
            />
          )}
        </>
      ) : (
        <Layer>
          <Tile style={{ margin: '1rem 0' }}>
            <div style={{ margin: '2rem 0', textAlign: 'center' }}>
              <EmptyDataIllustration />
              <p>{t('noPolicies', 'No insurance policies found')}</p>
            </div>
          </Tile>
        </Layer>
      )}
    </div>
  );
};
