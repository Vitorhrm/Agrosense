import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { AuthUser } from "../features/auth/auth.types"
const cloud = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock("../lib/supabase", () => ({ getSupabase: () => cloud }))
const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }))
vi.mock("../features/auth/auth.service", () => ({ authService: mocks }))
import App from "./App"
const user: AuthUser = { id: "test", email: "test@example.com", firstName: "Ana", lastName: "Silva" }
let listener: (user: AuthUser | null) => void
beforeEach(() => {
  window.history.replaceState(null, "", "/")
  mocks.subscribe.mockImplementation(callback => { listener = callback; callback(null); return vi.fn() })
})
it.each(["profile", "new-station"])("bloqueia acesso por hash à rota privada %s", async route => {
  window.history.replaceState(null, "", `/#${route}`)
  render(<App />)
  expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument()
  expect(window.location.hash).toBe("#login")
})
it("faz login e volta ao login quando a sessão expira", async () => {
  mocks.login.mockResolvedValue(user)
  render(<App />)
  const actions = userEvent.setup()
  await actions.type(screen.getByPlaceholderText("seu@email.com"), user.email)
  await actions.type(screen.getByPlaceholderText("Sua senha"), "senha-segura")
  await actions.click(screen.getByRole("button", { name: "Entrar" }))
  expect(await screen.findByRole("heading", { name: "Olá, Ana" })).toBeInTheDocument()
  act(() => listener(null))
  expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument()
})
it("apresenta erro de rede e libera nova tentativa", async () => {
  mocks.login.mockRejectedValue(new Error("Failed to fetch"))
  render(<App />)
  const actions = userEvent.setup()
  await actions.type(screen.getByPlaceholderText("seu@email.com"), user.email)
  await actions.type(screen.getByPlaceholderText("Sua senha"), "senha-segura")
  await actions.click(screen.getByRole("button", { name: "Entrar" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Verifique sua internet")
  expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled()
})
it("não envia cadastro com senhas diferentes", async () => {
  render(<App />)
  const actions = userEvent.setup()
  await actions.click(screen.getByRole("button", { name: "Criar conta" }))
  await actions.type(screen.getByPlaceholderText("Como podemos chamar você?"), "Ana")
  await actions.type(screen.getByPlaceholderText("Seu sobrenome"), "Silva")
  await actions.type(screen.getByPlaceholderText("seu@email.com"), user.email)
  await actions.type(screen.getByPlaceholderText("Mínimo de 8 caracteres"), "senha-segura")
  await actions.type(screen.getByPlaceholderText("Repita sua senha"), "senha-diferente")
  await actions.click(screen.getByRole("button", { name: "Criar conta" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("As senhas não coincidem")
  expect(mocks.signup).not.toHaveBeenCalled()
})
it("restaura sessão e faz logout no perfil", async () => {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  mocks.logout.mockResolvedValue(undefined)
  render(<App />)
  const actions = userEvent.setup()
  await actions.click(await screen.findByRole("button", { name: "Perfil" }))
  expect(screen.getByText(user.email)).toBeInTheDocument()
  await actions.click(screen.getByRole("button", { name: "Sair da conta" }))
  await waitFor(() => expect(window.location.hash).toBe("#login"))
})

const area = { id: "area-1", name: "Talhão cadastrado", crop: "Tomate", latitude: null as number | null, longitude: null as number | null }

function signedInAreas(areas = [area], station: { node: string; latitude: number | null; longitude: number | null } | null = null) {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  cloud.from.mockImplementation(table => ({
    select: () => ({
      order: () => ({ abortSignal: async () => ({ data: table === "agro_areas" ? areas : [], error: null }) }),
      eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: station, error: null }) }) }),
    }),
  }))
}

afterEach(() => vi.unstubAllGlobals())

it("carrega áreas da conta pelo menu principal", async () => {
  signedInAreas()
  render(<App />)
  const actions = userEvent.setup()
  await actions.click(await screen.findByRole("button", { name: "Áreas" }))
  expect(await screen.findByRole("textbox", { name: "Nome da área" })).toHaveValue(area.name)
  expect(screen.getByRole("textbox", { name: "Cultura" })).toHaveValue(area.crop)
  expect(cloud.from).toHaveBeenCalledWith("agro_areas")
  expect(screen.queryByText("Horta Leste")).not.toBeInTheDocument()
})

it("consulta a previsão pela primeira Station, mesmo com coordenadas manuais cadastradas", async () => {
  signedInAreas([{ ...area, latitude: 0, longitude: 0 }], { node: "station1", latitude: -20.52, longitude: -43.69 })
  const fetchForecast = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ fetched_at: "2026-11-12T12:00:00Z", daily: [
      { date: "2026-11-12", temp_min_c: 17, temp_max_c: 24, precipitation_probability_pct: 80, precipitation_mm: 12 },
    ] }),
  })
  vi.stubGlobal("fetch", fetchForecast)
  render(<App />)
  await userEvent.click(await screen.findByRole("button", { name: "Clima" }))
  expect(await screen.findByText("17 a 24 °C")).toBeInTheDocument()
  expect(screen.getByText("Localização: Station station1")).toBeInTheDocument()
  expect(fetchForecast.mock.calls[0][0].pathname).toBe("/api/forecast")
  expect(fetchForecast.mock.calls[0][0].search).toBe("?lat=-20.520&lon=-43.690")
})

it("não consulta previsão sem coordenadas cadastradas", async () => {
  signedInAreas()
  const fetchForecast = vi.fn()
  vi.stubGlobal("fetch", fetchForecast)
  render(<App />)
  await userEvent.click(await screen.findByRole("button", { name: "Clima" }))
  expect(await screen.findByText(/Cadastre as coordenadas desta área/)).toBeInTheDocument()
  expect(fetchForecast).not.toHaveBeenCalled()
})
