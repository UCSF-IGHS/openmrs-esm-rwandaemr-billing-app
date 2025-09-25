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
  IremboPayRequest,
  IremboPayResponse,
  IremboPayTransaction,
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

// Irembo Pay operations
// export { initiateIremboPayTransaction } from './irembopay';

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
  getConsommationPaymentStatus,
  getMultipleConsommationStatuses,
} from './consommations';

// Report operations
export { fetchInsuranceFirms, fetchAllInsuranceReportData, fetchInsuranceReport } from './reports';

// Facility information operations
export { fetchFacilityInfo, fetchFacilitySetting, type FacilityInfo } from './facility-info';

// Patient operations
export { fetchPatientPhoneNumber, fetchPatientInfo, type PatientPhoneNumber } from '../patient.resource';
