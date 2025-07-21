import { openmrsFetch } from '@openmrs/esm-framework';
import { getConsommationById, getConsommationsByGlobalBillId } from '../consommations';
import { API_CONFIG } from '../../../constants';

// Mock the openmrsFetch function
jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
}));

// Mock the error handler
jest.mock('../../../utils/error-handler', () => ({
  errorHandler: {
    wrapAsync: jest.fn((fn) => fn()),
    handleError: jest.fn(),
    handleWarning: jest.fn(),
    handleInfo: jest.fn(),
  },
  commonErrorMessages: {
    fetchError: 'Fetch error',
  },
}));

// Mock the payments module
jest.mock('../payments', () => ({
  createSimplePatientBill: jest.fn(),
}));

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Consommations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConsommationById', () => {
    it('should fetch consommation by ID successfully', async () => {
      const mockConsommation = {
        consommationId: 1,
        department: { name: 'Emergency' },
        billItems: [],
        patientBill: { amount: 1000 },
        insuranceBill: { amount: 800 },
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockConsommation,
        ok: true,
        status: 200,
      } as any);

      const result = await getConsommationById('1');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/consommation/1`);
      expect(result).toEqual(mockConsommation);
    });
  });

  describe('getConsommationsByGlobalBillId', () => {
    it('should fetch consommations by global bill ID successfully', async () => {
      const mockConsommations = {
        results: [
          { consommationId: 1, createdDate: '2024-01-01' },
          { consommationId: 2, createdDate: '2024-01-02' },
        ],
        totalDueAmount: 2000,
        totalPaidAmount: 1500,
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockConsommations,
        ok: true,
        status: 200,
      } as any);

      const result = await getConsommationsByGlobalBillId('1');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/consommation?globalBillId=1`);
      expect(result).toEqual(mockConsommations);
    });
  });
});
