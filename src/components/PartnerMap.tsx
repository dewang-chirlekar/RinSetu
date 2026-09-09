/**
 * src/components/PartnerMap.tsx
 *
 * Phase 4 tail — MapLibre GL JS + OpenStreetMap raster tiles.
 *
 * Pure display: hard filters and haversine already ran in src/core/partners/match.ts.
 * This file only shows the already-filtered `eligible` set, never decides who is
 * eligible. Never geocodes at request time (CLAUDE.md hard rule 9) — coordinates
 * are committed in data/partners.seed.json and Prisma.
 *
 * OSM raster via {a,b,c}.tile.openstreetmap.org, no API key, no billing.
 * MapLibre GL JS is the only map dependency (package.json: maplibre-gl).
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApplicantProfile, PartnerMatchResult } from '@/core/types';
import { translate } from '@/messages';
import 'maplibre-gl/dist/maplibre-gl.css';

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

function applicantHasLocation(applicant: ApplicantProfile): boolean {
  return applicant.lat != null && applicant.lng != null;
}

export function PartnerMap({
  result,
  applicant,
}: {
  result: PartnerMatchResult;
  applicant: ApplicantProfile;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const hasApplicantLocation = applicantHasLocation(applicant);

  useEffect(() => {
    if (result.eligible.length === 0) return;
    if (!containerRef.current) return;
    // DEMO_MODE / offline: don't fetch OSM tiles — show deterministic fallback so
    // "wifi physically off" demo still has a map affordance and no hanging spinner.
    const demoMode =
      typeof window !== 'undefined' &&
      ((window as unknown as { __RINSETU_DEMO__?: boolean }).__RINSETU_DEMO__ === true ||
        document.documentElement.getAttribute('data-demo') === 'true');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (demoMode || isOffline) {
      setOffline(true);
      return;
    }

    let cancelled = false;
    let map: import('maplibre-gl').Map | null = null;

    async function init() {
      try {
        const maplibregl = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        // Center: applicant if known, else centroid of eligible partners, else India centroid
        const lats = result.eligible.map((m) => m.partner.lat);
        const lngs = result.eligible.map((m) => m.partner.lng);
        const centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const centroidLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
        const center: [number, number] = hasApplicantLocation
          ? [applicant.lng as number, applicant.lat as number]
          : [centroidLng, centroidLat];

        map = new maplibregl.Map({
          container: containerRef.current as HTMLElement,
          style: OSM_STYLE as unknown as string,
          center,
          zoom: hasApplicantLocation ? 7 : 5,
        });
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        // Applicant marker (if location known)
        if (hasApplicantLocation) {
          const el = document.createElement('div');
          el.className = 'applicant-marker';
          el.style.width = '14px';
          el.style.height = '14px';
          el.style.background = '#1f3a5f';
          el.style.border = '2px solid white';
          el.style.borderRadius = '50%';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
          el.title = translate('partner.map.applicant_marker');
          new maplibregl.Marker({ element: el }).setLngLat([applicant.lng as number, applicant.lat as number]).addTo(map);
        }

        // Partner markers — eligible only, ranked_by_distance order gets numbers
        const rankByCode = new Map<string, number>();
        result.ranked_by_distance.forEach((m, i) => rankByCode.set(m.partner.code, i + 1));

        const bounds = new maplibregl.LngLatBounds();
        if (hasApplicantLocation) bounds.extend([applicant.lng as number, applicant.lat as number]);

        for (const match of result.eligible) {
          const rank = rankByCode.get(match.partner.code) ?? 0;
          const el = document.createElement('div');
          el.className = 'partner-marker';
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.background = rank <= 3 ? '#1f3a5f' : '#4a4740';
          el.style.color = 'white';
          el.style.border = '2px solid white';
          el.style.borderRadius = '50%';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.fontSize = '11px';
          el.style.fontWeight = '700';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)';
          el.style.cursor = 'pointer';
          el.textContent = String(rank);
          el.title = `${match.partner.name} — ${match.partner.district}, ${match.partner.state}`;

          const popup = new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
            `<div style="font-family: ui-sans-serif, system-ui; font-size: 12px; line-height: 1.4; min-width: 160px;">
              <div style="font-weight: 600; color: #17160f;">${match.partner.name}</div>
              <div style="color: #4a4740; font-size: 11px;">${match.partner.district}, ${match.partner.state} · ${match.partner.type}</div>
              ${match.distance_km != null ? `<div style="color: #1f3a5f; margin-top: 4px; font-size: 11px;">${translate('partner.straight_line_distance', { km: String(match.distance_km) })}</div>` : ''}
            </div>`,
          );

          new maplibregl.Marker({ element: el }).setLngLat([match.partner.lng, match.partner.lat]).setPopup(popup).addTo(map);
          bounds.extend([match.partner.lng, match.partner.lat]);
        }

        // Fit bounds with padding, but not before style loads
        map.on('load', () => {
          if (cancelled || !map) return;
          try {
            map.fitBounds(bounds, { padding: 32, maxZoom: 10, duration: 0 });
          } catch {
            // ignore fitBounds errors on tiny bounds
          }
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (map) {
        try {
          map.remove();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
  }, [result, applicant.lat, applicant.lng, hasApplicantLocation]);

  if (result.eligible.length === 0) return null;

  if (failed || offline) {
    // Offline/DEMO_MODE fallback: static grid with partner dots + ranked list (no tiles)
    if (offline) {
      return (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
              {translate('partner.map.heading')}
            </h4>
            <span className="stamp text-fail">{translate('partner.map.offline_badge')}</span>
          </div>
          <div className="border-rule bg-paper-sunk mt-1.5 grid h-[240px] w-full place-items-center border px-3 py-3 text-center sm:h-[320px]">
            <div>
              <p className="text-ink text-xs font-medium">{translate('partner.map.offline_title')}</p>
              <p className="text-ink-3 mt-1 text-[0.6875rem] leading-relaxed">
                {translate('partner.map.eligible_only')} · {result.eligible.length} eligible partners · {translate('partner.map.note')}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {result.ranked_by_distance.slice(0, 6).map((m) => (
                  <span key={m.partner.code} className="border-rule bg-paper text-ink inline-flex items-center border px-2 py-1 text-[0.6875rem]">
                    {m.partner.code}
                    {m.distance_km != null ? ` · ${m.distance_km}km` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-ink-3 mt-1.5 text-[0.6875rem] leading-relaxed">{translate('partner.map.note')}</p>
        </div>
      );
    }
    return (
      <div className="border-rule bg-paper-sunk text-ink-3 border px-3 py-3 text-xs leading-relaxed">
        {translate('partner.map.failed')}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {translate('partner.map.heading')}
        </h4>
        <span className="text-ink-3 text-[0.6875rem]">{translate('partner.map.eligible_only')}</span>
      </div>
      <div
        ref={containerRef}
        className="border-rule mt-1.5 h-[240px] w-full border bg-[#e8edf4] sm:h-[320px]"
        role="region"
        aria-label={translate('partner.map.heading')}
        // MapLibre injects its own canvas; container must have explicit height
      />
      <p className="text-ink-3 mt-1.5 text-[0.6875rem] leading-relaxed">
        {translate('partner.map.note')}
      </p>
    </div>
  );
}
