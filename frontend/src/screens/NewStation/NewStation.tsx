import { ChevronDown, LocateFixed, Map, MapPin, RadioTower, Wifi } from "lucide-react"
import { Button } from "../../components/Button/Button"
import { TopBar } from "../../components/TopBar/TopBar"
import { AppShell } from "../../components/AppShell/AppShell"
import { FormField } from "../../components/FormField/FormField"
import type { Screen } from "../../types/navigation"
import "./NewStation.css"

export function NewStation({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="new-station" go={go} noNav>
      <TopBar
        title="Nova estação"
        subtitle="Vincule um dispositivo IoT"
        back
        onBack={() => go("area")}
        action={<span />}
      />
      <section className="form-page">
        <div className="form-section-title">
          <span>DADOS DA ESTAÇÃO</span>
          <h2>Identifique o dispositivo</h2>
          <p>As coordenadas serão usadas na previsão climática da área.</p>
        </div>
        <FormField
          label="Nome da estação"
          placeholder="Ex.: Estação Sul"
          icon={RadioTower}
        />
        <FormField
          label="Identificador"
          placeholder="Ex.: ESP32-A7F2"
          icon={Wifi}
          note="Código único configurado no dispositivo."
        />
        <label className="field">
          <span>Área vinculada</span>
          <div>
            <Map size={18} />
            <select defaultValue="Talhão Norte">
              <option>Talhão Norte</option>
              <option>Fazenda Sul</option>
            </select>
            <ChevronDown size={18} />
          </div>
        </label>
        <div className="coordinate-grid">
          <FormField label="Latitude" placeholder="-22.9068" />
          <FormField label="Longitude" placeholder="-47.0626" />
        </div>
        <Button variant="secondary" icon={LocateFixed} full>
          Usar localização atual
        </Button>
        <div className="map-placeholder">
          <MapPin size={29} />
          <span>Prévia da localização</span>
          <small>-22.9068, -47.0626</small>
        </div>
        <Button full onClick={() => go("area")}>
          Cadastrar estação
        </Button>
      </section>
    </AppShell>
  )
}
