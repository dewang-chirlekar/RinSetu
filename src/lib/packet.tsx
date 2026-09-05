/**
 * src/lib/packet.tsx
 *
 * Phase 6 half — PDF packet. Differentiator B — "the file arrives correct".
 *
 * Reuses recommend() output: applicant, verdicts, loan figures, schedule,
 * partners, checklist, provenance. No new numbers, no LLM.
 *
 * @react-pdf/renderer is TypeScript-native, no headless browser.
 * Style mirrors the ledger/paper ledger (globals.css) — warm paper, ink-navy,
 * hairline rules, tabular numerals, stamp badges.
 */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ApplicantProfile, RecommendationResult, SchemeSpec } from '@/core/types';
import { translate } from '@/messages';

// Indian grouping, same as src/lib/format.ts but without translate dep for currency symbol
const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
function rupees(value: number): string {
  return `Rs ${RUPEES.format(Math.round(value))}`;
}
function km(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#17160f',
    backgroundColor: '#fbfaf7',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#b6af9c',
    paddingBottom: 12,
    marginBottom: 12,
  },
  brand: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1f3a5f',
  },
  tagline: {
    fontSize: 7,
    color: '#7b766a',
    marginTop: 2,
  },
  stamp: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#9a3324',
    color: '#9a3324',
    padding: 4,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  h1: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#17160f',
    marginBottom: 4,
  },
  h2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f3a5f',
    marginTop: 12,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ded9cb',
    paddingBottom: 4,
  },
  h3: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#4a4740',
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#ded9cb',
    paddingVertical: 4,
  },
  label: {
    fontSize: 8,
    color: '#7b766a',
    width: '45%',
  },
  value: {
    fontSize: 8,
    color: '#17160f',
    width: '55%',
    textAlign: 'right',
  },
  cellHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#4a4740',
    textTransform: 'uppercase',
    padding: 3,
    backgroundColor: '#f3f1ea',
    borderWidth: 1,
    borderColor: '#ded9cb',
    textAlign: 'center',
  },
  cell: {
    fontSize: 7,
    padding: 3,
    borderWidth: 1,
    borderColor: '#ded9cb',
    textAlign: 'right',
  },
  cellLeft: {
    textAlign: 'left',
  },
  badge: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#7b766a',
    borderWidth: 1,
    borderColor: '#7b766a',
    padding: 2,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#b6af9c',
    paddingTop: 8,
    fontSize: 6,
    color: '#7b766a',
  },
  bullet: {
    fontSize: 7,
    marginVertical: 2,
    marginLeft: 8,
  },
});

function FieldRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PacketDocument({
  applicant,
  result,
  schemeByCode,
  locale = 'en' as never,
}: {
  applicant: ApplicantProfile;
  result: RecommendationResult;
  schemeByCode: Map<string, SchemeSpec>;
  locale?: import('@/messages').Locale;
}): React.ReactElement {
  const t = (key: string, values?: Record<string, string | number | null | undefined>) =>
    translate(key, values, locale);
  const recommended = result.schemes.find((s) => s.scheme_code === result.recommended_scheme_code);
  const generatedAt = new Date(result.generated_at).toLocaleString(locale === 'hi' ? 'hi-IN' : locale === 'mr' ? 'mr-IN' : 'en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const unknown = t('common.unknown');

  return (
    <Document title={`RinSetu packet — ${applicant.name ?? applicant.id ?? 'applicant'}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>{t('ui.brand')} — {t('ui.tagline')}</Text>
          <Text style={styles.tagline}>{t('ui.footer.build')}</Text>
          {!result.dataset.figures_authoritative ? (
            <Text style={styles.stamp}>
              {t('dataset.banner.not_authoritative')} — {t('dataset.banner.not_authoritative_detail')}
            </Text>
          ) : null}
          <Text style={{ fontSize: 6, color: '#7b766a', marginTop: 4 }}>
            {t('recommendation.generated_at', { timestamp: generatedAt })} · {t(result.dataset.label)}
          </Text>
        </View>

        {/* Applicant */}
        <Text style={styles.h2}>{t('ui.result.answers_heading')}</Text>
        <FieldRow label={t('ui.apply.name')} value={applicant.name ?? unknown} />
        <FieldRow label={t('ui.apply.age')} value={applicant.age == null ? unknown : String(applicant.age)} />
        <FieldRow label={t('ui.apply.category')} value={t(`ui.category.${applicant.category}`)} />
        <FieldRow label={t('ui.apply.income')} value={applicant.annual_family_income == null ? unknown : rupees(applicant.annual_family_income)} />
        <FieldRow label={t('ui.apply.state')} value={applicant.state ?? unknown} />
        <FieldRow label={t('ui.apply.district')} value={applicant.district ?? unknown} />
        <FieldRow label={t('ui.apply.intent')} value={t(`ui.intent.${applicant.intent}`)} />
        <FieldRow label={t('ui.apply.purpose')} value={applicant.purpose ?? unknown} />
        <FieldRow label={t('ui.apply.project_cost')} value={applicant.project_cost == null ? unknown : rupees(applicant.project_cost)} />

        {/* Verdicts */}
        <Text style={styles.h2}>{t('ui.result.schemes_heading')}</Text>
        {result.schemes.map((rec) => {
          const scheme = schemeByCode.get(rec.scheme_code);
          const isRec = rec.scheme_code === result.recommended_scheme_code;
          return (
            <View key={rec.scheme_code} style={{ marginBottom: 6, borderWidth: isRec ? 1 : 0, borderColor: '#1f3a5f', padding: isRec ? 6 : 0 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: isRec ? '#1f3a5f' : '#17160f' }}>
                {scheme?.name_i18n.en ?? rec.scheme_code} — {t(`status.${rec.status}`)} {isRec ? `(${t('recommendation.heading')})` : ''}
              </Text>
              {rec.verdicts.map((v) => (
                <Text key={v.code} style={styles.bullet}>
                  • {t(v.messageKey, { actual: String(v.actual ?? ''), required: String(v.required ?? '') })} [{v.code}]
                </Text>
              ))}
              {rec.remediations.map((r) => (
                <Text key={r.code} style={{ fontSize: 7, color: '#4a4740', marginLeft: 12 }}>
                  → {t(r.messageKey, { delta: String(r.delta ?? ''), target: String(r.target ?? ''), fields: (r.alternatives ?? []).join(', ') })}
                </Text>
              ))}
            </View>
          );
        })}

        {/* Loan figures — recommended only */}
        {recommended?.computation && recommended.computation.computable ? (
          <View>
            <Text style={styles.h2}>{t('loan.loan')} — {recommended.scheme_code}</Text>
            <FieldRow label={t('loan.eligible_cost')} value={rupees(recommended.computation.eligible_cost)} />
            <FieldRow label={t('loan.subsidy')} value={rupees(recommended.computation.subsidy)} />
            <FieldRow label={t('loan.own_contribution')} value={rupees(recommended.computation.own_contribution)} />
            <FieldRow label={t('loan.loan')} value={rupees(recommended.computation.loan)} />
            <FieldRow label={t('loan.annual_rate_pct')} value={`${recommended.computation.annual_rate_pct}%`} />
            <FieldRow label={t('loan.emi')} value={rupees(recommended.computation.schedule.emi)} />
            <FieldRow label={t('loan.moratorium_months')} value={`${recommended.computation.moratorium_months} · ${recommended.computation.schedule.treatment}`} />
            <FieldRow label={t('loan.repayment_months')} value={String(recommended.computation.repayment_months)} />
            <FieldRow label={t('loan.total_interest')} value={rupees(recommended.computation.schedule.totals.total_interest)} />
            <FieldRow label={t('loan.total_outflow')} value={rupees(recommended.computation.schedule.totals.total_outflow)} />

            {/* Schedule — first 12 rows + totals */}
            <Text style={styles.h3}>{t('loan.schedule.heading')}</Text>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.cellHeader, { flex: 1 }]}>{t('loan.schedule.month')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.phase')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.opening_balance')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.payment')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.interest')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.principal')}</Text>
              <Text style={[styles.cellHeader, { flex: 2 }]}>{t('loan.schedule.closing_balance')}</Text>
            </View>
            {recommended.computation.schedule.rows.slice(0, 24).map((row) => (
              <View key={row.month} style={{ flexDirection: 'row' }}>
                <Text style={[styles.cell, { flex: 1 }]}>{String(row.month)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{t(`loan.schedule.${row.phase}`)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{rupees(row.opening_balance)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{rupees(row.payment)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{rupees(row.interest)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{rupees(row.principal)}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{rupees(row.closing_balance)}</Text>
              </View>
            ))}
            {recommended.computation.schedule.rows.length > 24 ? (
              <Text style={{ fontSize: 6, color: '#7b766a', marginTop: 2 }}>
                {recommended.computation.schedule.rows.length - 24} more months — totals below include full schedule.
              </Text>
            ) : null}
          </View>
        ) : recommended ? (
          <Text style={{ fontSize: 8, color: '#9a3324', marginTop: 6 }}>{t('loan.not_computable')}</Text>
        ) : null}

        {/* Partners */}
        {recommended?.partners && recommended.partners.eligible.length > 0 ? (
          <View>
            <Text style={styles.h2}>{t('partner.heading')}</Text>
            {recommended.partners.ranked_by_distance.slice(0, 5).map((m, i) => (
              <View key={m.partner.code} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ded9cb', paddingVertical: 3 }}>
                <Text style={{ fontSize: 8, width: '55%' }}>
                  {i + 1}. {m.partner.name} — {m.partner.district}, {m.partner.state} ({m.partner.type})
                </Text>
                <Text style={{ fontSize: 7, color: '#4a4740', width: '45%', textAlign: 'right' }}>
                  {m.distance_km != null ? `${km(m.distance_km)} km` : t('partner.distance_unknown')} · {m.health ? `${m.health.score.toFixed(2)}` : ''} {m.health ? t(`health.capacity.${m.health.capacity_flag}`) : ''}
                </Text>
              </View>
            ))}
            <Text style={{ fontSize: 6, color: '#7b766a', marginTop: 4 }}>{t('partner.map.eligible_only')}</Text>
          </View>
        ) : null}

        {/* Checklist */}
        {recommended?.checklist ? (
          <View>
            <Text style={styles.h2}>{t('checklist.heading')}</Text>
            {recommended.checklist.items.map((item) => (
              <View key={item.doc_code} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#ded9cb', paddingVertical: 3 }}>
                <Text style={{ fontSize: 8, width: '55%' }}>
                  {t(item.name_key)} {item.mandatory ? `(${t('checklist.mandatory')})` : `(${t('checklist.optional')})`} — {t(item.status === 'HAVE' ? 'checklist.have' : 'checklist.missing')}
                </Text>
                <Text style={{ fontSize: 6, color: '#7b766a', width: '45%', textAlign: 'right' }}>{t(item.where_to_obtain_key)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{t('ui.footer.build')}</Text>
          <Text>{t('dataset.banner.not_authoritative_detail')}</Text>
          <Text>
            {t(result.dataset.label)} · {result.dataset.figures_authoritative ? 'authoritative' : 'not authoritative'} · {result.dataset.notes.join(' · ')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}