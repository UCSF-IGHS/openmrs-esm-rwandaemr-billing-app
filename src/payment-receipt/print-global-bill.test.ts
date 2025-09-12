import { printGlobalBill } from './print-global-bill';

const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

const mockDocumentWrite = jest.fn();
const mockDocumentClose = jest.fn();
mockWindowOpen.mockReturnValue({
  document: {
    write: mockDocumentWrite,
    close: mockDocumentClose,
  },
  focus: jest.fn(),
  closed: false,
});

// Mock data for testing
const mockGlobalBillData = {
  globalBillId: 'GB-12345',
  patientName: 'John Doe',
  policyNumber: 'POL-001',
  insuranceName: 'Test Insurance',
  insuranceRate: 80,
  patientRate: 20,
  admissionDate: '2024-01-15',
  department: 'General Medicine',
  totalAmount: 1000,
  paidAmount: 800,
  dueAmount: 200,
  status: 'OPEN',
  closed: false,
};

const mockConsommationsData = [
  {
    consommationId: 'CONS-001',
    service: 'Consultation',
    createdDate: '2024-01-15',
    items: [
      {
        patientServiceBillId: 1,
        itemName: 'Doctor Consultation',
        quantity: 1,
        unitPrice: 500,
        paidAmount: 400,
        serviceDate: '2024-01-15',
      },
    ],
    insuranceRates: {
      insuranceRate: 80,
      patientRate: 20,
    },
    totalAmount: 500,
    paidAmount: 400,
    dueAmount: 100,
    status: 'PAID',
  },
];

describe('printGlobalBill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should print global bill without paymentData', () => {
    printGlobalBill(mockGlobalBillData, mockConsommationsData, 'Test User');

    expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank', 'width=1000,height=800,scrollbars=yes');
    expect(mockDocumentWrite).toHaveBeenCalled();
    expect(mockDocumentClose).toHaveBeenCalled();
  });

  test('should print global bill with paymentData', () => {
    const mockPaymentData = {
      amountPaid: '800.00',
      receivedCash: '1000.00',
      change: '200.00',
      paymentMethod: 'cash',
      deductedAmount: '',
      dateReceived: '2024-01-15',
      collectorName: 'Test User',
      patientName: 'John Doe',
      policyNumber: 'POL-001',
      thirdPartyAmount: '0.00',
      thirdPartyProvider: 'Test Insurance',
      totalAmount: '1000.00',
      insuranceRate: 80,
      patientRate: 20,
      insuranceName: 'Test Insurance',
    };

    printGlobalBill(mockGlobalBillData, mockConsommationsData, 'Test User', mockPaymentData);

    expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank', 'width=1000,height=800,scrollbars=yes');
    expect(mockDocumentWrite).toHaveBeenCalled();
    expect(mockDocumentClose).toHaveBeenCalled();
  });

  test('should handle window.open failure', () => {
    mockWindowOpen.mockReturnValue(null);

    // Mock alert to avoid actual alert in test
    const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});

    printGlobalBill(mockGlobalBillData, mockConsommationsData, 'Test User');

    expect(mockAlert).toHaveBeenCalledWith('Please allow pop-ups to print the global bill');
    expect(mockDocumentWrite).not.toHaveBeenCalled();

    mockAlert.mockRestore();
  });
});
