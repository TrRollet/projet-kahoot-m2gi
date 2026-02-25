<script setup lang="ts">
import { ref } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonButton, IonSpinner,
  toastController
} from '@ionic/vue'
import { useGameStore } from '@/stores/game.store'

const gameStore = useGameStore()
const code = ref('')
const loading = ref(false)
const found = ref<null | { title: string; code: string; status: string }>(null)

async function handleJoin() {
  if (!code.value.trim()) return
  loading.value = true
  found.value = null
  try {
    const game = await gameStore.getGameByCode(code.value)
    if (!game) {
      const toast = await toastController.create({
        message: 'Aucune partie trouvée avec ce code',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
    } else if (game.status === 'finished') {
      const toast = await toastController.create({
        message: 'Cette partie est terminée',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
    } else {
      found.value = { title: game.quizTitle, code: game.code, status: game.status }
    }
  } finally {
    loading.value = false
  }
}

function statusLabel(s: string) {
  return s === 'waiting' ? 'En attente' : s === 'active' ? 'En cours' : 'Terminée'
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Rejoindre une partie</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="join-container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Entrez le code</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">Code de la partie</ion-label>
              <ion-input
                v-model="code"
                type="text"
                placeholder="ex : ABC123"
                :maxlength="6"
                style="text-transform: uppercase; font-size: 1.4em; letter-spacing: 0.2em; font-weight: bold;"
                @keyup.enter="handleJoin"
              />
            </ion-item>

            <ion-button
              expand="block"
              style="margin-top: 16px;"
              :disabled="loading || !code.trim()"
              @click="handleJoin"
            >
              <ion-spinner v-if="loading" name="crescent" />
              <span v-else>Rejoindre</span>
            </ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card v-if="found" class="found-card">
          <ion-card-header>
            <ion-card-title>{{ found.title }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <p><strong>Code :</strong> {{ found.code }}</p>
            <p><strong>Statut :</strong> {{ statusLabel(found.status) }}</p>
            <p style="margin-top: 12px; color: var(--ion-color-medium);">
              La fonctionnalité de jeu arrive bientôt !
            </p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.join-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
}
ion-card {
  width: 100%;
  max-width: 480px;
}
.found-card {
  border: 2px solid var(--ion-color-success);
}
</style>
