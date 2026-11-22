/**
 * tests/intake.params.test.ts
 *
 * The intake cookie path has two pure helpers that are easy to get subtly
 * wrong: repeated document checkboxes must stay an array, and a profile must
 * survive the round trip through the form shape without losing the fields the
 * engine needs. Both are asserted here, along with the redirect allow-list.
 */

import { describe, expect, it } from 'vitest';
import { ApplicantProfileSchema } from '../src/core/types';
import { parseApplicantParams } from '../src/lib/applicant-params';
import {
  formDataToParams,
  profileToParams,
  safeIntakeDestination,
} from '../src/lib/intake-params';

const profile = ApplicantProfileSchema.parse({
  name: 'Asha',
  age: 34,
  annual_family_income: 120000,
  state: 'Maharashtra',
  district: 'Pune',
  lat: null,
  lng: null,
  purpose: 'TAILORING',
  project_cost: 90000,
  documents_available: ['AADHAAR', 'CASTE_CERT'],
});

describe('intake form shape', () => {
  it('keeps repeated document values as an array', () => {
    const form = new FormData();
    form.set('name', 'Asha');
    form.set('age', '34');
    form.append('doc', 'AADHAAR');
    form.append('doc', 'CASTE_CERT');

    expect(formDataToParams(form)).toEqual({
      name: 'Asha',
      age: '34',
      doc: ['AADHAAR', 'CASTE_CERT'],
    });
  });

  it('round-trips a profile through the form shape', () => {
    const params = profileToParams(profile);
    expect(params.doc).toEqual(['AADHAAR', 'CASTE_CERT']);

    const parsed = parseApplicantParams(params);
    expect(parsed.name).toBe('Asha');
    expect(parsed.age).toBe(34);
    expect(parsed.annual_family_income).toBe(120000);
    expect(parsed.district).toBe('Pune');
    expect(parsed.documents_available).toEqual(['AADHAAR', 'CASTE_CERT']);
  });
});

describe('intake redirect destinations', () => {
  it('allows only the three pages that consume the profile', () => {
    expect(safeIntakeDestination('/result')).toBe('/result');
    expect(safeIntakeDestination('/apply')).toBe('/apply');
    expect(safeIntakeDestination('/api/packet')).toBe('/api/packet');
  });

  it('falls back to /result instead of honouring an open redirect', () => {
    expect(safeIntakeDestination('//evil.example')).toBe('/result');
    expect(safeIntakeDestination('https://evil.example')).toBe('/result');
    expect(safeIntakeDestination(null)).toBe('/result');
  });
});
