import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dropdown,
  Form,
  NumberInput,
  TextInput,
  Button,
  InlineLoading,
  Tile
} from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { getServices, getFacilityServicePrices, type HopService, getMappedBillableServices, getBillableServiceById } from '../api/billing';
import styles from './service-calculator.scss';

interface ServiceCalculatorProps {
  patientUuid?: string;
  insuranceCardNo?: string;
  onClose?: () => void;
  onSave?: (calculatorItems: any[]) => void;
}

// Define a clear interface for our service items
interface ServiceItem {
  id: string;
  facilityServicePriceId: number;
  billableServiceId: number;
  name: string;
  fullPrice: number;
  category?: string;
  itemType: number;
  shortName?: string;
  description?: string;
}

const ServiceCalculator: React.FC<ServiceCalculatorProps> = ({ 
  patientUuid, 
  insuranceCardNo, 
  onClose, 
  onSave 
}) => {
  const { t } = useTranslation();
  const config = useConfig();
  const defaultCurrency = config?.defaultCurrency || 'RWF';
  
  // State
  const [departmentUuid, setDepartmentUuid] = useState('');
  const [serviceUuid, setServiceUuid] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [drugFrequency, setDrugFrequency] = useState('');
  
  const [departments, setDepartments] = useState<HopService[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  
  const [departmentServices, setDepartmentServices] = useState<Record<string, ServiceItem[]>>({});
  const [validBillableServiceIds, setValidBillableServiceIds] = useState<number[]>([]);
  
  const [errors, setErrors] = useState({
    departmentUuid: '',
    serviceUuid: '',
    quantity: '',
  });
  
  const [calculatorItems, setCalculatorItems] = useState([]);
  const [total, setTotal] = useState(0);
  
  // Helper functions - defined first to avoid TypeScript errors
  const getServicesForDepartment = useCallback((departmentUuid: string) => {
    return departmentServices[departmentUuid] || [];
  }, [departmentServices]);
  
  const getServiceByUuid = useCallback((serviceUuid: string) => {
    for (const deptUuid in departmentServices) {
      const service = departmentServices[deptUuid]?.find(s => s.id === serviceUuid);
      if (service) return service;
    }
    return null;
  }, [departmentServices]);

  const debugDepartmentServices = useCallback((departmentId: string) => {
    console.group(`🔍 Debug Department Services for ID: ${departmentId}`);
    console.log('Current departmentServices state:', departmentServices);
    
    if (departmentServices[departmentId]) {
      console.log(`Found ${departmentServices[departmentId].length} services for department ${departmentId}`);
      console.log('Sample services:', departmentServices[departmentId].slice(0, 3));
    } else {
      console.log(`No services cached for department ${departmentId}`);
    }
    
    const servicesToDisplay = getServicesForDepartment(departmentId);
    console.log(`getServicesForDepartment returns ${servicesToDisplay.length} services`);
    console.log('Sample services from getServicesForDepartment:', servicesToDisplay.slice(0, 3));
    
    console.groupEnd();
  }, [departmentServices, getServicesForDepartment]);
  
  const validateForm = () => {
    const newErrors = {
      departmentUuid: '',
      serviceUuid: '',
      quantity: '',
    };
    
    if (!departmentUuid) {
      newErrors.departmentUuid = t('departmentRequired', 'Department is required');
    }
    
    if (!serviceUuid) {
      newErrors.serviceUuid = t('serviceRequired', 'Service is required');
    }
    
    if (!quantity || quantity < 1) {
      newErrors.quantity = t('quantityRequired', 'Quantity must be at least 1');
    }
    
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };
  
  // Load departments
  useEffect(() => {
    const fetchDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        const services = await getServices();
        
        if (services && services.length > 0) {
          const transformedDepts = services.map(dept => ({
            ...dept,
            uuid: dept.serviceId.toString(),
          }));
          setDepartments(transformedDepts);
        } else {
          console.error('Failed to fetch departments: No data returned');
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    
    fetchDepartments();
  }, []);

  // Load billable services for a department
  useEffect(() => {
    const fetchBillableServicesForDepartment = async (departmentId: string) => {
      if (!departmentId) {
        return;
      }
      
      // Don't fetch if we already have services for this department
      if (departmentServices[departmentId] && departmentServices[departmentId].length > 0) {
        console.log(`Using cached services for department ${departmentId}`);
        return;
      }
      
      setIsLoadingServices(true);
      try {
        console.log(`Fetching services for department ${departmentId}`);
        
        const mappedServices = await getMappedBillableServices(parseInt(departmentId));
        
        console.log(`Retrieved ${mappedServices.length} services for department ${departmentId}`);
        console.log('First few services:', mappedServices.slice(0, 3));
        
        const validatedMappedServices = await Promise.all(
          mappedServices.map(async (service) => {
            if (!service.billableServiceId || isNaN(service.billableServiceId)) {
              const billable = await getBillableServiceById(service.facilityServicePriceId);
              return {
                ...service,
                billableServiceId: billable?.serviceId || null,
              };
            }
            return service;
          })
        );
        
        // Replace the mapped services with the validated ones
        setDepartmentServices(prev => ({
          ...prev,
          [departmentId]: validatedMappedServices
        }));
        
        // If we got services, select the first one by default (optional)
        if (validatedMappedServices.length > 0) {
          setServiceUuid(validatedMappedServices[0].id);
        }
        
        // Always update the state, even if empty
        setDepartmentServices(prev => ({
          ...prev,
          [departmentId]: mappedServices
        }));
        
        // If we got services, select the first one by default (optional)
        if (mappedServices.length > 0) {
          setServiceUuid(mappedServices[0].id);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        setDepartmentServices(prev => ({
          ...prev,
          [departmentId]: []
        }));
      } finally {
        setIsLoadingServices(false);
      }
    };
    
    if (departmentUuid) {
      fetchBillableServicesForDepartment(departmentUuid);
    }
  }, [departmentUuid]);
  
  // Add service to calculator
  const addService = async () => {
    if (!validateForm()) return;

    const service = getServiceByUuid(serviceUuid);
    if (!service) {
      setErrors((prev) => ({
        ...prev,
        serviceUuid: t('serviceNotFound', 'Service not found'),
      }));
      return;
    }

    // Log the selected service to debug
    console.log('Selected service for adding to calculator:', service);
    
    if (!service.billableServiceId) {
      console.warn('Fetching missing billableServiceId for service:', service);
      const billableService = await getBillableServiceById(service.facilityServicePriceId);
      if (billableService) {
        service.billableServiceId = billableService.serviceId;
      } else {
        console.error('Failed to fetch Billable Service for FacilityServicePriceId:', service.facilityServicePriceId);
        setErrors((prev) => ({
          ...prev,
          serviceUuid: t('invalidService', 'Invalid service - missing required ID'),
        }));
        return;
      }
    }

    const department = departments.find((d) => d.serviceId.toString() === departmentUuid);
    if (!department) {
      setErrors((prev) => ({
        ...prev,
        departmentUuid: t('departmentNotFound', 'Department not found'),
      }));
      return;
    }

    const isDrug = departmentUuid === '11'; // Assuming department ID 11 is for drugs
    let sanitizedDrugFrequency = '';

    // Only set drug frequency for drugs
    if (isDrug) {
      sanitizedDrugFrequency = (drugFrequency || '').trim();
    }

    const existingIndex = calculatorItems.findIndex((item) => item.uuid === serviceUuid);

    let updatedItems;
    if (existingIndex >= 0) {
      updatedItems = [...calculatorItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + quantity,
        drugFrequency: isDrug ? sanitizedDrugFrequency : updatedItems[existingIndex].drugFrequency,
      };
    } else {
      const newItem = {
        id: serviceUuid,
        uuid: serviceUuid,
        facilityServicePriceId: service.facilityServicePriceId,
        billableServiceId: service.billableServiceId,
        name: service.name,
        displayName: service.name,
        departmentName: department.name || '',
        departmentId: departmentUuid,
        price: service.fullPrice,
        quantity,
        drugFrequency: sanitizedDrugFrequency,
        isDrug,
        serviceDate: new Date().toISOString(),
        itemType: service.itemType || 1,
        description: service.description || '',
        service: { 
          serviceId: service.billableServiceId, // Using the real billableServiceId here
          name: service.name,
          displayName: service.name,
          description: service.description || ''
        },
        category: service.category
      };

      console.log('Adding new calculator item:', newItem);
      updatedItems = [...calculatorItems, newItem];
    }

    setCalculatorItems(updatedItems);
    onSave && onSave(updatedItems);

    // Reset form fields
    setServiceUuid('');
    setQuantity(1);
    setDrugFrequency('');
  };
  
  // Calculate total
  useEffect(() => {
    const newTotal = calculatorItems.reduce(
      (sum, item) => sum + (item.totalPrice || (item.price * item.quantity)), 
      0
    );
    setTotal(newTotal);
  }, [calculatorItems]);
  
  // Item management functions
  const removeItem = (index) => {
    const updatedItems = [...calculatorItems];
    updatedItems.splice(index, 1);
    setCalculatorItems(updatedItems);
    
    onSave && onSave(updatedItems);
  };
  
  const updateItemQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    
    const updatedItems = [...calculatorItems];
    updatedItems[index] = {
      ...updatedItems[index],
      quantity: newQuantity,
    };
    setCalculatorItems(updatedItems);
    
    onSave && onSave(updatedItems);
  };
  
  const updateDrugFrequency = (index, frequency) => {
    const updatedItems = [...calculatorItems];
    updatedItems[index] = {
      ...updatedItems[index],
      drugFrequency: frequency,
    };
    setCalculatorItems(updatedItems);
    
    onSave && onSave(updatedItems);
  };

  return (
    <div className={styles.calculatorWrapper}>
      <Tile light className={styles.formTile}>
        <Form className={styles.form}>
          <div className={styles.formGrid}>
            {/* Department dropdown */}
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>{t('department', 'Department')}</label>
              <Dropdown
                id="department"
                label={isLoadingDepartments ? t('loading', 'Loading...') : t('pleaseSelect', 'Please select')}
                items={departments.map((dept) => dept.serviceId.toString())}
                itemToString={(uuid) => departments.find((d) => d.serviceId.toString() === uuid)?.name || ''}
                invalid={!!errors.departmentUuid}
                invalidText={errors.departmentUuid}
                onChange={({ selectedItem }) => {
                  setDepartmentUuid(selectedItem);
                  setServiceUuid('');

                  // Debug services
                  setTimeout(() => debugDepartmentServices(selectedItem), 1000);
                }}
                selectedItem={departmentUuid}
                size="sm"
                disabled={isLoadingDepartments}
              />
              {isLoadingDepartments && <InlineLoading className={styles.inlineLoading} />}
            </div>

            {/* Service dropdown */}
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>{t('service', 'Service')}</label>
              <Dropdown
                id="service"
                label={
                  isLoadingServices
                    ? t('loading', 'Loading...')
                    : getServicesForDepartment(departmentUuid).length === 0
                      ? t('noServicesAvailable', 'No services available')
                      : t('pleaseSelect', 'Please select')
                }
                items={getServicesForDepartment(departmentUuid)}
                itemToString={(svc) => {
                  if (!svc) return '';
                  return `${svc.name} (${svc.fullPrice} ${defaultCurrency})`;
                }}
                invalid={!!errors.serviceUuid}
                invalidText={errors.serviceUuid}
                onChange={({ selectedItem }) => {
                  console.log('Service selected:', selectedItem);
                  if (selectedItem) {
                    setServiceUuid(selectedItem.id);
                  }
                }}
                selectedItem={getServiceByUuid(serviceUuid)}
                disabled={!departmentUuid || isLoadingServices || getServicesForDepartment(departmentUuid).length === 0}
                size="md"
              />
              {isLoadingServices && <InlineLoading className={styles.inlineLoading} />}

              {!isLoadingServices && departmentUuid && getServicesForDepartment(departmentUuid).length === 0 && (
                <div className={styles.noServicesMessage}>
                  {t(
                    'noServicesForDepartment',
                    'No services found for this department. Please select a different department.',
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.formControls}>
            <div className={styles.controlsGroup}>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>{t('quantity', 'Quantity')}</label>
                <NumberInput
                  id="quantity"
                  min={1}
                  value={quantity}
                  onChange={(e, { value }) => setQuantity(value)}
                  invalidText={errors.quantity}
                  invalid={!!errors.quantity}
                  hideSteppers={true}
                  size="md"
                  className={styles.numberInput}
                />
              </div>

              {departmentUuid === '11' && (
                <div className={styles.formField}>
                  <label className={styles.fieldLabel}>{t('frequency', 'Frequency')}</label>
                  <TextInput
                    id="drugFrequency"
                    value={drugFrequency}
                    onChange={(e) => setDrugFrequency(e.target.value)}
                    placeholder="e.g. 1×3"
                    size="md"
                  />
                </div>
              )}
            </div>

            <div className={styles.addButtonContainer}>
              <Button
                className={styles.addButton}
                kind="primary"
                onClick={async () => await addService()}
                disabled={!serviceUuid}
                size="md"
              >
                {t('addItem', 'Add Item')}
              </Button>
            </div>
          </div>
        </Form>
      </Tile>

      {/* Items table */}
      {calculatorItems.length > 0 && (
        <div className={styles.tableContainerCompact}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th className={styles.itemColumn}>{t('item', 'Item')}</th>
                <th className={styles.qtyColumn}>{t('qty', 'Qty')}</th>
                <th className={styles.dosageColumn}>{t('dosage', 'Dosage')}</th>
                <th className={styles.priceColumn}>{t('price', 'Price')}</th>
                <th className={styles.actionColumn}></th>
              </tr>
            </thead>

            <tbody>
              {calculatorItems.map((item, index) => (
                <tr key={`${item.uuid}-${index}`}>
                  <td className={styles.itemCell}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemDept}>{item.departmentName}</div>
                  </td>

                  <td className={styles.qtyCell}>
                    <input
                      type="number"
                      id={`item-qty-${index}`}
                      value={item.quantity}
                      min={1}
                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                      className={styles.qtyInputPlain}
                    />
                  </td>

                  <td className={styles.dosageCell}>
                    {item.isDrug ? item.drugFrequency : <span className={styles.notApplicable}>-</span>}
                  </td>

                  <td className={styles.priceCell}>
                    {(item.totalPrice || item.price * item.quantity).toLocaleString()} {defaultCurrency}
                  </td>

                  <td className={styles.actionCell}>
                    <Button
                      kind="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className={styles.removeButton}
                      iconDescription={t('remove', 'Remove')}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={3} className={styles.totalLabelCell}>
                  <span className={styles.totalLabel}>{t('total', 'Total')}:</span>
                </td>
                <td colSpan={2} className={styles.totalAmountCell}>
                  <span className={styles.totalAmount}>
                    {total.toLocaleString()} {defaultCurrency}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceCalculator;
