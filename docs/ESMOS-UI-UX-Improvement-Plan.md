# ESMOS — UI/UX Improvement Plan

**Product:** ESMOS (ESG Management & Oversight System)  
**Delivery model:** 3 milestones  
**Date:** July 2026

---

## Response to your requirements

Below are direct answers to the points raised. The detailed work for each item is specified under the three milestones that follow.

---

### What are our expectations for this work?

We will deliver a **unified enterprise UI** across the entire ESMOS platform (tenant portal, platform portal, and login), so the application presents as one professional product — comparable in density and clarity to tools such as **SAP Fiori** and **Salesforce Lightning**.

Our expectations:

- **One design system** applied to every screen — consistent colors, typography, spacing, components, and interaction patterns.
- **Full-page workspaces** that use the available viewport efficiently, especially for data entry and administration.
- **Reusable building blocks** (page shell, data tables, form fields, filters, drawers) so all current and future pages follow the same standards.
- **Mobile and tablet support** — the shell and core workflows must remain usable on smaller screens.
- **No regression** in existing business logic — ESG workflows, role-based access, review cycles, support sessions, and reporting behaviour remain intact; this is a presentation and UX layer upgrade.
- **Sign-off at each milestone** before proceeding to the next stage.

This work is **primarily frontend**. Theme and density preferences can be delivered without backend changes in the first release.

---

### What will be done to improve UI/UX across the platform?

Improvement is organised in three stages:

| Milestone | Scope summary |
|-----------|---------------|
| **M1 — Foundation & design system** | Visual language, app shell, shared components, loading/empty states, pilot page migrations |
| **M2 — Professional forms & workspaces** | SAP/Salesforce-style dense input forms, validation, and redesign of all high-complexity data-entry pages |
| **M3 — Dashboards, themes & launch** | Enterprise dashboards, Reports & Analytics, user theme/density settings, remaining pages, QA and release |

**In scope:** all **30+ screens** across tenant portal, platform portal, and login.

**Tenant portal:** Dashboard, ESG Input, Review, Reports, KPI Setup, Indicators, Locations, Users, Settings, Notifications, Documents, Targets, Suppliers, Query, Help, ESG Library, Auditor Remarks, Reporting Years, and related flows.

**Platform portal:** Dashboard, Companies, System Config, Audit Log, Admins, Scope 3, Capability Catalog, Support Tickets.

---

### How will we show professional-level input forms?

Complex forms will move from **small dialogs and inconsistent layouts** to a standard **Form Workspace** pattern:

| Zone | Purpose |
|------|---------|
| **Header band** | Record title, status badge, breadcrumbs, primary actions (Save, Submit, Cancel) |
| **Context strip** | Always-visible context: company, financial year, location, module, reporting period |
| **Sectioned body** | Fields grouped by topic in a **2–3 column grid** on desktop (single column on mobile) |
| **Side panel** | Attachments, remarks, audit info, help — without compressing the main form |
| **Sticky footer** | Save Draft, Submit, Validate — always reachable on long forms |

**Applies to:** ESG Input, Review (detail panel), KPI Setup, User Management, Locations, Company Management, System Config, Scope 3 entry forms, Supplier Scorecard, Targets, and all create/edit dialogs upgraded to wide-panel or full-page layout where appropriate.

**Validation:** required fields marked clearly; errors shown **inline under each field**; server validation messages mapped to the correct field.

---

### How will we introduce theme settings for users?

A new **Appearance** section will be added under **Settings** (and accessible from the user profile menu):

| Setting | Options | Effect |
|---------|---------|--------|
| **Theme** | Light / Dark / System | Controls overall colour scheme |
| **Interface density** | Compact / Comfortable / Spacious | Controls row height, padding, and how much data fits on screen |
| **Table rows per page** | User preference | Default pagination on list pages |

**Technical approach:**

