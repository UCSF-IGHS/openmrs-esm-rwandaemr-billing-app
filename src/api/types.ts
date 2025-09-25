/**
 * TypeScript interfaces for the Rwanda EMR Billing API
 * This file provides proper type definitions to replace 'any' types
 */

// Base interfaces
export interface Link {
  rel: string;
  uri: string;
  resourceAlias: string;
}

export interface BaseResource {
  links: Link[];
  resourceVersion?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  results: T[];
  totalCount?: number;
  links?: Link[];
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  startIndex?: number;
  limit?: number;
}

// User/Person interfaces
export interface Person {
  uuid: string;
  display: string;
  gender?: string;
  age?: number;
  birthdate?: string;
  birthdateEstimated?: boolean;
  preferredName?: {
    display: string;
    uuid: string;
  };
  preferredAddress?: {
    display: string;
    uuid: string;
  };
  links: Link[];
}

export interface User extends BaseResource {
  uuid: string;
  display: string;
  username: string;
  person: Person;
}

// Department interfaces
export interface Department extends BaseResource {
  departmentId: number;
  name: string;
  description: string;
}

// Service interfaces
export interface HopService extends BaseResource {
  serviceId: number;
  name: string;
  description: string;
}

export interface ServiceCategory extends BaseResource {
  serviceCategoryId: number;
  name: string;
  description: string;
  departmentId: number;
  retired: boolean;
}

export interface Concept {
  uuid: string;
  display: string;
  links: Link[];
}

export interface FacilityServicePrice extends BaseResource {
  facilityServicePriceId: number;
  name: string;
  shortName: string;
  description: string;
  category: string;
  fullPrice: number;
  itemType: number;
  hidden: boolean;
  concept?: Concept;
}

export interface BillableService extends BaseResource {
  serviceId: number;
  facilityServicePrice: FacilityServicePrice;
  startDate: string;
  endDate: string | null;
  retired: boolean;
  insurance?: Insurance;
  maximaToPay?: number;
}

// Insurance interfaces
export interface Insurance extends BaseResource {
  insuranceId: number;
  name: string;
  address: string;
  phone: string;
  category: string;
  rate: number | null;
  flatFee: string | null;
  depositBalance: string;
  voided: boolean;
  concept?: Concept;
  creator?: User;
  createdDate?: string;
}

export interface InsurancePolicy extends BaseResource {
  insurancePolicyId: number;
  insuranceCardNo: string;
  coverageStartDate: string;
  expirationDate: string;
  insurance: Insurance;
  owner: {
    uuid: string;
    display: string;
    person?: Person;
  };
  beneficiaries?: Beneficiary[];
}

export interface Beneficiary extends BaseResource {
  beneficiaryId: number;
  patient: {
    uuid: string;
    display: string;
  };
  policyIdNumber: string;
}

// Third Party interfaces
export interface ThirdParty extends BaseResource {
  thirdPartyId: number;
  name: string;
  rate: number;
}

// Bill interfaces
export interface BillItem {
  serviceDate: string;
  service?: BillableService;
  hopService?: HopService;
  unitPrice: number;
  quantity: number;
  paidQuantity: number;
  paid: boolean;
  serviceOther: string | null;
  serviceOtherDescription: string | null;
  drugFrequency: string;
  itemType: number;
  links?: Link[];
}

export interface PaymentRecord {
  amountPaid: number;
  dateReceived: string;
  collector: {
    uuid: string;
    display: string;
  };
}

export interface PatientBill extends BaseResource {
  patientBillId: number;
  amount: number;
  isPaid: boolean;
  createdDate: string;
  status: string | null;
  voided: boolean;
  payments: PaymentRecord[];
  phoneNumber: string | null;
  transactionStatus: string | null;
  paymentConfirmedBy: any | null;
  paymentConfirmedDate: string | null;
  creator: string;
  departmentName: string;
  policyIdNumber: string;
  beneficiaryName: string;
  insuranceName: string;
}

export interface InsuranceBill {
  amount: number;
  creator: {
    person: {
      display: string;
    };
  };
  createdDate: string;
}

export interface Consommation extends BaseResource {
  consommationId: number;
  paymentStatus?: string;
  department: Department;
  billItems: BillItem[];
  patientBill: PatientBill;
  insuranceBill: InsuranceBill;
}

export interface Admission {
  admissionId?: number;
  uuid?: string;
  patient?: {
    uuid: string;
    display: string;
    person?: Person;
  };
  isAdmitted: boolean;
  admissionDate: string;
  dischargingDate: string | null;
  admissionType: number;
  diseaseType?: {
    uuid: string;
    display: string;
  };
  insurancePolicy: InsurancePolicy;
}

