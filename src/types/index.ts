// ═══ UOM Master ═══
export interface UOM {
  uom_id: number;
  symbol: string;
  display_name: string;
  /** energy | emission | volume | mass | distance | currency | other */
  category: string;
  is_active?: boolean;
}

// ═══ Vocabularies (platform-managed lookups) ═══
export interface DisposalMethod {
  method_id: number;
  key: string;
  label: string;
  display_order: number;
  is_active?: boolean;
}

export interface InputTypeDef {
  input_type_id: number;
  key: string;
  label: string;
  widget_component: string;
  has_uom: boolean;
  display_order: number;
  is_active?: boolean;
}

export interface EmissionScopeDef {
  scope_number: number;
  label: string;
  color: string;
  description?: string | null;
  display_order: number;
  is_active?: boolean;
}

// ═══ Modules ═══
export type LifecycleStatus = "DRAFT" | "PUBLISHED" | "DEPRECATED" | "ARCHIVED";

export interface AppModule {
  module_id: number;
  module_name: string;
  key: string;
  description?: string;
  color: string;
  bg_color: string;
  icon_name: string;
  /** Controls how ESGInputPage renders this module's section:
   *  "standard_input"       — normal quantity input (Energy, Water, and future modules)
   *  "auto_computed"        — no input; auto-computed from other modules (Emissions)
   *  "input_with_disposal"  — quantity input + optional disposal breakdown (Waste)
   */
  render_type: "standard_input" | "auto_computed" | "input_with_disposal";
  display_order: number;
  lifecycle_status: LifecycleStatus;
  is_active: boolean;
}

/** Bespoke feature (Scope 3, BRSR, Targets, etc.) — purpose-built code path,
 *  not a metadata-driven module. Bound to a hardcoded React component via route_key. */
export interface AppFeature {
  feature_id: number;
  feature_name: string;
  key: string;
  description?: string;
  color: string;
  bg_color: string;
  icon_name: string;
  route_key?: string;
  display_order: number;
  lifecycle_status: LifecycleStatus;
  is_active: boolean;
}

// ═══ Auth & Roles ═══
export type UserType = "platform" | "tenant";
export type PlatformRole = "PLATFORM_OWNER" | "PLATFORM_ADMIN";
export type TenantRole = "COMPANY_ADMIN" | "REVIEWER" | "LOCATION_USER" | "AUDITOR";
export type Role = PlatformRole | TenantRole;
export type AccessStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";
export type DataStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED";
export type EnergyType = "RENEWABLE" | "NON_RENEWABLE" | "NOT_APPLICABLE";
export type ReviewAction = "SUBMITTED" | "APPROVED" | "REJECTED" | "REVIEWER_EDITED";
export type NotificationType = "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED" | "REMINDER" | "EDITED";
export type StorageProvider = "S3" | "GCS" | "AZURE";

// ═══ Auth Responses ═══
export interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  user_type: UserType;
  company_id?: string;
  company_name?: string;
  company_code?: string;
  access_status?: AccessStatus;
  assigned_module_ids?: number[];
  assigned_location_ids?: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInfo;
}

// ═══ Paginated Response ═══
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  size: number;
}

// ═══ Platform User ═══
export interface PlatformUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: PlatformRole;
  is_active: boolean;
  blocked_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

// ═══ Subscription Plan ═══
export interface SubscriptionPlan {
  plan_id: number;
  plan_name: string;
  max_users: number;
  max_locations: number;
  max_kpis: number;
  is_active: boolean;
}

// ═══ Company ═══
export interface Company {
  company_id: string;
  company_name: string;
  company_code: string;
  industry?: string;
  country?: string;
  timezone: string;
  gstin?: string;
  pan?: string;
  registered_address?: string;
  billing_email?: string;
  plan_id?: number;
  plan?: SubscriptionPlan;
  access_status: AccessStatus;
  query_engine: "RULE_BASED" | "LLM";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  user_count?: number;
  location_count?: number;
  kpi_count?: number;
}

