import { useEffect, useState, type ReactNode } from "react"
import type { Screen } from "../types/navigation"
import type { AuthUser } from "../features/auth/auth.types"
import { authService } from "../features/auth/auth.service"
import { errorMessage } from "../features/auth/auth.errors"
import "./App.css"
import { areas } from "../data/demo"
import { WeatherScreen } from "../screens/WeatherScreen/WeatherScreen"
import { HistoryScreen } from "../screens/HistoryScreen/HistoryScreen"
import { Register } from "../screens/Register/Register"
import { AlertsScreen } from "../screens/AlertsScreen/AlertsScreen"
import { WeatherDetail } from "../screens/WeatherDetail/WeatherDetail"
import { NewStation } from "../screens/NewStation/NewStation"
import { CropScreen } from "../screens/CropScreen/CropScreen"
import { Login } from "../screens/Login/Login"
import { ProfileScreen } from "../screens/ProfileScreen/ProfileScreen"
import { AreasScreen } from "../screens/AreasScreen/AreasScreen"
import { HomeScreen } from "../screens/HomeScreen/HomeScreen"
import { StationScreen } from "../screens/StationScreen/StationScreen"
import { AreaScreen } from "../screens/AreaScreen/AreaScreen"
import { NewArea } from "../screens/NewArea/NewArea"

const allowedScreens: Screen[] = ["login", "register", "home", "areas", "area", "station", "weather", "weather-detail", "alerts", "profile", "new-area", "new-station", "crop", "history"]
const isPublicScreen = (screen: Screen) => screen === "login" || screen === "register"

export default function App() {
  const [selectedArea, setSelectedArea] = useState(() => areas.find(area => area.name === window.history.state?.areaName) ?? areas[0])
  const [screen, setScreen] = useState<Screen>("login")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState("")

  const navigate = (next: Screen, replace = false, areaName = selectedArea.name) => {
    if (replace) window.history.replaceState({ screen: next, areaName }, "", `#${next}`)
    else window.history.pushState({ screen: next, areaName }, "", `#${next}`)
    setScreen(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  // O evento INITIAL_SESSION também restaura a sessão ao reabrir o aplicativo.
  useEffect(() => {
    try {
      return authService.subscribe(session => {
        setUser(session)
        setLoading(false)
      })
    } catch (error: unknown) {
      setSessionError(errorMessage(error))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const update = () => {
      const hash = window.location.hash.slice(1)
      const requested = allowedScreens.find(item => item === hash) || (user ? "home" : "login")
      const safe = !user && !isPublicScreen(requested) ? "login" : user && isPublicScreen(requested) ? "home" : requested
      const area = areas.find(item => item.name === window.history.state?.areaName) ?? areas[0]
      setSelectedArea(area)
      navigate(safe, true, area.name)
    }
    update()
    window.addEventListener("popstate", update)
    window.addEventListener("hashchange", update)
    return () => { window.removeEventListener("popstate", update); window.removeEventListener("hashchange", update) }
  }, [user, loading])

  const go = (next: Screen) => navigate(!user && !isPublicScreen(next) ? "login" : user && isPublicScreen(next) ? "home" : next)
  const openArea = (name: string) => {
    const area = areas.find(item => item.name === name) ?? areas[0]
    setSelectedArea(area)
    navigate("area", false, area.name)
  }
  const handleLogin = (newUser: AuthUser) => { setSessionError(""); setUser(newUser); navigate("home", true) }
  const handleLogout = () => { setUser(null); navigate("login", true) }
  if (loading) return <div className="session-loading">Carregando...</div>

  const screens: Record<Screen, ReactNode> = {
    login: <Login go={go} onLogin={handleLogin} />,
    register: <Register go={go} onLogin={handleLogin} />,
    home: <HomeScreen go={go} user={user} onOpenArea={openArea} />,
    areas: <AreasScreen go={go} onOpenArea={openArea} />,
    area: <AreaScreen key={selectedArea.name} go={go} area={selectedArea} />,
    station: <StationScreen go={go} />,
    weather: <WeatherScreen go={go} />,
    "weather-detail": <WeatherDetail go={go} />,
    alerts: <AlertsScreen go={go} />,
    profile: <ProfileScreen go={go} user={user} onLogout={handleLogout} />,
    "new-area": <NewArea go={go} />,
    "new-station": <NewStation go={go} areaName={selectedArea.name} />,
    crop: <CropScreen go={go} />,
    history: <HistoryScreen go={go} />,
  }
  const visible = !user && !isPublicScreen(screen) ? "login" : screen
  return <>{sessionError && <div className="session-error" role="alert">{sessionError}</div>}{screens[visible]}</>
}