- All colours, spacing, and density values driven by **design tokens** (CSS variables).
- Preferences saved per user in the browser (v1); optional server sync can be added later.
- Density applies globally to tables, forms, sidebar, and dashboard widgets.

Theme settings are delivered in **Milestone 3**, after the design token foundation is built in Milestones 1 and 2.

---

### How will we deliver professional dashboards using the full page?

Dashboards and analytics will follow an **enterprise command-centre** layout:

- **Full-width KPI strip** at the top — key metrics with period comparison where data allows.
- **Filter bar** directly below — financial year, location, module; filters sync across widgets on the same page.
- **Responsive chart and table grid** — no large empty margins; charts use themed colours from the design system.
- **Actions required panel** — pending reviews, draft submissions, alerts surfaced prominently.
- **Click-through** — KPI cards and table rows link to the relevant detail page.

**Applies to:** Tenant Dashboard, Platform Dashboard, and Reports & Analytics (both Analytics and Report / Annexure tabs).

Inspired by SAP and Salesforce: **maximum information density with clear hierarchy**, and user-controlled compactness via density settings.

---

## Milestone overview

| Milestone | Duration | Primary outcome |
|-----------|----------|-----------------|
| **M1 — Foundation & design system** | 1 week | One visual language, mobile-ready shell, shared components |
| **M2 — Professional forms & workspaces** | 1 week | Dense, full-page input forms across all data-entry workflows |
| **M3 — Dashboards, themes & launch** | 1 week | Enterprise dashboards, user theme settings, full platform rollout |

**Total estimated duration:** 3 weeks

---

# Milestone 1 — Foundation & Design System

**Duration:** 1 week
**Goal:** Establish the visual and structural foundation that every page in ESMOS will build on. After M1, the product will have one consistent look, a mobile-usable shell, and shared components ready for form and dashboard work in M2 and M3.

---

## 1.1 Design system & visual language

| Item | Detail |
|------|--------|
| **Colour tokens** | Unified primary accent, background, surface, border, text, and semantic colours (success, warning, error, info). Resolve current inconsistency between CSS variables and hardcoded brand colours. |
| **Typography scale** | Defined sizes for page titles, section headers, body text, labels, captions, and table headers. Replace ad-hoc `text-[Npx]` values with named tokens. |
| **Spacing scale** | Consistent padding and margins for pages, cards, form fields, and table cells (4 / 8 / 12 / 16 / 24 / 32px system). |
| **Border radius** | Three tiers: small (inputs, badges), medium (cards, panels), large (modals). |
| **Shadows & elevation** | Subtle elevation for cards, dropdowns, and modals — no inconsistent shadow styles. |
| **Icon system** | Standardised icon sizes (12 / 14 / 16 / 18 / 20px) across navigation, tables, and forms. |
| **Status colours** | Single status colour map for workflow states: Draft, Submitted, Approved, Rejected, Locked, Active, Suspended, etc. |
| **Design reference** | Figma file with tokens, 8 key screen wireframes: Login, Tenant Dashboard, ESG Input, Review, Reports, User Management, Platform Dashboard, Settings. |

---

## 1.2 Application shell & layout

| Item | Detail |
|------|--------|
| **App shell** | Sidebar navigation + main content area for both tenant and platform portals. |
| **Mobile responsive sidebar** | Below `lg` breakpoint: sidebar becomes an overlay drawer with hamburger trigger, backdrop dismiss, and preserved navigation grouping. |
| **Sidebar improvements** | Retain role-based nav, notification badges, support ticket indicators, and user menu; align styling to new design tokens. |
| **Optional top context bar** | Slim bar above page content showing portal name, company name (tenant), and quick context where relevant. |
| **Support session banner** | Preserve existing read-only support session behaviour; restyle to match new system. |
| **Consent dialog** | Preserve GDPR/DPDP consent gate; restyle to match new dialog component. |
| **Route loading** | Replace blank white flash during lazy route load with a layout skeleton (sidebar + content placeholder). |
| **Page animation** | Retain subtle page-enter animation; ensure it does not cause layout shift. |
| **Login page** | Minor visual alignment to new token system (login quality is already high; accent and typography harmonised). |