// ═══ Audit Log ═══
export interface AuditLogEntry {
  id: string;
  actioned_by: string;
  action: string;
  target_company_id?: string;
  target_platform_user_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  actioned_at: string;
}

// ═══ Company Status History ═══
export interface CompanyStatusHistory {
  id: string;
  company_id: string;
  previous_status: AccessStatus;
  new_status: AccessStatus;
  reason?: string;
  changed_by: string;
  changed_at: string;
}

// ═══ User (Tenant) ═══
export interface User {
  user_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: TenantRole;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  assigned_module_ids: number[];
  assigned_location_ids: string[];
  anonymised_at?: string | null;
}

// ═══ Location ═══
export interface Location {
  location_id: string;
  company_id: string;
  parent_location_id?: string;
  location_name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  is_high_risk_location?: boolean;
  is_active: boolean;
  created_at: string;
}

// ═══ Module ═══
export interface Module {
  module_id: number;
  module_name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  key?: string;
  color?: string;
  bg_color?: string;
  icon_name?: string;
  render_type?: string;
  lifecycle_status?: LifecycleStatus;
}

// ═══ Financial Year ═══
export interface FinancialYear {
  year_id: number;
  fy_label: string;
  start_date: string;
  end_date: string;
  start_month_name?: string;
}

// ═══ Month ═══
export interface Month {
  month_id: number;
  month_name: string;
  calendar_month: number;
  fy_order: number;
}

// ═══ Indicator ═══
export interface Indicator {
  indicator_id: number;
  company_id?: string;
  module_id: number;
  parent_indicator_id?: number;
  indicator_name: string;
  description?: string;
  unit?: string;
  input_type: "numeric" | "boolean" | "text";
  /** Conditional visibility: show this indicator only when another indicator's answer equals the given value. */
  show_when?: { indicator_id: number; equals: string | number } | null;
  is_system: boolean;
  display_order: number;
  is_active: boolean;
  has_data?: boolean; // true = data submitted against this indicator; name is locked
}

// ═══ KPI ═══
export interface KPI {
  kpi_id: string;
  /** NULL for platform catalog KPIs (is_system = true). */
  company_id?: string;
  module_id: number;
  indicator_id?: number;
  kpi_name: string;
  unit: string;
  input_type: "numeric" | "boolean" | "text";
  description?: string;
  is_emission_source: boolean;
  scope_number?: 1 | 2 | 3;
  energy_type?: EnergyType;
  is_system?: boolean;
  /** Points back to the catalog KPI this was pulled from (tenant rows only). */
  source_kpi_id?: string;
  is_active: boolean;
  created_at: string;
}

// ═══ Conversion Factor ═══
export interface ConversionFactor {
  factor_id: number;
  /** NULL for platform catalog factors (is_system = true). */
  company_id?: string;
  kpi_id: string;
  energy_factor: number;
  energy_factor_uom: string;
  emission_factor: number;
  emission_factor_uom: string;
  valid_from: string;
  valid_to?: string;
  source?: string;
  is_system?: boolean;
  source_factor_id?: number;
  created_at: string;
}

// ═══ ESG Library (catalog tree + pull) ═══
export interface CatalogKPINode {
  kpi_id: string;
  kpi_name: string;
  unit: string;
  input_type: "numeric" | "boolean" | "text";
  description?: string;
  is_emission_source: boolean;
  scope_number?: number;
  energy_type?: string;
  factor_count: number;
}

export interface CatalogIndicatorNode {
  indicator_id: number;
  module_id: number;
  indicator_name: string;
  description?: string;
  input_type: "numeric" | "boolean" | "text";
  unit?: string;
  display_order: number;
  kpis: CatalogKPINode[];
}

export interface CatalogPulledIds {
  indicator_ids: number[];
  kpi_ids: string[];
}

export interface CatalogPullResult {
  indicators_added: number;
  kpis_added: number;
  factors_added: number;
}

