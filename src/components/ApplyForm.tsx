/**
 * src/components/ApplyForm.tsx
 *
 * Progressive intake form — the primary intake path (CLAUDE.md hard rule 5).
 *
 * What it does:
 *   1. About you (always visible).
 *   2. What the loan is for — intent + purpose (always visible, second).
 *   3. After an intent is chosen, every other section is filtered to that loan
 *      family. Livelihood shows project cost / own funds; education shows
 *      admission / location / course / duration + education cost. Documents and
 *      income/location/terms are the same block but with a hint that narrows the
 *      checklist to the relevant scheme family.
 *
 * Why progressive, and why this implementation:
 *   - Choosing EDUCATION and then seeing "transport, manufacturing, artisan
 *     activity" as purposes, or "project report, shop licence" as documents, is
 *     noise that makes a low-end-phone user trust the form less. Filtering by
 *     intent is the cheapest win for comprehensibility.
 *   - The form submits with GET to /result so the result is a shareable plain URL
 *     and works with JS disabled. Progressive disclosure is *enhancement*: when
 *     JS is off every section is visible (in the new order). When JS is on we
 *     hide the intent-dependent sections until an intent is chosen. That is why
 *     jsEnabled starts false and flips true in an effect — the server HTML has
 *     everything visible, the client hides it after hydration. Do not replace
 *     this with a conditional that hides on the server.
 *   - `lat`/`lng` are still not collected. Inventing a centroid would violate
 *     hard rule 1. Form users see "distance unknown" and honest throughput
 *     ordering; fixtures carry real coordinates.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { GENDERS, INTENTS, SOCIAL_CATEGORIES, STUDY_LOCATIONS, type SchemeSpec } from '@/core/types';
import { humanisePurpose } from '@/lib/format';
import { translate } from '@/messages';
import { CheckboxGrid, Fieldset, SelectField, TextField, type Option } from '@/components/form';
import { PrimaryLink } from '@/components/ui';
import indiaData from '../../data/india-states-districts.json';

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string {
  const value = params[key];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate ?? '';
}

const BLANK = (label: string): Option => ({ value: '', label });

function enumOptions<T extends string>(values: readonly T[], keyPrefix: string, blankValue: T): Option[] {
  return [
    { value: '', label: translate(`${keyPrefix}.${blankValue}`) },
    ...values.filter((value) => value !== blankValue).map((value) => ({ value, label: translate(`${keyPrefix}.${value}`) })),
  ];
}

function purposeOptionsForIntent(schemes: SchemeSpec[], intent: string): Option[] {
  const filtered =
    intent === 'LIVELIHOOD'
      ? schemes.filter((s) => s.type !== 'EDUCATION')
      : intent === 'EDUCATION'
        ? schemes.filter((s) => s.type === 'EDUCATION')
        : schemes;
  const all = filtered.flatMap((s) => s.eligible_purposes);
  const deduped = [...new Set(all)];
  return deduped.map((code) => ({ value: code, label: humanisePurpose(code) })).sort((a, b) => a.label.localeCompare(b.label));
}

function docCodesForIntent(
  intent: string,
  requirements: { scheme_code: string; doc_code: string }[],
  schemes: SchemeSpec[],
): Set<string> | null {
  if (intent !== 'LIVELIHOOD' && intent !== 'EDUCATION') return null;
  const wantedSchemes =
    intent === 'LIVELIHOOD'
      ? schemes.filter((s) => s.type !== 'EDUCATION').map((s) => s.code)
      : schemes.filter((s) => s.type === 'EDUCATION').map((s) => s.code);
  const set = new Set<string>();
  for (const r of requirements) if (wantedSchemes.includes(r.scheme_code)) set.add(r.doc_code);
  // Always keep the three universal docs even if a seed omits them somewhere.
  for (const c of ['CASTE_CERT', 'INCOME_CERT', 'AADHAAR', 'PHOTO', 'RESIDENCE_PROOF']) set.add(c);
  return set;
}

function StepBadge({ n, active }: { n: string; active?: boolean }) {
  return (
    <span
      className={
        active
          ? 'bg-accent text-paper flex h-5 w-5 shrink-0 items-center justify-center text-[0.625rem] font-semibold'
          : 'border-rule-strong text-ink-3 flex h-5 w-5 shrink-0 items-center justify-center border text-[0.625rem] font-semibold'
      }
    >
      {n}
    </span>
  );
}

export function ApplyForm({
  dataset,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  partners,
  documentDefinitions,
  documentRequirements,
  initialParams,
}: {
  dataset: { schemes: SchemeSpec[] };
  partners: { state: string; district: string }[];
  documentDefinitions: { code: string; name_key: string }[];
  documentRequirements: { scheme_code: string; doc_code: string }[];
  initialParams: RawParams;
}) {
  const [jsEnabled, setJsEnabled] = useState(false);
  useEffect(() => setJsEnabled(true), []);

  const initialIntent = first(initialParams, 'intent');
  const [intent, setIntent] = useState(initialIntent);

  // When FreeTextIntake extracts and does router.replace('/apply?...'), initialParams changes.
  // Sync intent so progressive disclosure and purpose filtering update without a full remount.
  // FIX: only watch the serialized params, not local intent — otherwise picking intent from
  // the dropdown is immediately reverted to the URL value (''), see FRAGILE.
  const paramsKey = JSON.stringify(initialParams);
  useEffect(() => {
    const next = first(JSON.parse(paramsKey) as RawParams, 'intent');
    // Only sync if URL actually carries a different intent — don't clobber user's in-flight pick
    setIntent((prev) => (next !== prev ? next : prev));
  }, [paramsKey]);

  const isLivelihood = intent === 'LIVELIHOOD';
  const isEducation = intent === 'EDUCATION';
  const hasIntent = isLivelihood || isEducation;

  // Progressive visibility: without JS everything is visible. With JS, the
  // intent-dependent blocks are hidden until hasIntent.
  const reveal = !jsEnabled || hasIntent;

  // Location cascade: state → district → tehsil, unlocked one after another, every option shows all valid choices
  // Reverse lookup: tehsil → district → state, so typing tehsil auto-fills the upper ones
  const allStates = useMemo(() => (indiaData as { states: { code: string; name: string; districts: string[] }[] }).states, []);
  const stateNames = useMemo(() => allStates.map((s) => s.name).sort(), [allStates]);

  const tehsilMap = useMemo(() => (indiaData as { tehsils: Record<string, string[]> }).tehsils, []);
  const districtToState = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of allStates) for (const d of s.districts) m.set(d, s.name);
    return m;
  }, [allStates]);

  const tehsilToDistrict = useMemo(() => {
    const m = new Map<string, string>();
    for (const [district, tehsils] of Object.entries(tehsilMap)) {
      if (district === '_default') continue;
      for (const t of tehsils) m.set(t, district);
    }
    return m;
  }, [tehsilMap]);

  const [selectedState, setSelectedState] = useState(first(initialParams, 'state'));
  const [selectedDistrict, setSelectedDistrict] = useState(first(initialParams, 'district'));
  const [selectedTehsil, setSelectedTehsil] = useState(first(initialParams, 'tehsil'));

  useEffect(() => {
    setSelectedState(first(initialParams, 'state'));
    setSelectedDistrict(first(initialParams, 'district'));
    setSelectedTehsil(first(initialParams, 'tehsil'));
  }, [initialParams]);

  const districtsForState = useMemo(() => {
    if (!jsEnabled) return allStates.flatMap((s) => s.districts).sort();
    if (!selectedState) return [];
    const found = allStates.find((s) => s.name === selectedState);
    return found ? [...found.districts].sort() : [];
  }, [selectedState, allStates, jsEnabled]);

  const tehsilsForDistrict = useMemo(() => {
    if (!jsEnabled) {
      const all = Object.entries(tehsilMap)
        .filter(([k]) => k !== '_default')
        .flatMap(([, v]) => v);
      return [...new Set(all)].sort();
    }
    if (!selectedDistrict) return [];
    return tehsilMap[selectedDistrict] ?? tehsilMap._default ?? [];
  }, [selectedDistrict, tehsilMap, jsEnabled]);

  // Auto-detect upper levels when tehsil is typed directly
  function handleTehsilChange(value: string) {
    setSelectedTehsil(value);
    const district = tehsilToDistrict.get(value);
    if (district) {
      setSelectedDistrict(district);
      const state = districtToState.get(district);
      if (state) setSelectedState(state);
    }
  }

  const rawDocs = initialParams.doc;
  const checkedDocs = useMemo(
    () => new Set(Array.isArray(rawDocs) ? rawDocs : rawDocs !== undefined ? [rawDocs] : []),
    [rawDocs],
  );

  const filteredDocCodes = useMemo(
    () => docCodesForIntent(intent, documentRequirements, dataset.schemes),
    [intent, documentRequirements, dataset.schemes],
  );
  const visibleDocs = useMemo(() => {
    if (!filteredDocCodes) return documentDefinitions;
    return documentDefinitions.filter((d) => filteredDocCodes.has(d.code));
  }, [documentDefinitions, filteredDocCodes]);

  const purposeOptions = useMemo(() => purposeOptionsForIntent(dataset.schemes, intent), [dataset.schemes, intent]);
  const purposeDisabled = jsEnabled && !hasIntent;

  // When intent flips, the previously selected purpose may no longer belong to
  // the filtered list. We don't force-clear it (that would surprise a user who
  // toggles back and forth), but we surface a note under the select.
  const initialPurpose = first(initialParams, 'purpose');
  const purposeInFiltered = useMemo(() => {
    if (!hasIntent) return true;
    const all = new Set(purposeOptions.map((o) => o.value));
    return initialPurpose === '' || all.has(initialPurpose);
  }, [hasIntent, purposeOptions, initialPurpose]);

  // Force remount of inputs when extracted profile arrives via ?age=&... (FreeTextIntake)
  const formKey = JSON.stringify(initialParams);

  return (
    <form key={formKey} action="/result" method="get" className="pb-8">
      {/* Step progress — visible only when JS is on */}
      {jsEnabled ? (
        <div className="border-rule bg-paper-edge/50 -mx-4 mb-2 flex items-center gap-1.5 border-y px-4 py-2 sm:mx-0 sm:rounded sm:border" role="progressbar" aria-valuenow={hasIntent ? 3 : 1} aria-valuemin={1} aria-valuemax={3} aria-label={translate('ui.apply.progress_choose')}>
          <span className="bg-accent h-1.5 flex-1 rounded" aria-hidden />
          <span className={`h-1.5 flex-1 rounded ${hasIntent ? 'bg-accent' : 'bg-accent/40'}`} aria-hidden />
          <span className={`h-1.5 flex-1 rounded ${hasIntent ? 'bg-accent' : 'bg-rule-strong'}`} aria-hidden />
          <span className="text-ink-3 ml-2 text-[0.625rem] font-semibold tracking-wider uppercase">
            {hasIntent
              ? isLivelihood
                ? translate('ui.apply.progress_livelihood')
                : translate('ui.apply.progress_education')
              : translate('ui.apply.progress_choose')}
          </span>
        </div>
      ) : null}

      {/* 1 — About you (always) */}
      <div className="flex items-center gap-2 pt-2">
        <StepBadge n="1" active />
        <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {translate('ui.apply.step_person')}
        </span>
      </div>
      <Fieldset legend={translate('ui.apply.section_person')}>
        <TextField name="name" label={translate('ui.apply.name')} defaultValue={first(initialParams, 'name')} />
        <TextField
          name="age"
          label={translate('ui.apply.age')}
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          defaultValue={first(initialParams, 'age')}
        />
        <SelectField
          name="gender"
          label={translate('ui.apply.gender')}
          options={enumOptions(GENDERS, 'ui.gender', 'UNDISCLOSED')}
          defaultValue={first(initialParams, 'gender')}
        />
        <SelectField
          name="category"
          label={translate('ui.apply.category')}
          options={enumOptions(SOCIAL_CATEGORIES, 'ui.category', 'UNKNOWN')}
          defaultValue={first(initialParams, 'category')}
        />
      </Fieldset>

      {/* 2 — What the loan is for (always, second) */}
      <div className="flex items-center gap-2 pt-1">
        <StepBadge n="2" active />
        <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {translate('ui.apply.step_intent')}
        </span>
      </div>
      <Fieldset
        legend={translate('ui.apply.section_project')}
        hint={translate('ui.apply.purpose_hint')}
      >
        <div className="sm:col-span-2">
          <label htmlFor="intent" className="text-ink block text-sm font-medium">
            {translate('ui.apply.intent')}
          </label>
          <select
            id="intent"
            name="intent"
            defaultValue={initialIntent}
            onChange={(e) => setIntent(e.target.value)}
            className="border-rule-strong bg-paper-edge text-ink focus:border-accent focus:outline-accent mt-1 block w-full border px-3 py-2.5 text-sm"
          >
            <option value="">{translate('ui.intent.UNKNOWN')}</option>
            {INTENTS.filter((v) => v !== 'UNKNOWN').map((v) => (
              <option key={v} value={v}>
                {translate(`ui.intent.${v}`)}
              </option>
            ))}
          </select>
          {jsEnabled && !hasIntent ? (
            <p className="text-ink-3 mt-1 text-xs leading-relaxed">{translate('ui.apply.intent_hint')}</p>
          ) : null}
        </div>

        <div className={purposeDisabled ? 'opacity-60' : undefined}>
          <label htmlFor="purpose" className="text-ink block text-sm font-medium">
            {translate('ui.apply.purpose')}
          </label>
          <select
            id="purpose"
            name="purpose"
            defaultValue={first(initialParams, 'purpose')}
            disabled={purposeDisabled}
            className="border-rule-strong bg-paper-edge text-ink focus:border-accent focus:outline-accent mt-1 block w-full border px-3 py-2.5 text-sm disabled:opacity-60"
          >
            <option value="">{translate('ui.apply.select_purpose')}</option>
            {purposeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {purposeDisabled ? (
            <p className="text-ink-3 mt-1 text-xs leading-relaxed">{translate('ui.apply.purpose_need_intent')}</p>
          ) : !purposeInFiltered ? (
            <p className="text-ink-3 mt-1 text-xs leading-relaxed">{translate('ui.apply.purpose_mismatch')}</p>
          ) : null}
          {!purposeDisabled && hasIntent ? (
            <p className="text-ink-3 mt-1 text-xs leading-relaxed">
              {isLivelihood ? translate('ui.apply.purpose_hint_livelihood') : translate('ui.apply.purpose_hint_education')}
            </p>
          ) : null}
        </div>

        {/* Project cost + own funds: cost label and own-funds visibility follow the family */}
        {!jsEnabled ? (
          <>
            <TextField
              name="project_cost"
              label={translate('ui.apply.project_cost')}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={first(initialParams, 'project_cost')}
            />
            <TextField
              name="own_funds"
              label={translate('ui.apply.own_funds')}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={first(initialParams, 'own_funds')}
            />
          </>
        ) : isLivelihood ? (
          <>
            <TextField
              name="project_cost"
              label={translate('ui.apply.project_cost')}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={first(initialParams, 'project_cost')}
            />
            <TextField
              name="own_funds"
              label={translate('ui.apply.own_funds')}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={first(initialParams, 'own_funds')}
            />
          </>
        ) : isEducation ? (
          <TextField
            name="project_cost"
            label={translate('ui.apply.project_cost_edu')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(initialParams, 'project_cost')}
            hint={translate('ui.apply.project_cost_edu_hint')}
          />
        ) : null}
      </Fieldset>

      {/* Hint between intent and the rest — only when JS is on and intent missing */}
      {jsEnabled && !hasIntent && (
        <div className="border-accent bg-accent-soft text-ink-2 mt-6 border-l-[3px] px-3.5 py-3 text-xs leading-relaxed">
          {translate('ui.apply.progressive_hint')}
        </div>
      )}

      {/* Everything below is progressive: hidden until an intent is chosen when JS is on */}
      <div
        className={
          reveal
            ? 'animate-in fade-in mt-2 duration-200'
            : 'hidden'
        }
      >
        {/* noscript fallback: without JS the hidden div above is shown via <noscript> CSS below */}
        <style>{`noscript .js-progressive { display: block !important; }`}</style>

        <div className="flex items-center gap-2 pt-1">
          <StepBadge n="3" active={hasIntent} />
          <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
            {translate('ui.apply.step_income')}
          </span>
        </div>
        <Fieldset legend={translate('ui.apply.section_money')} hint={translate('ui.apply.location_hint')}>
          <TextField
            name="income"
            label={translate('ui.apply.income')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(initialParams, 'income')}
          />
          <SelectField
            name="state"
            label={translate('ui.apply.state')}
            options={[BLANK(translate('ui.apply.select_state')), ...stateNames.map((name) => ({ value: name, label: name }))]}
            defaultValue={selectedState}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setSelectedState(v);
              if (v && selectedDistrict && districtToState.get(selectedDistrict) !== v) {
                setSelectedDistrict('');
                setSelectedTehsil('');
              }
            }}
          />
          <SelectField
            name="district"
            label={translate('ui.apply.district')}
            options={[BLANK(translate('ui.apply.select_state')), ...districtsForState.map((d) => ({ value: d, label: d }))]}
            defaultValue={selectedDistrict}
            disabled={jsEnabled && !selectedState && !selectedDistrict}
            hint={jsEnabled && !selectedState && !selectedDistrict ? translate('ui.apply.district_need_state') : undefined}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setSelectedDistrict(v);
              const state = districtToState.get(v);
              if (state) setSelectedState(state);
              setSelectedTehsil('');
            }}
          />
          <SelectField
            name="tehsil"
            label={translate('ui.apply.tehsil')}
            options={[BLANK(translate('ui.apply.select_tehsil')), ...tehsilsForDistrict.map((t) => ({ value: t, label: t }))]}
            defaultValue={selectedTehsil}
            disabled={jsEnabled && !selectedDistrict && !selectedTehsil}
            hint={jsEnabled && !selectedDistrict && !selectedTehsil ? translate('ui.apply.tehsil_need_district') : translate('ui.apply.village_auto_hint')}
            onChange={(e) => handleTehsilChange((e.target as HTMLSelectElement).value)}
          />
        </Fieldset>

        {/* Education-only block */}
        {isEducation && (
          <>
            <div className="flex items-center gap-2 pt-1">
              <StepBadge n="4" active />
              <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
                {translate('ui.apply.step_education')}
              </span>
            </div>
            <Fieldset legend={translate('ui.apply.section_education')} hint={translate('ui.apply.education_hint')}>
              <SelectField
                name="edu_admission"
                label={translate('ui.apply.edu_admission')}
                options={[
                  BLANK(translate('ui.apply.unset')),
                  { value: 'yes', label: translate('common.yes') },
                  { value: 'no', label: translate('common.no') },
                ]}
                defaultValue={first(initialParams, 'edu_admission')}
              />
              <SelectField
                name="edu_location"
                label={translate('ui.apply.edu_location')}
                options={[
                  BLANK(translate('ui.apply.unset')),
                  ...STUDY_LOCATIONS.map((location) => ({
                    value: location,
                    label: translate(`ui.study_location.${location}`),
                  })),
                ]}
                defaultValue={first(initialParams, 'edu_location')}
              />
              <TextField name="edu_course" label={translate('ui.apply.edu_course')} defaultValue={first(initialParams, 'edu_course')} />
              <TextField
                name="edu_duration"
                label={translate('ui.apply.edu_duration')}
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={first(initialParams, 'edu_duration')}
              />
            </Fieldset>
          </>
        )}

        {/* Livelihood needs no extra block beyond the two money fields already shown above */}

        <div className="flex items-center gap-2 pt-1">
          <StepBadge n={isEducation ? '5' : '4'} active />
          <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
            {translate('ui.apply.step_documents')}
          </span>
        </div>
        <Fieldset
          legend={translate('ui.apply.section_documents')}
          hint={
            isLivelihood
              ? translate('ui.apply.documents_hint_livelihood')
              : isEducation
                ? translate('ui.apply.documents_hint_education')
                : translate('ui.apply.documents_hint')
          }
        >
          {filteredDocCodes && jsEnabled ? (
            <p className="text-ink-3 sm:col-span-2 -mt-1 text-xs leading-relaxed">
              {translate('ui.apply.documents_filtered', { count: String(visibleDocs.length) })}
            </p>
          ) : null}
          <CheckboxGrid
            name="doc"
            checked={checkedDocs}
            options={visibleDocs.map((definition) => ({ value: definition.code, label: translate(definition.name_key) }))}
          />
        </Fieldset>

        <div className="flex items-center gap-2 pt-1">
          <StepBadge n={isEducation ? '6' : '5'} active />
          <span className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
            {translate('ui.apply.step_terms')}
          </span>
        </div>
        <Fieldset legend={translate('ui.apply.section_terms')} hint={translate('ui.apply.terms_hint')}>
          <TextField
            name="tenure"
            label={translate('ui.apply.tenure')}
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={first(initialParams, 'tenure')}
          />
          <TextField
            name="moratorium"
            label={translate('ui.apply.moratorium')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(initialParams, 'moratorium')}
          />
        </Fieldset>

        <div className="no-print mt-6">
          <PrimaryLink type="submit">{translate('ui.apply.submit')}</PrimaryLink>
        </div>
      </div>

      {/* No-JS fallback: the reveal block is hidden via the `hidden` class above. This style
          restores it when JS is unavailable, so the form still submits and no field is lost. */}
      <noscript>
        <style>{`.hidden { display: block !important; }`}</style>
      </noscript>

      {/* When JS is on but no intent yet, still offer a disabled submit that explains why it is idle */}
      {jsEnabled && !hasIntent && (
        <div className="no-print mt-6">
          <PrimaryLink type="submit">{translate('ui.apply.submit')}</PrimaryLink>
          <p className="text-ink-3 mt-2 text-xs leading-relaxed">{translate('ui.apply.progressive_hint')}</p>
        </div>
      )}
    </form>
  );
}
