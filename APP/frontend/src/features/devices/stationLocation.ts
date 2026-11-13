export type StationLocation = { latitude: number; longitude: number }

// Solicita uma leitura nova no local da instalação, sem bloquear o cadastro se o GPS falhar.
export function captureStationLocation(): Promise<StationLocation | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined)
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => resolve(undefined), 12000)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      window.clearTimeout(timeout)
      resolve({ latitude: coords.latitude, longitude: coords.longitude })
    }, () => {
      window.clearTimeout(timeout)
      resolve(undefined)
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
  })
}
