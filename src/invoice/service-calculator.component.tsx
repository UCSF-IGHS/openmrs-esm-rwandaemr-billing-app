import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Form, NumberInput, TextInput, Button, InlineLoading, Tile } from '@carbon/react';
import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { errorHandler, commonErrorMessages } from '../utils/error-handler';
import {
  getServices,
  getServiceCategories,
  getBillableServices,
  getDepartments,
  type HopService,
  type ServiceCategory,
  type BillableService,
  type Department,
  getBillableServiceId,
} from '../api/billing';
import { mapHopServiceToDepartmentEnhanced, createHopServiceToDepartmentMapping } from '../utils/department-mapping';
import styles from './service-calculator.scss';

interface ServiceCalculatorProps {
  patientUuid?: string;
  insuranceCardNo?: string;
  onClose?: () => void;
  onSave?: (calculatorItems: any[]) => void;
}

interface NormalizedService {
  serviceId: number;
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

  const [departments, setDepartments] = useState<Department[]>([]);
  const [hopServices, setHopServices] = useState<HopService[]>([]);
  const [hopServiceToDepartmentMap, setHopServiceToDepartmentMap] = useState<Map<number, number>>(new Map());
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

  // Helper function to determine if current selection is for medications/drugs
  const isDrugCategory = useCallback(() => {
    if (!serviceCategoryId || !serviceCategories.length) return false;

    const selectedCategory = serviceCategories.find((cat) => cat.serviceCategoryId?.toString() === serviceCategoryId);

    if (!selectedCategory) return false;

    const categoryName = selectedCategory.name.toLowerCase();

    const drugKeywords = [
      'medicament',
      'medication',
      'drug',
      'medicine',
      'pharmacy',
      'pharmaceutique',
      'pharmacie',
      'médicament',
    ];

    return drugKeywords.some((keyword) => categoryName.includes(keyword));
  }, [serviceCategoryId, serviceCategories]);

  useEffect(() => {
    const fetchDepartmentsAndServices = async () => {
      setIsLoadingDepartments(true);
      try {
        const [departmentResults, hopServiceResults] = await Promise.all([getDepartments(), getServices()]);

        if (departmentResults && departmentResults.length > 0) {
          setDepartments(departmentResults);
        } else {
          errorHandler.handleWarning('No departments found in response', null, {
            component: 'service-calculator',
            action: 'fetchDepartments',
          });
        }

        if (hopServiceResults && hopServiceResults.length > 0) {
          setHopServices(hopServiceResults);

                      // Create the mapping between HopServices and Departments
            if (departmentResults && departmentResults.length > 0) {
              const mapping = createHopServiceToDepartmentMapping(hopServiceResults, departmentResults);
              setHopServiceToDepartmentMap(mapping);
            }
        } else {
          errorHandler.handleWarning('No hop services found in response', null, {
            component: 'service-calculator',
            action: 'fetchHopServices',
          });
        }
      } catch (error) {
        errorHandler.handleError(
          error,
          { component: 'service-calculator', action: 'fetchDepartmentsAndServices' },
          commonErrorMessages.fetchError,
        );
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    fetchDepartmentsAndServices();
  }, []);

  const fetchServiceCategories = useCallback(
    async (departmentId: string) => {
      if (!departmentId) return;

      setIsLoadingServiceCategories(true);
      setServiceCategories([]);
      setServiceCategoryId('');
      setServiceId('');
      setDrugFrequency('');

      try {
        const response = await getServiceCategories(departmentId, insuranceCardNo || '0');

        if (response && response.results && response.results.length > 0) {
          setServiceCategories(response.results);
        } else {
          errorHandler.handleWarning('No service categories found for department', null, {
            component: 'service-calculator',
            action: 'fetchServiceCategories',
          });
        }
      } catch (error) {
        errorHandler.handleError(
          error,
          { component: 'service-calculator', action: 'fetchServiceCategories' },
          commonErrorMessages.fetchError,
        );
      } finally {
        setIsLoadingServiceCategories(false);
      }
    },
    [insuranceCardNo],
  );

  const fetchBillableServices = useCallback(
    async (serviceCategoryId: string) => {
      if (!serviceCategoryId) return;

      setIsLoadingBillableServices(true);
      setBillableServices([]);
      setServiceId('');
      if (!isDrugCategory()) {
        setDrugFrequency('');
      }

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
          errorHandler.handleWarning('No billable services found or invalid response format', null, {
            component: 'service-calculator',
            action: 'fetchBillableServices',
          });
        }
      } catch (error) {
        errorHandler.handleError(
          error,
          { component: 'service-calculator', action: 'fetchBillableServices' },
          commonErrorMessages.fetchError,
        );
      } finally {
        setIsLoadingBillableServices(false);
      }
    },
    [isDrugCategory],
  );

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

