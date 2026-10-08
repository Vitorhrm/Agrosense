import { useEffect, useState, type ReactNode } from "react"
import { bridgeService, errorMessage, type AuthUser } from "./AndroidBridge"
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CloudRain,
  Droplets,
  Eye,
  EyeOff,
  Gauge,
  History,
  Home,
  Leaf,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  RadioTower,
  Settings,
  Sprout,
  Sun,
  Thermometer,
  User,
  Wind,
  Wifi,
  WifiOff,
  X,
} from "lucide-react"

type Screen = "login" | "register" | "home" | "areas" | "area" | "station" | "weather" | "weather-detail" | "alerts" | "profile" | "new-area" | "new-station" | "crop" | "history"

type IconType = typeof Home

const areas = [
  {
    name: "Talhão Norte",
    crop: "Milho",
    stations: 3,
    online: 2,
    offline: 1,
    moisture: 34,
    temperature: 27,
    rain: 82,
    nextRain: "Hoje, 21:00",
    precipitation: "11,4 mm",
    recommendation: "AGUARDAR CHUVA",
    tone: "wait",
  },
  {
    name: "Fazenda Sul",
    crop: "Café",
    stations: 4,
    online: 4,
    offline: 0,
    moisture: 23,
    temperature: 31,
    rain: 12,
    nextRain: "Daqui a 3 dias",
    precipitation: "0 mm",
    recommendation: "IRRIGAR",
    tone: "danger",
  },
  {
    name: "Horta Leste",
    crop: "Alface",
    stations: 2,
    online: 2,
    offline: 0,
    moisture: 58,
    temperature: 25,
    rain: 63,
    nextRain: "Amanhã, 06:00",
    precipitation: "6,8 mm",
    recommendation: "NÃO IRRIGAR",
    tone: "good",
  },
]

const hourly = [
  ["18h", "21%", "0 mm"],
  ["19h", "35%", "0 mm"],
  ["20h", "61%", "1,2 mm"],
  ["21h", "82%", "5,8 mm"],
  ["22h", "89%", "6,4 mm"],
]

const stations = [
  {
    name: "Estação Norte",
    status: "ONLINE",
    ago: "há 4 minutos",
    moisture: "42%",
  },
  {
    name: "Estação Centro",
    status: "ONLINE",
    ago: "há 7 minutos",
    moisture: "31%",
  },
  {
    name: "Estação Sul",
    status: "OFFLINE",
    ago: "há 2h 14min",
    moisture: "27%",
  },
]

