/**
 * Administrator dashboard section registry and layout preferences (client-safe).
 */

export const ADMIN_DASHBOARD_LAYOUT_VERSION = 3 as const;
const LEGACY_LAYOUT_VERSION = 1 as const;
const PREV_LAYOUT_VERSION = 2 as const;

export const ADMIN_DASHBOARD_SECTION_IDS = [
  "overview-kpis",
  "site-traffic",
  "client-pipeline",
  "trainer-pipeline",
  "site-activity",
  "premium-trainer-activity",
  "financial-details",
  "platform-health",
  "ad-performance",
  "operational-alerts",
  "background-checks",
  "automated-email-stats",
  "impersonation-audit",
  "recent-featured",
  "test-mode",
  "signup-log",
  "member-search",
] as const;

export type AdminDashboardSectionId = (typeof ADMIN_DASHBOARD_SECTION_IDS)[number];

export type AdminDashboardSectionGroup = "Overview" | "Analytics" | "Activity" | "Operations";

export type AdminDashboardDensity = "comfortable" | "compact";

export type AdminDashboardLayoutPresetId =
  | "default"
  | "essential"
  | "analytics"
  | "trust-safety"
  | "operations";

export type AdminDashboardSectionMeta = {
  id: AdminDashboardSectionId;
  label: string;
  description: string;
  group: AdminDashboardSectionGroup;
};

export const ADMIN_DASHBOARD_SECTIONS: AdminDashboardSectionMeta[] = [
  {
    id: "overview-kpis",
    label: "Member overview",
    description:
      "All members total, subscribers, free trials, inactive accounts, pending trainers, and unique site visitors.",
    group: "Overview",
  },
  {
    id: "site-traffic",
    label: "Site traffic",
    description: "7-day page views, unique visitors, top pages, and public site analytics.",
    group: "Analytics",
  },
  {
    id: "client-pipeline",
    label: "Client pipeline",
    description: "Signup progress from 50% complete through free trial (subscribers move to Member overview).",
    group: "Analytics",
  },
  {
    id: "trainer-pipeline",
    label: "Trainer pipeline",
    description: "Onboarding stages from signup through live dashboard with per-trainer detail.",
    group: "Analytics",
  },
  {
    id: "site-activity",
    label: "Site activity",
    description: "Member-only logins and top product actions inside dashboards.",
    group: "Analytics",
  },
  {
    id: "premium-trainer-activity",
    label: "Premium trainer activity",
    description: "Premium trainers, featured slots, active ads, token revenue, and bidding updates.",
    group: "Analytics",
  },
  {
    id: "financial-details",
    label: "Financial details",
    description: "Revenue windows, trials, best sellers, and recent transactions.",
    group: "Analytics",
  },
  {
    id: "platform-health",
    label: "Platform health",
    description: "Success rating, potential metrics, valuation, stability, security, and revenue projection.",
    group: "Analytics",
  },
  {
    id: "ad-performance",
    label: "Ad performance",
    description: "Google Ads and Meta spend, clicks, and UTM-attributed signup traffic (7 days).",
    group: "Analytics",
  },
  {
    id: "operational-alerts",
    label: "Operational alerts",
    description: "Background checks, billing grace, safety, and chat warnings.",
    group: "Analytics",
  },
  {
    id: "background-checks",
    label: "Background checks",
    description:
      "Plan B manual Checkr invite queue, automated Plan A invite timestamps, trainer email, and screening status.",
    group: "Operations",
  },
  {
    id: "automated-email-stats",
    label: "Automated email stats",
    description: "Transactional email delivery tracking (sent, skipped, failed).",
    group: "Analytics",
  },
  {
    id: "impersonation-audit",
    label: "Impersonation audit log",
    description: "Recent supervised account access by administrators.",
    group: "Activity",
  },
  {
    id: "recent-featured",
    label: "Recent featured",
    description: "Latest homepage featured trainer allocations.",
    group: "Activity",
  },
  {
    id: "test-mode",
    label: "Test mode",
    description: "Toggle sandbox validation mode for the platform.",
    group: "Operations",
  },
  {
    id: "signup-log",
    label: "Signup log",
    description: "Paginated full registration history (real clients and trainers only).",
    group: "Operations",
  },
  {
    id: "member-search",
    label: "Member search",
    description: "Find members and open supervised impersonation sessions.",
    group: "Operations",
  },
];

const SECTION_ID_SET = new Set<string>(ADMIN_DASHBOARD_SECTION_IDS);

const REMOVED_SECTION_IDS = new Set([
  "revenue-snapshot",
  "acquisition-funnel",
  "finances-detail",
  "ai-visitor-insights",
  "recent-signups",
]);

const SECTION_ID_ALIASES: Record<string, AdminDashboardSectionId> = {
  "finances-detail": "financial-details",
  "acquisition-funnel": "site-activity",
};

