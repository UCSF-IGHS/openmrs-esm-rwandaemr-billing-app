// Test file for print-global-bill functionality
import { printGlobalBill } from './print-global-bill';

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

// Test function
export const testPrintGlobalBill = () => {
  console.log('Testing print global bill functionality...');

  try {
    // Test the print function
    printGlobalBill(mockGlobalBillData, mockConsommationsData, 'Test User');
    console.log('✅ Print global bill function executed successfully');
    return true;
  } catch (error) {
    console.error('❌ Error testing print global bill:', error);
    return false;
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testPrintGlobalBill = testPrintGlobalBill;
}