// ═══ Location LB Factor ═══
export interface LocationLbFactor {
  lb_factor_id: number;
  company_id: string;
  location_id: string;
  kpi_id: string;
  kpi_name?: string;
  kpi_unit?: string;
  scope_number?: number;
  lb_factor: number;
  emission_uom: string;
  grid_zone_name?: string;
  valid_from: string;
  valid_to?: string;
  source?: string;
  created_at: string;
}

// ═══ Reporting Year ═══
export interface ReportingYear {
  id: string;
  company_id: string;
  year_id: number;
  fy_start_month: number;
  is_active: boolean;
  financial_year?: FinancialYear;
}

// ═══ Period Status ═══
export interface PeriodStatus {
  id: string;
  company_id: string;
  year_id: number;
  month_id: number;
  is_locked: boolean;
  locked_by?: string;
  locked_at?: string;
  month?: Month;
}

// ═══ Submission ═══
export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface KPIValue {
  record_id: string;
  kpi_id?: string;
  indicator_id?: number;
  quantity: number;
  text_value?: string;
  mj_value?: number;
  emission_value?: number;
  emission_value_lb?: number;
  notes?: string;
  updated_at: string;
}

export interface Submission {
  submission_id: string;
  company_id: string;
  location_id: string;
  year_id: number;
  month_id: number;
  status: SubmissionStatus;
  submitted_by?: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  kpi_values: KPIValue[];
}

export interface SubmissionListItem {
  submission_id: string;
  location_id: string;
  location_name: string;
  year_id: number;
  year_label: string;
  month_id: number;
  month_name: string;
  status: SubmissionStatus;
  kpi_count: number;
  filled_count: number;
  submitted_by_name?: string;
  submitted_at?: string;
  reviewed_by_name?: string;
  reviewer_notes?: string;
  updated_at: string;
}

// ESGInput — full record from /esg-input endpoint (location_metric_data row)
export interface ESGInput {
  record_id: string;
  company_id: string;
  location_id: string;
  kpi_id?: string;
  indicator_id?: number;
  submission_id?: string;
  year_id: number;
  month_id: number;
  quantity: number;
  mj_value?: number;
  emission_value?: number;
  emission_value_lb?: number;
  factor_id?: number;
  lb_factor_id?: number;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Optional embedded relations
  location?: { location_name: string };
  kpi?: { kpi_name: string; unit: string };
  financial_year?: { fy_label: string };
  month?: { month_name: string };
  status?: string;
}

// ═══ Review Comment ═══
export interface ReviewComment {
  comment_id: string;
  record_id: string;
  action: ReviewAction;
  comment?: string;
  actioned_by: string;
  actioned_at: string;
  quantity_before?: number;
  quantity_after?: number;
}

// ═══ Supporting Document ═══
export interface SupportingDocument {
  document_id: string;
  submission_id: string;
  record_id?: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_by: string;
  uploaded_at: string;
}

// ═══ Document Explorer ═══
export interface DocumentExplorerItem {
  document_id: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  submission_id: string;
  location_id: string;
  location_name: string;
  year_id: number;
  fy_label: string;
  month_id: number;
  month_name: string;
  submission_status: string;
  record_id?: string;
  kpi_id?: string;
  kpi_name?: string;
  indicator_id?: number;
  indicator_name?: string;
  module_id?: number;
  module_name?: string;
  quantity?: number;
  unit?: string;
}

// ═══ Query Engine ═══
export interface QueryTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface QueryChart {
  type: "bar" | "bar_h" | "line" | "pie";
  data: ChartPoint[];
  unit: string;
}

export interface QueryMetadata {
  intent: string;
  kpi_names: string[];
  location_names: string[];
  fy_labels: string[];
  module_names: string[];
  engine_used: "RULE_BASED" | "LLM";
}

export interface QueryResponse {
  answer: string;
  table?: QueryTable;
  chart?: QueryChart;
  suggestions: string[];
  metadata: QueryMetadata;
}