---

## 1.3 Shared UI components (build or refresh)

| Component | Specification |
|-----------|---------------|
| **Button** | Variants: primary, secondary, outline, ghost, destructive, link. Sizes: sm, default, lg, icon. Token-based colours; no gradient variants on standard actions. |
| **Input** | Consistent height, border, focus ring, placeholder, disabled, and error states. |
| **Textarea** | Matches Input styling; resizable where appropriate. |
| **Select** | Radix-based dropdown; replaces native `<select>` elements platform-wide. |
| **Label** | Standard label + optional required asterisk + optional hint text. |
| **FormField** | Wrapper: label + control + hint + inline error message. |
| **Badge / Status** | Consolidate `Badge`, `StatusBadge`, and `EsgStatusBadge` into one status component with defined variants. |
| **Dialog** | Header, body, footer sections; consistent padding and close button. |
| **Drawer / Sheet** | Side panel for detail views (used heavily in M2). |
| **Table** | Base table with header row styling, row hover, compact density support. |
| **DataTable** | Full list-page pattern: search box, filter row slot, column headers, pagination (page / size / total), loading skeleton, empty state slot, optional row actions column. |
| **PageShell** | Breadcrumb + page title + description + right-aligned action buttons + consistent `page-root` padding. |
| **Breadcrumb** | Hierarchical navigation trail on all inner pages. |
| **PageTabs** | Underline-style tabs for pages with multiple views (used in Reports, Settings, KPI Setup). |
| **FilterBar** | Horizontal row of Select filters with labels and a Clear button. |
| **EmptyState** | Icon + title + description + optional CTA button. |
| **LoadingSkeleton** | Table-shaped and card-shaped skeleton variants. |
| **Progress** | Token-based progress bar for module completion and form progress. |
| **Tooltip** | For collapsed sidebar labels and icon-only action buttons. |
| **Toast** | Sonner retained; ensure colours align with semantic tokens. |

---

## 1.4 Pages migrated in Milestone 1

These pages will be fully migrated to `PageShell` + `DataTable` (where applicable) + new component styles:

| Portal | Pages |
|--------|-------|
| **Tenant** | Dashboard (shell only — full dashboard redesign in M3), User Management, Locations, Notifications |
| **Platform** | Dashboard (shell only), Admin Management, Audit Log |
| **Shared** | Layout, Sidebar, Login (token alignment), Error boundary page |

---

## 1.5 Milestone 1 — deliverables checklist

- [ ] Figma design system file with tokens and 8 wireframe screens
- [ ] CSS / Tailwind token implementation — single source of truth for colours and spacing
- [ ] Mobile-responsive `AppShell` with overlay drawer
- [ ] Route loading skeleton (no blank white flash)
- [ ] All shared components listed in §1.3 built and documented
- [ ] `DataTable` component with search, pagination, loading, and empty states
- [ ] `PageShell` applied to 7+ pilot pages
- [ ] Status badge system consolidated to one component
- [ ] Native `<select>` removed from all M1 migrated pages

---

## 1.6 Milestone 1 — acceptance criteria

- [ ] Visual consistency: one accent colour, one background, one typography scale across all M1 pages
- [ ] Mobile: core navigation usable at 375px viewport width
- [ ] No blank white screen on route transitions
- [ ] DataTable pagination and search behave identically on User Management and Locations
- [ ] Designer and client sign-off on tokens and wireframes
- [ ] Staging demo of mobile shell + pilot pages (end of M1)

---

# Milestone 2 — Professional Forms & Workspaces

