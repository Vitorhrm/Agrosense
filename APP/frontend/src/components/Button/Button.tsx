import { type ReactNode } from "react"
import type { IconType } from "../../types/navigation"
import "./Button.css"

export function Button({
  children,
  onClick,
  variant = "primary",
  icon: Icon,
  full = false,
  type = "button",
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: IconType
  full?: boolean
  type?: "button" | "submit"
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`button button-${variant}${full ? " button-full" : ""}`}
    >
      {Icon && <Icon size={18} strokeWidth={2.2} />}
      {children}
    </button>
  )
}
