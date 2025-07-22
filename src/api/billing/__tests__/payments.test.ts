import { openmrsFetch } from '@openmrs/esm-framework';
import { getPatientBills, submitBillPayment, createSimplePatientBill } from '../payments';
import { API_CONFIG, HTTP_STATUS } from '../../../constants';

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
    saveError: 'Save error',
  },
}));

const mockOpenmrsFetch = openmrsFetch as jest.MockedFunction<typeof openmrsFetch>;

describe('Payments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatientBills', () => {
    it('should fetch patient bills successfully', async () => {
      const mockBills = [
        { patientBillId: 1, amount: 100, isPaid: false },
        { patientBillId: 2, amount: 200, isPaid: true },
      ];

      mockOpenmrsFetch.mockResolvedValue({
        data: { results: mockBills },
        ok: true,
        status: 200,
      } as any);

      const result = await getPatientBills('2024-01-01', '2024-01-31', 0, 10);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_BILLING_URL}/patientBill?limit=10`);
      expect(result).toEqual({ results: mockBills });
    });
  });

  describe('submitBillPayment', () => {
    it('should submit payment successfully', async () => {
      const mockPaymentData = {
        amountPaid: 100,
        patientBill: { patientBillId: 1 },
        dateReceived: '2024-01-01',
        collector: { uuid: 'collector-uuid' },
        paidItems: [{ billItem: { patientServiceBillId: 1 }, paidQty: 1 }],
      };

      const mockResponse = {
        billPaymentId: 123,
        amountPaid: 100,
        dateReceived: '2024-01-01',
        status: 'COMPLETED',
        links: [],
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockResponse,
        ok: true,
        status: 200,
      } as any);

      const result = await submitBillPayment(mockPaymentData);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/billPayment`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle string amount paid', async () => {
      const mockPaymentData = {
        amountPaid: '100.50',
        patientBill: { patientBillId: 1 },
        dateReceived: '2024-01-01',
        collector: { uuid: 'collector-uuid' },
        paidItems: [{ billItem: { patientServiceBillId: 1 }, paidQty: 1.5 }],
      };

      const mockResponse = {
        billPaymentId: 123,
        amountPaid: 100.5,
        dateReceived: '2024-01-01',
        status: 'COMPLETED',
        links: [],
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockResponse,
        ok: true,
        status: 200,
      } as any);

      await submitBillPayment(mockPaymentData);

      // Verify the call was made with proper formatting
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/billPayment`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"amountPaid":100.50'), // Should be numeric, not string
        }),
      );
    });

    it('should handle payment failure', async () => {
      const mockPaymentData = {
        amountPaid: 100,
        patientBill: { patientBillId: 1 },
        dateReceived: '2024-01-01',
        collector: { uuid: 'collector-uuid' },
        paidItems: [],
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: null,
        ok: false,
        status: 400,
      } as any);

      await expect(submitBillPayment(mockPaymentData)).rejects.toThrow('Payment failed with status 400');
    });
  });

  describe('createSimplePatientBill', () => {
    it('should create patient bill successfully', async () => {
      const mockBill = {
        patientBillId: 123,
        amount: 100,
        isPaid: false,
        createdDate: '2024-01-01',
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockBill,
        ok: true,
        status: 200,
      } as any);

      const result = await createSimplePatientBill(100, false);

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/patientBill`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 100,
            isPaid: false,
          }),
        }),
      );
      expect(result).toEqual(mockBill);
    });

    it('should use default values when not provided', async () => {
      const mockBill = {
        patientBillId: 123,
        amount: 0,
        isPaid: false,
        createdDate: '2024-01-01',
      };

      mockOpenmrsFetch.mockResolvedValue({
        data: mockBill,
        ok: true,
        status: 200,
      } as any);

      await createSimplePatientBill();

      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_BILLING_URL}/patientBill`,
        expect.objectContaining({
          body: JSON.stringify({
            amount: 0,
            isPaid: false,
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: null,
        ok: false,
        status: HTTP_STATUS.BAD_REQUEST,
      } as any);

      await expect(createSimplePatientBill(100, false)).rejects.toThrow(
        `API returned status ${HTTP_STATUS.BAD_REQUEST}`,
      );
    });
  });
});