**Duration:** 1 week  
**Goal:** Transform every significant data-entry and administration workflow into a **dense, full-page workspace** — the standard used by SAP and Salesforce. After M2, users will experience professional input forms with clear sections, inline validation, and maximum use of screen space.

---

## 2.1 Form workspace framework

| Item | Detail |
|------|--------|
| **FormWorkspace** | Top-level layout wrapper for all complex forms. |
| **FormHeader** | Record title, status badge, breadcrumb, action buttons (Save / Submit / Cancel / Delete). |
| **FormContextBar** | Sticky strip showing active context: company, FY, location, module, month — always visible while scrolling. |
| **FormSection** | Titled section with optional description; groups related fields. |
| **FormRow** | Responsive 1 / 2 / 3-column grid row within a section. |
| **FormField** | Label, input, hint text, required indicator, inline error — used on every field. |
| **FormSidePanel** | Optional right panel for attachments, comments, history. |
| **FormFooter** | Sticky bottom bar with primary and secondary actions on long forms. |
| **Validation** | Client-side: required fields, format checks, cross-field rules. Server-side: map HTTP 422 field errors to the correct `FormField`. |
| **Form library** | `react-hook-form` + `zod` schemas for all migrated forms. |
| **Upgrade FormDialog** | Simple creates (quick adds) retain dialog pattern; complex creates open in wide panel or full page. |

---

## 2.2 ESG Input — full workspace redesign

The highest-priority daily-use page. Currently ~1,760 lines in a single file; will be split into focused components.

| Item | Detail |
|------|--------|
| **Page layout** | `FormWorkspace` with context bar showing selected location, financial year, module, and month. |
| **Month strip** | Redesigned month selector: compact chips, Lucide icons instead of emoji, accessible labels, colour-coded status (Draft / Submitted / Approved / Rejected / Locked). |
| **Module tabs** | Module switcher across Energy, Emissions, Water, Waste, etc. — aligned to design tokens. |
| **Indicator / KPI sections** | Fields grouped by indicator; 2-column grid for numeric inputs; clear unit labels. |
| **Conditional fields** | `show_when` logic preserved; hidden fields collapsed cleanly. |
| **Waste disposal breakdown** | Seven-method disposal grid in a dense table layout within the form section. |
| **Auto-computed fields** | Read-only computed values styled distinctly (muted background, mono font). |
| **Document attachments** | `FormSidePanel` or inline attachment section per record; upload, download, delete. |
| **Scope 3 tab** | `Scope3InputTab` restyled to match workspace; no functional regression. |
| **Rich text fields** | `RichTextEditor` aligned to Input focus and border styles. |
| **Progress indicator** | Show % of required indicators completed for the selected month. |
| **Sticky footer** | Save Draft, Submit, and validation feedback always visible. |
| **Support read-only mode** | `WriteOnly` / support session: write controls hidden; layout and navigation remain fully interactive. |
| **Component split** | `ESGInputLayout`, `MonthStrip`, `ModuleTabs`, `SubmissionForm`, `AttachmentPanel`, `useESGInput` hook. |

---

## 2.3 Review — master-detail workspace

| Item | Detail |
|------|--------|
| **Split layout** | Desktop: submission list (left, ~35%) + detail panel (right, ~65%). Mobile: list → tap → full-screen detail. |
| **URL deep linking** | `/app/review/:id` — selected submission survives page refresh; shareable link for reviewers. |
| **Filter tabs** | All / Pending / Approved / Rejected / Draft with live counts. |
| **List rows** | Dense rows: location, period, module, status badge, submitter, date. |
| **Detail header** | Submission metadata, status, location, FY, month in `FormContextBar`. |
| **Detail body** | Expandable indicator sections; KPI values read-only; waste disposal breakdown visible. |
| **Document viewer** | Inline attachment list with download per record. |
| **Scope 3 review** | `Scope3ReviewDetail` integrated in split panel. |
| **Auditor remarks** | `SubmissionRemarksPanel` in side panel or section. |
| **Sticky review footer** | Approve, Reject (with reason input), Review notes — always visible in detail panel. |
| **Notification deep links** | Clicking a notification opens the correct submission in Review. |

