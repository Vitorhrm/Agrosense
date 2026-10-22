/** Dados de demonstração do protótipo; ainda não são leituras do Supabase. */
export const areas = [
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

export const hourly = [
  ["18h", "21%", "0 mm"],
  ["19h", "35%", "0 mm"],
  ["20h", "61%", "1,2 mm"],
  ["21h", "82%", "5,8 mm"],
  ["22h", "89%", "6,4 mm"],
]

export const stations = [
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