function Button({
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

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo${compact ? " logo-compact" : ""}`}>
      <div className="logo-mark">
        <Sprout size={compact ? 20 : 28} strokeWidth={2.4} />
        <span className="signal signal-a" />
        <span className="signal signal-b" />
      </div>
      {!compact && (
        <div>
          <strong>AgroSense</strong>
          <span>decisões que cultivam</span>
        </div>
      )}
    </div>
  )
}

function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <div>
        <RadioTower size={13} />
        <Wifi size={13} />
        <span className="battery">87</span>
      </div>
    </div>
  )
}

function TopBar({
  title,
  subtitle,
  back,
  onBack,
  action,
}: {
  title: string
  subtitle?: string
  back?: boolean
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <header className="top-bar">
      <div className="top-leading">
        {back ? (
          <button className="icon-button" onClick={onBack} aria-label="Voltar">
            <ArrowLeft size={21} />
          </button>
        ) : (
          <Logo compact />
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action || (
        <button
          className="icon-button notification-button"
          aria-label="Notificações"
        >
          <Bell size={20} />
          <span />
        </button>
      )}
    </header>
  )
}

function BottomNav({
  screen,
  go,
}: {
  screen: Screen
  go: (screen: Screen) => void
}) {
  const items: {
    label: string
    icon: IconType
    screen: Screen
    badge?: string
  }[] = [
    { label: "Início", icon: Home, screen: "home" },
    { label: "Áreas", icon: Map, screen: "areas" },
    { label: "Clima", icon: CloudRain, screen: "weather" },
    { label: "Alertas", icon: Bell, screen: "alerts", badge: "2" },
    { label: "Perfil", icon: User, screen: "profile" },
  ]
  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const active =
          screen === item.screen ||
          (item.screen === "areas" &&
            ["area", "station", "new-area", "new-station", "crop"].includes(
              screen,
            )) ||
          (item.screen === "weather" && screen === "weather-detail")
        const Icon = item.icon
        return (
          <button
            key={item.label}
            className={active ? "active" : ""}
            onClick={() => go(item.screen)}
          >
            <span className="nav-icon">
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              {item.badge && <i>{item.badge}</i>}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function AppShell({
  children,
  screen,
  go,
  noNav = false,
}: {
  children: ReactNode
  screen: Screen
  go: (screen: Screen) => void
  noNav?: boolean
}) {
  return (
    <div className="app-shell">
      <StatusBar />
      <main className={noNav ? "app-content no-nav" : "app-content"}>
        {children}
      </main>
      {!noNav && <BottomNav screen={screen} go={go} />}
    </div>
  )
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: string
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "green",
}: {
  icon: IconType
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${tone}`}>
        <Icon size={19} />
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AreaCard({
  area,
  open,
}: {
  area: typeof areas[number]
  open: () => void
}) {
  return (
    <article className="area-card" onClick={open}>
      <div className="area-card-head">
        <div className="crop-icon">
          <Leaf size={22} />
        </div>
        <div className="area-title">
          <h3>{area.name}</h3>
          <p>
            {area.crop} · {area.stations} estações
          </p>
        </div>
        <ChevronRight size={20} className="muted" />
      </div>
      <div className="status-row">
        <Badge tone="success">{area.online} online</Badge>
        {area.offline > 0 && (
          <Badge tone="danger">
            <AlertCircle size={13} /> {area.offline} offline
          </Badge>
        )}
      </div>
      <div className="area-stats">
        <div>
          <span>Umidade média</span>
          <strong>{area.moisture}%</strong>
          <div className="progress">
            <i style={{ width: `${area.moisture}%` }} />
          </div>
        </div>
        <div>
          <span>Clima da área</span>
          <strong>
            {area.temperature}°{" "}
            <small>
              <CloudRain size={14} /> {area.rain}%
            </small>
          </strong>
          <p>Chuva: {area.nextRain}</p>
        </div>
      </div>
      <div className={`recommend-strip ${area.tone}`}>
        <div>
          <span>Recomendação</span>
          <strong>{area.recommendation}</strong>
        </div>
        <span className="round-arrow">
          <ChevronRight size={17} />
        </span>
      </div>
      {area.offline > 0 && (
        <div className="inline-alert">
          <WifiOff size={16} />
          <span>
            <strong>Estação Sul offline</strong> · há 2h 14min
          </span>
        </div>
      )}
    </article>
  )
}

function Login({ go, onLogin }: { go: (screen: Screen) => void, onLogin: (u: AuthUser) => void }) {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError("")
    setLoading(true)
    try {
      const user = await bridgeService.login(email, password)
      onLogin(user)
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell screen="login" go={go} noNav>
      <section className="auth-hero">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <Logo />
        <div className="hero-visual">
          <div className="sun-dot" />
          <div className="field-line field-a" />
          <div className="field-line field-b" />
          <div className="field-line field-c" />
          <RadioTower size={42} />
          <span className="radio-wave wave-a" />
          <span className="radio-wave wave-b" />
        </div>
      </section>
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-copy">
          <span className="eyebrow">MONITORAMENTO INTELIGENTE</span>
          <h1>Bem-vindo de volta</h1>
          <p>Acompanhe sua lavoura e irrigue com mais confiança.</p>
        </div>
        {error && (
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        <label className="field">
          <span>E-mail</span>
          <div>
            <Mail size={18} />
            <input
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              placeholder="Sua senha"
              type={visible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="field-action"
              onClick={() => setVisible(!visible)}
              aria-label="Mostrar senha"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <button type="button" className="text-link align-right">Esqueci minha senha</button>
        <Button full type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        <p className="auth-switch">
          Ainda não tem conta?{" "}
          <button type="button" onClick={() => go("register")}>Criar conta</button>
        </p>
      </form>
    </AppShell>
  )
}

function Register({ go, onLogin }: { go: (screen: Screen) => void, onLogin: (u: AuthUser) => void }) {
  const [name, setName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError("")
    setSuccessMsg("")
    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }
    setLoading(true)
    try {
      const result = await bridgeService.signup(email, password, name, lastName)
      setPassword("")
      setConfirm("")
      if (result.user) onLogin(result.user)
      else setSuccessMsg("Cadastro recebido. Verifique seu e-mail para confirmar a conta e depois faça login.")
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell screen="register" go={go} noNav>
      <TopBar
        title="Criar conta"
        subtitle="Comece a monitorar sua produção"
        back
        onBack={() => go("login")}
        action={<span />}
      />
      <form className="form-page" onSubmit={handleSubmit}>
        <div className="form-intro">
          <div className="intro-icon">
            <Sprout size={26} />
          </div>
          <h2>Sua lavoura, mais conectada</h2>
          <p>Leva menos de um minuto para começar.</p>
        </div>
        {error && (
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="resolved-alert" style={{ marginBottom: 14 }}>
            <Check size={16} />
            <strong>{successMsg}</strong>
          </div>
        )}
        <label className="field">
          <span>Nome</span>
          <div>
            <User size={18} />
            <input
              placeholder="Como podemos chamar você?"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Sobrenome</span>
          <div>
            <User size={18} />
            <input
              placeholder="Seu sobrenome"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>E-mail</span>
          <div>
            <Mail size={18} />
            <input
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
        </label>
        <label className="field">
          <span>Senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              placeholder="Mínimo de 8 caracteres"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </label>
        <label className="field">
          <span>Confirmar senha</span>
          <div>
            <LockKeyhole size={18} />
            <input
              placeholder="Repita sua senha"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
        </label>
        <Button full type="submit" disabled={loading}>
          {loading ? "Cadastrando..." : "Criar conta"}
        </Button>
        <p className="terms">
          Ao continuar, você concorda com nossos Termos de Uso e Política de
          Privacidade.
        </p>
      </form>
    </AppShell>
  )
}

function HomeScreen({ go, user }: { go: (screen: Screen) => void, user: AuthUser | null }) {
  return (
    <AppShell screen="home" go={go}>
      <TopBar title={`Olá, ${user?.firstName || 'Produtor'}`} subtitle="Hoje" />
      <section className="page">
        <button className="attention-banner" onClick={() => go("alerts")}>
          <span>
            <AlertCircle size={21} />
          </span>
          <div>
            <strong>2 alertas precisam da sua atenção</strong>
            <p>1 estação offline e 1 umidade crítica</p>
          </div>
          <ChevronRight size={20} />
        </button>
        <div className="summary-weather">
          <div>
            <span>VISÃO GERAL</span>
            <strong>Como estão suas áreas hoje</strong>
          </div>
          <div className="mini-summary">
            <span>
              <Check size={15} /> 1 estável
            </span>
            <span>
              <Droplets size={15} /> 1 irrigar
            </span>
          </div>
        </div>
        <div className="section-title">
          <div>
            <span>MINHAS ÁREAS</span>
            <p>3 áreas cadastradas</p>
          </div>
          <button onClick={() => go("areas")}>Ver todas</button>
        </div>
        <div className="cards-stack">
          {areas.slice(0, 2).map((area) => (
            <AreaCard key={area.name} area={area} open={() => go("area")} />
          ))}
        </div>
        <Button
          variant="secondary"
          icon={Plus}
          full
          onClick={() => go("new-area")}
        >
          Nova área
        </Button>
      </section>
    </AppShell>
  )
}

function AreasScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="areas" go={go}>
      <TopBar
        title="Áreas"
        subtitle="3 áreas · 9 estações"
        action={
          <button className="icon-button" onClick={() => go("new-area")}>
            <Plus size={21} />
          </button>
        }
      />
      <section className="page">
        <div className="filter-row">
          <button className="chip active">Todas</button>
          <button className="chip">Precisam de ação</button>
          <button className="chip">Normais</button>
        </div>
        <div className="cards-stack">
          {areas.map((area) => (
            <AreaCard key={area.name} area={area} open={() => go("area")} />
          ))}
        </div>
      </section>
    </AppShell>
  )
}

function RecommendationCard() {
  return (
    <article className="recommend-card">
      <div className="recommend-top">
        <span className="recommend-icon">
          <CloudRain size={25} />
        </span>
        <div>
          <span>RECOMENDAÇÃO DE IRRIGAÇÃO</span>
          <h3>AGUARDAR CHUVA</h3>
        </div>
      </div>
      <p>
        A umidade média do solo está abaixo do recomendado para o milho, porém
        há alta probabilidade de chuva significativa nas próximas horas.
      </p>
      <div className="recommend-grid">
        <div>
          <span>Umidade atual</span>
          <strong>31%</strong>
        </div>
        <div>
          <span>Limite recomendado</span>
          <strong>35%</strong>
        </div>
        <div>
          <span>Próxima chuva</span>
          <strong>3h 40min</strong>
        </div>
        <div>
          <span>Precipitação</span>
          <strong>11,4 mm</strong>
        </div>
      </div>
      <div className="reason">
        <Check size={16} />
        <span>É seguro aguardar a precipitação prevista antes de irrigar.</span>
      </div>
    </article>
  )
}

function HourlyForecast() {
  return (
    <div className="hourly">
      {hourly.map(([time, rain, mm], index) => (
        <div key={time} className={index === 3 ? "peak" : ""}>
          <strong>{time}</strong>
          {index < 2 ? <Sun size={20} /> : <CloudRain size={20} />}
          <span>{rain}</span>
          <small>{mm}</small>
        </div>
      ))}
    </div>
  )
}

function AreaScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="area" go={go}>
      <TopBar
        title="Talhão Norte"
        subtitle="Milho · 3 estações"
        back
        onBack={() => go("areas")}
        action={
          <button className="icon-button">
            <MoreHorizontal size={21} />
          </button>
        }
      />
      <section className="page">
        <div className="area-overview">
          <div>
            <span className="area-symbol">
              <Leaf size={25} />
            </span>
            <div>
              <span>STATUS DA ÁREA</span>
              <strong>Atenção necessária</strong>
            </div>
          </div>
          <Badge tone="danger">1 offline</Badge>
        </div>
        <div className="section-title">
          <div>
            <span>CONDIÇÃO DA ÁREA</span>
            <p>Atualizado há 4 min</p>
          </div>
        </div>
        <div className="metrics-grid">
          <Metric icon={Droplets} label="Umidade do solo" value="34%" />
          <Metric
            icon={Thermometer}
            label="Temperatura"
            value="27°C"
            tone="orange"
          />
          <Metric icon={Wind} label="Umidade do ar" value="66%" tone="blue" />
          <Metric icon={Gauge} label="Pressão" value="1012 hPa" tone="purple" />
        </div>
        <RecommendationCard />
        <article className="weather-card" onClick={() => go("weather-detail")}>
          <div className="weather-card-head">
            <div>
              <span>CLIMA DESTA ÁREA</span>
              <h3>Clima do Talhão Norte</h3>
            </div>
            <CloudRain size={31} />
          </div>
          <div className="weather-main">
            <strong>27°</strong>
            <div>
              <b>Chuva às 21:00</b>
              <span>82% de chance · 11,4 mm</span>
            </div>
          </div>
          <div className="location-note">
            <MapPin size={14} /> Previsão baseada na localização das estações
          </div>
          <HourlyForecast />
        </article>
        <div className="section-title">
          <div>
            <span>ESTAÇÕES</span>
            <p>2 online · 1 offline</p>
          </div>
          <button onClick={() => go("new-station")}>Adicionar</button>
        </div>
        <div className="station-list">
          {stations.map((station) => (
            <button
              className={`station-card ${station.status.toLowerCase()}`}
              key={station.name}
              onClick={() => station.status === "OFFLINE" && go("station")}
            >
              <span className="station-status-icon">
                {station.status === "ONLINE" ? (
                  <Wifi size={19} />
                ) : (
                  <WifiOff size={19} />
                )}
              </span>
              <div>
                <strong>{station.name}</strong>
                <span>Última leitura: {station.ago}</span>
                <small>
                  Umidade
                  {station.status === "OFFLINE" ? " da última leitura" : ""}:{" "}
                  {station.moisture}
                </small>
              </div>
              <div>
                <Badge
                  tone={station.status === "ONLINE" ? "success" : "danger"}
                >
                  {station.status}
                </Badge>
                <ChevronRight size={18} />
              </div>
            </button>
          ))}
        </div>
        <button className="text-action" onClick={() => go("crop")}>
          <Leaf size={18} />
          <span>Parâmetros da cultura: Milho</span>
          <ChevronRight size={18} />
        </button>
      </section>
    </AppShell>
  )
}