---

## 2.4 KPI Setup — master-detail workspace

| Item | Detail |
|------|--------|
| **Page tabs** | KPIs / Derived Metrics / Scope 3 Setup — using shared `PageTabs`. |
| **KPI list** | `DataTable` with module filter, search, pagination; module colour pills. |
| **KPI detail drawer** | Click row → right drawer with full KPI edit form in `FormWorkspace` sections. |
| **KPI create** | Wide panel with sections: Basic info, Module, Unit, Energy type, Emission scope, etc. |
| **Conversion factors** | Managed inside KPI drawer; factor list + add/edit in nested panel; recalculate confirmation dialog. |
| **Derived metrics** | Table list with show/hide in report flag. |
| **Derived metric form** | **Simple mode** (default): LHS operand, operator, RHS operand. **Advanced mode**: formula builder collapsed behind toggle. |
| **Scope 3 Setup tab** | Lazy-loaded `Scope3SetupPage` restyled to match workspace. |
| **Component split** | `KPIList`, `KPIDetailDrawer`, `DerivedMetricsPanel`, `ConversionFactorsPanel`. |

---

## 2.5 User Management & Locations

| Item | Detail |
|------|--------|
| **User list** | `DataTable` with role filter, search, pagination, module pills, location pills. |
| **User create** | Wide panel / full page: Personal info section, Role section, Assigned Modules (chip multi-select), Assigned Locations (chip multi-select). Warning when no modules/locations assigned. |
| **User edit** | Same layout; password change excluded (handled in sidebar). |
| **Deactivate / reactivate / erase** | `ConfirmDialog` with clear destructive styling. |
| **Location list** | Table view + grid view toggle (retain existing preference in localStorage). |
| **Location create / edit** | `FormWorkspace` sections: Name, Code, Address, Status, Emission factors. |
| **Location LB factors** | Drawer panel: factor list per location, add/edit/delete, UOM selectors. |

---

## 2.6 Platform administration forms

| Item | Detail |
|------|--------|
| **Company Management** | `DataTable` company list; company detail in shared `Drawer`; create/edit in wide panel with sectioned fields (company info, plan, status, admin contact). |
| **System Config — Modules** | Sectioned workspace; custom dialog with `IconPicker` and colour swatches; render type selector with descriptions. |
| **System Config — Indicators** | `DataTable` + edit in drawer; conditional `show_when` fields in form sections. |
| **System Config — Financial Years** | Table + create/edit form sections (label, start date, end date). |
| **System Config — Subscription Plans** | Plan cards + capabilities matrix drawer (`PlanFeaturesDrawer` restyled). |
| **System Config — UOMs** | Category filter + table + create/edit. |
| **System Config — Catalog KPIs** | Filter by module/indicator; KPI edit drawer; conversion factor drawer. |
| **System Config — Vocabularies** | `VocabulariesManager` restyled to `DataTable` + inline edit pattern. |
| **Admin Management** | `DataTable` + `FormDialog` upgraded to wide panel. |
| **Platform Scope 3** | GHG factors table + entry forms in workspace layout. |
| **Capability Catalog** | `PageShell` + `DataTable` + edit forms. |

---

## 2.7 Tenant configuration & data pages

