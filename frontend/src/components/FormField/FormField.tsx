import type { IconType } from "../../types/navigation"
import "./FormField.css"

export function FormField({
  label,
  placeholder,
  icon: Icon,
  note,
}: {
  label: string
  placeholder: string
  icon?: IconType
  note?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        {Icon && <Icon size={18} />}
        <input placeholder={placeholder} />
      </div>
      {note && <small>{note}</small>}
    </label>
  )
}
