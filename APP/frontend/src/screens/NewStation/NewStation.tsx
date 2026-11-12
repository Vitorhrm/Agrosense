import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { DeviceRegistration } from "../../features/devices/DeviceRegistration/DeviceRegistration"
import type { Screen } from "../../types/navigation"

export function NewStation({ go, userId }: { go: (screen: Screen) => void; userId: string }) {
  return (
    <AppShell screen="new-station" go={go} noNav>
      <TopBar title="Configurar dispositivos" back onBack={() => go("home")} action={<span />} />
      <div className="page">
        <DeviceRegistration userId={userId} />
      </div>
    </AppShell>
  )
}
