import { openmrsFetch } from '@openmrs/esm-framework';
import { getDepartments } from '../departments';
import { API_CONFIG } from '../../../constants';

// Mock the openmrsFetch function
jest.mock('@openmrs/esm-framework', () => ({
  openmrsFetch: jest.fn(),
}));

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Departments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDepartments', () => {
    it('should fetch departments successfully', async () => {
      const mockDepartments = [
        { departmentId: 1, name: 'Emergency', description: 'Emergency Department' },
        { departmentId: 2, name: 'Cardiology', description: 'Cardiology Department' },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockDepartments },
        ok: true,
        status: 200,
      } as any);

      const result = await getDepartments();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/department`);
      expect(result).toEqual(mockDepartments);
    });

    it('should handle empty results', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: { results: [] },
        ok: true,
        status: 200,
      } as any);

      const result = await getDepartments();

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOpenmrsFetch.mockRejectedValue(new Error('Network error'));

      await expect(getDepartments()).rejects.toThrow('Network error');
    });

    it('should handle null response data', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: null,
        ok: true,
        status: 200,
      } as any);

      await expect(getDepartments()).rejects.toThrow();
    });
  });
});
