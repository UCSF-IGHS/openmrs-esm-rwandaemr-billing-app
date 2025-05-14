import React, { useState } from 'react';
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
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useTranslation } from 'react-i18next';
import { CardHeader, EmptyState } from '@openmrs/esm-patient-common-lib';
import styles from './insurance.scss';
import DeleteInsuranceModal from './delete-insurance.modal';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';

const Insurance = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddInsurance = () => {
    launchPatientWorkspace('insurance-form-workspace', { patientUuid });
  };

  const handleEditInsurance = (insuranceId) => {
    launchPatientWorkspace('insurance-form-workspace', {
      patientUuid,
      insuranceId,
    });
  };

  const handleDelete = (index) => {
    DeleteInsuranceModal(entries[index]);
    setEntries(entries.filter((_, i) => i !== index));
  };

  const filteredEntries = entries.filter((entry) =>
    Object.values(entry).some(
      (value) => typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  );

  const headers = [
    { key: 'insuranceName', header: t('insuranceName', 'Insurance Name') },
    { key: 'cardNumber', header: t('membershipNumber', 'Membership Number') },
    { key: 'startDate', header: t('validFrom', 'Valid From') },
    { key: 'endDate', header: t('validTo', 'Valid To') },
    { key: 'hasThirdParty', header: t('hasThirdParty', 'Has Third Party') },
    { key: 'thirdPartyProvider', header: t('thirdPartyProvider', 'Third Party Provider') },
    { key: 'companyName', header: t('companyName', 'Company Name') },
    { key: 'policyOwner', header: t('policyOwner', 'Policy Owner') },
    { key: 'affiliationCode', header: t('affiliationCode', 'Affiliation Code') },
    { key: 'category', header: t('category', 'Category') },
    { key: 'actions', header: t('actions', 'Actions') },
  ];

  return (
    <div className={styles.container}>
      {filteredEntries.length === 0 ? (
        <EmptyState
          displayText={t('insurance', 'insurance')}
          headerTitle={t('insurance', 'Insurance')}
          launchForm={() => launchPatientWorkspace('insurance-form-workspace', { patientUuid })}
        />
      ) : (
        <DataTable
          headers={headers}
          rows={filteredEntries.map((entry, index) => ({
            id: String(index),
            ...entry,
            actions: (
              <OverflowMenu>
                <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => handleEditInsurance(String(index))} />
                <OverflowMenuItem
                  itemText={t('delete', 'Delete')}
                  hasDivider
                  isDelete
                  onClick={() => handleDelete(index)}
                />
              </OverflowMenu>
            ),
          }))}
          isSortable
          useZebraStyles
        >
          {({ rows, headers, getTableProps, getRowProps, getHeaderProps }) => (
            <TableContainer>
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
      )}
    </div>
  );
};

export default Insurance;