| Item | Detail |
|------|--------|
| **Indicators** | `DataTable` + indicator edit in drawer; parent/child hierarchy visible. |
| **Reporting Years** | Table + lock/unlock period actions; create/edit form. |
| **ESG Library** | Template catalog in dense table/grid; import and preview in panel. |
| **Scope 3 Setup page** | Full workspace if accessed directly; aligned with KPI Setup tab. |
| **Scope 3 Hub** | Restyled to `PageShell` + workspace sections. |
| **Supplier Scorecard** | Sectioned form workspace for supplier data entry and scoring. |
| **Targets** | Target definition form in sectioned layout; FY and KPI linkage clear in context bar. |
| **Auditor Remarks** | Read/add remarks in sectioned layout; linked to submission context. |
| **Document Explorer** | `DataTable` with filters; download and export actions in page header. |
| **Help & Support** | Ticket list `DataTable`; ticket detail in drawer; create ticket form in panel. |
| **Settings — Config tab** | Company display name, timezone, FY start month, report footer, reminder day — in `FormSection` groups. |
| **Settings — Support tab** | `SupportAccessInbox` restyled. |
| **Settings — Compliance tab** | Activity log `DataTable`. |

---

## 2.8 Milestone 2 — deliverables checklist

- [ ] `FormWorkspace` framework and all sub-components (§2.1)
- [ ] ESG Input fully redesigned and component-split
- [ ] Review page: split view + URL deep linking
- [ ] KPI Setup: master-detail + derived metrics simple/advanced mode
- [ ] User Management and Locations: wide-panel creates, inline validation
- [ ] Company Management and System Config: sectioned workspaces and drawers
- [ ] All tenant configuration pages (§2.7) migrated to `PageShell` + `DataTable` / workspace
- [ ] `react-hook-form` + `zod` on all migrated forms
- [ ] Server 422 errors displayed inline on the correct field
- [ ] `Drawer`, `FilterBar`, `PageTabs` shared and used consistently
- [ ] Native `<select>` removed from all M2 pages

---

## 2.9 Milestone 2 — acceptance criteria

- [ ] ESG Input: a Location User can complete a full monthly submission using only the new workspace layout
- [ ] Review: a Reviewer can open a direct link, review submission details, and approve/reject in ≤ 3 clicks from the detail panel
- [ ] KPI Setup: a Company Admin can add a KPI and a conversion factor without using a cramped dialog
- [ ] All required-field errors appear under the field, not only as toast messages
- [ ] No functional regression in support read-only sessions, role-based nav, or Scope 3 flows
- [ ] Client sign-off on ESG Input demo (mid-M2) and full M2 staging walkthrough (end of M2)

---

# Milestone 3 — Dashboards, Themes & Launch

**Duration:** 1 week  
**Goal:** Deliver enterprise-grade dashboards that use the full page, introduce user theme and density settings, complete migration of any remaining pages, and release a fully consistent, tested platform.

---

## 3.1 Tenant Dashboard — enterprise command centre

| Item | Detail |
|------|--------|
| **Page layout** | Full-width `PageShell`; no narrow centred column. |
| **Welcome header** | User name, company, role — compact, not oversized. |
| **FY period selector** | Dropdown in page header; all dashboard metrics respect selected FY. |
| **KPI strip** | Full-width row: Locations, KPIs, Submissions, Pending Review — with trend vs previous FY where data is available. |
| **KPI cards** | Clickable; navigate to relevant page (Locations, KPI Setup, ESG Input, Review). |
| **Actions required panel** | Pending reviews, unread notifications, incomplete months — with direct links. |
| **Quick actions** | Dense action row: Submit ESG Data, Review, Manage Locations, View Reports. |
| **Module progress** | Completion % per module (approved / expected) — not misleading relative bar chart. |
| **Recent activity** | Notification feed in dense list; status badges; click → correct page. |
| **Onboarding checklist** | For new tenants: setup steps (locations, FY, KPIs, users, first submission) with checkmarks and links. |

---

## 3.2 Platform Dashboard — operations overview

| Item | Detail |
|------|--------|
| **KPI strip** | Total companies, Active, Suspended/Blocked, Audit actions — full width. |
| **Alert banner** | Visible when suspended companies > 0; links to filtered company list. |
| **Recent companies table** | Dense `DataTable`; clickable rows open company detail drawer. |
| **Subscription plans panel** | Plan cards with user/site/KPI limits; link to System Config. |
| **Recent audit log** | Dense table; action badges; link to full Audit Log page. |
| **Click-through** | Every KPI card navigates to the relevant filtered list. |