export function isAdminDashboardSectionId(value: string): value is AdminDashboardSectionId {
  return SECTION_ID_SET.has(value);
}

export type AdminDashboardLayout = {
  version: typeof ADMIN_DASHBOARD_LAYOUT_VERSION;
  /** Display order; includes hidden sections (hidden sections are omitted on render). */
  order: AdminDashboardSectionId[];
  hidden: AdminDashboardSectionId[];
  /** Sections shown collapsed until expanded (persisted per administrator). */
  collapsed: AdminDashboardSectionId[];
  density: AdminDashboardDensity;
};

export const DEFAULT_ADMIN_DASHBOARD_LAYOUT: AdminDashboardLayout = {
  version: ADMIN_DASHBOARD_LAYOUT_VERSION,
  order: [...ADMIN_DASHBOARD_SECTION_IDS],
  hidden: ["platform-health", "ad-performance", "recent-featured"],
  collapsed: [],
  density: "comfortable",
};

export type AdminDashboardLayoutPreset = {
  id: AdminDashboardLayoutPresetId;
  label: string;
  description: string;
  hidden: AdminDashboardSectionId[];
  collapsed: AdminDashboardSectionId[];
};

export const ADMIN_DASHBOARD_LAYOUT_PRESETS: AdminDashboardLayoutPreset[] = [
  {
    id: "default",
    label: "Full dashboard",
    description: "Show every section; expand all panels.",
    hidden: [],
    collapsed: [],
  },
  {
    id: "essential",
    label: "Essential overview",
    description: "High-level KPIs, pipelines, alerts, and signup log only.",
    hidden: [
      "platform-health",
      "ad-performance",
      "premium-trainer-activity",
      "financial-details",
      "automated-email-stats",
      "impersonation-audit",
      "recent-featured",
      "test-mode",
      "member-search",
    ],
    collapsed: [],
  },
  {
    id: "analytics",
    label: "Analytics focus",
    description: "Traffic, pipelines, site activity, and finances; hide day-to-day operations tools.",
    hidden: ["test-mode", "signup-log", "member-search", "impersonation-audit", "recent-featured"],
    collapsed: ["financial-details", "automated-email-stats"],
  },
  {
    id: "trust-safety",
    label: "Trust & safety",
    description: "Background checks, alerts, audit log, member search, and signup activity.",
    hidden: [
      "platform-health",
      "site-traffic",
      "site-activity",
      "client-pipeline",
      "trainer-pipeline",
      "premium-trainer-activity",
      "financial-details",
      "automated-email-stats",
      "recent-featured",
      "test-mode",
    ],
    collapsed: ["signup-log", "impersonation-audit"],
  },
  {
    id: "operations",
    label: "Operations desk",
    description: "Test mode, logs, search, and recent activity — panels start collapsed to reduce noise.",
    hidden: [
      "platform-health",
      "site-traffic",
      "site-activity",
      "client-pipeline",
      "trainer-pipeline",
      "premium-trainer-activity",
      "financial-details",
      "automated-email-stats",
    ],
    collapsed: ["overview-kpis", "operational-alerts", "background-checks"],
  },
];

export function adminDashboardSectionDomId(id: AdminDashboardSectionId): string {
  return `admin-section-${id}`;
}

function normalizeSectionId(raw: string): AdminDashboardSectionId | null {
  if (REMOVED_SECTION_IDS.has(raw)) return null;
  if (isAdminDashboardSectionId(raw)) return raw;
  const alias = SECTION_ID_ALIASES[raw];
  return alias ?? null;
}

function normalizeOrder(orderRaw: unknown): AdminDashboardSectionId[] {
  const order: AdminDashboardSectionId[] = [];
  if (Array.isArray(orderRaw)) {
    for (const item of orderRaw) {
      if (typeof item !== "string") continue;
      const id = normalizeSectionId(item);
      if (id && !order.includes(id)) order.push(id);
    }
  }
  for (const id of ADMIN_DASHBOARD_SECTION_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  return order;
}

function normalizeHidden(hiddenRaw: unknown): AdminDashboardSectionId[] {
  const hidden: AdminDashboardSectionId[] = [];
  if (!Array.isArray(hiddenRaw)) return hidden;
  for (const item of hiddenRaw) {
    if (typeof item !== "string") continue;
    const id = normalizeSectionId(item);
    if (id && !hidden.includes(id)) hidden.push(id);
  }
  return hidden;
}

function normalizeCollapsed(collapsedRaw: unknown): AdminDashboardSectionId[] {
  const collapsed: AdminDashboardSectionId[] = [];
  if (!Array.isArray(collapsedRaw)) return collapsed;
  for (const item of collapsedRaw) {
    if (typeof item !== "string") continue;
    const id = normalizeSectionId(item);
    if (id && !collapsed.includes(id)) collapsed.push(id);
  }
  return collapsed;
}

function normalizeDensity(value: unknown): AdminDashboardDensity {
  return value === "compact" ? "compact" : "comfortable";
}

export function parseAdminDashboardLayout(raw: unknown): AdminDashboardLayout {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT };

  const obj = raw as Record<string, unknown>;
  if (
    obj.version !== ADMIN_DASHBOARD_LAYOUT_VERSION &&
    obj.version !== PREV_LAYOUT_VERSION &&
    obj.version !== LEGACY_LAYOUT_VERSION
  ) {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT };
  }

  const order = normalizeOrder(obj.order);
  const hidden = normalizeHidden(obj.hidden);

  if (obj.version === LEGACY_LAYOUT_VERSION) {
    return {
      version: ADMIN_DASHBOARD_LAYOUT_VERSION,
      order,
      hidden,
      collapsed: [],
      density: "comfortable",
    };
  }

  return {
    version: ADMIN_DASHBOARD_LAYOUT_VERSION,
    order,
    hidden,
    collapsed: normalizeCollapsed(obj.collapsed),
    density: normalizeDensity(obj.density),
  };
}

