import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { Button } from "../../components/Button/Button"
import type { Screen } from "../../types/navigation"

export function AlertsScreen({ go }: { go: (screen: Screen) => void }) {
  return <AppShell screen="alerts" go={go}>
    <TopBar title="Alertas" />
    <section className="page">
      <p>Os alertas automáticos ainda estão em desenvolvimento. Consulte a faixa de solo configurada em Áreas e culturas.</p>
      <Button onClick={() => go("areas")}>Abrir áreas e culturas</Button>
    </section>
  </AppShell>
}
