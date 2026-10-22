import { type ReactNode } from "react"
import "./Badge.css"

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: string
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
