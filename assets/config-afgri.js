// ---------------------------------------------------------------------------
// Ticket portal configuration for the AFGRI Connect branded page
// (afgri-connect.html). Same Zammad backend as the generic portal
// (assets/config.js) - kept as a separate file so AFGRI-specific
// categories/limits can diverge later without touching the generic page.
// ---------------------------------------------------------------------------
const TICKET_PORTAL_CONFIG = {
  // Base URL of the Zammad instance (no trailing slash).
  ZAMMAD_URL: "https://support.mvne.co.za",

  // Category + sub-category options shown in the "Issue type" /
  // "Issue detail" dropdowns. The top-level `category` maps straight onto
  // the existing `tickets.issue` column that the Superset reports already
  // use (see mvne_superset/runbook.md - "Case-duplicated issue types") -
  // keep that casing EXACTLY as written here for every submission. The
  // `subcategories` are for agent-facing detail only (included in the
  // ticket title/body) unless you also wire up an `issue_detail` custom
  // Ticket attribute via `form_allowed_params` (see README). Add new
  // categories/subcategories here rather than letting clients free-type
  // one, so reporting doesn't fragment into near-duplicate values.
  ISSUE_CATEGORIES: [
    {
      category: "SIM Swap",
      subcategories: ["Lost or stolen SIM", "Damaged SIM", "Device upgrade"],
    },
    {
      category: "Number Porting",
      subcategories: ["Port-in request", "Port-out request", "Porting delayed / failed"],
    },
    {
      category: "Activation",
      subcategories: ["New SIM activation", "Reactivation", "Activation delayed"],
    },
    {
      category: "Billing Query",
      subcategories: ["Incorrect charge", "Invoice request", "Payment not reflecting"],
    },
    {
      category: "Network / Coverage Issue",
      subcategories: ["No signal", "Slow / no data", "Call drops", "Roaming issue"],
    },
    {
      category: "SIM Not Working",
      subcategories: ["No service at all", "SIM not recognized by device", "SIM blocked/suspended"],
    },
    {
      category: "Data / Airtime Query",
      subcategories: ["Data not loading", "Airtime not loading", "Bundle / package query"],
    },
    {
      category: "Other",
      subcategories: ["General inquiry"],
    },
  ],

  // Priority options shown to the client. `zammadValue` must match a
  // priority configured in Zammad (Manage > Priorities) AND that priority
  // must be enabled for the "Web Form" channel's create screen, otherwise
  // Zammad silently falls back to its default priority.
  PRIORITIES: [
    { label: "Low", zammadValue: "1 low" },
    { label: "Normal", zammadValue: "2 normal" },
    { label: "High", zammadValue: "3 high" },
  ],

  // Max attachment size (bytes) enforced client-side before Zammad's own
  // server-side limit rejects it. 5 MB default.
  MAX_ATTACHMENT_BYTES: 5 * 1024 * 1024,

  // Max number of MSISDN/ICCID rows a client can add when they select
  // "Multiple numbers".
  MAX_AFFECTED_NUMBERS: 10,

  // SIMs are often printed/barcoded with just the last 10 digits of the
  // ICCID. If a client types or scans exactly 10 digits, this prefix is
  // prepended automatically to form the full ICCID. Change this if your
  // SIM stock uses a different prefix.
  ICCID_PREFIX: "892700000",
};
