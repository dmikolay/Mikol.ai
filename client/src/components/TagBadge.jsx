const VARIANT_CLASS = {
  default: 'badge badge-gray',
  green:   'badge badge-sage',
  yellow:  'badge badge-amber',
  red:     'badge badge-red',
  blue:    'badge badge-navy',
}

export default function TagBadge({ label, variant = 'default' }) {
  return (
    <span className={VARIANT_CLASS[variant] ?? VARIANT_CLASS.default}>
      {label}
    </span>
  )
}
