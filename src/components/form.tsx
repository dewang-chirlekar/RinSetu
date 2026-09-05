/**
 * src/components/form.tsx
 *
 * Intake form primitives. Plain HTML inputs, server-rendered, no client JS.
 *
 * Two properties are deliberate:
 *
 *   1. Every input can be left blank, and a blank one submits an empty string that
 *      src/lib/applicant-params.ts turns into null — "not known", never zero. Do
 *      not add `required` to anything here; a required field would force a guess,
 *      and a guessed income is a wrong verdict.
 *
 *   2. Touch targets are 44px tall and labels sit above their control, so the form
 *      is usable one-handed at 360px (CLAUDE.md hard rule 10).
 */

export interface Option {
  value: string;
  label: string;
}

const CONTROL =
  'border-rule-strong bg-paper-edge text-ink focus:border-accent focus:outline-accent mt-1 block w-full border px-3 py-2.5 text-sm';

export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-rule mt-6 border-t pt-4">
      <legend className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
        {legend}
      </legend>
      {hint ? <p className="text-ink-3 mt-1 text-xs leading-relaxed">{hint}</p> : null}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Label({
  name,
  label,
  optional,
}: {
  name: string;
  label: string;
  optional?: string;
}) {
  return (
    <label htmlFor={name} className="text-ink block text-sm font-medium">
      {label}
      {optional ? <span className="text-ink-3 ml-1.5 text-xs font-normal">({optional})</span> : null}
    </label>
  );
}

export function TextField({
  name,
  label,
  defaultValue,
  hint,
  type = 'text',
  inputMode,
  min,
  max,
  list,
  wide = false,
  disabled,
  onChange,
  value,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  hint?: string;
  type?: 'text' | 'number';
  inputMode?: 'numeric' | 'text';
  min?: number;
  max?: number;
  list?: string;
  wide?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const isControlled = value !== undefined;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <Label name={name} label={label} />
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        list={list}
        defaultValue={isControlled ? undefined : defaultValue}
        value={isControlled ? value : undefined}
        onChange={onChange}
        disabled={disabled}
        autoComplete="off"
        className={`${CONTROL} disabled:opacity-60 disabled:bg-paper-sunk`}
      />
      {hint ? <p className="text-ink-3 mt-1 text-xs leading-relaxed">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
  groups,
  wide = false,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  /** Ungrouped options, rendered before any groups. The first is usually the blank. */
  options: Option[];
  defaultValue?: string;
  hint?: string;
  /** Optional grouped options, e.g. purposes grouped by scheme. */
  groups?: { label: string; options: Option[] }[];
  wide?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <Label name={name} label={label} />
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={onChange}
        className={`${CONTROL} disabled:opacity-60 disabled:bg-paper-sunk`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {groups?.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={`${group.label}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {hint ? <p className="text-ink-3 mt-1 text-xs leading-relaxed">{hint}</p> : null}
    </div>
  );
}

export function CheckboxGrid({
  name,
  options,
  checked,
}: {
  name: string;
  options: Option[];
  checked: ReadonlySet<string>;
}) {
  return (
    <div className="grid gap-x-4 gap-y-1 sm:col-span-2 sm:grid-cols-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="text-ink flex min-h-11 cursor-pointer items-center gap-2.5 text-sm"
        >
          <input
            type="checkbox"
            name={name}
            value={option.value}
            defaultChecked={checked.has(option.value)}
            className="accent-accent h-4 w-4 shrink-0"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