export interface GlobalBill extends BaseResource {
  globalBillId: number;
  billIdentifier: string;
  globalAmount: number;
  createdDate: string;
  closingDate: string | null;
  closed: boolean;
  closingReason: string;
  admission: Admission;
  creator: {
    display: string;
  };
  insurance?: Insurance;
}

// Payment interfaces
export interface BillPaymentItem {
  billItem: {
    patientServiceBillId: number;
  };
  paidQty: number;
}

export interface BillPaymentRequest {
  amountPaid: number | string;
  patientBill: {
    patientBillId: number;
  };
  dateReceived: string;
  collector: {
    uuid: string;
  };
  paidItems: BillPaymentItem[];
}

export interface BillPaymentResponse extends BaseResource {
  billPaymentId: number;
  amountPaid: number;
  dateReceived: string;
  status: string;
}

// Report interfaces
export interface ReportRecord {
  column: string;
  value: any;
}

export interface ReportRow {
  record: ReportRecord[];
}

export interface ReportResponse {
  results: ReportRow[];
  pagination?: {
    totalRecords: number;
    page: number;
    pageSize: number;
  };
}

// Form data interfaces
export interface ConsommationItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  serviceDate: string;
  itemType: number;
  paid: boolean;
  partiallyPaid: boolean;
  paidQuantity: number;
  drugFrequency: string;
  patientServiceBillId: number;
  serviceId?: number;
  selected: boolean;
}

export interface PaymentData {
  amountPaid: string;
  paymentMethod: string;
  receivedCash?: string;
  change?: string;
}

// Status interfaces
export interface ConsommationStatusResponse {
  department: Department;
  billItems: BillItem[];
  patientBill: {
    isPaid: boolean;
    amountPaid?: number;
  };
  paid?: boolean;
  partiallyPaid?: boolean;
  paymentStatus?: string;
}

// Admission form interfaces
export interface AdmissionFormValues {
  insuranceName: string;
  insuranceCardNumber: string;
  isAdmitted: boolean;
  admissionDate: Date;
  diseaseType: string;
  admissionType: string;
}

// Calculator interfaces
export interface CalculatorItem {
  departmentId: number;
  departmentName: string;
  serviceCategoryId: number;
  serviceId: number;
  serviceName: string;
  quantity: number;
  price: number;
  total: number;
  drugFrequency?: string;
  hopServiceId?: number;
}

// API error response
export interface ApiError {
  error: {
    message: string;
    code?: string;
    detail?: string;
  };
}

// Insurance verification result
export interface InsuranceVerificationResult {
  isValid: boolean;
  policy: InsurancePolicy | null;
  policyId: number | null;
  insurance: Insurance | null;
  existingGlobalBill: GlobalBill | null;
  message: string;
}

// Normalized service for UI components
export interface NormalizedService {
  serviceId: number;
  name: string;
  shortName?: string;
  description?: string;
  price: number;
  category?: string;
  departmentId?: number;
  serviceCategoryId?: number;
  facilityServicePriceId?: number;
}

// Summary interfaces
export interface GlobalBillSummary {
  total: number;
  closed: number;
  open: number;
}

export interface ConsommationListItem {
  consommationId: number;
  createdDate: string;
  service: string;
  createdBy: string;
  insuranceCardNo: string;
  insuranceDue: number;
  thirdPartyDue: number;
  patientDue: number;
  paidAmount: number;
  status: string;
}

export interface ConsommationListResponse {
  results: ConsommationListItem[];
  totalDueAmount: number;
  totalPaidAmount: number;
}

// Rates interface
export interface ConsommationRates {
  insuranceRate: number;
  patientRate: number;
  insuranceName?: string;
}

// Irembo Pay interfaces
export interface IremboPayRequest {
  accountIdentifier: string; // Phone number
  paymentProvider: 'MTN' | 'AIRTEL';
  consommationId: string;
}

export interface IremboPayResponse {
  success: boolean;
  message: string;
  data?: {
    accountIdentifier: string;
    paymentProvider: string;
    invoiceNumber: string;
    amount: number;
    referenceId: string;
  };
  errors?: Array<{
    code: string;
    detail: string;
  }>;
}

export interface IremboPayTransaction {
  referenceId: string;
  invoiceNumber: string;
  amount: number;
  paymentProvider: string;
  accountIdentifier: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  createdAt: string;
}