export function serializeAdminDashboardLayout(layout: AdminDashboardLayout): string {
  return JSON.stringify(layout);
}

export function isSectionVisible(layout: AdminDashboardLayout, id: AdminDashboardSectionId): boolean {
  return !layout.hidden.includes(id);
}

export function isSectionCollapsed(layout: AdminDashboardLayout, id: AdminDashboardSectionId): boolean {
  return layout.collapsed.includes(id);
}

/** Sections in display order, visible only. */
export function visibleDashboardSections(layout: AdminDashboardLayout): AdminDashboardSectionId[] {
  return layout.order.filter((id) => isSectionVisible(layout, id));
}

export function setSectionVisible(
  layout: AdminDashboardLayout,
  id: AdminDashboardSectionId,
  visible: boolean,
): AdminDashboardLayout {
  const hidden = new Set(layout.hidden);
  if (visible) hidden.delete(id);
  else hidden.add(id);
  return { ...layout, hidden: [...hidden] };
}

export function setSectionCollapsed(
  layout: AdminDashboardLayout,
  id: AdminDashboardSectionId,
  collapsed: boolean,
): AdminDashboardLayout {
  const next = new Set(layout.collapsed);
  if (collapsed) next.add(id);
  else next.delete(id);
  return { ...layout, collapsed: [...next] };
}

export function collapseAllVisibleSections(layout: AdminDashboardLayout): AdminDashboardLayout {
  return { ...layout, collapsed: [...visibleDashboardSections(layout)] };
}

export function expandAllSections(layout: AdminDashboardLayout): AdminDashboardLayout {
  return { ...layout, collapsed: [] };
}

export function setLayoutDensity(
  layout: AdminDashboardLayout,
  density: AdminDashboardDensity,
): AdminDashboardLayout {
  return { ...layout, density };
}

export function applyLayoutPreset(
  layout: AdminDashboardLayout,
  presetId: AdminDashboardLayoutPresetId,
): AdminDashboardLayout {
  const preset = ADMIN_DASHBOARD_LAYOUT_PRESETS.find((p) => p.id === presetId);
  if (!preset || presetId === "default") {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: layout.order };
  }
  return {
    ...layout,
    hidden: [...preset.hidden],
    collapsed: [...preset.collapsed],
  };
}

export function moveSection(
  layout: AdminDashboardLayout,
  id: AdminDashboardSectionId,
  direction: "up" | "down",
): AdminDashboardLayout {
  const order = [...layout.order];
  const idx = order.indexOf(id);
  if (idx < 0) return layout;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= order.length) return layout;
  [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
  return { ...layout, order };
}

export function sectionsByGroup(): Record<AdminDashboardSectionGroup, AdminDashboardSectionMeta[]> {
  const out: Record<AdminDashboardSectionGroup, AdminDashboardSectionMeta[]> = {
    Overview: [],
    Analytics: [],
    Activity: [],
    Operations: [],
  };
  for (const section of ADMIN_DASHBOARD_SECTIONS) {
    out[section.group].push(section);
  }
  return out;
}

export function visibleSectionsByGroup(
  layout: AdminDashboardLayout,
): { group: AdminDashboardSectionGroup; sections: AdminDashboardSectionMeta[] }[] {
  const visibleIds = new Set(visibleDashboardSections(layout));
  const groups: AdminDashboardSectionGroup[] = ["Overview", "Analytics", "Activity", "Operations"];
  return groups
    .map((group) => ({
      group,
      sections: ADMIN_DASHBOARD_SECTIONS.filter((s) => s.group === group && visibleIds.has(s.id)),
    }))
    .filter((entry) => entry.sections.length > 0);
}

export const ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY = "mf_admin_dashboard_layout_v3";
