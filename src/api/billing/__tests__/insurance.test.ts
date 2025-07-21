import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { getInsurances, getUsers, getThirdParties, getInsuranceById } from '../insurance';
import { API_CONFIG } from '../../../constants';

// Mock the openmrsFetch function
jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
  restBaseUrl: '/ws/rest/v1',
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

describe('Insurance API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInsurances', () => {
    it('should fetch insurances successfully', async () => {
      const mockInsurances = [
        { insuranceId: 1, name: 'RSSB', rate: 80 },
        { insuranceId: 2, name: 'Private', rate: 100 },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockInsurances },
        ok: true,
        status: 200,
      } as any);

      const result = await getInsurances();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/insurance`);
      expect(result).toEqual(mockInsurances);
    });
  });

  describe('getUsers', () => {
    it('should fetch users successfully', async () => {
      const mockUsers = [
        { uuid: 'user1', display: 'John Doe' },
        { uuid: 'user2', display: 'Jane Smith' },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockUsers },
        ok: true,
        status: 200,
      } as any);

      const result = await getUsers();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/user?v=default`);
      expect(result).toEqual(mockUsers);
    });
  });

  describe('getThirdParties', () => {
    it('should fetch third parties successfully', async () => {
      const mockThirdParties = [
        { thirdPartyId: 1, name: 'Company A' },
        { thirdPartyId: 2, name: 'Company B' },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockThirdParties },
        ok: true,
        status: 200,
      } as any);

      const result = await getThirdParties();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/thirdParty`);
      expect(result).toEqual(mockThirdParties);
    });
  });

  describe('getInsuranceById', () => {
    it('should fetch insurance by ID successfully', async () => {
      const mockInsurance = { insuranceId: 1, name: 'RSSB', rate: 80 };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockInsurance,
        ok: true,
        status: 200,
      } as any);

      const result = await getInsuranceById(1);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/insurance/1`);
      expect(result).toEqual(mockInsurance);
    });

    it('should return null when insurance not found', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: null,
        ok: false,
        status: 404,
      } as any);

      const result = await getInsuranceById(999);

      expect(result).toBeNull();
    });
  });
});