---

## 3.3 Reports & Analytics — full-page analytics workspace

| Item | Detail |
|------|--------|
| **Page layout** | Full-width; no narrow container. |
| **Tab bar** | Analytics / Report (Annexure) — shared `PageTabs`. |
| **Filter bar** | FY, Location, Month (analytics only) — `FilterBar` with labels; Clear button. |
| **Export actions** | Export Excel (annexure), Generate BRSR — in page header; BRSR shows loading state while generating. |
| **KPI strip (analytics)** | Energy, Emissions, Water, Waste, Scope 3 — full-width, 5 columns. |
| **Chart grid** | 2-column responsive grid, full available width. |
| **Charts included** | Monthly emissions/energy bar, Emissions by scope pie, Top emitters by location horizontal bar, GHG scope breakdown, Energy mix stacked bar, Energy vs emissions trend line, Scope 3 by GHG category bar (when data exists). |
| **Chart theming** | All chart colours from design tokens via shared `ChartTheme` config. |
| **Chart components** | Shared `ChartCard` (title + chart + empty state). |
| **Chart empty states** | Designed empty state per chart, not plain text. |
| **Cross-filter (optional)** | Click pie segment or bar → apply filter to other charts on the page. |
| **Annexure tab** | Full-width pivot table; horizontal scroll; dense column headers; Excel export. |
| **Role respect** | Location User sees only assigned location in filters. |

---

## 3.4 Query (Ask ESMOS) — polish

| Item | Detail |
|------|--------|
| **Page layout** | `PageShell` header; chat area uses remaining viewport height. |
| **Chat UI** | Message bubbles aligned to design tokens; engine badge (AI / Standard). |
| **Empty state** | Suggestion chips on first load. |
| **Loading state** | Typing indicator with accessible `aria-live` region. |
| **Result table & chart** | `ResultTable` and `QueryChart` themed consistently with Reports. |

---

## 3.5 Theme & appearance settings

| Item | Detail |
|------|--------|
| **Settings → Appearance** | New section in tenant Settings (and accessible from user profile menu). |
| **Theme: Light** | Default; warm neutral background; token-based colours. |
| **Theme: Dark** | Dark content area; adjusted surface, border, and text tokens; charts and tables themed. |
| **Theme: System** | Follows OS `prefers-color-scheme`. |
| **Density: Compact** | Reduced row heights, tighter padding — maximum data on screen (SAP-style). |
| **Density: Comfortable** | Default balanced spacing. |
| **Density: Spacious** | Increased padding for readability. |
| **Density scope** | Applied to: tables, form fields, sidebar nav items, dashboard widgets, list rows. |
| **Table preference** | Default rows per page (10 / 20 / 50). |
| **Persistence** | Saved to `localStorage` per user on save; applied immediately on change without page reload. |
| **Admin accent (optional)** | Company Admin can set organisation accent colour in Company Config; applied to primary buttons and active nav state. |

---

## 3.6 Remaining pages & final consistency pass

All pages not fully completed in M1 or M2 receive final `PageShell`, token, and density treatment:

| Portal | Pages |
|--------|-------|
| **Tenant** | Query, Help & Support, Documents, Suppliers, Targets, Auditor Remarks, ESG Library, Scope 3 Hub, Scope 3 Setup (standalone route), Notifications (final polish) |
| **Platform** | Platform Scope 3, Capability Catalog, Platform Support Tickets, Audit Log (final polish), Admin Management (final polish) |
| **Shared** | All dialogs, dropdowns, and toast messages aligned to tokens; remove any remaining hardcoded hex colours |

**Global consistency tasks:**

