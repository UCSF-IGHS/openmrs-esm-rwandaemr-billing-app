import { openmrsFetch } from '@openmrs/esm-framework';
import {
  getServices,
  getServiceCategories,
  getBillableServices,
  getFacilityServicePrices,
  getBillableServiceId,
} from '../services';
import { API_CONFIG } from '../../../constants';

// Mock the openmrsFetch function
jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
}));

// Mock the error handler
jest.mock('../../../utils/error-handler', () => ({
  errorHandler: {
    wrapAsync: jest.fn((fn) => fn()),
    createComponentHandler: jest.fn(() => ({})),
    handleError: jest.fn(),
    handleWarning: jest.fn(),
    handleInfo: jest.fn(),
  },
  commonErrorMessages: {
    fetchError: 'Fetch error',
  },
}));

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Services API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getServices', () => {
    it('should fetch services successfully', async () => {
      const mockServices = [
        { serviceId: 1, name: 'Consultation', description: 'Medical consultation' },
        { serviceId: 2, name: 'X-Ray', description: 'X-Ray imaging' },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockServices },
        ok: true,
        status: 200,
      } as any);

      const result = await getServices();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/hopService`);
      expect(result).toEqual(mockServices);
    });
  });

  describe('getServiceCategories', () => {
    it('should fetch service categories successfully', async () => {
      const mockCategories = [
        { categoryId: 1, name: 'Diagnostic', departmentId: 1 },
        { categoryId: 2, name: 'Treatment', departmentId: 1 },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockCategories },
        ok: true,
        status: 200,
      } as any);

      const result = await getServiceCategories('1', '12345');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/serviceCategory?departmentId=1&ipCardNumber=12345`,
      );
      expect(result).toEqual({ results: mockCategories });
    });

    it('should use default card number when not provided', async () => {
      const mockCategories = [{ categoryId: 1, name: 'Diagnostic', departmentId: 1 }];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockCategories },
        ok: true,
        status: 200,
      } as any);

      await getServiceCategories('1');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/serviceCategory?departmentId=1&ipCardNumber=0`,
      );
    });
  });

  describe('getBillableServices', () => {
    it('should fetch billable services successfully', async () => {
      const mockServices = [
        { serviceId: 1, name: 'Lab Test', categoryId: 1 },
        { serviceId: 2, name: 'Blood Test', categoryId: 1 },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockServices },
        ok: true,
        status: 200,
      } as any);

      const result = await getBillableServices('1');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/billableService?serviceCategoryId=1`,
      );
      expect(result).toEqual({ results: mockServices });
    });
  });

  describe('getFacilityServicePrices', () => {
    it('should fetch facility service prices with default pagination', async () => {
      const mockPrices = [
        { priceId: 1, serviceName: 'Consultation', price: 100 },
        { priceId: 2, serviceName: 'X-Ray', price: 200 },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockPrices },
        ok: true,
        status: 200,
      } as any);

      const result = await getFacilityServicePrices();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/facilityServicePrice?startIndex=0&limit=20`,
      );
      expect(result).toEqual({ results: mockPrices });
    });

    it('should use custom pagination parameters', async () => {
      const mockPrices = [{ priceId: 1, serviceName: 'Consultation', price: 100 }];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockPrices },
        ok: true,
        status: 200,
      } as any);

      await getFacilityServicePrices(10, 5);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/facilityServicePrice?startIndex=10&limit=5`,
      );
    });
  });

  describe('getBillableServiceId', () => {
    it('should return service ID when found', async () => {
      const mockResponse = {
        data: {
          results: [{ serviceId: 123, name: 'Test Service' }],
        },
      };

      mockOpenmrsFetch.mockResolvedValue(mockResponse as any);

      const result = await getBillableServiceId('1', '2');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/billableService?facilityServicePriceId=2&serviceCategoryId=1`,
      );
      expect(result).toBe(123);
    });

    it('should return null when no services found', async () => {
      const mockResponse = {
        data: {
          results: [],
        },
      };

      mockOpenmrsFetch.mockResolvedValue(mockResponse as any);

      const result = await getBillableServiceId('1', '2');

      expect(result).toBeNull();
    });

    it('should return null when service has no serviceId', async () => {
      const mockResponse = {
        data: {
          results: [
            { name: 'Test Service' }, // no serviceId
          ],
        },
      };

      mockOpenmrsFetch.mockResolvedValue(mockResponse as any);

      const result = await getBillableServiceId('1', '2');

      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockOpenmrsFetch.mockRejectedValue(new Error('Network error'));

      const result = await getBillableServiceId('1', '2');

      expect(result).toBeNull();
    });
  });
});
