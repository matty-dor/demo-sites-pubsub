import {
  operatorThresholdFieldLabel,
  operatorThresholdKind,
  operatorThresholdPlaceholder,
  type ComparisonOperator,
} from '../lib/ruleMatch'

type Props = {
  operator: ComparisonOperator
  value: string
  onChange: (value: string) => void
  /** Shorter placeholder for compact rows (e.g. v1 dynamic image mappings). */
  compact?: boolean
}

export function ConditionOperatorValueField({
  operator,
  value,
  onChange,
  compact = false,
}: Props) {
  const kind = operatorThresholdKind(operator)
  const disabled = kind === 'none'
  const placeholder =
    compact && kind === 'example'
      ? 'Compare to this value'
      : operatorThresholdPlaceholder(operator)

  return (
    <label className="stack-label mapping-cell">
      <span className="muted small">{operatorThresholdFieldLabel(operator)}</span>
      <div
        className={
          kind === 'days' ? 'condition-threshold-days-row' : undefined
        }
      >
        <input
          className="input"
          type="text"
          inputMode={kind === 'days' ? 'decimal' : undefined}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {kind === 'days' && (
          <span className="muted small condition-threshold-days-suffix">days</span>
        )}
      </div>
    </label>
  )
}
