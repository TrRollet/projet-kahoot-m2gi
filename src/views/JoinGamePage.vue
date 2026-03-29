<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonInput, IonButton, IonIcon, IonSpinner,
  toastController
} from '@ionic/vue'
import { scanOutline, arrowForwardOutline, qrCodeOutline } from 'ionicons/icons'
import { useGameStore } from '@/stores/game.store'
import { Capacitor } from '@capacitor/core'
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const code = ref('')
const loading = ref(false)
const scanning = ref(false)

onMounted(async () => {
  if (route.query.code) {
    code.value = String(route.query.code)
    await handleJoin()
  }
})

async function handleJoin() {
  if (!code.value.trim()) return
  loading.value = true
  try {
    const game = await gameStore.getGameByCode(code.value)
    if (!game) {
      const toast = await toastController.create({
        position: 'top',
        message: 'Aucune partie trouvée avec ce code',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
    } else if (game.status === 'finished') {
      const toast = await toastController.create({
        position: 'top',
        message: 'Cette partie est terminée',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
    } else {
      await router.push('/game/' + game.id)
      code.value = ''
    }
  } finally {
    loading.value = false
  }
}

async function handleScan() {
  if (!Capacitor.isNativePlatform()) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Le scanner QR nécessite un appareil natif',
      duration: 3000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  scanning.value = true
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Scannez le QR code de la partie',
      scanButton: false,
      cameraDirection: 1 // BACK
    })
    if (result.ScanResult) {
      const scanned = result.ScanResult.trim()
      // Tenter d'extraire le code depuis l'URL projet-kahoot://join/XXXXXX
      const urlMatch = scanned.match(/^projet-kahoot:\/\/join\/([A-Za-z0-9]+)/i)
      const extracted = urlMatch ? urlMatch[1].toUpperCase() : scanned.toUpperCase()

      if (/^[A-Z0-9]{6}$/.test(extracted)) {
        code.value = extracted
        await handleJoin()
      } else {
        const toast = await toastController.create({
          position: 'top',
          message: 'QR code invalide',
          duration: 2000,
          color: 'warning'
        })
        await toast.present()
      }
    }
  } catch (e: any) {
    // Ne pas afficher d'erreur si l'utilisateur a juste fermé le scanner
    console.log('Scanner error or cancelled:', e)
  } finally {
    scanning.value = false
  }
}
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <div class="page-header-inline">
          <h1 class="page-title-sm">Rejoindre</h1>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div class="join-container">
        <div class="join-hero">
          <ion-icon :icon="qrCodeOutline" class="hero-icon" />
          <h2 class="hero-title">Rejoindre une partie</h2>
          <p class="hero-sub">Entrez le code ou scannez le QR code</p>
        </div>

        <div class="code-form">
          <ion-input v-model="code" type="text" label="Code de la partie" label-placement="floating" fill="outline"
            placeholder="ex : ABC123" :maxlength="6" class="code-input" @keyup.enter="handleJoin" />

          <div class="form-actions">
            <ion-button expand="block" :disabled="loading || !code.trim()" class="join-btn" @click="handleJoin">
              <ion-spinner v-if="loading" name="crescent" />
              <template v-else>
                <ion-icon slot="start" :icon="arrowForwardOutline" />
                Rejoindre
              </template>
            </ion-button>

            <div class="divider">
              <span class="divider-line" />
              <span class="divider-text">ou</span>
              <span class="divider-line" />
            </div>

            <ion-button expand="block" fill="outline" :disabled="scanning" class="scan-btn" @click="handleScan">
              <ion-spinner v-if="scanning" name="crescent" />
              <template v-else>
                <ion-icon slot="start" :icon="scanOutline" />
                Scanner un QR code
              </template>
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.page-header-inline {
  padding: 0 16px;
}

.page-title-sm {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
}

.join-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  margin: 0 auto;
  padding-top: 24px;
}

.join-hero {
  text-align: center;
  margin-bottom: 32px;
}

.hero-icon {
  font-size: 3rem;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.hero-title {
  font-size: 1.4rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color);
}

.hero-sub {
  font-size: 0.9rem;
  color: var(--app-text-secondary);
  margin: 6px 0 0;
}

.code-form {
  width: 100%;
}

.code-input {
  --border-radius: 12px;
  --border-color: var(--app-border);
  --border-width: 1.5px;
  --highlight-color-focused: var(--ion-color-primary);
  --highlight-color-valid: var(--app-border);
  --highlight-color-invalid: var(--ion-color-danger);
}

.code-input::part(native) {
  font-size: 1.2em;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
}

.form-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.join-btn {
  --border-radius: 12px;
  font-weight: 600;
  height: 48px;
}

.scan-btn {
  --border-radius: 12px;
  font-weight: 600;
  height: 48px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--app-border);
}

.divider-text {
  font-size: 0.8rem;
  color: var(--app-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
