import type { SelectHTMLAttributes } from 'react'

type SelectOption = {
  readonly value: string
  readonly label: string
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  readonly label?: string
  readonly error?: string
  readonly options: readonly SelectOption[]
  readonly placeholder?: string
}

export function Select({
  label,
  error,
  options,
  placeholder,
  id,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text-muted">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-lg border border-border bg-bg px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
