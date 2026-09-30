export type ProjectReportPeriod = "day" | "month";

export type InventoryProject = {
  id: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export type ProjectReportFact = {
  lead_id: string;
  requirement: string | null;
  category: string | null;
  customer_response: string | null;
  next_action: string | null;
};

export type ProjectReportRow = {
  projectId: string;
  project: string;
  active: boolean;
  leads: number;
  calls: number;
  siteVisits: number;
  bookings: number;
};

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function dhakaPeriodBounds(period: ProjectReportPeriod, key: string) {
  const match = period === "day" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error("Invalid report period");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = period === "day" ? Number(match[3]) : 1;
  const startMs = Date.UTC(year, month - 1, day) - DHAKA_OFFSET_MS;
  const endMs =
    period === "day"
      ? startMs + 24 * 60 * 60 * 1000
      : Date.UTC(year, month, 1) - DHAKA_OFFSET_MS;
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString() };
}

function normalized(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

export function buildProjectReport(
  projects: InventoryProject[],
  facts: ProjectReportFact[],
  createdLeadRequirements: ReadonlyMap<string, string>,
): ProjectReportRow[] {
  const byLabel = new Map(projects.map((project) => [normalized(project.label), project]));
  const totals = new Map<string, { leads: Set<string>; calls: number; siteVisits: number; bookings: number }>();

  for (const project of projects) {
    totals.set(project.id, { leads: new Set(), calls: 0, siteVisits: 0, bookings: 0 });
  }

  for (const fact of facts) {
    const project = byLabel.get(normalized(fact.requirement));
    if (!project) continue;
    const row = totals.get(project.id);
    if (!row) continue;
    row.calls += 1;
    if (fact.customer_response === "site_visit" || fact.next_action === "site_visit") {
      row.siteVisits += 1;
    }
    if (fact.category === "closed_converted") row.bookings += 1;
  }

  for (const [leadId, requirement] of createdLeadRequirements) {
    const project = byLabel.get(normalized(requirement));
    const row = project ? totals.get(project.id) : undefined;
    if (row) row.leads.add(leadId);
  }

  return projects
    .map((project) => {
      const row = totals.get(project.id);
      return {
        projectId: project.id,
        project: project.label,
        active: project.active,
        leads: row?.leads.size ?? 0,
        calls: row?.calls ?? 0,
        siteVisits: row?.siteVisits ?? 0,
        bookings: row?.bookings ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.project.localeCompare(b.project, "bn");
    });
}

export function projectReportCsv(rows: ProjectReportRow[]) {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return [
    ["Project / Requirement", "Status", "Leads", "Calls", "Site visit signals", "Bookings"],
    ...rows.map((row) => [
      row.project,
      row.active ? "Active" : "Inactive",
      row.leads,
      row.calls,
      row.siteVisits,
      row.bookings,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\n");
}