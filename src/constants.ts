/**
 * Application-wide constants for the Rwanda EMR Billing App
 * This file centralizes all hard-coded values to improve maintainability
 */

// API Configuration
export const API_CONFIG = {
  BASE_BILLING_URL: '/ws/rest/v1/mohbilling',
  BASE_MAMBA_URL: '/ws/rest/v1/mamba/report',
  REST_BASE_URL: '/ws/rest/v1',
} as const;

// Legacy exports for backward compatibility
export const BASE_API_URL = API_CONFIG.BASE_BILLING_URL;
export const omrsDateFormat = 'YYYY-MM-DD HH:mm:ss';

// Billing Constants
export const BILLING_CONSTANTS = {
  // Default values for patient service bill ID generation
  DEFAULT_PATIENT_SERVICE_BILL_ID_BASE: 10372855,

  // Price precision offset to ensure proper Double values for API
  PRICE_PRECISION_OFFSET: 0.000001,

  // Default pagination
  DEFAULT_PAGE_SIZE: 50,
  DEFAULT_START_INDEX: 0,
  DEFAULT_LIMIT: 20,

  // Payment statuses
  PAYMENT_STATUS: {
    PAID: 'Paid',
    PENDING: 'Pending',
    PARTIAL: 'Partial',
  },

  // Item types
  ITEM_TYPES: {
    SERVICE: 1,
    MEDICATION: 2,
    PROCEDURE: 3,
  },
} as const;

// Admission Constants
export const ADMISSION_CONSTANTS = {
  TYPES: {
    ORDINARY: 1,
    DCP: 2,
  },
  TYPE_LABELS: {
    1: 'Ordinary Admission',
    2: 'DCP Admission',
  },

  // Minimum insurance card number length for validation
  MIN_INSURANCE_CARD_LENGTH: 8,

  // Default admission type
  DEFAULT_ADMISSION_TYPE: 1,
} as const;

// Insurance Constants
export const INSURANCE_CONSTANTS = {
  // Default rates
  DEFAULT_INSURANCE_RATE: 0,
  DEFAULT_PATIENT_RATE: 100,

  // Mock values (should be replaced with actual API calls)
  MOCK_DEPOSIT_BALANCE: '1100.00',

  // Card number validation
  MIN_CARD_LENGTH: 8,
} as const;

// Payment Constants
export const PAYMENT_CONSTANTS = {
  METHODS: {
    CASH: 'cash',
    DEPOSIT: 'deposit',
  },

  // Validation rules
  MIN_AMOUNT: 0,
  DECIMAL_PRECISION: 2,
} as const;

// Report Constants
export const REPORT_CONSTANTS = {
  // Report IDs for mamba API
  REPORT_IDS: {
    INSURANCE_FIRM: 'insurance_firm_report',
    INSURANCE_BILL: 'insurance_bill',
  },

  // Hidden columns for reports
  HIDDEN_COLUMNS: [
    'first_closing_date_id',
    'family_code',
    'household_head_name',
    'beneficiary_level',
    'birth_date',
    'company_name',
    'insurance_id',
    'global_bill_id',
    'global_bill_identifier',
    'MEDICAMENTS',
    'CONSULTATION',
    'HOSPITALISATION',
    'LABORATOIRE',
    'FORMALITES ADMINISTRATIVES',
    'AMBULANCE',
    'CONSOMMABLES',
    'OXYGENOTHERAPIE',
    'IMAGING',
    'PROCED.',
  ],

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 50,
  DEFAULT_PAGE: 1,
} as const;

// Configuration Schema Constants
export const CONFIG_CONSTANTS = {
  DISEASE_TYPE_CONCEPT: '90029723-7058-40bd-b20a-e369524cb355',

  ADMISSION_CONCEPTS: {
    PATIENT_NAME: '1528AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    BILL_IDENTIFIER: '159465AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    INSURANCE_NAME: '8da67e73-776c-43f6-9758-79d1f6786db3',
    CARD_NUMBER: 'b78996b6-1ee8-4201-8cb8-69ab676ee7d2',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  FETCH_ERROR: 'Failed to Load Data',
  SAVE_ERROR: 'Save Failed',
  NETWORK_ERROR: 'Network Error',
  VALIDATION_ERROR: 'Validation Error',
  UNEXPECTED_ERROR: 'Unexpected Error',

  // Specific error messages
  NO_COLLECTOR_UUID: 'Unable to retrieve collector UUID. Please ensure you are logged in.',
  INSUFFICIENT_CASH: 'Received cash amount must be equal to or greater than the payment amount',
  INSUFFICIENT_BALANCE: 'Deducted amount exceeds available balance',
  AMOUNT_EXCEEDS_TOTAL: 'Payment amount cannot exceed the total of selected items',
  INVALID_DEDUCTED_AMOUNT: 'Please enter a valid deducted amount',
  INSURANCE_POLICY_REQUIRED: 'Insurance policy ID is required. Please verify the insurance card first.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PAYMENT_SUCCESSFUL: 'Payment Successful!',
  INSURANCE_POLICY_SAVED: 'Insurance policy saved',
  GLOBAL_BILL_CREATED: 'Global bill has been created successfully',
  ITEMS_ADDED: 'Items Added',
} as const;

// Loading Messages
export const LOADING_MESSAGES = {
  LOADING_ADMISSION_DATA: 'Loading admission data...',
  LOADING_BILL_METRICS: 'Loading bill metrics...',
  PROCESSING_PAYMENT: 'Processing payment...',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Timeouts
export const TIMEOUTS = {
  DEFAULT_SNACKBAR: 5000,
  API_REQUEST: 30000,
} as const;

// File Extensions and Types
export const FILE_TYPES = {
  EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
  CSV: 'text/csv',
} as const;