export interface ChatMessage {
  id: string;
  role: "user" | "system";
  content: string;
  table?: QueryTable;
  chart?: QueryChart;
  suggestions?: string[];
  engine_used?: "RULE_BASED" | "LLM";
  timestamp: Date;
}

// ═══ Notification ═══
export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  record_id?: string;
  is_read: boolean;
  created_at: string;
}

// ═══ Company Setting ═══
export interface CompanySetting {
  id: string;
  company_id: string;
  setting_key: string;
  setting_value: string;
  updated_by?: string;
  updated_at: string;
}

// ═══ Waste Disposal Breakdown ═══
export type WasteDisposalMethod =
  | "RECYCLED" | "REUSED" | "CO_PROCESSING" | "INCINERATION"
  | "LANDFILL" | "OTHER_RECOVERY" | "OTHER_DISPOSAL";

export interface WasteDisposalBreakdown {
  id: string;
  record_id: string;
  company_id: string;
  method: WasteDisposalMethod;
  quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ═══ Derived Metric ═══
export type OperandType  = "kpi_field" | "indicator_field" | "derived" | "constant";
export type OperandField = "quantity" | "mj_value" | "emission_value";
export type DerivedOperator = "+" | "-" | "*" | "/" | "%";

export interface KPIRef {
  kpi_id: string;
  kpi_name: string;
  unit: string;
}

export interface IndicatorRef {
  indicator_id: number;
  indicator_name: string;
}

export interface DerivedRef {
  metric_id: string;
  name: string;
  unit: string;
}

export interface DerivedMetric {
  metric_id: string;
  company_id: string;
  name: string;
  unit: string;
  description?: string;
  module_id?: number;
  indicator_id?: number;
  // Formula mode (new — takes precedence over LHS/op/RHS when set)
  formula?: string;
  // LHS (legacy mode — used when formula is null)
  lhs_type?: OperandType;
  lhs_kpi_id?: string;
  lhs_indicator_id?: number;
  lhs_derived_id?: string;
  lhs_field?: OperandField;
  lhs_constant?: number;
  lhs_kpi?: KPIRef;
  lhs_indicator_ref?: IndicatorRef;
  lhs_derived_ref?: DerivedRef;
  // Operator (legacy mode)
  operator?: DerivedOperator;
  // RHS (legacy mode)
  rhs_type?: OperandType;
  rhs_kpi_id?: string;
  rhs_indicator_id?: number;
  rhs_derived_id?: string;
  rhs_field?: OperandField;
  rhs_constant?: number;
  rhs_kpi?: KPIRef;
  rhs_indicator_ref?: IndicatorRef;
  rhs_derived_ref?: DerivedRef;
  // Display
  show_in_report: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ═══ Scope 3 ═══

/** GHG Protocol calculation methods — per entry row */
export type Scope3CalcMethod =
  | "SUPPLIER_SPECIFIC"   // qty × EF from supplier's own data
  | "AVERAGE_DATA"        // qty × EF from process LCA database
  | "SPEND_BASED"         // monetary value × EEIO EF
  | "DIRECT_ESTIMATE";    // user directly enters tCO2e

export type Scope3Type = "upstream" | "downstream";

export interface Scope3GHGCategory {
  category_id: number;
  code: string;
  name: string;
  description?: string;
  scope3_type: Scope3Type;
  entry_type?: string | null;  // legacy; not used in new unified form
  typical_unit: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Scope3FactorSet {
  factor_set_id: string;
  company_id: string | null;
  set_name: string;
  source_name: string | null;
  dataset_year: number | null;
  currency_code: string | null;
  methodology: string | null;
  version: string | null;
  is_system: boolean;
  is_active: boolean;
  source_set_id: string | null;
  item_count: number;
  created_at: string;
}

export interface Scope3FactorItem {
  factor_item_id: string;
  factor_set_id: string;
  ghg_category_id: number;
  sector_code: string | null;
  sector_name: string;
  activity_type: string | null;
  sub_type: string | null;
  emission_factor: number;
  emission_unit: string;          // "kgCO2e" | "tCO2e"
  activity_unit: string | null;   // "km" | "tonne" | "INR" | …
  calc_method: string;            // "AVERAGE_DATA" | "SPEND_BASED"
  factor_unit: string | null;     // legacy derived display string
  wtt_factor: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface Scope3Batch {
  batch_id: string;
  company_id: string;
  ghg_category_id: number;
  ghg_category_name: string;
  location_id: string | null;
  location_name: string | null;
  reporting_year: number;
  reporting_month: number | null;
  entry_type: string | null;    // legacy; NULL for new unified batches
  factor_set_id: string | null;
  factor_set_name: string | null;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  total_emissions: number | null;
  notes: string | null;
  rejection_reason: string | null;
  uploader_name: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface Scope3Entry {
  entry_id: string;
  batch_id: string;
  row_number: number;
  // GHG Protocol calculation method (per row)
  calculation_method: Scope3CalcMethod;
  // Common
  activity_label?: string;    // description for all methods
  supplier_id?: string;
  supplier_name?: string;
  notes?: string;
  // Quantity-based (SUPPLIER_SPECIFIC, AVERAGE_DATA)
  quantity?: number;
  quantity_unit?: string;
  manual_emission_factor?: number;  // SUPPLIER_SPECIFIC only
  manual_ef_unit?: string;          // SUPPLIER_SPECIFIC: "kgCO2e" | "tCO2e"
  factor_item_id?: string;
  sector_name?: string;       // joined from factor_item
  // Spend-based (SPEND_BASED)
  amount?: number;
  currency_code?: string;
  // Direct estimate (DIRECT_ESTIMATE)
  source_reference?: string;
  // Legacy (kept for backward compat)
  location_id?: string;
  location_name?: string;
  item_description?: string;
  spend_date?: string;
  methodology?: string;
  // Result
  emission_value?: number;
  validation_status: string;
  error_message?: string;
  // Phase 2: category-specific fields (Appendix D)
  computation_mode?: "SIMPLE" | "CATEGORY" | "AUTO" | "ALLOCATION" | "HYBRID";
  data_source?: string;
  assumptions?: string;
  distance_km?: number;
  mass_tonnes?: number;
  transport_mode?: string;
  vehicle_type?: string;
  hotel_nights?: number;
  num_passengers?: number;
  num_employees?: number;
  pct_mode?: number;
  working_days?: number;
  floor_area_m2?: number;
  total_area_m2?: number;
  refrigerant_kg?: number;
  refrigerant_gwp?: number;
  units_sold?: number;
  lifetime_uses?: number;
  energy_per_use?: number;
  equity_share_pct?: number;
  investee_revenue?: number;
  waste_method?: string;
  waste_type?: string;
}

export interface Scope3Assignment {
  assignment_id: string;
  company_id: string;
  ghg_category_id: number;
  ghg_category_name: string | null;
  ghg_category_code: string | null;
  scope3_type: Scope3Type | null;
  location_id: string | null;
  location_name: string | null;
  assigned_to: string | null;
  assigned_user_name: string | null;
  factor_set_id: string | null;
  factor_set_name: string | null;
  entry_type: string;   // comma-separated Scope3CalcMethod values
  is_active: boolean;
  created_at: string;
}

export interface Scope3UploadResult {
  batch_id: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  total_emissions: number | null;
  errors: { row: number; message: string }[];
}

export interface Scope3DashboardStats {
  reporting_year: number;
  total_emissions: number;
  upstream_emissions: number;
  downstream_emissions: number;
  approved_batch_count: number;
  pending_batch_count: number;
  by_category: {
    category_id: number;
    category_code: string;
    category_name: string;
    scope3_type: Scope3Type;
    emissions: number;
  }[];
}

// ── Suppliers ───────────────────────────────────────────────────────────────

export interface Supplier {
  supplier_id: string;
  company_id: string;
  supplier_name: string;
  supplier_code?: string;
  gstin?: string;
  pan?: string;
  vendor_code?: string;
  sector_code?: string;
  sector_name?: string;
  risk_tier?: "HIGH" | "MEDIUM" | "LOW";
  is_critical: boolean;
  contact_name?: string;
  contact_email?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierEmissionFactor {
  factor_id: string;
  supplier_id: string;
  company_id: string;
  product_category: string;
  emission_factor: number;
  emission_uom: string;
  unit_basis?: string;
  valid_from?: string;
  valid_to?: string;
  source_note?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierScorecard {
  supplier_id: string;
  supplier_name: string;
  supplier_code?: string;
  sector_name?: string;
  risk_tier?: string;
  is_critical: boolean;
  total_emissions: number;
  total_spend: number;
  entry_count: number;
  category_count: number;
  pct_of_total: number;
}

export interface SupplierCategorySplit {
  category_id: number;
  category_code: string;
  category_name: string;
  emissions: number;
  spend: number;
  entry_count: number;
}

export interface SupplierTrend {
  month: number;
  emissions: number;
  spend: number;
}

export interface SupplierScorecardDetail {
  supplier: Supplier;
  total_emissions: number;
  total_spend: number;
  entry_count: number;
  by_category: SupplierCategorySplit[];
  trend: SupplierTrend[];
}

export interface SupplierScorecardSummary {
  reporting_year: number;
  total_emissions: number;
  supplier_count: number;
  unlinked_count: number;
  top_suppliers: SupplierScorecard[];
}

// ── KPI Targets ──────────────────────────────────────────────────────────────

export type TargetType = "ABSOLUTE" | "INTENSITY";
export type TargetAggField = "quantity" | "mj_value" | "emission_value";

export interface KPITarget {
  target_id: string;
  company_id: string;
  kpi_id?: string;
  indicator_id?: number;
  module_id: number;
  target_type: TargetType;
  agg_field: TargetAggField;
  baseline_year_id: number;
  baseline_value: number;
  target_year_id: number;
  target_value: number;
  target_unit?: string;
  intensity_denominator?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Denormalised display fields
  kpi_name?: string;
  indicator_name?: string;
  module_name?: string;
  module_color?: string;
  baseline_fy_label?: string;
  target_fy_label?: string;
}

export interface TargetProgress {
  target_id: string;
  label: string;
  module_name: string;
  module_color: string;
  target_type: TargetType;
  agg_field: TargetAggField;
  unit: string;
  baseline_value: number;
  baseline_fy_label: string;
  target_value: number;
  target_fy_label: string;
  current_value: number;
  current_fy_label: string;
  delta_from_baseline: number;
  delta_pct: number;
  progress_pct: number;
  on_track: boolean;
  direction: "DECREASE" | "INCREASE";
}

export interface TargetProgressSummary {
  current_fy_id: number;
  current_fy_label: string;
  total_targets: number;
  on_track_count: number;
  at_risk_count: number;
  items: TargetProgress[];
}

// ── Auditor Remarks ──────────────────────────────────────────────────────────

export type RemarkSeverity = "OBSERVATION" | "FINDING" | "NON_CONFORMITY";
export type RemarkStatus   = "OPEN" | "RESPONDED" | "CLOSED";

export interface RemarkResponse {
  response_id: string;
  remark_id: string;
  responder_user_id: string;
  response_text: string;
  created_at: string;
  responder_name?: string;
  responder_role?: string;
}

export interface AuditorRemark {
  remark_id: string;
  company_id: string;
  submission_id: string;
  record_id?: string;
  auditor_user_id: string;
  remark_text: string;
  severity: RemarkSeverity;
  status: RemarkStatus;
  created_at: string;
  updated_at: string;

  // Denormalised
  auditor_name?: string;
  location_name?: string;
  fy_label?: string;
  month_name?: string;
  submission_status?: string;
  kpi_name?: string;
  response_count: number;
  responses: RemarkResponse[];
}

export interface RemarkSummary {
  total: number;
  by_severity: Record<string, number>;
  by_status:   Record<string, number>;
  open_count:  number;
}
