/**
 * Administrator dashboard section registry and layout preferences (client-safe).
 */

export const ADMIN_DASHBOARD_LAYOUT_VERSION = 2 as const;
const LEGACY_LAYOUT_VERSION = 1 as const;

export const ADMIN_DASHBOARD_SECTION_IDS = [
  "overview-kpis",
  "revenue-snapshot",
  "platform-health",
  "site-traffic",
  "acquisition-funnel",
  "trainer-pipeline",
  "finances-detail",
  "operational-alerts",
  "impersonation-audit",
  "ai-visitor-insights",
  "recent-signups",
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
    description: "Total members, active clients/trainers, subscribers, and 7-day site visitors.",
    group: "Overview",
  },
  {
    id: "revenue-snapshot",
    label: "Revenue snapshot",
    description: "Lifetime platform revenue and profit by category.",
    group: "Overview",
  },
  {
    id: "platform-health",
    label: "Platform health",
    description: "Success rating, potential success projection, valuation, stability, and security.",
    group: "Analytics",
  },
  {
    id: "site-traffic",
    label: "Site traffic",
    description: "Page views, visitors, top pages, and link clicks (7 days).",
    group: "Analytics",
  },
  {
    id: "acquisition-funnel",
    label: "Acquisition funnel",
    description: "Signup funnel, logins, and top product actions.",
    group: "Analytics",
  },
  {
    id: "trainer-pipeline",
    label: "Trainer pipeline",
    description: "Onboarding stages from signup through live dashboard.",
    group: "Analytics",
  },
  {
    id: "finances-detail",
    label: "Finances detail",
    description: "Revenue windows, trials, best sellers, and recent transactions.",
    group: "Analytics",
  },
  {
    id: "operational-alerts",
    label: "Operational alerts",
    description: "Background checks, billing grace, safety, and chat warnings.",
    group: "Analytics",
  },
  {
    id: "impersonation-audit",
    label: "Impersonation audit log",
    description: "Recent supervised account access by administrators.",
    group: "Activity",
  },
  {
    id: "ai-visitor-insights",
    label: "AI visitor insights",
    description: "AI analysis of traffic patterns with signup recommendations.",
    group: "Analytics",
  },
  {
    id: "recent-signups",
    label: "Recent signups",
    description: "Latest client and trainer registrations.",
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
    description: "Paginated full registration history.",
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
  hidden: [],
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
    description: "High-level KPIs, revenue, alerts, and recent signups only.",
    hidden: [
      "platform-health",
      "site-traffic",
      "acquisition-funnel",
      "trainer-pipeline",
      "finances-detail",
      "ai-visitor-insights",
      "impersonation-audit",
      "recent-featured",
      "test-mode",
      "signup-log",
      "member-search",
    ],
    collapsed: [],
  },
  {
    id: "analytics",
    label: "Analytics focus",
    description: "Traffic, funnel, pipeline, and finances; hide day-to-day operations tools.",
    hidden: ["test-mode", "signup-log", "member-search", "impersonation-audit", "recent-featured"],
    collapsed: ["finances-detail", "ai-visitor-insights"],
  },
  {
    id: "trust-safety",
    label: "Trust & safety",
    description: "Alerts, audit log, member search, and signup activity.",
    hidden: [
      "revenue-snapshot",
      "platform-health",
      "site-traffic",
      "acquisition-funnel",
      "trainer-pipeline",
      "finances-detail",
      "ai-visitor-insights",
      "recent-featured",
      "test-mode",
    ],
    collapsed: ["signup-log"],
  },
  {
    id: "operations",
    label: "Operations desk",
    description: "Test mode, logs, search, and recent activity — panels start collapsed to reduce noise.",
    hidden: [
      "platform-health",
      "site-traffic",
      "acquisition-funnel",
      "trainer-pipeline",
      "finances-detail",
      "ai-visitor-insights",
    ],
    collapsed: ["overview-kpis", "revenue-snapshot", "operational-alerts"],
  },
];

export function adminDashboardSectionDomId(id: AdminDashboardSectionId): string {
  return `admin-section-${id}`;
}

function normalizeOrder(orderRaw: unknown): AdminDashboardSectionId[] {
  const order: AdminDashboardSectionId[] = [];
  if (Array.isArray(orderRaw)) {
    for (const item of orderRaw) {
      if (typeof item === "string" && isAdminDashboardSectionId(item) && !order.includes(item)) {
        order.push(item);
      }
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
    if (typeof item === "string" && isAdminDashboardSectionId(item) && !hidden.includes(item)) {
      hidden.push(item);
    }
  }
  return hidden;
}

function normalizeCollapsed(collapsedRaw: unknown): AdminDashboardSectionId[] {
  const collapsed: AdminDashboardSectionId[] = [];
  if (!Array.isArray(collapsedRaw)) return collapsed;
  for (const item of collapsedRaw) {
    if (typeof item === "string" && isAdminDashboardSectionId(item) && !collapsed.includes(item)) {
      collapsed.push(item);
    }
  }
  return collapsed;
}

function normalizeDensity(value: unknown): AdminDashboardDensity {
  return value === "compact" ? "compact" : "comfortable";
}

export function parseAdminDashboardLayout(raw: unknown): AdminDashboardLayout {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT };

  const obj = raw as Record<string, unknown>;
  if (obj.version !== ADMIN_DASHBOARD_LAYOUT_VERSION && obj.version !== LEGACY_LAYOUT_VERSION) {
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

export const ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY = "mf_admin_dashboard_layout_v2";
