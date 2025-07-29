import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from '@carbon/react';
import ReportFilterForm from './report-filter-form.component';
import { EmptyState } from '@openmrs/esm-patient-common-lib';

const ServiceRevenueReport: React.FC = () => {
  const { t } = useTranslation();
  const [hasSearched, setHasSearched] = useState(false);
  const [reportData, setReportData] = useState([]);

  const headerTitle = t('serviceRevenueReport', 'Service Revenue Report');

  const handleSearch = (filters: any) => {
    setHasSearched(true);

    // Check if date range is provided
    if (filters.startDate && filters.endDate) {
      // TODO: When endpoint is ready, fetch data here
      // For now, just set empty data
      setReportData([]);
    } else {
      setReportData([]);
    }
  };

  const serviceColumns = [
    { key: 'service', header: t('service', 'Service') },
    { key: 'chirurgie', header: t('chirurgie', 'Chirurgie') },
    { key: 'consommables', header: t('consommables', 'Consommables') },
    { key: 'dermatologie', header: t('dermatologie', 'Dermatologie') },
    { key: 'echographie', header: t('echographie', 'Echographie') },
    { key: 'formalitesAdministratives', header: t('formalitesAdministratives', 'Formalités Administratives') },
    { key: 'hospitalisation', header: t('hospitalisation', 'Hospitalisation') },
    { key: 'kinestherapie', header: t('kinestherapie', 'Kinésthérapie') },
    { key: 'laboratoire', header: t('laboratoire', 'Laboratoire') },
    { key: 'maternite', header: t('maternite', 'Maternité') },
    { key: 'medecineInterne', header: t('medecineInterne', 'Médecine Interne') },
    { key: 'medicaments', header: t('medicaments', 'Médicaments') },
    { key: 'ophtalmologie', header: t('ophtalmologie', 'Ophtalmologie') },
    { key: 'orl', header: t('orl', 'ORL') },
    { key: 'oxygenotherapie', header: t('oxygenotherapie', 'Oxygénothérapie') },
    { key: 'pediatrie', header: t('pediatrie', 'Pédiatrie') },
    { key: 'radiologie', header: t('radiologie', 'Radiologie') },
    { key: 'soinsInfirmiers', header: t('soinsInfirmiers', 'Soins Infirmiers') },
    { key: 'soinsTherapeutiques', header: t('soinsTherapeutiques', 'Soins Thérapeutiques') },
    { key: 'stomatologie', header: t('stomatologie', 'Stomatologie') },
    { key: 'autres', header: t('autres', 'Autres') },
    { key: 'consultation', header: t('consultation', 'Consultation') },
    { key: 'ambulance', header: t('ambulance', 'Ambulance') },
    { key: 'total', header: t('total', 'Total') },
  ];

  return (
    <div>
      <h2>{headerTitle}</h2>
      <ReportFilterForm fields={['startDate', 'endDate']} onSearch={handleSearch} />

      {!hasSearched || reportData.length === 0 ? (
        <EmptyState displayText={headerTitle} headerTitle={headerTitle} />
      ) : (
        <div style={{ marginTop: '1rem' }}>
          <DataTable rows={reportData} headers={serviceColumns}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()}>
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
        </div>
      )}
    </div>
  );
};

export default ServiceRevenueReport;
