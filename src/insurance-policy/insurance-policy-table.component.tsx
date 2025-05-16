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
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import { Umbrella } from '@carbon/react/icons';
import styles from './insurance-policy-table.scss';
import { useInsurancePolicy } from './insurance-policy.resource';

export const InsurancePolicyTable: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'sm' : 'lg';
  const [searchString, setSearchString] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { isLoading, error, data: policies } = useInsurancePolicy(startDate, endDate);

  const headerData = [
    { header: t('insuranceCardNo', 'Insurance Policy No.'), key: 'policyNumber' },
    { header: t('insurance', 'Insurance'), key: 'insurance' },
    { header: t('cardNumber', 'Insurance Card No.'), key: 'cardNumber' },
    { header: t('patientName', 'Patient names'), key: 'patientName' },
    { header: t('age', 'Age'), key: 'age' },
    { header: t('gender', 'Gender'), key: 'gender' },
    { header: t('birthdate', 'Birthdate'), key: 'birthdate' },
  ];

  const filteredPolicies = React.useMemo(() => {
    if (!policies?.length) return policies;

    if (!searchString) return policies;

    return policies.filter((policy) => {
      const searchableFields = [policy.insuranceCardNo, policy.insurance, policy.patientName];

      return searchableFields.some((field) => field.toLowerCase().includes(searchString.toLowerCase()));
    });
  }, [policies, searchString]);

  const { paginated, goTo, results, currentPage } = usePagination(filteredPolicies, pageSize);

  const handleSearch = useCallback(
    (e) => {
      goTo(1);
      setSearchString(e.target.value);
    },
    [goTo],
  );

  if (isLoading) {
    return (
      <DataTableSkeleton rowCount={pageSize} columnCount={headerData.length} showHeader={false} showToolbar={false} />
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
              size: responsiveSize,
            },
          }}
        />
      </div>

      <div style={{ margin: '1rem 0' }}>
        <Search
          labelText=""
          placeholder={t('searchPolicies', 'Search policies')}
          onChange={handleSearch}
          size={responsiveSize}
        />
      </div>

      {filteredPolicies?.length > 0 ? (
        <>
          <DataTable rows={results} headers={headerData} size="sm" useZebraStyles>
            {({ rows, headers, getTableProps, getTableContainerProps, getHeaderProps, getRowProps }) => (
              <TableContainer {...getTableContainerProps()}>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader {...getHeaderProps({ header })}>{header.header}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          {paginated && (
            <Pagination
              forwardText={t('nextPage', 'Next page')}
              backwardText={t('previousPage', 'Previous page')}
              page={currentPage}
              pageSize={pageSize}
              pageSizes={[10, 20, 30, 40, 50]}
              totalItems={filteredPolicies?.length}
              size="sm"
              onChange={({ page, pageSize: newPageSize }) => {
                if (newPageSize !== pageSize) {
                  setPageSize(newPageSize);
                }
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
