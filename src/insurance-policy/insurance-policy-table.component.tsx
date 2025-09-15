import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
  Pagination,
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
import {
  TableToolbarSearch,
  Tag,
  TableExpandHeader,
  TableExpandRow,
  TableExpandedRow,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import styles from './insurance-policy-table.scss';
import { useInsurancePolicy } from './insurance-policy.resource';
import EditInsuranceModal from '../insurance/edit-insurance.workspace';
import dayjs from 'dayjs';

interface InsuranceRecord {
  id: string;
  patientUuid: string;
  cardNumber: string;
  startDate: string;
  endDate: string;
  policyId: string;
}

export const InsurancePolicyTable: React.FC = () => {
  const { t } = useTranslation();
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isPhone = layout === 'phone';
  const tableSize = isTablet ? 'lg' : isPhone ? 'lg' : 'sm';

  const [searchTerm, setSearchTerm] = useState('');

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPolicyNo, setSelectedPolicyNo] = useState(null);
  const {
    isLoading,
    error,
    data: policies,
    totalCount,
    mutate: tableMutate, // Get mutate function
  } = useInsurancePolicy(startDate, endDate, searchTerm, pageSize, currentPage);

  const tableHeaders = [
    { header: t('policyNo', 'Policy No.'), key: 'policyNo' },
    { header: t('insurance', 'Insurance'), key: 'insurance' },
    { header: t('cardNumber', 'Insurance Card No.'), key: 'insuranceCardNo' },
    { header: t('expirationDate', 'Expiration Date'), key: 'expirationDate' },
    { header: t('expiryStatus', 'Expiry status'), key: 'expiryStatus' },
    { header: t('patientName', 'Patient Name'), key: 'patientName' },
    { header: t('age', 'Age'), key: 'age' },
    { header: t('gender', 'Gender'), key: 'gender' },
    { key: 'actions', header: t('actions', 'Actions') },
  ];

  const { paginated, goTo, results } = usePagination(policies, pageSize);

  const onEdit = (policy) => {
    setSelectedPolicyNo(policy.insurancePolicyNo);
    setSelectedRecord({
      insuranceCardNo: policy.insuranceCardNo,
      coverageStartDate: dayjs(policy.coverageStartDate).format('YYYY-MM-DD'),
      expirationDate: dayjs(policy.expirationDate).format('YYYY-MM-DD'),
      insuranceName: policy.insurance,
      insuranceId: policy.insuranceId,
    });
    setShowEditModal(true);
  };
  const tableRows = results.map((policy, index) => ({
    id: String(index),
    policyNo: policy.insurancePolicyNo,
    coverageStartDate: policy.coverageStartDate,
    expirationDate: policy.expirationDate,
    expiryStatus: {
      content: (
        <Tag type={new Date(policy.expirationDate) < new Date() ? 'red' : 'green'}>
          {new Date(policy.expirationDate) < new Date() ? 'Expired' : 'Valid'}
        </Tag>
      ),
    },
    insurance: policy.insurance,
    insuranceCardNo: policy.insuranceCardNo,
    patientName: policy.patientName,
    age: policy.age || '--',
    gender: policy.gender || '--',
    birthdate: policy.birthdate || '--',
    actions: (
      <OverflowMenu>
        <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => onEdit(policy)} />
      </OverflowMenu>
    ),
  }));

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

  const handleClose = () => {
    setShowEditModal(false);
    setSelectedRecord(null);
  };

  return (
    <div>
      <div className={styles.tableHeaderContainer}>
        <h4>{t('insurancePolicies', 'Insurance Policies')}</h4>
        <ExtensionSlot
          name="patient-search-button-slot"
          state={{
            selectPatientAction: launchCreateInsurancePolicyForm,
            buttonText: t('addPolicy', 'Add policy'),
            overlayHeader: t('createNewInsurancePolicy', 'Create new insurance policy'),
            buttonProps: {
              kind: 'primary',
              renderIcon: (props) => <Umbrella size={32} {...props} />,
              size: tableSize,
            },
          }}
        />
      </div>

      {results?.length > 0 ? (
        <>
          <DataTable headers={tableHeaders} isSortable rows={tableRows} size={tableSize} useZebraStyles>
            {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
              <TableContainer className={styles.tableContainer}>
                <TableToolbarSearch
                  className={styles.searchbox}
                  expanded
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  placeholder={t('searchThisTable', 'Search policy by card number')}
                  size={tableSize}
                  persistent
                />
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader />
                      {headers.map((header: any) => (
                        <TableHeader
                          {...getHeaderProps({
                            header,
                            isSortable: header.isSortable,
                          })}
                          className={isDesktop ? styles.desktopHeader : styles.tabletHeader}
                          key={`${header.key}`}
                        >
                          {header.header?.content ?? header.header}
                        </TableHeader>
                      ))}
                      <TableHeader></TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody style={{ overflow: 'hidden', padding: '1rem !important' }}>
                    {rows.map((row, index) => {
                      return (
                        <React.Fragment key={row.id}>
                          <TableExpandRow
                            className={isDesktop ? styles.desktopRow : styles.tabletRow}
                            {...getRowProps({ row })}
                          >
                            {row.cells.map((cell) => {
                              return <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>;
                            })}
                          </TableExpandRow>

                          {row.isExpanded ? (
                            <TableExpandedRow colSpan={headers.length + 2}>
                              <ExpandedPolicyDetails policy={results[index]} />
                            </TableExpandedRow>
                          ) : (
                            <TableExpandedRow className={styles.hiddenRow} colSpan={headers.length + 2} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>

          <div>
            {showEditModal && (
              <EditInsuranceModal
                record={selectedRecord}
                onClose={handleClose}
                policyId={selectedPolicyNo}
                parentMutate={tableMutate} // Pass mutate function
              />
            )}
          </div>

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

const ExpandedPolicyDetails = ({ policy }) => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <p>
          <strong>{t('coverageStartDate', 'Coverage Start Date')}: </strong>
          {policy.coverageStartDate || '--'}
        </p>
        <p>
          <strong>{t('birthdate', 'Birth Date')}: </strong>
          {policy.birthdate || '--'}
        </p>
        <p>
          <strong>{t('ownerName', 'Policy Owner')}: </strong>
          {policy.ownerName || '--'}
        </p>
      </div>
    </div>
  );
};