function MiniChart({
  color = "green",
}: {
  color?: "green" | "orange" | "blue" | "purple"
}) {
  return (
    <div className={`chart ${color}`}>
      <span className="grid-line one" />
      <span className="grid-line two" />
      <svg viewBox="0 0 320 100" preserveAspectRatio="none">
        <path
          className="chart-fill"
          d="M0 72 C30 65,42 40,72 50 S112 83,145 57 S195 20,225 42 S270 74,320 28 L320 100 L0 100 Z"
        />
        <path
          className="chart-line"
          d="M0 72 C30 65,42 40,72 50 S112 83,145 57 S195 20,225 42 S270 74,320 28"
        />
      </svg>
      <div className="chart-labels">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>Agora</span>
      </div>
    </div>
  )
}

function StationScreen({ go }: { go: (screen: Screen) => void }) {
  const [period, setPeriod] = useState("24 horas")
  return (
    <AppShell screen="station" go={go}>
      <TopBar
        title="Estação Sul"
        subtitle="Talhão Norte"
        back
        onBack={() => go("area")}
        action={
          <button className="icon-button">
            <Settings size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="offline-hero">
          <span>
            <WifiOff size={27} />
          </span>
          <div>
            <Badge tone="danger">OFFLINE</Badge>
            <h2>Sem comunicação há 2h 14min</h2>
            <p>Última leitura recebida hoje às 14:20</p>
          </div>
        </div>
        <div className="station-location">
          <MapPin size={18} />
          <div>
            <span>Localização da estação</span>
            <strong>-22.9068, -47.0626</strong>
          </div>
          <button>
            <LocateFixed size={18} />
          </button>
        </div>
        <div className="data-warning">
          <AlertCircle size={17} />
          <span>Os valores abaixo correspondem à última leitura recebida.</span>
        </div>
        <div className="metrics-grid">
          <Metric icon={Droplets} label="Umidade do solo" value="27%" />
          <Metric
            icon={Thermometer}
            label="Temperatura"
            value="29,2°C"
            tone="orange"
          />
          <Metric icon={Wind} label="Umidade do ar" value="61%" tone="blue" />
          <Metric icon={Gauge} label="Pressão" value="1010 hPa" tone="purple" />
          <Metric
            icon={RadioTower}
            label="RSSI"
            value="-112 dBm"
            tone="orange"
          />
          <Metric icon={Wifi} label="SNR" value="7,4 dB" tone="blue" />
        </div>
        <div className="section-title">
          <div>
            <span>HISTÓRICO DE LEITURAS</span>
            <p>Últimos dados recebidos</p>
          </div>
        </div>
        <div className="filter-row compact">
          {["24 horas", "7 dias", "30 dias"].map((item) => (
            <button
              key={item}
              className={`chip ${period === item ? "active" : ""}`}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <article className="chart-card">
          <div>
            <span>UMIDADE DO SOLO</span>
            <strong>27%</strong>
            <small>-8% no período</small>
          </div>
          <MiniChart />
        </article>
        <article className="chart-card">
          <div>
            <span>TEMPERATURA</span>
            <strong>29,2°C</strong>
            <small>Máx. 31,8°C</small>
          </div>
          <MiniChart color="orange" />
        </article>
      </section>
    </AppShell>
  )
}

function WeatherScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="weather" go={go}>
      <TopBar title="Clima" subtitle="Previsão individual por área" />
      <section className="page">
        <div className="info-banner">
          <MapPin size={18} />
          <p>
            Cada previsão usa a localização das estações vinculadas àquela área.
          </p>
        </div>
        <div className="section-title">
          <div>
            <span>CLIMA POR ÁREA</span>
            <p>Atualizado agora</p>
          </div>
        </div>
        <div className="climate-list">
          {areas.map((area, index) => (
            <button
              className={`climate-card climate-${index}`}
              key={area.name}
              onClick={() => go("weather-detail")}
            >
              <div className="climate-head">
                <div>
                  <span>{area.crop}</span>
                  <h3>{area.name}</h3>
                </div>
                {index === 1 ? <Sun size={32} /> : <CloudRain size={32} />}
              </div>
              <div className="climate-temp">
                <strong>{area.temperature}°</strong>
                <div>
                  <b>{area.rain}% de chuva</b>
                  <span>Umidade do ar: {index === 1 ? 48 : 66}%</span>
                </div>
              </div>
              <div className="climate-rain">
                <CloudRain size={17} />
                <div>
                  <span>Próxima chuva</span>
                  <strong>{area.nextRain}</strong>
                </div>
                <b>{area.precipitation}</b>
              </div>
              <div className="climate-footer">
                <MapPin size={13} /> Localização própria da área{" "}
                <ChevronRight size={17} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </AppShell>
  )
}

function WeatherDetail({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="weather-detail" go={go}>
      <TopBar
        title="Clima do Talhão Norte"
        subtitle="Previsão específica da área"
        back
        onBack={() => go("weather")}
      />
      <section className="page">
        <article className="weather-hero">
          <div className="weather-hero-top">
            <span>AGORA · PARCIALMENTE NUBLADO</span>
            <CloudRain size={43} />
          </div>
          <div className="weather-hero-temp">
            <strong>27°</strong>
            <div>
              <span>Sensação de 28°</span>
              <b>Máx. 29° · Mín. 19°</b>
            </div>
          </div>
          <div className="weather-details">
            <span>
              <Wind size={16} /> Umidade <b>66%</b>
            </span>
            <span>
              <Gauge size={16} /> Pressão <b>1012 hPa</b>
            </span>
          </div>
        </article>
        <div className="location-confirm">
          <MapPin size={18} />
          <div>
            <strong>Previsão localizada</strong>
            <span>
              Corresponde à localização média das 3 estações desta área.
            </span>
          </div>
          <Check size={18} />
        </div>
        <article className="rain-focus">
          <div className="rain-focus-title">
            <span>
              <CloudRain size={22} />
            </span>
            <div>
              <small>PRÓXIMA CHUVA</small>
              <strong>Hoje às 21:00</strong>
            </div>
          </div>
          <div className="rain-countdown">
            <div>
              <strong>3h 40min</strong>
              <span>até a chuva</span>
            </div>
            <div>
              <strong>82%</strong>
              <span>probabilidade</span>
            </div>
            <div>
              <strong>11,4 mm</strong>
              <span>precipitação</span>
            </div>
          </div>
        </article>
        <div className="section-title">
          <div>
            <span>PREVISÃO HORÁRIA</span>
            <p>Próximas 5 horas</p>
          </div>
        </div>
        <article className="white-card">
          <HourlyForecast />
        </article>
        <div className="section-title">
          <div>
            <span>PRÓXIMOS DIAS</span>
            <p>Previsão para a área</p>
          </div>
        </div>
        <div className="daily-list">
          {[
            ["Hoje", "Chuva à noite", "19°", "29°", "82%"],
            ["Qua", "Chuva moderada", "18°", "25°", "74%"],
            ["Qui", "Parcialmente nublado", "17°", "27°", "22%"],
            ["Sex", "Ensolarado", "18°", "30°", "8%"],
          ].map((day, i) => (
            <div key={day[0]}>
              <strong>{day[0]}</strong>
              {i < 2 ? <CloudRain size={20} /> : <Sun size={20} />}
              <span>{day[1]}</span>
              <small>
                <Droplets size={13} /> {day[4]}
              </small>
              <b>
                {day[2]} / {day[3]}
              </b>
            </div>
          ))}
        </div>
        <div className="et-card">
          <div>
            <Wind size={20} />
            <span>Evapotranspiração ET0</span>
          </div>
          <strong>3,8 mm/dia</strong>
        </div>
      </section>
    </AppShell>
  )
}

function AlertsScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="alerts" go={go}>
      <TopBar
        title="Alertas"
        subtitle="2 ativos precisam de atenção"
        action={
          <button className="icon-button">
            <Check size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="filter-row">
          <button className="chip active">
            Ativos <i>2</i>
          </button>
          <button className="chip">Resolvidos</button>
          <button className="chip">Todos</button>
        </div>
        <div className="alert-group-title">
          <span>CRÍTICOS</span>
          <Badge tone="danger">2 alertas</Badge>
        </div>
        <button className="alert-card critical" onClick={() => go("station")}>
          <span className="alert-icon">
            <WifiOff size={21} />
          </span>
          <div>
            <div>
              <Badge tone="danger">ESTAÇÃO OFFLINE</Badge>
              <small>há 14 min</small>
            </div>
            <h3>Estação Sul offline</h3>
            <p>Sem comunicação há 2h 14min.</p>
            <strong>
              <MapPin size={14} /> Talhão Norte
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <button className="alert-card critical">
          <span className="alert-icon">
            <Droplets size={21} />
          </span>
          <div>
            <div>
              <Badge tone="danger">UMIDADE CRÍTICA</Badge>
              <small>há 36 min</small>
            </div>
            <h3>Umidade do solo em 19%</h3>
            <p>A Estação Centro registrou umidade abaixo do limite.</p>
            <strong>
              <MapPin size={14} /> Fazenda Sul
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="alert-group-title">
          <span>IRRIGAÇÃO</span>
        </div>
        <button className="alert-card irrigation" onClick={() => go("area")}>
          <span className="alert-icon">
            <Droplets size={21} />
          </span>
          <div>
            <div>
              <Badge tone="warning">IRRIGAR</Badge>
              <small>hoje, 08:10</small>
            </div>
            <h3>Irrigação recomendada</h3>
            <p>Não há chuva significativa nas próximas 24 horas.</p>
            <strong>
              <MapPin size={14} /> Fazenda Sul
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="alert-group-title">
          <span>CLIMA</span>
        </div>
        <button
          className="alert-card climate"
          onClick={() => go("weather-detail")}
        >
          <span className="alert-icon">
            <CloudRain size={21} />
          </span>
          <div>
            <div>
              <Badge tone="info">CHUVA PREVISTA</Badge>
              <small>hoje, 07:45</small>
            </div>
            <h3>Chuva nas próximas horas</h3>
            <p>11,4 mm previstos a partir das 21:00.</p>
            <strong>
              <MapPin size={14} /> Talhão Norte
            </strong>
          </div>
          <ChevronRight size={19} />
        </button>
        <div className="resolved-alert">
          <Check size={17} />
          <div>
            <strong>Estação Norte voltou a ficar online</strong>
            <span>Resolvido hoje às 06:32</span>
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function ProfileScreen({ go, user, onLogout }: { go: (screen: Screen) => void, user: AuthUser | null, onLogout: () => void }) {
  const menu = [
    [History, "Histórico de recomendações", "history"],
    [Leaf, "Parâmetros das culturas", "crop"],
    [Settings, "Configurações", "profile"],
    [LockKeyhole, "Alterar senha", "profile"],
  ] as const

  const [logoutError, setLogoutError] = useState("")
  const [loggingOut, setLoggingOut] = useState(false)
  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError("")
    try {
      await bridgeService.logout()
      onLogout()
    } catch (e: unknown) {
      setLogoutError(errorMessage(e))
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <AppShell screen="profile" go={go}>
      <TopBar
        title="Perfil"
        subtitle="Sua conta e configurações"
        action={
          <button className="icon-button">
            <Menu size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="profile-card">
          <div className="avatar">{user?.firstName?.[0] || "U"}{user?.lastName?.[0] || ""}</div>
          <div>
            <h2>{user?.firstName} {user?.lastName}</h2>
            <p>{user?.email}</p>
            <Badge tone="success">Produtor conectado</Badge>
          </div>
          <button>
            <Settings size={18} />
          </button>
        </div>
        <div className="profile-stats">
          <div>
            <strong>3</strong>
            <span>Áreas</span>
          </div>
          <div>
            <strong>9</strong>
            <span>Estações</span>
          </div>
          <div>
            <strong className="green-text">8</strong>
            <span>Online</span>
          </div>
          <div>
            <strong className="red-text">1</strong>
            <span>Offline</span>
          </div>
        </div>
        <div className="section-title">
          <div>
            <span>CONTA E DADOS</span>
          </div>
        </div>
        <div className="menu-list">
          {menu.map(([Icon, label, target]) => (
            <button key={label} onClick={() => go(target)}>
              <span>
                <Icon size={19} />
              </span>
              <strong>{label}</strong>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
        {logoutError && <div className="inline-alert" role="alert">{logoutError}</div>}
        <button className="logout-button" onClick={handleLogout} disabled={loggingOut}>
          <LogOut size={19} /> {loggingOut ? "Saindo..." : "Sair da conta"}
        </button>
        <p className="app-version">
          AgroSense · Versão 1.0.0
          <br />
          Projeto acadêmico de monitoramento agrícola
        </p>
      </section>
    </AppShell>
  )
}

function FormField({
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

function NewArea({ go }: { go: (screen: Screen) => void }) {
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

function NewStation({ go }: { go: (screen: Screen) => void }) {
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

function CropScreen({ go }: { go: (screen: Screen) => void }) {
  return (
    <AppShell screen="crop" go={go}>
      <TopBar
        title="Cultura"
        subtitle="Parâmetros agronômicos"
        back
        onBack={() => go("area")}
        action={
          <button className="icon-button">
            <Settings size={20} />
          </button>
        }
      />
      <section className="page">
        <div className="crop-hero">
          <span>
            <Leaf size={29} />
          </span>
          <div>
            <small>CULTURA ATIVA</small>
            <h2>Milho</h2>
            <p>Zea mays · Talhão Norte</p>
          </div>
        </div>
        <div className="info-banner">
          <AlertCircle size={18} />
          <p>
            Estes parâmetros orientam as recomendações automáticas de irrigação.
          </p>
        </div>
        <div className="parameter-list">
          <div>
            <span>
              <Droplets size={18} /> Umidade mínima
            </span>
            <strong>35%</strong>
          </div>
          <div>
            <span>
              <Droplets size={18} /> Umidade máxima
            </span>
            <strong>65%</strong>
          </div>
          <div>
            <span>
              <CloudRain size={18} /> Precipitação mínima
            </span>
            <strong>5 mm</strong>
          </div>
          <div>
            <span>
              <History size={18} /> Tempo máximo para chuva
            </span>
            <strong>6 horas</strong>
          </div>
          <div>
            <span>
              <Gauge size={18} /> Coeficiente da cultura (Kc)
            </span>
            <strong>1,20</strong>
          </div>
        </div>
        <Button variant="secondary" full>
          Editar parâmetros
        </Button>
      </section>
    </AppShell>
  )
}

function HistoryScreen({ go }: { go: (screen: Screen) => void }) {
  const records = [
    [
      "Hoje · 18:30",
      "Talhão Norte",
      "Milho",
      "AGUARDAR CHUVA",
      "wait",
      "31%",
      "11,4 mm",
      "Há previsão de chuva suficiente nas próximas horas.",
    ],
    [
      "Hoje · 08:10",
      "Fazenda Sul",
      "Café",
      "IRRIGAR",
      "danger",
      "23%",
      "0 mm",
      "Umidade baixa e nenhuma chuva significativa prevista.",
    ],
    [
      "Ontem · 17:45",
      "Horta Leste",
      "Alface",
      "NÃO IRRIGAR",
      "good",
      "58%",
      "4,2 mm",
      "Umidade atual dentro da faixa adequada para o cultivo.",
    ],
  ]
  return (
    <AppShell screen="history" go={go}>
      <TopBar
        title="Histórico"
        subtitle="Recomendações de irrigação"
        back
        onBack={() => go("profile")}
      />
      <section className="page">
        <div className="history-filters">
          <button>
            <Map size={16} /> Todas as áreas <ChevronDown size={15} />
          </button>
          <button>
            <CalendarDays size={16} /> 30 dias <ChevronDown size={15} />
          </button>
        </div>
        <div className="filter-row">
          <button className="chip active">Todas</button>
          <button className="chip">Irrigar</button>
          <button className="chip">Aguardar</button>
        </div>
        <div className="history-list">
          {records.map((item) => (
            <article
              key={item[0] + item[1]}
              className={`history-card ${item[4]}`}
            >
              <div className="history-date">
                <History size={15} /> {item[0]}
              </div>
              <div className="history-head">
                <div>
                  <h3>{item[1]}</h3>
                  <span>{item[2]}</span>
                </div>
                <Badge
                  tone={
                    item[4] === "danger"
                      ? "danger"
                      : item[4] === "good"
                        ? "success"
                        : "warning"
                  }
                >
                  {item[3]}
                </Badge>
              </div>
              <div className="history-metrics">
                <span>
                  Umidade média <strong>{item[5]}</strong>
                </span>
                <span>
                  Precipitação <strong>{item[6]}</strong>
                </span>
              </div>
              <div className="history-reason">
                <strong>Motivo</strong>
                <p>{item[7]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  )
}

const allowedScreens: Screen[] = ["login", "register", "home", "areas", "area", "station", "weather", "weather-detail", "alerts", "profile", "new-area", "new-station", "crop", "history"]
const isPublicScreen = (screen: Screen) => screen === "login" || screen === "register"

export default function App() {
  const [screen, setScreen] = useState<Screen>("login")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState("")

  const navigate = (next: Screen, replace = false) => {
    if (replace) window.history.replaceState(null, "", `#${next}`)
    else window.history.pushState({ screen: next }, "", `#${next}`)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  // A sessão é restaurada uma vez; mudanças de hash nunca liberam telas privadas.
  useEffect(() => {
    let active = true
    bridgeService.getSession().then(session => { if (active) setUser(session) })
      .catch((error: unknown) => { if (active) setSessionError(errorMessage(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (loading) return
    const update = () => {
      const hash = window.location.hash.slice(1)
      const requested = allowedScreens.find(item => item === hash) || (user ? "home" : "login")
      const safe = !user && !isPublicScreen(requested) ? "login" : user && isPublicScreen(requested) ? "home" : requested
      navigate(safe, true)
    }
    update()
    window.addEventListener("popstate", update)
    window.addEventListener("hashchange", update)
    return () => { window.removeEventListener("popstate", update); window.removeEventListener("hashchange", update) }
  }, [user, loading])

  const go = (next: Screen) => navigate(!user && !isPublicScreen(next) ? "login" : user && isPublicScreen(next) ? "home" : next)
  const handleLogin = (newUser: AuthUser) => { setSessionError(""); setUser(newUser); navigate("home", true) }
  const handleLogout = () => { setUser(null); navigate("login", true) }
  if (loading) return <div className="session-loading">Carregando...</div>

  const screens: Record<Screen, ReactNode> = {
    login: <Login go={go} onLogin={handleLogin} />,
    register: <Register go={go} onLogin={handleLogin} />,
    home: <HomeScreen go={go} user={user} />,
    areas: <AreasScreen go={go} />,
    area: <AreaScreen go={go} />,
    station: <StationScreen go={go} />,
    weather: <WeatherScreen go={go} />,
    "weather-detail": <WeatherDetail go={go} />,
    alerts: <AlertsScreen go={go} />,
    profile: <ProfileScreen go={go} user={user} onLogout={handleLogout} />,
    "new-area": <NewArea go={go} />,
    "new-station": <NewStation go={go} />,
    crop: <CropScreen go={go} />,
    history: <HistoryScreen go={go} />,
  }
  const visible = !user && !isPublicScreen(screen) ? "login" : screen
  return <>{sessionError && <div className="session-error" role="alert">{sessionError}</div>}{screens[visible]}</>
}
