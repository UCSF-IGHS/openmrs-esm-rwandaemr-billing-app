/**
 * Main billing API module
 * Consolidated exports from all billing-related modules
 */

export type {
  Department,
  HopService,
  ServiceCategory,
  BillableService,
  FacilityServicePrice,
  Insurance,
  User,
  ThirdParty,
  PatientBill,
  GlobalBill,
  Consommation,
  BillPaymentRequest,
  BillPaymentResponse,
  ConsommationItem,
  ConsommationRates,
  GlobalBillSummary,
  ConsommationListResponse,
  ConsommationStatusResponse,
  ApiResponse,
  PaginatedResponse,
} from '../types';

// Department operations
export { getDepartments, type DepartmentResponse } from './departments';

// Services operations
export {
  getServices,
  getServiceCategories,
  getBillableServices,
  getFacilityServicePrices,
  getBillableServiceId,
  type ServiceResponse,
  type ServiceCategoryResponse,
  type BillableServiceResponse,
  type FacilityServicePriceResponse,
  type PaginatedFacilityServicePriceResponse,
} from './services';

// Insurance operations
export {
  getInsurances,
  getUsers,
  getThirdParties,
  getInsuranceById,
  getInsurancePolicyByCardNumber,
  fetchGlobalBillsByInsuranceCard,
  getInsurancePoliciesByPatient,
  findBeneficiaryByPolicyNumber,
  type InsuranceResponse,
  type UserResponse,
  type ThirdPartyResponse,
} from './insurance';

// Payment operations
export { getPatientBills, submitBillPayment, type PatientBillResponse } from './payments';

// Global Bill operations
export {
  getGlobalBillByIdentifier,
  getGlobalBillById,
  fetchGlobalBillsByPatient,
  getGlobalBillSummary,
  createDirectGlobalBill,
  closeGlobalBill,
  revertGlobalBill,
  fetchRecentGlobalBills,
  fetchConsommationTotals,
  getPatientNameFromGlobalBill,
  type GlobalBillResponse,
} from './global-bills';

// Consommation operations
export {
  getConsommationById,
  getConsommationsByGlobalBillId,
  getConsommationItems,
  getConsommationRates,
  createDirectConsommationWithBeneficiary,
  getConsommationStatus,
  isConsommationPaid,
  getMultipleConsommationStatuses,
} from './consommations';

// Report operations
export { fetchInsuranceFirms, fetchAllInsuranceReportData, fetchInsuranceReport } from './reports';