  useEffect(() => {
    const newTotal = calculatorItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setTotal(newTotal);
  }, [calculatorItems]);

  const validateInputs = () => {
    const newErrors = {
      departmentUuid: !departmentUuid ? t('departmentRequired', 'Department is required') : '',
      serviceCategoryId: !serviceCategoryId ? t('serviceCategoryRequired', 'Service category is required') : '',
      serviceId: !serviceId ? t('serviceRequired', 'Service is required') : '',
      quantity: quantity <= 0 ? t('quantityRequired', 'Quantity must be greater than 0') : '',
    };

    setErrors(newErrors);
    return Object.values(newErrors).every((error) => !error);
  };

  const addService = async () => {
    if (!validateInputs()) return;

    const service = billableServices.find((s) => s.serviceId?.toString() === serviceId);
    if (!service) return;

    try {
      const billableServiceId = await getBillableServiceId(serviceCategoryId, serviceId);

      const existingIndex = calculatorItems.findIndex(
        (item) =>
          item.facilityServicePriceId?.toString() === serviceId && item.departmentId?.toString() === departmentUuid,
      );

      let updatedItems;
      if (existingIndex >= 0) {
        updatedItems = [...calculatorItems];
        updatedItems[existingIndex] = {
          ...updatedItems[existingIndex],
          quantity: updatedItems[existingIndex].quantity + quantity,
          drugFrequency: drugFrequency || updatedItems[existingIndex].drugFrequency,
        };
      } else {
        const department = departments.find((d) => d.departmentId.toString() === departmentUuid);
        const serviceCategory = serviceCategories.find((c) => c.serviceCategoryId?.toString() === serviceCategoryId);

        if (!department) {
          errorHandler.handleError(
            new Error(`Department with ID ${departmentUuid} not found`),
            { component: 'service-calculator', action: 'addService' },
            { title: 'Department not found', kind: 'error' },
          );
          return;
        }

          let correspondingHopService = hopServices.find(
          (hs) => mapHopServiceToDepartmentEnhanced(hs, departments)?.departmentId === department.departmentId,
        );

        if (!correspondingHopService) {
          correspondingHopService = hopServices.find(
            (hs) =>
              hs.name.toLowerCase().includes(department.name.toLowerCase()) ||
              department.name.toLowerCase().includes(hs.name.toLowerCase()),
          );
        }

        if (!correspondingHopService && hopServices.length > 0) {
          correspondingHopService = hopServices[0];
        }

        const newItem = {
          id: serviceId,
          serviceId: Number(service.serviceId),
          name: service.name,
          price: service.price,
          totalPrice: service.price * quantity,
          departmentName: department.name,
          departmentId: department.departmentId,
          serviceCategoryId: Number(serviceCategoryId),
          serviceCategoryName: serviceCategory?.name || '',
          originalData: service.originalData,
          quantity,
          drugFrequency: isDrugCategory() ? drugFrequency || '' : '',
          isDrug: isDrugCategory(),
          serviceDate: new Date().toISOString(),
          itemType: service.originalData?.facilityServicePrice?.itemType || 1,
          billableServiceId: billableServiceId,
          facilityServicePriceId: parseInt(serviceId, 10),
          hopServiceId: correspondingHopService?.serviceId || department.departmentId,
        };

                updatedItems = [...calculatorItems, newItem];
      }

      setCalculatorItems(updatedItems);
      onSave && onSave(updatedItems);

      setServiceId('');
      setQuantity(1);
      if (isDrugCategory()) {
        setDrugFrequency('');
      }
    } catch (error) {
      errorHandler.handleError(
        error,
        { component: 'service-calculator', action: 'addService' },
        { title: 'Error adding service', kind: 'error' },
      );
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = calculatorItems.filter((_, i) => i !== index);
    setCalculatorItems(updatedItems);
    onSave && onSave(updatedItems);
  };

  const clearAll = () => {
    setCalculatorItems([]);
    onSave && onSave([]);
  };

  return (
    <div className={styles.calculatorWrapper}>
      <Tile light className={styles.formTile}>
        <Form className={styles.form}>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>{t('department', 'Department')}</label>
                <Dropdown
                  id="department"
                  titleText=""
                  label={isLoadingDepartments ? t('loading', 'Loading...') : t('pleaseSelect', 'Please select')}
                  items={departments.map((dept) => dept.departmentId.toString())}
                  itemToString={(id) => departments.find((d) => d.departmentId.toString() === id)?.name || ''}
                  invalid={!!errors.departmentUuid}
                  invalidText={errors.departmentUuid}
                  onChange={({ selectedItem }) => {
                    setDepartmentUuid(selectedItem);
                    setServiceCategoryId('');
                    setServiceId('');
                    setDrugFrequency(''); 
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
                  titleText=""
                  label={isLoadingServiceCategories ? t('loading', 'Loading...') : t('pleaseSelect', 'Please select')}
                  items={serviceCategories
                    .filter((cat) => cat && cat.serviceCategoryId)
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
                    setDrugFrequency(''); 
                  }}
                  selectedItem={serviceCategoryId}
                  size="sm"
                  disabled={!departmentUuid || isLoadingServiceCategories}
                />
                {isLoadingServiceCategories && <InlineLoading className={styles.inlineLoading} />}
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formField}>
                <label className={styles.fieldLabel}>{t('service', 'Service')}</label>
                <Dropdown
                  id="service"
                  titleText=""
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
              </div>

              <div className={styles.formField}>
                <NumberInput
                  id="quantity"
                  label={t('quantity', 'Quantity')}
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value ? parseInt(event.target.value, 10) : 1)}
                  invalid={!!errors.quantity}
                  invalidText={errors.quantity}
                  size="sm"
                />
              </div>
            </div>

