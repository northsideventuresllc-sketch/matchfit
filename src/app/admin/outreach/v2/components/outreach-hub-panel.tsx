"use client";

import { useState } from "react";
import { adminLabelClass, adminPanelClass } from "@/components/admin/admin-portal-ui";
import type { OutreachArchiveLead, OutreachConversionLead, OutreachHubLead, OutreachLane } from "@/lib/outreach-types";
import { computeLaneTiles, leadDisplayName, type LaneTile, type OutreachV2Tab } from "./helpers";

function Tile(props: {
  tile: LaneTile;
  expanded: boolean;
  onToggle: () => void;
  rows: { id: string; label: string; platform: string }[];
  onOpenLead: (tab: OutreachV2Tab, leadId: string) => void;
  onOpenTab: (tab: OutreachV2Tab) => void;
}) {
  const { tile } = props;
  return (
    <div className={`${adminPanelClass} p-4`}>
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={props.onToggle}>
        <div>
          <p className={adminLabelClass}>{tile.label}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#FFD34E]">{tile.count}</p>
        </div>
        <span className={`text-white/40 transition-transform ${props.expanded ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>
      {props.expanded ? (
        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {tile.count === 0 ? (
            <p className="text-xs text-white/40">Nothing in this lane.</p>
          ) : (
            <>
              {props.rows.slice(0, 6).map((row) => (
                <button
                  key={`${row.platform}-${row.id}`}
                  type="button"
                  className="block w-full truncate rounded-lg border border-white/[0.06] bg-[#0E1016]/60 px-3 py-1.5 text-left text-xs text-white/75 transition hover:border-[#FF7E00]/30 hover:text-[#FFD34E]"
                  onClick={() => props.onOpenLead(tile.tab, row.id)}
                >
                  {row.label} <span className="text-white/35">· {row.platform}</span>
                </button>
              ))}
              <button
                type="button"
                className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#FF7E00] hover:text-[#FFD34E]"
                onClick={() => props.onOpenTab(tile.tab)}
              >
                Open {tile.label} →
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function OutreachHubPanel(props: {
  grouped: Record<OutreachLane, OutreachHubLead[]>;
  archiveEntries: OutreachArchiveLead[];
  conversionEntries: OutreachConversionLead[];
  onNavigate: (tab: OutreachV2Tab, leadId?: string) => void;
}) {
  const tiles = computeLaneTiles(props.grouped, props.archiveEntries.length, props.conversionEntries.length);
  const [expanded, setExpanded] = useState<string | null>(null);

  function rowsForTile(tile: LaneTile): { id: string; label: string; platform: string }[] {
    if (tile.lane === "archived") {
      return props.archiveEntries.map((e) => ({
        id: e.lead.id,
        label: leadDisplayName(e),
        platform: e.platform,
      }));
    }
    if (tile.lane === "converted") {
      return props.conversionEntries.map((e) => ({
        id: e.lead.id,
        label: leadDisplayName(e),
        platform: e.platform,
      }));
    }
    const lane = tile.lane as OutreachLane;
    return props.grouped[lane].map((e) => ({
      id: e.lead.id,
      label: leadDisplayName(e),
      platform: e.platform,
    }));
  }

  return (
    <div className="space-y-4">
      <div className={`${adminPanelClass} p-5`}>
        <p className="text-sm leading-relaxed text-white/60">
          Zoom-out of the whole pipeline. Every tile is a lane — click to peek at what is inside, then jump straight to a
          specific lead (its card opens and scrolls into view) or open the full tab.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const key = `${tile.tab}-${tile.lane}`;
          return (
            <Tile
              key={key}
              tile={tile}
              expanded={expanded === key}
              onToggle={() => setExpanded((prev) => (prev === key ? null : key))}
              rows={rowsForTile(tile)}
              onOpenLead={(tab, leadId) => props.onNavigate(tab, leadId)}
              onOpenTab={(tab) => props.onNavigate(tab)}
            />
          );
        })}
      </div>
    </div>
  );
}
