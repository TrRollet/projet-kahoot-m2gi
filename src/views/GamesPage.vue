<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonBadge, IonButton, IonIcon,
  IonSpinner, IonNote, onIonViewWillEnter, toastController
} from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import { useGameStore } from '@/stores/game.store'
import type { Game } from '@/models/game'

const gameStore = useGameStore()

onIonViewWillEnter(async () => {
  await gameStore.fetchMyGames()
})

function statusLabel(s: Game['status']) {
  return s === 'waiting' ? 'En attente' : s === 'active' ? 'En cours' : 'Terminée'
}
function statusColor(s: Game['status']) {
  return s === 'waiting' ? 'warning' : s === 'active' ? 'success' : 'medium'
}

async function handleDelete(gameId: string) {
  try {
    await gameStore.deleteGame(gameId)
    const toast = await toastController.create({ message: 'Partie supprimée', duration: 2000, color: 'success' })
    await toast.present()
  } catch {
    const toast = await toastController.create({ message: 'Erreur lors de la suppression', duration: 2000, color: 'danger' })
    await toast.present()
  }
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Mes parties</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="gameStore.loading" class="loading-container">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="gameStore.games.length === 0" class="empty-container">
        <p>Aucune partie créée pour l'instant.</p>
        <p>Créez une partie depuis le détail d'un quiz.</p>
      </div>

      <ion-list v-else>
        <ion-item v-for="game in gameStore.games" :key="game.id">
          <ion-label>
            <h2>{{ game.quizTitle }}</h2>
            <p>
              Code :
              <strong style="font-family: monospace; letter-spacing: 0.12em; font-size: 1.1em;">
                {{ game.code }}
              </strong>
            </p>
            <ion-note>{{ new Date(game.createdAt).toLocaleDateString('fr-FR') }}</ion-note>
          </ion-label>
          <ion-badge slot="end" :color="statusColor(game.status)" style="margin-right: 8px;">
            {{ statusLabel(game.status) }}
          </ion-badge>
          <ion-button slot="end" fill="clear" color="danger" @click="handleDelete(game.id)">
            <ion-icon :icon="trashOutline" />
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60%;
  color: var(--ion-color-medium);
  text-align: center;
  padding: 20px;
}
</style>
