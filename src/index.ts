import { getAsyncLifecycle, defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import { createLeftPanelLink } from './left-panel-link.component';
import BillingAdminCardLink from './billing-admin-card-link.component';
import BillingAdminHome from './billing-admin/billing-home/billing-home-component';
import InvoiceTable from './invoice/invoice-table.component';
import { dashboardMeta, insuranceDashboardMeta, admissionDashboard } from './dashboard.meta';
import Insurance from './insurance/insurance.component';
import PatientAdmissionForm from './visit-attributes/patient-admission-form.component';
import AdmissionHistory from './admission-information/admission-history.component';
import InsuranceForm from './insurance/insurance-forms.component';
import InsurancePolicyRootComponent from './insurance-root.component';

const moduleName = '@openmrs/esm-rwandaemr-billing-app';

const options = { featureName: 'RwandaEMR Billing', moduleName };

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const billingSummaryDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...dashboardMeta, moduleName }),
  options,
);

export const insuranceDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...insuranceDashboardMeta, moduleName }),
  options,
);

export const admissionSummaryDashboardLink = getSyncLifecycle(
  createDashboardLink({ ...admissionDashboard, moduleName }),

  options,
);

export const insuranceFormWorkspace = getSyncLifecycle(InsuranceForm, {
  ...options,
});

export const billingDashboardLink = getSyncLifecycle(
  createLeftPanelLink({ name: 'billing', title: 'Billing' }),
  options,
);

export const billingAdminHome = getSyncLifecycle(BillingAdminHome, options);

export const billingPatientSummary = getSyncLifecycle(InvoiceTable, options);

export const billableServicesCardLink = getSyncLifecycle(BillingAdminCardLink, options);

export const insurancePatientSummary = getSyncLifecycle(Insurance, options);
export const admissionCheckinForm = getSyncLifecycle(PatientAdmissionForm, options);

export const patientAdmissionFormWorkspace = getSyncLifecycle(PatientAdmissionForm, options);

export const admissionHistory = getSyncLifecycle(AdmissionHistory, options);

export const insurancePolicyDashboardLink = getSyncLifecycle(
  createLeftPanelLink({ name: 'insurance-policy', title: 'Insurance policy' }),
  options,
);

export const insurancePolicyRoot = getSyncLifecycle(InsurancePolicyRootComponent, options);

export const visitFormInsurancePolicyFields = getAsyncLifecycle(
  () => import('./visit-attributes/patient-admission-fields.extension'),
  options,
);