- [ ] Every page uses `PageShell` (except Login)
- [ ] Every list page uses `DataTable`
- [ ] Every complex form uses `FormWorkspace` or wide panel
- [ ] One card/surface pattern across the app
- [ ] One tab pattern (`PageTabs`) across the app
- [ ] One drawer pattern across the app

---

## 3.7 Accessibility & quality assurance

| Item | Detail |
|------|--------|
| **Keyboard navigation** | All interactive elements reachable by Tab; logical tab order in forms. |
| **Focus indicators** | Visible focus ring on all controls. |
| **ARIA labels** | All icon-only buttons labelled; form fields associated with labels. |
| **Screen reader** | Month status, notification counts, and chat messages announced correctly. |
| **Colour contrast** | WCAG AA on text, labels, and status badges at all density levels. |
| **Emoji removal** | All emoji status indicators replaced with Lucide icons + text labels. |
| **Skip to content** | Skip link at top of AppShell. |
| **Dialog focus trap** | All modals and drawers trap focus correctly. |

**QA regression matrix — all roles must pass primary paths:**

| Role | Portal | Critical paths to test |
|------|--------|------------------------|
| Company Admin | Tenant | Setup, ESG Input, Review, Reports, Users, Settings, Appearance |
| Location User | Tenant | ESG Input (assigned location/module only) |
| Reviewer | Tenant | Review queue, approve/reject, deep link |
| Auditor | Tenant | Auditor Remarks, read-only document access |
| Platform Owner | Platform | Companies, System Config, Audit Log, Plans |
| Platform Admin | Platform | Companies (no admins tab), Support Tickets |
| Support session | Tenant | Read-only: navigation works, all writes blocked |

---

## 3.8 Documentation & release

| Item | Detail |
|------|--------|
| **Component guide** | Short developer doc: when to use PageShell, DataTable, FormWorkspace, Drawer. |
| **Storybook** | Core components documented with variants (Button, Input, Select, Badge, Status, PageShell, DataTable, FormField, ChartCard). |
| **Release notes** | Summary of UI changes for internal team and end users. |
| **Staging sign-off** | Client UAT with 1–2 users per role. |
| **Production release** | Deploy after UAT sign-off. |

---

## 3.9 Milestone 3 — deliverables checklist

- [ ] Tenant Dashboard: full-width KPI strip, FY selector, actions panel, onboarding checklist
- [ ] Platform Dashboard: alert banner, clickable rows, full-width layout
- [ ] Reports & Analytics: themed charts, filter bar, annexure table, BRSR loading state
- [ ] Query page: polished chat UI with accessible loading state
- [ ] Settings → Appearance: Light / Dark / System theme + 3 density modes + table preference
- [ ] Density and theme applied globally
- [ ] All 30+ pages on consistent PageShell / DataTable / FormWorkspace patterns
- [ ] Accessibility pass complete; 0 critical issues on primary workflows
- [ ] QA matrix passed for all 7 role/portal combinations
- [ ] Storybook and component guide delivered
- [ ] Production release after client UAT sign-off

---

## 3.10 Milestone 3 — acceptance criteria

- [ ] Dashboards use the full page width; KPIs, filters, and charts visible without excessive scrolling on 1440px display
- [ ] User can switch theme and density in Settings; preference persists across sessions
- [ ] Reports: user can filter by FY and location, view all charts, and export BRSR without error
- [ ] All 30+ pages visually consistent — no mix of old and new styling
- [ ] Role-based UAT passed; 0 open P1 bugs
- [ ] Client written sign-off for production release

---

## Milestone sign-off summary

| Milestone | Client sign-off point |
|-----------|----------------------|
| **M1** | Design tokens + wireframes; mobile shell + pilot pages demo (end of M1) |
| **M2** | ESG Input workspace demo (mid-M2); full M2 staging walkthrough (end of M2) |
| **M3** | Dashboard + Reports preview (start of M3); UAT + production release approval (end of M3) |

---

*End of document*
