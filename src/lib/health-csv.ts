/**
 * src/lib/health-csv.ts
 *
 * CSV parsing + validation for the admin health upload. Pure functions,
 * no I/O, no DB — so preview can run without DATABASE_URL and is testable.
 *
 * Expected header (case-insensitive, trimmed, order-insensitive):
 *   partner_code, funds_sanctioned, funds_utilised, overdue_amount,
 *   npa_pct, avg_processing_days, capacity_flag [, as_of]
 *
 * - partner_code must exist in the registry (caller supplies set)
 * - numeric columns must be finite >=0 (npa_pct 0..100, days >=0)
 * - capacity_flag must be OPEN|CONSTRAINED|CLOSED
 * - as_of if present must be YYYY-MM-DD, otherwise caller-supplied defaultAsOf
 * - data_origin is never read from CSV; preview forces MIS_UPLOAD, so even a
 *   forged column cannot smuggle SIMULATED back in via the upload.
 *
 * Returns { rows, errors }. A row with errors is still returned with
 * `valid:false` so the UI can show the bad value inline. No row is dropped
 * silently — silent dropping is how a beneficiary's partner disappears.
 */

import type { PartnerHealthRecord } from '@/core/types';

export interface HealthCsvRow {
  line: number; // 1-indexed in the file, header is 1
  raw: Record<string, string>;
  valid: boolean;
  errors: string[];
  record?: PartnerHealthRecord;
}

export interface HealthCsvResult {
  rows: HealthCsvRow[];
  validRows: PartnerHealthRecord[];
  errors: { line: number; message: string }[];
  asOfFallback: string;
}

const REQUIRED_HEADERS = [
  'partner_code',
  'funds_sanctioned',
  'funds_utilised',
  'overdue_amount',
  'npa_pct',
  'avg_processing_days',
  'capacity_flag',
] as const;

const CAPACITY_FLAGS = new Set(['OPEN', 'CONSTRAINED', 'CLOSED']);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Minimal quoted-field CSV splitter. Handles:
// - fields quoted with ", escaped "" inside
// - commas inside quotes not splitting
// - trims unquoted fields
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((field) => {
    const trimmed = field.trim();
    // Remove surrounding quotes if present (already handled escaping)
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });
}

function parseNumber(raw: string, label: string, errors: string[]): number | null {
  if (raw === '' || raw === undefined) {
    errors.push(`${label} is required`);
    return null;
  }
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) {
    errors.push(`${label} must be a number (got '${raw}')`);
    return null;
  }
  return n;
}

