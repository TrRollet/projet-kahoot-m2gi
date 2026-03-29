import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueFire, VueFireAuth } from 'vuefire'
import { firebaseApp } from './firebase/config'
import App from './App.vue'
import { App as CapApp } from '@capacitor/app'
import { SocialLogin } from '@capgo/capacitor-social-login'
import router from './router';
import { useAuthStore } from './stores/auth.store';
import { Capacitor } from '@capacitor/core'

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
import '@ionic/vue/css/palettes/dark.class.css';
/* import '@ionic/vue/css/palettes/dark.system.css'; */

/* Theme variables */
import './theme/variables.css';

import { useSettingsStore } from './stores/settings.store'

const app = createApp(App)
  .use(IonicVue)
  .use(createPinia())
  .use(VueFire, {
    firebaseApp,
    modules: [VueFireAuth()]
  })
  .use(router);

// Initialiser l'authentification
const authStore = useAuthStore()
authStore.initAuthListener()

// Initialiser les parametres
const settingsStore = useSettingsStore()
settingsStore.init()

// Initialiser SocialLogin pour Google Auth (natif seulement)
async function initializeSocialLogin() {
  if (Capacitor.isNativePlatform()) {
    try {
      await SocialLogin.initialize({
        google: {
          webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
        }
      })
      console.log('SocialLogin initialized')
    } catch (error) {
      console.error('Failed to initialize SocialLogin:', error)
    }
  }
}

function navigateToJoin(code: string) {
  router.push(`/tabs/join?code=${code}`)
}

function handleDeepLink(url: string) {
  const match = url.match(/^projet-kahoot:\/\/join\/([A-Za-z0-9]+)/)
  if (!match) return
  // Ne pas naviguer si l'utilisateur est déjà sur la page de jeu
  if (router.currentRoute.value.name === 'GamePage') return
  navigateToJoin(match[1].toUpperCase())
}

router.isReady().then(async () => {
  // Capturer l'URL de deep link EN PREMIER (avant initializeSocialLogin qui peut être lente)
  let coldStartCode: string | undefined
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('appUrlOpen', (event) => handleDeepLink(event.url))
    const launchUrl = await CapApp.getLaunchUrl()
    if (launchUrl?.url) {
      const m = launchUrl.url.match(/^projet-kahoot:\/\/join\/([A-Za-z0-9]+)/)
      if (m) coldStartCode = m[1].toUpperCase()
    }
  }

  await initializeSocialLogin()

  // Si deep link au démarrage : pré-naviguer le routeur AVANT le mount
  // pour que l'app s'ouvre directement à la bonne page (pas de race condition)
  if (coldStartCode) {
    await authStore.waitForAuthInit()
    if (authStore.isConnected) {
      await router.replace(`/tabs/join?code=${coldStartCode}`)
    } else {
      await router.replace({ name: 'Login', query: { redirect: `/tabs/join?code=${coldStartCode}` } })
    }
  }

  app.mount('#app')
});