            {/* Drug Frequency - Only show for medication categories */}
            {isDrugCategory() && (
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <TextInput
                    id="drugFrequency"
                    labelText={t('drugFrequency', 'Drug Frequency')}
                    placeholder={t('enterFrequency', 'e.g., 1×3, 2×2, etc.')}
                    value={drugFrequency}
                    onChange={(e) => setDrugFrequency(e.target.value)}
                    size="sm"
                  />
                </div>
              </div>
            )}

            <div className={styles.formRow}>
              <div className={styles.formField}>
                <Button
                  onClick={addService}
                  kind="primary"
                  size="sm"
                  disabled={!serviceId || isLoadingBillableServices}
                >
                  {t('addService', 'Add Service')}
                </Button>
              </div>
            </div>
          </div>
        </Form>
      </Tile>

      {calculatorItems.length > 0 && (
        <Tile className={styles.itemsList}>
          <div className={styles.itemsHeader}>
            <h4>{t('selectedServices', 'Selected Services')}</h4>
            <Button onClick={clearAll} kind="ghost" size="sm">
              {t('clearAll', 'Clear All')}
            </Button>
          </div>

          {calculatorItems.map((item, index) => (
            <div key={index} className={styles.itemRow}>
              <div className={styles.itemDetails}>
                <strong>{item.name}</strong>
                <p className={styles.itemMeta}>
                  {item.departmentName} - {item.serviceCategoryName}
                </p>
                <p className={styles.itemCalculation}>
                  {t('quantity', 'Quantity')}: {item.quantity} × {item.price.toLocaleString()} {defaultCurrency} ={' '}
                  {item.totalPrice.toLocaleString()} {defaultCurrency}
                </p>
                {item.drugFrequency && (
                  <p className={styles.itemFrequency}>
                    <strong>{t('frequency', 'Frequency')}:</strong> {item.drugFrequency}
                  </p>
                )}
              </div>
              <Button
                onClick={() => removeItem(index)}
                kind="ghost"
                size="sm"
                hasIconOnly
                iconDescription={t('remove', 'Remove')}
              >
                ×
              </Button>
            </div>
          ))}

          <div className={styles.totalSection}>
            <strong>
              {t('total', 'Total')}: {total.toLocaleString()} {defaultCurrency}
            </strong>
          </div>
        </Tile>
      )}
    </div>
  );
};

export default ServiceCalculator;
