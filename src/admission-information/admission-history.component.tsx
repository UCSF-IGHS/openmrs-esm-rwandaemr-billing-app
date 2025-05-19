import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableSkeleton,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbarSearch,
  Tile,
  InlineNotification,
  Pagination,
  Button,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useConfig, useDebounce, useLayoutType, usePagination } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, launchPatientWorkspace, usePaginationInfo } from '@openmrs/esm-patient-common-lib';
import styles from './admission-history.scss';
import { usePatientAdmissions } from '../api/patient-admission.resource';

interface AdmissionHistoryProps {
  patientUuid: string;
}

const AdmissionHistory: React.FC<AdmissionHistoryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig();
  const pageSize = config?.pageSize || 10;
  
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const isPhone = layout === 'phone';
  const isDesktopLayout = layout === 'small-desktop' || layout === 'large-desktop';
  const tableSize = isTablet ? 'lg' : isPhone ? 'lg' : 'sm';

  const { admissions, isLoading, error, isValidating, mutate } = usePatientAdmissions(patientUuid);

  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const { paginated, goTo, results, currentPage } = usePagination(admissions || [], currentPageSize);
  const { pageSizes } = usePaginationInfo(pageSize, admissions?.length || 0, currentPage, results?.length || 0);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const filteredAdmissions = React.useMemo(() => {
    const resultsArray = Array.isArray(results) ? results : [];
    
    let filtered = resultsArray;
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = resultsArray.filter(admission => 
        (admission.patientName && admission.patientName.toLowerCase().includes(searchLower)) ||
        (admission.billIdentifier && admission.billIdentifier.toLowerCase().includes(searchLower)) ||
        (admission.insuranceName && admission.insuranceName.toLowerCase().includes(searchLower)) ||
        (admission.cardNumber && admission.cardNumber.toLowerCase().includes(searchLower))
      );
    }

    return filtered.sort((a, b) => {
      if (!a.isClosed && b.isClosed) return -1;
      if (a.isClosed && !b.isClosed) return 1;
      return 0;
    });
  }, [debouncedSearchTerm, results]);

  const tableHeaders = [
    { key: 'name', header: ""},
    { key: 'billIdentifier', header: t('billIdentifier', 'Bill Identifier') },
    { key: 'insuranceName', header: t('insuranceName', 'Insurance name') },
    { key: 'cardNumber', header: t('cardNumber', 'Card Number') },
    { key: 'admissionType', header: t('admissionType', 'Admission Type') },
    { key: 'admissionDate', header: t('admissionDate', 'Admission date') },
    { key: 'admissionTypeDetail', header: t('admissionTypeDetail', 'Admission Type') },
    { key: 'status', header: t('status', 'Status') },
  ];

  const tableRows = React.useMemo(() => {
    return filteredAdmissions.map((admission) => {
      // Create status tag with appropriate color
      const statusContent = {
        content: (
          <Tag 
            type={admission.isClosed ? 'red' : 'green'} 
            className={admission.isClosed ? styles.closedStatus : styles.openStatus}
          >
            {admission.isClosed ? t('closed', 'Closed') : t('open', 'Open')}
          </Tag>
        )
      };
      
      return {
        id: admission.id,
        billIdentifier: admission.billIdentifier,
        insuranceName: admission.insuranceName,
        cardNumber: admission.cardNumber,
        admissionType: admission.admissionType,
        admissionDate: new Date(admission.admissionDate).toLocaleString(),
        admissionTypeDetail: admission.admissionTypeDetail,
        status: statusContent,
      };
    });
  }, [filteredAdmissions, t]);

  // Function to handle adding a bill to an admission
  const handleAddBill = (globalBillId: string) => {
    launchPatientWorkspace('billing-form-workspace', { 
      patientUuid, 
      globalBillId 
    });
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
          subtitle={typeof error === 'string' ? error : t('failedToLoadAdmissionData', 'Failed to load admission data')}
          hideCloseButton
        />
      </div>
    );
  }

  if (!patientUuid) {
    return (
      <div className={styles.errorContainer}>
        <InlineNotification
          kind="warning"
          title={t('missingIdentifier', 'Missing Identifier')}
          subtitle={t('patientIdentifierRequired', 'Patient UUID is required to fetch admission data')}
          hideCloseButton
        />
      </div>
    );
  }

  // If there are no admissions, return only the EmptyState component
  if (admissions.length === 0 && !isLoading) {
    return (
      <EmptyState
        displayText={t('admissionsInLowerCase', 'admissions')}
        headerTitle={t('admissionsHistory', 'Admissions History')}
        launchForm={() => launchPatientWorkspace('patient-admission-workspace', { patientUuid })}
      />
    );
  }

  // Otherwise, return the full component with data table
  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('admissionsHistory', 'Admissions History')}>
        <div className={styles.headerActions}>
          <Button
            renderIcon={Add}
            onClick={() => launchPatientWorkspace('patient-admission-workspace', { patientUuid })}
            kind="ghost"
          >
            {t('createNewAdmission', 'Create New Admission')}
          </Button>
        </div>
      </CardHeader>

      <div className={styles.tableContainer}>
        <DataTable headers={tableHeaders} isSortable rows={tableRows} size={tableSize} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
            <TableContainer className={styles.tableBodyScroll}>
              <TableToolbarSearch
                className={styles.searchbox}
                expanded
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder={t('searchThisTable', 'Search this table')}
                size={tableSize}
                persistent
                light
              />
              <Table {...getTableProps()} aria-label="Admission history" className={styles.admissionTable}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        key={header.key}
                        className={`${styles.tableHeader} ${styles[`col${header.key.charAt(0).toUpperCase() + header.key.slice(1)}`]}`}
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
                  {rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => {
                        // Determine class for the cell
                        const cellClassName = `${styles[`col${cell.info.header.charAt(0).toUpperCase() + cell.info.header.slice(1)}`] || ''}`;
                        
                        return (
                          <TableCell key={cell.id} className={cellClassName}>
                            {cell.value?.content ?? cell.value}
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

        {filteredAdmissions?.length === 0 && admissions.length > 0 && (
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

        {paginated && admissions.length > pageSize && (
          <Pagination
            forwardText={t('nextPage', 'Next page')}
            backwardText={t('previousPage', 'Previous page')}
            page={currentPage}
            pageSize={currentPageSize}
            pageSizes={pageSizes}
            totalItems={admissions.length}
            onChange={({ page: newPage, pageSize }) => {
              if (newPage !== currentPage) {
                goTo(newPage);
              }
              setCurrentPageSize(pageSize);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AdmissionHistory;
