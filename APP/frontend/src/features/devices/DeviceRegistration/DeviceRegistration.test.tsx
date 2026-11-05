import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"
import { DeviceRegistration } from "./DeviceRegistration"

it("abre as duas opções e simula configuração do transmissor sem expor a senha", async () => {
  render(<DeviceRegistration areaName="Fazenda Sul" />)
  const actions = userEvent.setup()
  await actions.click(
    screen.getByRole("button", { name: "Cadastrar dispositivo" }),
  )
  expect(
    screen.getByRole("button", { name: /Cadastrar estação/ }),
  ).toBeInTheDocument()
  await actions.click(
    screen.getByRole("button", { name: /Cadastrar transmissor/ }),
  )
  expect(screen.getByText("Fazenda Sul")).toBeInTheDocument()
  await actions.click(
    screen.getByRole("button", { name: "Buscar via Bluetooth (simulação)" }),
  )
  await actions.click(
    screen.getByRole("button", { name: /ESP32-Transmissor-01/ }),
  )
  expect(
    screen.getByRole("button", { name: "Concluir simulação" }),
  ).toBeDisabled()
  await actions.type(
    screen.getByLabelText("Nome da rede Wi-Fi (SSID)"),
    "Fazenda-exemplo",
  )
  await actions.type(screen.getByLabelText("Senha do Wi-Fi"), "senha-ficticia")
  await actions.type(
    screen.getByLabelText("Identificador da rede LoRa"),
    "AGRO-TX-01",
  )
  await actions.click(
    screen.getByRole("button", { name: "Concluir simulação" }),
  )
  expect(screen.getByRole("status")).toHaveTextContent("Simulação concluída")
  expect(screen.getByRole("status")).toHaveTextContent(
    "Nenhum cadastro foi salvo ou enviado ao ESP32",
  )
  expect(screen.queryByText("senha-ficticia")).not.toBeInTheDocument()
  await actions.click(
    screen.getByRole("button", { name: "Voltar para a área" }),
  )
  expect(
    screen.getByRole("button", { name: "Cadastrar dispositivo" }),
  ).toBeInTheDocument()
})

it("exige nome e seleção do transmissor LoRa no cadastro da estação", async () => {
  render(<DeviceRegistration areaName="Horta Leste" initialKind="station" />)
  const actions = userEvent.setup()
  await actions.click(
    screen.getByRole("button", { name: "Buscar via Bluetooth (simulação)" }),
  )
  await actions.click(screen.getByRole("button", { name: /ESP32-Estacao-01/ }))
  await actions.type(screen.getByLabelText("Nome da estação"), "Estação Horta")
  expect(
    screen.getByRole("button", { name: "Concluir simulação" }),
  ).toBeDisabled()
  await actions.click(
    screen.getByRole("button", {
      name: "Buscar transmissores LoRa (simulação)",
    }),
  )
  await actions.click(screen.getByRole("radio", { name: /AGRO-TX-02/ }))
  await actions.click(
    screen.getByRole("button", { name: "Concluir simulação" }),
  )
  expect(screen.getByRole("status")).toHaveTextContent("Estação Horta")
  expect(screen.getByRole("status")).toHaveTextContent("AGRO-TX-02")
  expect(screen.getByRole("status")).toHaveTextContent("Horta Leste")
})

it("descarta campos ao voltar e mudar o tipo do dispositivo", async () => {
  render(<DeviceRegistration areaName="Talhão Norte" />)
  const actions = userEvent.setup()
  await actions.click(
    screen.getByRole("button", { name: "Cadastrar dispositivo" }),
  )
  await actions.click(
    screen.getByRole("button", { name: /Cadastrar transmissor/ }),
  )
  await actions.click(
    screen.getByRole("button", { name: "Buscar via Bluetooth (simulação)" }),
  )
  await actions.click(
    screen.getByRole("button", { name: /ESP32-Transmissor-01/ }),
  )
  await actions.type(
    screen.getByLabelText("Senha do Wi-Fi"),
    "teste-descartado",
  )
  await actions.click(
    screen.getByRole("button", { name: "Voltar à busca Bluetooth" }),
  )
  await actions.click(screen.getByRole("button", { name: "Voltar às opções" }))
  await actions.click(screen.getByRole("button", { name: /Cadastrar estação/ }))
  await actions.click(
    screen.getByRole("button", { name: "Buscar via Bluetooth (simulação)" }),
  )
  expect(screen.queryByText("ESP32-Transmissor-01")).not.toBeInTheDocument()
  expect(screen.getByText("ESP32-Estacao-01")).toBeInTheDocument()
})
