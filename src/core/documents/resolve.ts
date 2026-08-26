/**
 * src/core/documents/resolve.ts
 *
 * The document checklist: scheme × partner type. Differentiator B's foundation.
 *
 * The problem statement complains about misrouted applications and delays in
 * disbursement. The cure is not a better recommendation, it is the file arriving
 * complete — so the checklist has to know that a public sector bank asks for a
 * guarantor form the state channelizing agency does not, and that a micro
 * finance institution wants a group reference instead.
 *
 * Merge rule: requirements filed against partner_type '*' always apply;
 * requirements filed against a specific type are added when that type is the
 * chosen partner. Where both exist for the same document the stricter mandatory
 * flag wins, and `required_by` records which side asked for it so the UI can
 * say "your bank additionally requires…".
 */

import type {
  ApplicantProfile,
  ChecklistItem,
  DocumentChecklist,
  DocumentDefinition,
  DocumentRequirement,
  PartnerType,
  SchemeSpec,
} from '../types';

export interface ResolveChecklistInput {
  scheme: SchemeSpec;
  /** Null before a partner is chosen — yields the scheme-only baseline. */
  partnerType: PartnerType | null;
  applicant: ApplicantProfile;
  definitions: DocumentDefinition[];
  requirements: DocumentRequirement[];
}

export function resolveChecklist(input: ResolveChecklistInput): DocumentChecklist {
  const { scheme, partnerType, applicant, definitions, requirements } = input;

  const byCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const available = new Set(applicant.documents_available);

  const relevant = requirements.filter(
    (requirement) =>
      requirement.scheme_code === scheme.code &&
      (requirement.partner_type === '*' ||
        (partnerType != null && requirement.partner_type === partnerType)),
  );

  const merged = new Map<string, ChecklistItem>();

  for (const requirement of relevant) {
    const definition = byCode.get(requirement.doc_code);
    if (!definition) {
      // A requirement naming a document that is not in the catalogue is a seed
      // error. Fail loudly rather than silently dropping a document a
      // beneficiary would then be turned away for.
      throw new Error(
        `Requirement ${requirement.scheme_code}/${requirement.partner_type} names unknown document '${requirement.doc_code}'.`,
      );
    }

    const side = requirement.partner_type === '*' ? 'SCHEME' : 'PARTNER_TYPE';
    const existing = merged.get(requirement.doc_code);

    if (!existing) {
      merged.set(requirement.doc_code, {
        doc_code: requirement.doc_code,
        name_key: definition.name_key,
        where_to_obtain_key: definition.where_to_obtain_key,
        notes_key: requirement.notes_key,
        mandatory: requirement.mandatory,
        status: available.has(requirement.doc_code) ? 'HAVE' : 'MISSING',
        required_by: side,
        provenance: definition.provenance,
      });
      continue;
    }

    merged.set(requirement.doc_code, {
      ...existing,
      // Stricter wins: if either side makes it mandatory, it is mandatory.
      mandatory: existing.mandatory || requirement.mandatory,
      required_by: existing.required_by === side ? side : 'BOTH',
      // Keep the first note rather than concatenating; the partner-specific note
      // is surfaced separately in the UI.
      notes_key: existing.notes_key ?? requirement.notes_key,
    });
  }

  // Mandatory first, then alphabetical by code — a stable order so the printed
  // cover sheet and the on-screen list always agree.
  const items = Array.from(merged.values()).sort((a, b) => {
    if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
    return a.doc_code.localeCompare(b.doc_code);
  });

  const mandatoryItems = items.filter((item) => item.mandatory);
  const mandatoryMissing = mandatoryItems.filter((item) => item.status === 'MISSING').length;

  return {
    scheme_code: scheme.code,
    partner_type: partnerType,
    items,
    mandatory_total: mandatoryItems.length,
    mandatory_missing: mandatoryMissing,
    ready: mandatoryMissing === 0,
  };
}
