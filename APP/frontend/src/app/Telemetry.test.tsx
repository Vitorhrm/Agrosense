import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import type { AuthUser } from "../features/auth/auth.types"

const { from, select, order, limit, overrideTypes, abortSignal, subscribe, calibrationQuery, calibrationSelect, calibrationEq, calibrationAbort, readingEq } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), order: vi.fn(), limit: vi.fn(), overrideTypes: vi.fn(), abortSignal: vi.fn(), subscribe: vi.fn(),
  calibrationQuery: vi.fn(), calibrationSelect: vi.fn(), calibrationEq: vi.fn(), calibrationAbort: vi.fn(), readingEq: vi.fn(),
}))
vi.mock("../features/auth/auth.service", () => ({ authService: { subscribe } }))
vi.mock("../lib/supabase", () => ({ getSupabase: () => ({ from }) }))

import App from "./App"

const user: AuthUser = { id: "test", email: "test@example.com", firstName: "Ana", lastName: "Silva" }

beforeEach(() => {
  window.history.replaceState(null, "", "/")
  vi.resetAllMocks()
  subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  from.mockImplementation(table => table === "agro_readings" ? { select } : { select: calibrationSelect })
  select.mockReturnValue({ order, eq: readingEq })
  readingEq.mockReturnValue({ order })
  order.mockReturnValue({ order, limit })
  limit.mockReturnValue({ abortSignal })
  abortSignal.mockReturnValue({ overrideTypes })
  calibrationSelect.mockReturnValue({ eq: calibrationEq })
  calibrationEq.mockReturnValue({ abortSignal: calibrationAbort })
  calibrationAbort.mockReturnValue({ overrideTypes: calibrationQuery })
  calibrationQuery.mockResolvedValue({ data: [], error: null })
})

it("carrega as leituras recentes e atualiza a lista sem mostrar dados de demonstração", async () => {
  overrideTypes.mockResolvedValueOnce({
    error: null,
    data: [
      { id: 2, node: "estacao-1", received_at: "2026-11-12T14:20:00Z", temp_c: 27.2, air_rh_pct: null, pressure_hpa: 1012, soil_raw: 0, soil_enabled: true, signal: "OK" },
      { id: 1, node: "estacao-2", received_at: "2026-11-12T14:00:00Z", temp_c: 26, air_rh_pct: 65, pressure_hpa: null, soil_raw: 0, soil_enabled: false, signal: "OK" },
    ],
  }).mockResolvedValueOnce({ error: null, data: [] })
  const actions = userEvent.setup()
  render(<App />)
  await actions.click(await screen.findByRole("button", { name: /telemetria/i }))
  expect(await screen.findByRole("heading", { name: "estacao-1" })).toBeInTheDocument()
  expect(screen.getByText("27,2 °C")).toBeInTheDocument()
  expect(screen.getByText("0")).toBeInTheDocument()
  expect(screen.getAllByText("Desativado").length).toBeGreaterThan(0)
  expect(screen.getByText("Sem calibração")).toBeInTheDocument()
  expect(screen.queryByText("Dados agrícolas de demonstração")).toBeNull()
  expect(from).toHaveBeenCalledWith("agro_readings")
  expect(order).toHaveBeenCalledWith("received_at", { ascending: false })
  expect(limit).toHaveBeenCalledWith(30)
  await actions.click(screen.getByRole("button", { name: "Atualizar leituras" }))
  expect(await screen.findByText(/nenhuma leitura disponível/i)).toBeInTheDocument()
})

it("permite tentar de novo quando a leitura falha", async () => {
  window.history.replaceState(null, "", "/#telemetry")
  overrideTypes.mockResolvedValueOnce({ error: { message: "network" }, data: null })
    .mockResolvedValueOnce({ error: null, data: [] })
  const actions = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i)
  await actions.click(screen.getByRole("button", { name: "Atualizar leituras" }))
  expect(await screen.findByText(/nenhuma leitura disponível/i)).toBeInTheDocument()
})

it("bloqueia a consulta por hash sem sessão", async () => {
  window.history.replaceState(null, "", "/#telemetry")
  subscribe.mockImplementation(callback => { callback(null); return vi.fn() })
  render(<App />)
  expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument()
  expect(from).not.toHaveBeenCalled()
})

it("exibe o índice de solo somente com referências medidas válidas", async () => {
  window.history.replaceState(null, "", "/#telemetry")
  overrideTypes.mockResolvedValue({
    error: null,
    data: [
      { id: 2, node: "estacao-1", received_at: "2026-11-12T14:20:00Z", temp_c: 27.2, air_rh_pct: null, pressure_hpa: 1012, soil_raw: 2250, soil_enabled: true, signal: "OK" },
      { id: 1, node: "estacao-2", received_at: "2026-11-12T14:00:00Z", temp_c: 26, air_rh_pct: 65, pressure_hpa: null, soil_raw: 0, soil_enabled: true, signal: "OK" },
    ],
  })
  calibrationQuery.mockResolvedValue({
    error: null,
    data: [
      { node: "estacao-1", dry_adc: 3000, wet_adc: 1500 },
      { node: "estacao-2", dry_adc: 1500, wet_adc: 1500 },
    ],
  })
  render(<App />)
  expect(await screen.findByText("50%")).toBeInTheDocument()
  expect(screen.getByText("2.250")).toBeInTheDocument()
  expect(screen.getByText("Sem calibração")).toBeInTheDocument()
  expect(from).toHaveBeenCalledWith("agro_station_access")
  expect(calibrationEq).toHaveBeenCalledWith("user_id", user.id)
  overrideTypes.mockResolvedValueOnce({ error: null, data: [] })
  const actions = userEvent.setup()
  await actions.selectOptions(screen.getByRole("combobox", { name: "Estação" }), "estacao-2")
  expect(readingEq).toHaveBeenCalledWith("node", "estacao-2")
  expect(await screen.findByText(/nenhuma leitura disponível/i)).toBeInTheDocument()
})
