/**
 * Compare Stream Finder `/api/status` with `/api/providers` catalog (IDs & counts).
 * Run from project root: `npm run audit:stream-finder-providers`
 * Requires STREAM_FINDER_KEY in `.env` for the authenticated providers endpoint.
 */
import 'dotenv/config';

import {
  parseOfficialProvidersCatalog,
  resolveNextCatalogUrl,
} from '../lib/services/stream-finder-sync';

const STATUS_URL = 'https://stream-finder--trevorseitzai.replit.app/api/status';
const PROVIDERS_URL = 'https://stream-finder--trevorseitzai.replit.app/api/providers';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return parseFloat(v);
  return null;
}

function maybeRecord(v: unknown): Record<string, unknown> | undefined {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function collectStatusIdsAndMeta(status: unknown): {
  ids: number[];
  totalProviders: unknown;
  providerCountKeys: string[];
  paginationNotes: string[];
} {
  const paginationNotes: string[] = [];
  if (!status || typeof status !== 'object') {
    return { ids: [], totalProviders: undefined, providerCountKeys: [], paginationNotes };
  }
  const o = status as Record<string, unknown>;
  const ids = new Set<number>();

  const totalProviders =
    o.totalProviders ??
    o.total_providers ??
    (maybeRecord(o.meta)?.total as unknown) ??
    maybeRecord(o.meta)?.totalProviders;

  const pc = o.providerCounts;
  const providerCountKeys =
    pc && typeof pc === 'object' && !Array.isArray(pc) ? Object.keys(pc as object) : [];

  for (const k of providerCountKeys) {
    const n = num(k);
    if (n != null && n > 0) ids.add(Math.trunc(n));
  }

  const provList = o.providers ?? o.providersList ?? o.providers_summary;
  if (Array.isArray(provList)) {
    for (const row of provList) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = num(r.providerId ?? r.provider_id ?? r.id);
      if (id != null && id > 0) ids.add(Math.trunc(id));
    }
  }

  const nextHint = resolveNextCatalogUrl(status, STATUS_URL);
  if (nextHint) paginationNotes.push(`status payload includes next/catalog link: ${nextHint}`);

  return {
    ids: [...ids].sort((a, b) => a - b),
    totalProviders,
    providerCountKeys,
    paginationNotes,
  };
}

function logPaginationHints(providersPayload: unknown, requestUrl: string): void {
  const next = resolveNextCatalogUrl(providersPayload, requestUrl);
  console.log('');
  console.log('— Pagination hints on /api/providers payload —');
  console.log(next ? `  next/link-style URL: ${next}` : '  (no recognizable next/nextPage/links.next)');
  if (providersPayload && typeof providersPayload === 'object' && !Array.isArray(providersPayload)) {
    const o = providersPayload as Record<string, unknown>;
    const cand = ['total', 'totalCount', 'total_count', 'totalProviders', 'page', 'limit', 'meta', 'pagination'];
    for (const k of cand) {
      if (o[k] !== undefined) console.log(`  ${k}:`, JSON.stringify(o[k]));
    }
  }
}

async function main(): Promise<void> {
  console.log('GET', STATUS_URL, '(public)\n');

  let statusJson: unknown;
  const statusRes = await fetch(STATUS_URL);
  if (!statusRes.ok) {
    const t = await statusRes.text();
    throw new Error(`Status HTTP ${statusRes.status}: ${t.slice(0, 400)}`);
  }
  statusJson = await statusRes.json();

  const statusIdsMeta = collectStatusIdsAndMeta(statusJson);
  const st = statusJson as Record<string, unknown>;

  console.log(
    'Status — totalProviders (or analogous):',
    statusIdsMeta.totalProviders !== undefined ? statusIdsMeta.totalProviders : '(field not present)'
  );
  console.log(
    'Status — providerCounts keys:',
    statusIdsMeta.providerCountKeys.length
      ? statusIdsMeta.providerCountKeys.join(', ')
      : '(providerCounts missing or empty)'
  );
  console.log(
    'Status — derived provider IDs (from providerCounts + providers[]):',
    statusIdsMeta.ids.length ? statusIdsMeta.ids.join(', ') : '(none)'
  );
  if (Array.isArray(st.providers)) {
    console.log('Status — providers[] length:', st.providers.length);
  }
  if (typeof statusIdsMeta.totalProviders === 'number' && statusIdsMeta.ids.length > 0) {
    if (statusIdsMeta.totalProviders !== statusIdsMeta.ids.length) {
      console.warn(
        `Status — totalProviders (${statusIdsMeta.totalProviders}) ≠ count of derived IDs (${statusIdsMeta.ids.length}); check payload shape.`
      );
    }
  }
  if (statusIdsMeta.paginationNotes.length) {
    for (const n of statusIdsMeta.paginationNotes) console.log('Status —', n);
  }

  const apiKey = process.env.STREAM_FINDER_KEY?.trim();
  if (!apiKey) {
    throw new Error('Set STREAM_FINDER_KEY in .env to fetch /api/providers');
  }

  console.log('');
  console.log('GET', PROVIDERS_URL, '(X-Api-Key)\n');

  const providersRes = await fetch(PROVIDERS_URL, {
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!providersRes.ok) {
    const t = await providersRes.text();
    throw new Error(`Providers HTTP ${providersRes.status}: ${t.slice(0, 600)}`);
  }

  let providersPayload: unknown;
  try {
    providersPayload = await providersRes.json();
  } catch {
    throw new Error('/api/providers response is not JSON');
  }

  console.log('Full JSON from /api/providers:');
  console.log(JSON.stringify(providersPayload, null, 2));

  logPaginationHints(providersPayload, PROVIDERS_URL);

  const catalogParsed = parseOfficialProvidersCatalog(providersPayload);
  const catalogIds = new Set(catalogParsed.map((p) => p.provider_id));
  const statusIdSet = new Set(statusIdsMeta.ids);

  const missingInCatalog = statusIdsMeta.ids.filter((id) => !catalogIds.has(id));
  const extraInCatalog = [...catalogIds].sort((a, b) => a - b).filter((id) => !statusIdSet.has(id));

  console.log('');
  console.log('— Comparison —');
  console.log(`  Parsed catalog rows: ${catalogParsed.length}`);
  console.log(`  Status-derived IDs count: ${statusIdsMeta.ids.length}`);
  console.log(`  Parsed catalog IDs count: ${catalogIds.size}`);
  if (missingInCatalog.length) {
    console.log(
      '  Providers listed in status but MISSING from parsed /api/providers:',
      missingInCatalog.join(', ')
    );
  } else {
    console.log('  No status-derived ID is missing from the parsed providers catalog.');
  }
  if (extraInCatalog.length) {
    console.log('  Catalog IDs not present in status-derived set:', extraInCatalog.join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
