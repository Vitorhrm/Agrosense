import { Bluetooth, CloudRain, Leaf, RadioTower } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import type { Screen } from "../../types/navigation"
import type { AuthUser } from "../../features/auth/auth.types"

export function HomeScreen({ go, user }: { go: (screen: Screen) => void; user: AuthUser | null }) {
  return <AppShell screen="home" go={go}>
    <TopBar title={`Olá, ${user?.firstName || "Produtor"}`} />
    <section className="page">
      <Button icon={RadioTower} full onClick={() => go("telemetry")}>Telemetria das estações</Button>
      <Button variant="secondary" icon={Leaf} full onClick={() => go("areas")}>Áreas e culturas</Button>
      <Button variant="secondary" icon={CloudRain} full onClick={() => go("weather")}>Previsão por área</Button>
      <Button variant="secondary" icon={Bluetooth} full onClick={() => go("new-station")}>Configurar dispositivos</Button>
    </section>
  </AppShell>
}
