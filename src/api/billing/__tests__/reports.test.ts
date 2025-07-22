import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchInsuranceFirms, fetchInsuranceReport } from '../reports';
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

// Mock the download utils
jest.mock('../../../billing-reports/utils/download-utils', () => ({
  formatToYMD: jest.fn((date) => date.replace(/\//g, '-')),
}));

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Reports API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchInsuranceFirms', () => {
    it('should fetch insurance firms successfully', async () => {
      const mockApiResponse = {
        results: [
          {
            record: [
              { column: 'insurance_id', value: '1' },
              { column: 'name', value: 'RSSB' },
            ],
          },
          {
            record: [
              { column: 'insurance_id', value: '2' },
              { column: 'name', value: 'Private' },
            ],
          },
        ],
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockApiResponse,
        ok: true,
        status: 200,
      } as any);

      const result = await fetchInsuranceFirms();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_MAMBA_URL}?report_id=insurance_firm_report`);
      expect(result).toEqual([
        { value: '1', label: 'RSSB' },
        { value: '2', label: 'Private' },
      ]);
    });

    it('should handle empty results', async () => {
      const mockApiResponse = {
        results: [],
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockApiResponse,
        ok: true,
        status: 200,
      } as any);

      const result = await fetchInsuranceFirms();

      expect(result).toEqual([]);
    });
  });

  describe('fetchInsuranceReport', () => {
    it('should fetch insurance report successfully', async () => {
      const mockApiResponse = {
        results: [
          { billId: 1, amount: 1000 },
          { billId: 2, amount: 2000 },
        ],
        pagination: {
          totalRecords: 2,
        },
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockApiResponse,
        ok: true,
        status: 200,
      } as any);

      const result = await fetchInsuranceReport('2024-01-01', '2024-01-31', '1');

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('report_id=insurance_bill'));
      expect(result).toEqual({
        results: mockApiResponse.results,
        total: 2,
      });
    });

    it('should handle errors gracefully', async () => {
      mockOpenmrsFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchInsuranceReport('2024-01-01', '2024-01-31', '1');

      expect(result).toEqual({
        results: [],
        total: 0,
      });
    });
  });
});
