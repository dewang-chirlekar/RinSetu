/**
 * src/components/LoanFigures.tsx
 *
 * The money. Every number on this panel comes from src/core/finance/ — this file
 * formats and labels, it never computes.
 *
 * The one arithmetic-looking thing here is deliberate avoidance of arithmetic:
 * `loan.binding_constraint.LOAN_PCT_CAP` needs the cap percentage, so the panel
 * reads `scheme.loan_pct_cap` from the dataset rather than back-solving it from
 * loan ÷ eligible_cost. A derived-in-the-UI figure would drift from the engine's
 * by a rupee and there would be no test to catch it. If you need a number that
 * isn't on LoanFigures, take it from the SchemeSpec or add it to the engine —
 * do not calculate it here.
 *
 * The not-computable branch is not an error state. A scheme whose parameters we
 * have not transcribed produces no figures, names what is missing, and that is the
 * correct, honest output. Do not fill it with placeholder numbers.
 */

import type { LoanComputation, SchemeSpec } from '@/core/types';
import { translate } from '@/messages';
import { fieldLabel } from '@/lib/view';
import { fractionPercent, joinList, months, percent, rupees } from '@/lib/format';
import { FieldRow } from './ui';

export function LoanFigures({
  scheme,
  computation,
  requestedMoratorium,
}: {
  scheme: SchemeSpec;
  computation: LoanComputation;
  requestedMoratorium: number | null;
}) {
  if (!computation.computable) {
    return (
      <div className="border-hold bg-hold-soft border-l-[3px] px-3.5 py-3">
        <h3 className="text-ink text-sm">{translate('loan.not_computable')}</h3>
        <p className="text-ink-2 mt-1 text-xs leading-relaxed">
          {translate('loan.not_computable_detail', {
            fields: joinList(computation.missing.map(fieldLabel)),
          })}
        </p>
      </div>
    );
  }

  const figures = computation;
  const schedule = figures.schedule;

  const clamped =
    requestedMoratorium !== null && requestedMoratorium !== figures.moratorium_months;

  return (
    <div>
      <dl className="border-rule border-t">
        <FieldRow
          label={translate('loan.project_cost')}
          value={rupees(figures.project_cost)}
        />
        <FieldRow
          label={translate('loan.eligible_cost')}
          help={translate('loan.eligible_cost_help')}
          value={rupees(figures.eligible_cost)}
          provenance={scheme.provenance.max_unit_cost}
        />
        {figures.subsidy > 0 ? (
          <FieldRow
            label={translate('loan.subsidy')}
            help={translate(`loan.subsidy_${figures.subsidy_timing.toLowerCase()}`)}
            value={rupees(figures.subsidy)}
            provenance={scheme.provenance.subsidy_pct}
          />
        ) : null}
        <FieldRow
          label={translate('loan.own_contribution')}
          help={translate('loan.own_contribution_help', {
            pct: fractionPercent(figures.margin_pct),
          })}
          value={rupees(figures.own_contribution)}
          provenance={scheme.provenance.margin_pct}
        />
        <FieldRow label={translate('loan.gross_loan')} value={rupees(figures.gross_loan)} />
        <FieldRow label={translate('loan.loan')} value={rupees(figures.loan)} emphasis />
        <FieldRow
          label={translate('loan.annual_rate_pct')}
          value={percent(figures.annual_rate_pct)}
          provenance={figures.rate_provenance}
        />
        <FieldRow
          label={translate('loan.moratorium_months')}
          value={months(figures.moratorium_months)}
          provenance={scheme.provenance.moratorium_months_max}
        />
        <FieldRow
          label={translate('loan.repayment_months')}
          value={months(figures.repayment_months)}
          provenance={scheme.provenance.tenure_months_max}
        />
        <FieldRow
          label={translate('loan.tenure_months_total')}
          value={months(figures.tenure_months_total)}
        />
        <FieldRow label={translate('loan.emi')} value={rupees(schedule.emi)} emphasis />
        <FieldRow label={translate('loan.total_interest')} value={rupees(schedule.totals.total_interest)} />
        <FieldRow
          label={translate('loan.total_outflow')}
          value={rupees(schedule.totals.total_outflow)}
        />
      </dl>

      <div className="mt-3 space-y-2 text-xs leading-relaxed">
        <p className="text-ink-2">
          <span className="text-ink font-medium">
            {translate('loan.binding_constraint.heading')}:{' '}
          </span>
          {translate(`loan.binding_constraint.${figures.binding_constraint}`, {
            value: scheme.max_loan !== null ? rupees(scheme.max_loan) : rupees(figures.loan),
            // loan_pct_cap is a fraction (0.85), not a percentage. Formatted here
            // rather than in the message so the message holds no unit at all.
            pct:
              scheme.loan_pct_cap !== null
                ? fractionPercent(scheme.loan_pct_cap)
                : translate('common.unknown'),
          })}
        </p>

        <p className="text-ink-2">
          <span className="text-ink font-medium">
            {translate('loan.moratorium_months')}:{' '}
          </span>
          {translate(`loan.moratorium.${schedule.treatment}`)}
        </p>

        {clamped ? (
          <p className="text-hold">
            {translate('loan.moratorium.clamped', {
              requested: requestedMoratorium,
              min: scheme.moratorium_months_min,
              max: scheme.moratorium_months_max,
              applied: figures.moratorium_months,
            })}
          </p>
        ) : null}

        {figures.loan_below_min && figures.min_loan !== null ? (
          <p className="text-fail">
            {translate('loan.below_min', { value: rupees(figures.min_loan) })}
          </p>
        ) : null}
      </div>

      <details className="border-rule mt-4 border-t pt-3">
        <summary className="text-accent cursor-pointer text-xs font-medium">
          {translate('loan.schedule.heading')} — {months(schedule.rows.length)}
        </summary>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-rule-strong text-ink-3 border-b">
                <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                  {translate('loan.schedule.month')}
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                  {translate('loan.schedule.phase')}
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {translate('loan.schedule.opening_balance')}
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {translate('loan.schedule.payment')}
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {translate('loan.schedule.interest')}
                </th>
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  {translate('loan.schedule.principal')}
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  {translate('loan.schedule.closing_balance')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-rule divide-y">
              {schedule.rows.map((row) => (
                <tr key={row.month} className={row.phase === 'MORATORIUM' ? 'bg-paper-sunk' : ''}>
                  <td className="num py-1 pr-2 text-left">{row.month}</td>
                  <td className="text-ink-3 py-1 pr-2 text-left text-[0.6875rem]">
                    {translate(`loan.schedule.${row.phase}`)}
                  </td>
                  <td className="num py-1 pr-2">{rupees(row.opening_balance)}</td>
                  <td className="num py-1 pr-2">{rupees(row.payment)}</td>
                  <td className="num py-1 pr-2">{rupees(row.interest)}</td>
                  <td className="num py-1 pr-2">{rupees(row.principal)}</td>
                  <td className="num py-1">{rupees(row.closing_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-ink-3 mt-2 text-[0.6875rem] leading-relaxed">
          {translate('loan.schedule.final_instalment_note')}
        </p>
      </details>
    </div>
  );
}
