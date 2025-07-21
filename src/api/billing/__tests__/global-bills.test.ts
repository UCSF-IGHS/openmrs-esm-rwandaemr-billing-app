import { openmrsFetch } from '@openmrs/esm-framework';
import { getGlobalBillByIdentifier, getGlobalBillSummary } from '../global-bills';
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

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Global Bills API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGlobalBillByIdentifier', () => {
    it('should fetch global bill by identifier successfully', async () => {
      const mockGlobalBill = { globalBillId: 1, billIdentifier: 'BILL-001', amount: 1000 };

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: [mockGlobalBill] },
        ok: true,
        status: 200,
      } as any);

      const result = await getGlobalBillByIdentifier('BILL-001');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/globalBill?billIdentifier=BILL-001`,
      );
      expect(result).toEqual({ results: [mockGlobalBill] });
    });
  });

  describe('getGlobalBillSummary', () => {
    it('should fetch global bill summary successfully', async () => {
      const mockSummary = { total: 100, closed: 80, open: 20 };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockSummary,
        ok: true,
        status: 200,
      } as any);

      const result = await getGlobalBillSummary();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/globalBill/summary`);
      expect(result).toEqual(mockSummary);
    });
  });
});
