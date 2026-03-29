import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

export const useSettingsStore = defineStore('settings', () => {
  const themeMode = ref<ThemeMode>(
    (localStorage.getItem('themeMode') as ThemeMode) || 'system'
  )

  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark =
      themeMode.value === 'dark' || (themeMode.value === 'system' && prefersDark)
    document.body.classList.toggle('ion-palette-dark', shouldBeDark)
  }

  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
    localStorage.setItem('themeMode', mode)
    applyTheme()
  }

  function init() {
    applyTheme()
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (themeMode.value === 'system') applyTheme()
      })
  }
  return { themeMode, setTheme, init }
})
