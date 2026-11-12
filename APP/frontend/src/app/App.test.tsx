import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import type { AuthUser } from "../features/auth/auth.types"
const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }))
vi.mock("../features/auth/auth.service", () => ({ authService: mocks }))
import App from "./App"
const user: AuthUser = { id: "test", email: "test@example.com", firstName: "Ana", lastName: "Silva" }
let listener: (user: AuthUser | null) => void
beforeEach(() => {
  window.history.replaceState(null, "", "/")
  mocks.subscribe.mockImplementation(callback => { listener = callback; callback(null); return vi.fn() })
})
it("bloqueia acesso por hash a uma tela privada", async () => {
  window.history.replaceState(null, "", "/#profile")
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


it("mantém a área selecionada ao abrir o cadastro da estação", async () => {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  render(<App />)
  const actions = userEvent.setup()
  await actions.click(await screen.findByRole("button", { name: "Áreas" }))
  await actions.click(screen.getByRole("button", { name: "Abrir Horta Leste" }))
  expect(screen.getByRole("heading", { name: "Horta Leste" })).toBeInTheDocument()
  await actions.click(screen.getByRole("button", { name: "Cadastrar dispositivo" }))
  expect(screen.getByRole("region", { name: "Cadastro de dispositivo em Horta Leste" })).toBeInTheDocument()
  await actions.click(screen.getByRole("button", { name: "Fechar cadastro" }))
  await actions.click(screen.getByRole("button", { name: "Adicionar" }))
  expect(screen.getByRole("region", { name: "Cadastro de dispositivo em Horta Leste" })).toBeInTheDocument()
  expect(window.history.state.areaName).toBe("Horta Leste")
})


it("abre uma área pelo teclado", async () => {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  const actions = userEvent.setup()
  render(<App />)
  await actions.click(await screen.findByRole("button", { name: "Áreas" }))
  const card = screen.getByRole("button", { name: "Abrir Fazenda Sul" })
  card.focus()
  await actions.keyboard("{Enter}")
  expect(window.history.state.areaName).toBe("Fazenda Sul")
  expect(screen.getByRole("heading", { name: "Fazenda Sul", level: 1 })).toBeInTheDocument()
})

it("abre a previsão da área escolhida e mantém o contexto no histórico", async () => {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  const actions = userEvent.setup()
  render(<App />)
  await actions.click(await screen.findByRole("button", { name: "Clima" }))
  await actions.click(screen.getByRole("heading", { name: "Fazenda Sul" }))
  expect(screen.getByRole("heading", { name: "Clima de Fazenda Sul" })).toBeInTheDocument()
  expect(screen.getByText("31°")).toBeInTheDocument()
  expect(window.history.state.areaName).toBe("Fazenda Sul")
})

it("abre a área do alerta de irrigação", async () => {
  mocks.subscribe.mockImplementation(callback => { callback(user); return vi.fn() })
  const actions = userEvent.setup()
  render(<App />)
  await actions.click(await screen.findByRole("button", { name: /2 alertas precisam/ }))
  await actions.click(screen.getByRole("heading", { name: "Irrigação recomendada" }))
  expect(screen.getByRole("heading", { name: "Fazenda Sul", level: 1 })).toBeInTheDocument()
  expect(screen.getByText("4 online · 0 offline")).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "IRRIGAR" })).toBeInTheDocument()
  expect(screen.queryByText("Estação Sul")).not.toBeInTheDocument()
})
