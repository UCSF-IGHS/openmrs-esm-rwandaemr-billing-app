import React, { useState, useEffect } from 'react';
import {
  Button,
  DataTable,
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableContainer,
  TextInput,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { CardHeader, EmptyState } from '@openmrs/esm-patient-common-lib';
import styles from './insurance.scss';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { fetchInsuranceFirms, loadInsurancePolicies } from './insurance-resource';
import dayjs from 'dayjs';
import EditInsuranceModal from './edit-insurance.workspace';
import { TableToolbarSearch } from '@carbon/react';

const Insurance = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [, setInsuranceIdToNameMap] = useState<Record<string, string>>({});
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPolicyNo, setSelectedPolicyNo] = useState(null);

  useEffect(() => {
    const loadInsuranceNames = async () => {
      const firms = await fetchInsuranceFirms();

      const mapped: Record<string, string> = {};
      firms.forEach((firm) => {
        if (firm.value && firm.label) {
          mapped[firm.value] = firm.label;
        }
      });

      setInsuranceIdToNameMap(mapped);
    };

    loadInsuranceNames();
  }, []);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const onEdit = (record) => {
    setSelectedPolicyNo(record.insurancePolicyNo);
    setSelectedRecord({
      insuranceCardNo: record.cardNumber,
      coverageStartDate: dayjs(record.startDate).format('YYYY-MM-DD'),
      expirationDate: dayjs(record.endDate).format('YYYY-MM-DD'),
    });
    setShowEditModal(true);
  };

  const handleClose = () => {
    setShowEditModal(false);
    setSelectedRecord(null);
  };

  const filteredEntries = entries.filter((entry) =>
    Object.values(entry).some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );

  const pagedEntries = filteredEntries.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    const handler = () => {
      setRefreshSignal((prev) => prev + 1);
    };

    window.addEventListener('insurancePolicyAdded', handler);

    return () => {
      window.removeEventListener('insurancePolicyAdded', handler);
    };
  }, []);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const response = await loadInsurancePolicies(patientUuid);
        const policies = response?.results ?? response;
        const mapped = policies
          .slice()
          .reverse()
          .map((policy, index) => ({
            id: String(index),
            cardNumber: policy.insuranceCardNo,
            startDate: dayjs(policy.coverageStartDate).format('YYYY-MM-DD'),
            endDate: dayjs(policy.expirationDate).format('YYYY-MM-DD'),
            hasThirdParty: policy.thirdPartyProvider ? t('yes', 'Yes') : t('no', 'No'),
            thirdPartyProvider: policy.thirdPartyProvider?.name ?? t('notAvailable', 'N/A'),
            insurancePolicyNo: policy.insurancePolicyId,
            status: (
              <Tag type={new Date(policy.expirationDate) < new Date() ? 'red' : 'green'}>
                {new Date(policy.expirationDate) < new Date() ? 'Expired' : 'Valid'}
              </Tag>
            ),
            companyName: policy.companyName ?? '',
            insuranceOwner: policy.insuranceOwner ?? '',
            affiliationCode: policy.family ?? '',
          }));

        setEntries(mapped);
        setTotalRecords(mapped.length);
        setPage(1);
      } catch (error) {
        console.error('Failed to load insurance policies:', error);
      }
    };

    if (patientUuid) loadPolicies();
  }, [patientUuid, refreshSignal, t]);

  const headers = [
    { key: 'cardNumber', header: t('membershipNumber', 'Membership Number') },
    { key: 'startDate', header: t('coverageStartDate', 'Coverage Start Date') },
    { key: 'endDate', header: t('coverageEndDate', 'Coverage End Date') },
    { key: 'status', header: t('status', 'Status') },
    { key: 'actions', header: t('actions', 'Actions') },
  ];

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('insurancePolicy', 'Insurance Policy')}>
        <div className={styles.headerActions}>
          <Button
            renderIcon={Add}
            onClick={() => launchPatientWorkspace('insurance-form-workspace', { patientUuid })}
            kind="ghost"
          >
            {t('addNewPolicy', 'Add new policy')}
          </Button>
        </div>
      </CardHeader>

      {filteredEntries.length === 0 ? (
        <EmptyState
          displayText={t('insurance', 'insurance')}
          headerTitle={t('insurance', 'Insurance')}
          launchForm={() => launchPatientWorkspace('insurance-form-workspace', { patientUuid })}
        />
      ) : (
        <>
          <DataTable
            headers={headers}
            rows={pagedEntries.map((entry) => ({
              id: entry.id,
              ...entry,
              actions: (
                <OverflowMenu>
                  <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => onEdit(entry)} />

                  {/* TODO  delete of insurance policy is unsupported for now */}

                  {/* <OverflowMenuItem
                    itemText={t('delete', 'Delete')}
                    hasDivider
                    isDelete
                    onClick={() => handleDelete(entries.findIndex((e) => e.id === entry.id))}
                  /> */}
                </OverflowMenu>
              ),
            }))}
            isSortable
            useZebraStyles
          >
            {({ rows, headers, getTableProps, getRowProps, getHeaderProps }) => (
              <TableContainer>
                <TableToolbarSearch
                  className={styles.searchbox}
                  isExpanded
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSearchTerm(e.target.value), setPage(1);
                  }}
                  placeholder={t('searchPlaceholder', 'Search insurance...')}
                  size={'md'}
                  persistent
                />
                <Table {...getTableProps()} aria-label="Insurance details table">
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} {...getRowProps({ row })}>
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
          <div>
            {/* Pass the record & handlers to the modal */}
            {showEditModal && (
              <EditInsuranceModal record={selectedRecord} onClose={handleClose} policyId={selectedPolicyNo} />
            )}
          </div>
          <Pagination
            backwardText={t('previousPage', 'Previous page')}
            forwardText={t('nextPage', 'Next page')}
            itemsPerPageText={t('itemsPerPage', 'Items per page') + ':'}
            page={page}
            pageNumberText={t('pageNumber', 'Page number')}
            pageSize={pageSize}
            pageSizes={[10, 20, 50]}
            onChange={({ page: newPage, pageSize: newPageSize }) => {
              setPage(newPage);
              setPageSize(newPageSize);
            }}
            totalItems={filteredEntries.length}
          />
        </>
      )}
    </div>
  );
};

export default Insurance;
