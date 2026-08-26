/**
 * src/app/apply/page.tsx
 *
 * The guided intake form — the primary intake path (CLAUDE.md hard rule 5).
 *
 * It submits with GET, so /result is a plain URL and this whole flow works with
 * JavaScript unavailable and the LLM disabled. Free-text intake, when it lands,
 * is an alternative route into the same query string, never a replacement for it.
 *
 * Every option list on this page is read from the dataset rather than typed here:
 * purposes come from each scheme's eligible_purposes, documents from the document
 * definitions, states and districts from the partner registry. That is not tidiness
 * — a hardcoded option list would let the form offer a purpose no scheme accepts,
 * or a state no partner covers, and the form would then be quietly lying about what
 * the engine can do.
 *
 * `lat`/`lng` are not collected. They would let us rank partners by real distance,
 * but the only way to fill them from a state-and-district answer is to invent a
 * centroid, and CLAUDE.md hard rule 1 forbids exactly that. Form users see
 * "distance unknown" and correct ordering by throughput; the persona fixtures carry
 * committed coordinates and demonstrate distance ranking honestly.
 */

import {
  GENDERS,
  INTENTS,
  SOCIAL_CATEGORIES,
  STUDY_LOCATIONS,
  type SchemeSpec,
} from '@/core/types';
import { loadBundle } from '@/lib/dataset';
import { humanisePurpose } from '@/lib/format';
import { translate } from '@/messages';
import { CheckboxGrid, Fieldset, SelectField, TextField, type Option } from '@/components/form';
import { PrimaryLink } from '@/components/ui';

type RawParams = Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string {
  const value = params[key];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate ?? '';
}

const BLANK = (label: string): Option => ({ value: '', label });

/**
 * The blank option carries the enum's own "not answered" member (UNKNOWN /
 * UNDISCLOSED) and submits as an empty string, which applicant-params.ts turns
 * into `undefined` so Zod applies that same default. An untouched form and a
 * submitted one therefore describe the applicant identically.
 */
function enumOptions<T extends string>(
  values: readonly T[],
  keyPrefix: string,
  blankValue: T,
): Option[] {
  return [
    { value: '', label: translate(`${keyPrefix}.${blankValue}`) },
    ...values
      .filter((value) => value !== blankValue)
      .map((value) => ({ value, label: translate(`${keyPrefix}.${value}`) })),
  ];
}

