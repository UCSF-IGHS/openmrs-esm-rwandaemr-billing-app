import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
  Pagination
} from '@carbon/react';
import styles from './bill-list-table.scss';

// Bill list data structure
export interface BillListItem {
  id: string;
  uuid: string;
  visitTime: string;
  identifier: string;
  name: string;
  billedItems: string;
}

interface BillListTableProps {
  data?: BillListItem[];
}

// Dummy data for the bill list table
const DEFAULT_DUMMY_DATA: BillListItem[] = [
  {
    id: '1',
    uuid: '1',
    visitTime: 'Today, 11:39 AM',
    identifier: '10006A3',
    name: 'Temurbek Rajapboyev',
    billedItems: 'Antenatal care'
  },
  {
    id: '2',
    uuid: '2',
    visitTime: '24 — Feb — 2025',
    identifier: '100008E',
    name: 'Joshua Johnson',
    billedItems: 'Azithromycin'
  },
  {
    id: '3',
    uuid: '3',
    visitTime: '24 — Feb — 2025',
    identifier: '100006X',
    name: 'Richard Jones',
    billedItems: 'Orthopedic Service'
  },
  {
    id: '4',
    uuid: '4',
    visitTime: '24 — Feb — 2025',
    identifier: '100013P',
    name: 'George Phillips',
    billedItems: 'Orthopedic Service'
  },
  {
    id: '5',
    uuid: '5',
    visitTime: '24 — Feb — 2025',
    identifier: '100000Y',
    name: 'Betty Williams',
    billedItems: 'Antenatal care'
  }
];

const BillListTable: React.FC<BillListTableProps> = ({ data = DEFAULT_DUMMY_DATA }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Define headers for the bill list table with column width classes
  const headerData = [
    { 
      key: 'visitTime', 
      header: t('visitTime', 'Visit time'),
      className: styles.visitTimeCol
    },
    { 
      key: 'identifier', 
      header: t('identifier', 'Identifier'),
      className: styles.identifierCol
    },
    { 
      key: 'name', 
      header: t('name', 'Name'),
      className: styles.nameCol
    },
    { 
      key: 'billedItems', 
      header: t('billedItems', 'Billed Items'),
      className: styles.billedItemsCol
    }
  ];
  
  // Format the data for better display
  const formattedData = data.map(item => ({
    ...item,
    // Format elements explicitly to prevent UI issues
    visitTime: item.visitTime,
    identifier: item.identifier,
    name: item.name,
    billedItems: item.billedItems
  }));

  // Handle pagination change
  const handlePaginationChange = ({ page, pageSize }) => {
    setCurrentPage(page);
    setPageSize(pageSize);
  };

  return (
    <div className={styles.container}>
      {/* Header with "Recent Bills" */}
      <div className={styles.desktopHeading}>
        <h4>{t('recentBills', 'Recent Bills')}</h4>
      </div>
      
      <div className={styles.billHistoryContainer}>
        <DataTable 
          rows={formattedData} 
          headers={headerData} 
          size="lg" 
          useZebraStyles
          isSortable={false}
          overflowMenuOnHover={false}
          className={styles.dataTable}
        >
          {({
            rows,
            headers,
            getTableProps,
            getTableContainerProps,
            getHeaderProps,
            getRowProps,
          }) => (
            <TableContainer {...getTableContainerProps()}>
              <Table className={styles.table} {...getTableProps()} aria-label="Recent bills">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        key={header.key}
                        {...getHeaderProps({
                          header,
                          className: header.className
                        })}
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
                        // Find the corresponding header to get its className
                        const headerClass = headers.find(h => h.key === cell.info.header)?.className || '';
                        
                        return (
                          <TableCell 
                            key={cell.id} 
                            className={`${styles.tableCells} ${headerClass}`}
                          >
                            {cell.info.header === 'name' ? (
                              <a href="#" className={styles.nameLink}>{cell.value}</a>
                            ) : (
                              cell.value
                            )}
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
        <Pagination
          forwardText={t('nextPage', 'Next page')}
          backwardText={t('previousPage', 'Previous page')}
          page={currentPage}
          pageSize={pageSize}
          pageSizes={[5, 10, 20]}
          totalItems={data.length}
          className={styles.pagination}
          size="sm"
          onChange={handlePaginationChange}
        />
      </div>
    </div>
  );
};

export default BillListTable;
