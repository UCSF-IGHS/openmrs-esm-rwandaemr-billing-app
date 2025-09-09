interface Link {
  rel: string;
  uri: string;
  resourceAlias: string;
}

interface Owner {
  uuid: string;
  display: string;
  links: Link[];
  person?: {
    uuid: string;
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    birthdateEstimated: boolean;
    preferredName: {
      display: string;
      uuid: string;
    };
    preferredAddress: {
      display: string;
      uuid: string;
    };
    links: Link[];
  };
  attributes?: Array<{ uuid: string; display: string; links: Link[] }>;
}

export interface InsurancePolicy {
  insuranceCardNo: string;
  coverageStartDate: string;
  expirationDate: string;
  insurance?: {
    uuid: string;
    name: string;
    links: Link[];
  };
  owner: Owner;
  links: Link[];
  insurancePolicyId: string;
}

interface Admission {
  insurancePolicy: InsurancePolicy;
  isAdmitted: boolean;
  admissionDate: string;
  dischargingDate: string | null;
  diseaseType: string;
  admissionType: number;
  links: Link[];
}

interface CreatorOrCloser {
  uuid: string;
  display: string;
  links: Link[];
}

interface Insurance {
  insuranceId: number;
  name: string;
  address: string;
  phone: string;
  category: string;
  rate?: number | null;
  flatFee?: string | null;
  voided?: boolean;
  links: Link[];
}

export interface Bill {
  globalBillId: number;
  admission: Admission;
  billIdentifier: string;
  globalAmount: number;
  consommations: any;
  createdDate: string;
  creator: CreatorOrCloser;
  closingDate: string;
  closedBy: CreatorOrCloser;
  closed: boolean;
  insurance: Insurance;
  closingReason: string;
  links: Link[];
  resourceVersion: string;
}

export type PaymentStatus = 'PAID' | 'UNPAID' | 'PARTIALLY PAID';

export interface MappedBill {
  uuid: number;
  globalBillId: number;
  no: number;
  date: string;
  createdBy: string;
  policyId: string;
  admissionDate: string;
  dischargeDate: string;
  billIdentifier: string;
  patientDueAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  bill: boolean;
  isPaid?: boolean;
  closed?: boolean;
}

export interface ConsommationStatus {
  consommationId: number;
  status: PaymentStatus;
  totalAmount: number;
  paidAmount: number;
}

export interface ConsommationListItem {
  consommationId?: number;
  createdDate?: string;
  department?: {
    name?: string;
  };
  insuranceBill?: {
    amount?: number;
    creator?: {
      person?: {
        display?: string;
      };
    };
  };
  thirdPartyBill?: {
    amount?: number;
  };
  patientBill?: {
    amount?: number;
    policyIdNumber?: string;
    status?: string;
    payments?: Array<{
      amountPaid?: number;
    }>;
  };
}

export interface ConsommationListResponse {
  results?: ConsommationListItem[];
  totalDueAmount?: number;
  totalPaidAmount?: number;
}

export interface ConsommationItem {
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  paidAmount?: number;
  remainingAmount?: number;
  serviceDate?: string;
  paid?: boolean;
  partiallyPaid?: boolean;
  paidQuantity?: number;
  itemType?: number;
  drugFrequency?: string;
  patientServiceBillId?: number;
  selected?: boolean;
}

export interface RowData {
  id: string;
  index: number;
  createdDate: string;
  consommationId: string;
  service: string;
  insuranceCardNo: string;
  insuranceDue: string;
  thirdPartyDue: string;
  patientDue: string;
  paidAmount: string;
  status: string;
  rawPatientDue: number;
  rawPaidAmount: number;
  select?: React.ReactNode;
}

export interface BillPaymentItem {
  billItem: {
    patientServiceBillId: number;
  };
  paidQty: number;
}

export interface BillPaymentRequest {
  amountPaid: number;
  patientBill: {
    patientBillId: number;
    creator: string;
  };
  dateReceived: string;
  collector: {
    uuid: string;
  };
  paidItems: BillPaymentItem[];
}

export interface InsurancePolicyRecord {
  hasThirdParty: boolean;
  thirdPartyProvider: string;
  companyName: string;
  insuranceOwner: string;
  family: string;
  insuranceCardNo: string;
  coverageStartDate: string;
  expirationDate: string;
  insuranceName?: string;
}

export interface ExtendedConsommationItem extends ConsommationItem {
  serviceId?: number;
  selected?: boolean;
}

export interface SelectedItemInfo {
  item: ExtendedConsommationItem;
  consommationId: string;
  consommationService: string;
}

export interface ExtendedConsommationListItem extends ConsommationListItem {
  items: ExtendedConsommationItem[];
  isLoadingItems: boolean;
  insuranceRates: {
    insuranceRate: number;
    patientRate: number;
  };
}

export interface GroupedConsommationItems {
  consommationId: string;
  consommationService: string;
  items: ExtendedConsommationItem[];
}

export interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedItems: SelectedItemInfo[];
  onItemToggle: (consommationId: string, itemIndex: number) => void;
}

export interface EmbeddedConsommationsListProps {
  globalBillId: string;
  patientUuid?: string;
  insuranceCardNo?: string;
  onConsommationClick?: (consommationId: string) => void;
  onAddNewInvoice?: (globalBillId: string) => void;
  isGlobalBillClosed?: boolean;
}

export interface InsuranceRatesResponse {
  insuranceRate: number;
  patientRate: number;
  insuranceName?: string;
}
