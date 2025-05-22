import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Form, NumberInput, TextInput, Button, InlineLoading, Tile } from '@carbon/react';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import {
  getServices,
  getServiceCategories,
  getBillableServices,
  type HopService,
  type ServiceCategory,
  type BillableService,
  getBillableServiceId,
} from '../api/billing';
import styles from './service-calculator.scss';

interface ServiceCalculatorProps {
  patientUuid?: string;
  insuranceCardNo?: string;
  onClose?: () => void;
  onSave?: (calculatorItems: any[]) => void;
}

interface NormalizedService {
  serviceId: string | number;
  name: string;
  price: number;
  originalData: any;
}

const ServiceCalculator: React.FC<ServiceCalculatorProps> = ({ patientUuid, insuranceCardNo, onClose, onSave }) => {
  const { t } = useTranslation();
  const config = useConfig();
  const defaultCurrency = config?.defaultCurrency || 'RWF';

  const [departmentUuid, setDepartmentUuid] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [drugFrequency, setDrugFrequency] = useState('');

  const [departments, setDepartments] = useState<HopService[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isLoadingServiceCategories, setIsLoadingServiceCategories] = useState(false);
  const [isLoadingBillableServices, setIsLoadingBillableServices] = useState(false);

  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [billableServices, setBillableServices] = useState<NormalizedService[]>([]);

  const [errors, setErrors] = useState({
    departmentUuid: '',
    serviceCategoryId: '',
    serviceId: '',
    quantity: '',
  });

  const [calculatorItems, setCalculatorItems] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        const services = await getServices();

        if (services && services.length > 0) {
          const transformedDepts = services.map((dept) => ({
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

  const fetchServiceCategories = useCallback(
    async (departmentId: string) => {
      if (!departmentId) return;

      setIsLoadingServiceCategories(true);
      setServiceCategories([]);
      setBillableServices([]);
      setServiceCategoryId('');
      setServiceId('');

      try {
        const ipCardNumber = insuranceCardNo || '0';

        const categories = await getServiceCategories(departmentId, ipCardNumber);

        if (categories && categories.results && categories.results.length > 0) {
          setServiceCategories(categories.results);
        } else {
          console.error('Failed to fetch service categories: No data returned');
        }
      } catch (error) {
        console.error('Error fetching service categories:', error);
      } finally {
        setIsLoadingServiceCategories(false);
      }
    },
    [insuranceCardNo],
  );

  const fetchBillableServices = useCallback(async (serviceCategoryId: string) => {
    if (!serviceCategoryId) return;

    setIsLoadingBillableServices(true);
    setBillableServices([]);
    setServiceId('');

    try {
      const services = await getBillableServices(serviceCategoryId);

      if (services && services.results && services.results.length > 0) {
        const formattedServices = services.results
          .filter((service) => service != null)
          .map((service, index) => {
            const id = service.serviceId || index + 1;
            const serviceName = service.facilityServicePrice?.name || (service as any).name || `Service ${index + 1}`;

            const servicePrice = service.facilityServicePrice?.fullPrice || (service as any).maximaToPay || 0;

            return {
              serviceId: id,
              name: serviceName || `Unknown Service ${id}`,
              price: servicePrice,
              originalData: service,
            };
          });

        setBillableServices(formattedServices);
      } else {
        console.warn('No billable services found or invalid response format');
      }
    } catch (error) {
      console.error('Error fetching billable services:', error);
    } finally {
      setIsLoadingBillableServices(false);
    }
  }, []);

  useEffect(() => {
    if (departmentUuid) {
      fetchServiceCategories(departmentUuid);
    }
  }, [departmentUuid, fetchServiceCategories]);

  useEffect(() => {
    if (serviceCategoryId) {
      fetchBillableServices(serviceCategoryId);
    }
  }, [serviceCategoryId, fetchBillableServices]);

  const getBillableServiceById = (serviceId: string) => {
    if (!serviceId) {
      return null;
    }

    const service = billableServices.find((service) => service.serviceId.toString() === serviceId);
    return service;
  };

  const validateForm = () => {
    const newErrors = {
      departmentUuid: '',
      serviceCategoryId: '',
      serviceId: '',
      quantity: '',
    };

    if (!departmentUuid) {
      newErrors.departmentUuid = t('departmentRequired', 'Department is required');
    }

    if (!serviceCategoryId) {
      newErrors.serviceCategoryId = t('serviceCategoryRequired', 'Service Category is required');
    }

    if (!serviceId) {
      newErrors.serviceId = t('serviceRequired', 'Service is required');
    }

    if (!quantity || quantity < 1) {
      newErrors.quantity = t('quantityRequired', 'Quantity must be at least 1');
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error);
  };

  const addService = async () => {
    if (!validateForm()) return;

    try {
      const service = getBillableServiceById(serviceId);
      if (!service) {
        console.error('Service not found for ID:', serviceId);
        return;
      }

      let billableServiceId = null;
      try {
        billableServiceId = await getBillableServiceId(serviceCategoryId, serviceId);

        if (billableServiceId === null) {
          console.error('Failed to retrieve billable service ID');
          console.warn('Continuing without billable service ID - this may cause errors when saving');
        }
      } catch (error) {
        console.error('Error retrieving billable service ID:', error);
        console.warn('Continuing without billable service ID - this may cause errors when saving');
      }

      const existingIndex = calculatorItems.findIndex((item) => item.serviceId.toString() === serviceId);

      let updatedItems;
      if (existingIndex >= 0) {
        updatedItems = [...calculatorItems];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
          drugFrequency: drugFrequency || updatedItems[existingIndex].drugFrequency,
        };
      } else {
        const department = departments.find((d) => d.serviceId.toString() === departmentUuid);
        const serviceCategory = serviceCategories.find((c) => c.serviceCategoryId?.toString() === serviceCategoryId);

        const hopServiceId = department?.serviceId || parseInt(departmentUuid, 10);

        const newItem = {
          id: serviceId,
          serviceId: Number(service.serviceId),
          name: service.name,
          price: service.price,
          totalPrice: service.price * quantity,
          departmentName: department?.name || '',
          departmentId: Number(departmentUuid),
          serviceCategoryId: Number(serviceCategoryId),
          serviceCategoryName: serviceCategory?.name || '',
          originalData: service.originalData,
          quantity,
          drugFrequency: drugFrequency || '',
          isDrug: departmentUuid === '11',
          serviceDate: new Date().toISOString(),
          itemType: service.originalData?.facilityServicePrice?.itemType || 1,
          billableServiceId: billableServiceId,
          facilityServicePriceId: parseInt(serviceId, 10),
          hopServiceId: hopServiceId,
        };

        updatedItems = [...calculatorItems, newItem];
      }

      setCalculatorItems(updatedItems);
      onSave && onSave(updatedItems);

      setServiceId('');
      setQuantity(1);
      setDrugFrequency('');
    } catch (error) {
      console.error('Error adding service:', error);
    }
  };

  useEffect(() => {
    const newTotal = calculatorItems.reduce((sum, item) => sum + (item.totalPrice || item.price * item.quantity), 0);
    setTotal(newTotal);
  }, [calculatorItems]);

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

  // Update drug frequency
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
                  setServiceCategoryId('');
                  setServiceId('');
                }}
                selectedItem={departmentUuid}
                size="sm"
                disabled={isLoadingDepartments}
              />
              {isLoadingDepartments && <InlineLoading className={styles.inlineLoading} />}
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>{t('serviceCategory', 'Service Category')}</label>
              <Dropdown
                id="serviceCategory"
                label={isLoadingServiceCategories ? t('loading', 'Loading...') : t('pleaseSelect', 'Please select')}
                items={serviceCategories
                  .filter((cat) => cat && cat.serviceCategoryId) // Filter out categories with missing IDs
                  .map((cat) => cat.serviceCategoryId.toString())}
                itemToString={(id) => {
                  if (!id) return '';
                  return (
                    serviceCategories.find((cat) => cat.serviceCategoryId && cat.serviceCategoryId.toString() === id)
                      ?.name || ''
                  );
                }}
                invalid={!!errors.serviceCategoryId}
                invalidText={errors.serviceCategoryId}
                onChange={({ selectedItem }) => {
                  setServiceCategoryId(selectedItem);
                  setServiceId('');
                }}
                selectedItem={serviceCategoryId}
                size="sm"
                disabled={!departmentUuid || isLoadingServiceCategories}
              />
              {isLoadingServiceCategories && <InlineLoading className={styles.inlineLoading} />}
            </div>

            <div className={styles.formField}>
              <label className={styles.fieldLabel}>{t('service', 'Service')}</label>
              <Dropdown
                id="service"
                label={
                  isLoadingBillableServices
                    ? t('loading', 'Loading...')
                    : billableServices.length === 0
                      ? t('noServicesAvailable', 'No services available')
                      : t('pleaseSelect', 'Please select')
                }
                items={billableServices.map((svc) => svc.serviceId?.toString() || '')}
                itemToString={(id) => {
                  if (!id) return '';
                  const service = billableServices.find((s) => s.serviceId?.toString() === id);
                  if (!service) return `Service ID: ${id}`;
                  return `${service.name || 'Unnamed Service'} (${service.price || 0} ${defaultCurrency})`;
                }}
                invalid={!!errors.serviceId}
                invalidText={errors.serviceId}
                onChange={({ selectedItem }) => {
                  setServiceId(selectedItem);
                }}
                selectedItem={serviceId}
                disabled={!serviceCategoryId || isLoadingBillableServices || billableServices.length === 0}
                size="md"
              />
              {isLoadingBillableServices && <InlineLoading className={styles.inlineLoading} />}
              {!isLoadingBillableServices && billableServices.length === 0 && (
                <div className={styles.emptyStateMessage}></div>
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
              <Button className={styles.addButton} kind="primary" onClick={addService} disabled={!serviceId} size="md">
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
                <tr key={`${item.serviceId}-${index}`}>
                  <td className={styles.itemCell}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemDept}>
                      {item.departmentName} - {item.serviceCategoryName}
                    </div>
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
