import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { DeviceRegistration } from "../../features/devices/DeviceRegistration/DeviceRegistration"
import type { Screen } from "../../types/navigation"

export function NewStation({ go, areaName }: { go: (screen: Screen) => void; areaName: string }) {
  return (
    <AppShell screen="new-station" go={go} noNav>
      <TopBar title="Cadastrar estação" subtitle={areaName} back onBack={() => go("area")} action={<span />} />
      <section className="form-page">
        <DeviceRegistration areaName={areaName} initialKind="station" onClose={() => go("area")} />
      </section>
    </AppShell>
  )
}
