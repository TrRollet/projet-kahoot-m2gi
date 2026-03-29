import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'

const isOnline = ref(true)

let initialized = false

async function initNetwork() {
  if (initialized) return
  initialized = true

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus()
      isOnline.value = status.connected
      Network.addListener('networkStatusChange', (status) => {
        isOnline.value = status.connected
      })
    } catch {
      // Fallback web si le plugin n'est pas disponible en natif
      isOnline.value = navigator.onLine
      window.addEventListener('online', () => { isOnline.value = true })
      window.addEventListener('offline', () => { isOnline.value = false })
    }
  } else {
    isOnline.value = navigator.onLine
    window.addEventListener('online', () => { isOnline.value = true })
    window.addEventListener('offline', () => { isOnline.value = false })
  }
}

initNetwork()

export function useNetwork() {
  return { isOnline }
}
