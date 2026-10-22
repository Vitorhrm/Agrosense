import { CalendarDays, ChevronDown, Leaf, LocateFixed, Map } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { FormField } from "../../components/FormField/FormField"
import type { Screen } from "../../types/navigation"
import "./NewArea.css"

export function NewArea({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="new-area" go={go} noNav>
      <TopBar
        title="Nova área"
        subtitle="Cadastre uma área de cultivo"
        back
        onBack={() => go("areas")}
        action={<span />}
      />
      <section className="form-page">
        <div className="step-indicator">
          <span className="active" />
          <span />
          <span />
        </div>
        <div className="form-section-title">
          <span>INFORMAÇÕES DA ÁREA</span>
          <h2>Conte sobre o cultivo</h2>
          <p>Você poderá adicionar as estações em seguida.</p>
        </div>
        <FormField
          label="Nome da área"
          placeholder="Ex.: Talhão Norte"
          icon={Map}
        />
        <label className="field">
          <span>Cultura</span>
          <div>
            <Leaf size={18} />
            <select defaultValue="">
              <option value="" disabled>
                Selecione a cultura
              </option>
              <option>Milho</option>
              <option>Café</option>
              <option>Tomate</option>
              <option>Alface</option>
            </select>
            <ChevronDown size={18} />
          </div>
        </label>
        <FormField
          label="Data de início"
          placeholder="dd/mm/aaaa"
          icon={CalendarDays}
        />
        <label className="field">
          <span>Descrição (opcional)</span>
          <textarea placeholder="Adicione observações sobre esta área" />
        </label>
        <div className="info-banner location">
          <LocateFixed size={20} />
          <div>
            <strong>Localização automática</strong>
            <p>
              A localização da área será definida automaticamente pelas estações
              cadastradas.
            </p>
          </div>
        </div>
        <Button full onClick={() => go("new-station")}>
          Continuar
        </Button>
      </section>
    </AppShell>
  )
}