function purposeGroups(schemes: SchemeSpec[]) {
  return schemes
    .filter((scheme) => scheme.eligible_purposes.length > 0)
    .map((scheme) => ({
      label: scheme.name_i18n.en ?? scheme.code,
      options: scheme.eligible_purposes.map((code) => ({
        value: code,
        label: humanisePurpose(code),
      })),
    }));
}

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const { dataset, partners, documentDefinitions } = loadBundle();

  const states = [...new Set(partners.map((partner) => partner.state))].sort();
  const districts = [...new Set(partners.map((partner) => partner.district))].sort();
  const rawDocs = params.doc;
  const checkedDocs = new Set(
    Array.isArray(rawDocs) ? rawDocs : rawDocs !== undefined ? [rawDocs] : [],
  );

  return (
    <div>
      <h1 className="text-ink font-serif text-2xl leading-tight font-semibold">
        {translate('ui.apply.heading')}
      </h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{translate('ui.apply.lede')}</p>
      <p className="border-accent bg-accent-soft text-ink-2 mt-3 border-l-[3px] px-3.5 py-2.5 text-xs leading-relaxed">
        {translate('ui.apply.blank_hint')}
      </p>

      <form action="/result" method="get">
        <Fieldset legend={translate('ui.apply.section_person')}>
          <TextField name="name" label={translate('ui.apply.name')} defaultValue={first(params, 'name')} />
          <TextField
            name="age"
            label={translate('ui.apply.age')}
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            defaultValue={first(params, 'age')}
          />
          <SelectField
            name="gender"
            label={translate('ui.apply.gender')}
            options={enumOptions(GENDERS, 'ui.gender', 'UNDISCLOSED')}
            defaultValue={first(params, 'gender')}
          />
          <SelectField
            name="category"
            label={translate('ui.apply.category')}
            options={enumOptions(SOCIAL_CATEGORIES, 'ui.category', 'UNKNOWN')}
            defaultValue={first(params, 'category')}
          />
        </Fieldset>

        <Fieldset legend={translate('ui.apply.section_money')}>
          <TextField
            name="income"
            label={translate('ui.apply.income')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(params, 'income')}
          />
          <SelectField
            name="state"
            label={translate('ui.apply.state')}
            options={[
              BLANK(translate('ui.apply.select_state')),
              ...states.map((state) => ({ value: state, label: state })),
            ]}
            defaultValue={first(params, 'state')}
          />
          <TextField
            name="district"
            label={translate('ui.apply.district')}
            list="districts"
            hint={translate('ui.apply.location_hint')}
            defaultValue={first(params, 'district')}
          />
          <datalist id="districts">
            {districts.map((district) => (
              <option key={district} value={district} />
            ))}
          </datalist>
        </Fieldset>

        <Fieldset legend={translate('ui.apply.section_project')}>
          <SelectField
            name="intent"
            label={translate('ui.apply.intent')}
            options={enumOptions(INTENTS, 'ui.intent', 'UNKNOWN')}
            defaultValue={first(params, 'intent')}
          />
          <SelectField
            name="purpose"
            label={translate('ui.apply.purpose')}
            options={[BLANK(translate('ui.apply.select_purpose'))]}
            groups={purposeGroups(dataset.schemes)}
            hint={translate('ui.apply.purpose_hint')}
            defaultValue={first(params, 'purpose')}
          />
          <TextField
            name="project_cost"
            label={translate('ui.apply.project_cost')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(params, 'project_cost')}
          />
          <TextField
            name="own_funds"
            label={translate('ui.apply.own_funds')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(params, 'own_funds')}
          />
        </Fieldset>

        <Fieldset
          legend={translate('ui.apply.section_education')}
          hint={translate('ui.apply.education_hint')}
        >
          <SelectField
            name="edu_admission"
            label={translate('ui.apply.edu_admission')}
            options={[
              BLANK(translate('ui.apply.unset')),
              { value: 'yes', label: translate('common.yes') },
              { value: 'no', label: translate('common.no') },
            ]}
            defaultValue={first(params, 'edu_admission')}
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
            defaultValue={first(params, 'edu_location')}
          />
          <TextField
            name="edu_course"
            label={translate('ui.apply.edu_course')}
            defaultValue={first(params, 'edu_course')}
          />
          <TextField
            name="edu_duration"
            label={translate('ui.apply.edu_duration')}
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={first(params, 'edu_duration')}
          />
        </Fieldset>

        <Fieldset
          legend={translate('ui.apply.section_documents')}
          hint={translate('ui.apply.documents_hint')}
        >
          <CheckboxGrid
            name="doc"
            checked={checkedDocs}
            options={documentDefinitions.map((definition) => ({
              value: definition.code,
              label: translate(definition.name_key),
            }))}
          />
        </Fieldset>

        <Fieldset
          legend={translate('ui.apply.section_terms')}
          hint={translate('ui.apply.terms_hint')}
        >
          <TextField
            name="tenure"
            label={translate('ui.apply.tenure')}
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={first(params, 'tenure')}
          />
          <TextField
            name="moratorium"
            label={translate('ui.apply.moratorium')}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={first(params, 'moratorium')}
          />
        </Fieldset>

        <div className="no-print mt-6">
          <PrimaryLink type="submit">{translate('ui.apply.submit')}</PrimaryLink>
        </div>
      </form>
    </div>
  );
}