export function parseHealthCsv(
  csvText: string,
  opts: { existingPartnerCodes: Set<string>; defaultAsOf?: string },
): HealthCsvResult {
  const lines = csvText.split(/\r?\n/);
  // Find first non-empty line as header
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === '') continue;
    // Strip UTF-8 BOM if present
    const line = trimmed.replace(/^\uFEFF/, '');
    headers = splitCsvLine(line).map((h) => h.trim().toLowerCase());
    headerIdx = i;
    break;
  }

  const errors: { line: number; message: string }[] = [];
  const rows: HealthCsvRow[] = [];
  const defaultAsOf = opts.defaultAsOf ?? todayIso();

  if (headerIdx === -1) {
    errors.push({ line: 1, message: 'CSV is empty' });
    return { rows, validRows: [], errors, asOfFallback: defaultAsOf };
  }

  // Normalise header lookup: code -> index
  const idx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) idx[headers[i]!] = i;

  // Validate required headers present
  for (const col of REQUIRED_HEADERS) {
    if (!(col in idx)) {
      errors.push({ line: headerIdx + 1, message: `Missing required column '${col}'` });
    }
  }
  // If any required header missing, still try to parse rows with best-effort
  if (errors.length > 0) {
    // Return early with header errors — no rows processed further
    return { rows, validRows: [], errors, asOfFallback: defaultAsOf };
  }

  const validRows: PartnerHealthRecord[] = [];
  const seen = new Set<string>(); // partner_code + as_of dedupe within file

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i]!;
    if (rawLine.trim() === '') continue;
    const fields = splitCsvLine(rawLine);
    // Pad fields to header length
    while (fields.length < headers.length) fields.push('');
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) raw[headers[j]!] = fields[j] ?? '';

    const lineNum = i + 1;
    const rowErrors: string[] = [];

    const partner_code = (raw['partner_code'] ?? '').trim();
    if (!partner_code) rowErrors.push('partner_code is required');
    else if (!opts.existingPartnerCodes.has(partner_code)) {
      rowErrors.push(`partner_code '${partner_code}' not in registry`);
    }

    const funds_sanctioned = parseNumber(raw['funds_sanctioned'] ?? '', 'funds_sanctioned', rowErrors);
    const funds_utilised = parseNumber(raw['funds_utilised'] ?? '', 'funds_utilised', rowErrors);
    const overdue_amount = parseNumber(raw['overdue_amount'] ?? '', 'overdue_amount', rowErrors);
    const npa_pct = parseNumber(raw['npa_pct'] ?? '', 'npa_pct', rowErrors);
    const avg_processing_days = parseNumber(
      raw['avg_processing_days'] ?? '',
      'avg_processing_days',
      rowErrors,
    );

    const capacity_raw = (raw['capacity_flag'] ?? '').trim().toUpperCase();
    if (!capacity_raw) rowErrors.push('capacity_flag is required');
    else if (!CAPACITY_FLAGS.has(capacity_raw)) {
      rowErrors.push(`capacity_flag must be OPEN, CONSTRAINED or CLOSED (got '${raw['capacity_flag']}')`);
    }

    let asOf = (raw['as_of'] ?? '').trim();
    if (asOf === '') asOf = defaultAsOf;
    else if (!isIsoDate(asOf)) {
      rowErrors.push(`as_of must be YYYY-MM-DD (got '${raw['as_of']}')`);
    }

    // Domain checks (only if numbers parsed)
    if (funds_sanctioned !== null && funds_sanctioned < 0) rowErrors.push('funds_sanctioned cannot be negative');
    if (funds_utilised !== null && funds_utilised < 0) rowErrors.push('funds_utilised cannot be negative');
    if (overdue_amount !== null && overdue_amount < 0) rowErrors.push('overdue_amount cannot be negative');
    if (npa_pct !== null && (npa_pct < 0 || npa_pct > 100)) rowErrors.push('npa_pct must be 0..100');
    if (avg_processing_days !== null && avg_processing_days < 0)
      rowErrors.push('avg_processing_days cannot be negative');

    const dedupeKey = `${partner_code}::${asOf}`;
    if (partner_code && asOf) {
      if (seen.has(dedupeKey)) {
        rowErrors.push(`Duplicate partner_code+as_of '${dedupeKey}' in file`);
      } else {
        seen.add(dedupeKey);
      }
    }

    const valid = rowErrors.length === 0;

    let record: PartnerHealthRecord | undefined;
    if (valid) {
      record = {
        partner_code: partner_code!,
        funds_sanctioned: funds_sanctioned!,
        funds_utilised: funds_utilised!,
        overdue_amount: overdue_amount!,
        npa_pct: npa_pct!,
        avg_processing_days: avg_processing_days!,
        capacity_flag: capacity_raw as PartnerHealthRecord['capacity_flag'],
        data_origin: 'MIS_UPLOAD',
        as_of: asOf,
      };
      validRows.push(record);
    }

    for (const msg of rowErrors) errors.push({ line: lineNum, message: msg });

    rows.push({ line: lineNum, raw, valid, errors: rowErrors, record });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ line: headerIdx + 1, message: 'No data rows found' });
  }

  return { rows, validRows, errors, asOfFallback: defaultAsOf };
}

export function healthCsvTemplate(): string {
  const header = [
    'partner_code',
    'funds_sanctioned',
    'funds_utilised',
    'overdue_amount',
    'npa_pct',
    'avg_processing_days',
    'capacity_flag',
    'as_of',
  ].join(',');
  const example = [
    'SCA_MH_PUNE_001',
    '120000000',
    '78000000',
    '4200000',
    '3.1',
    '21',
    'OPEN',
    todayIso(),
  ].join(',');
  return `${header}\n${example}\n`;
}
