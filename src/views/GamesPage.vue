<script setup lang="ts">
import { computed } from 'vue'
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonButton, IonIcon, IonSpinner, onIonViewWillEnter, toastController
} from '@ionic/vue'
import { useRouter } from 'vue-router'
import { trashOutline, arrowForwardOutline, trophyOutline } from 'ionicons/icons'
import { useGameStore } from '@/stores/game.store'
import { useAuthStore } from '@/stores/auth.store'
import { useNetwork } from '@/utils/useNetwork'
import OfflineBanner from '@/components/OfflineBanner.vue'
import type { Game } from '@/models/game'

const gameStore = useGameStore()
const authStore = useAuthStore()
const router = useRouter()
const currentUserId = computed(() => authStore.currentUser?.uid || '')
const { isOnline } = useNetwork()

onIonViewWillEnter(async () => {
  await gameStore.fetchMyGames()
})

function statusLabel(s: Game['status']) {
  if (s === 'waiting') return 'En attente'
  if (s === 'question' || s === 'results') return 'En cours'
  return 'Terminée'
}
function statusColor(s: Game['status']) {
  if (s === 'waiting') return 'var(--ion-color-warning)'
  if (s === 'question' || s === 'results') return 'var(--ion-color-success)'
  return 'var(--ion-color-medium)'
}

async function handleDelete(gameId: string) {
  try {
    await gameStore.deleteGame(gameId)
    const toast = await toastController.create({ position: 'top', message: 'Partie supprimée', duration: 2000, color: 'success' })
    await toast.present()
  } catch {
    const toast = await toastController.create({ position: 'top', message: 'Erreur lors de la suppression', duration: 2000, color: 'danger' })
    await toast.present()
  }
}
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <div class="page-header-inline">
          <h1 class="page-title-sm">Mes parties</h1>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div v-if="gameStore.loading" class="center-state">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="gameStore.games.length === 0" class="center-state">
        <ion-icon :icon="trophyOutline" class="empty-icon" />
        <p class="empty-text">Aucune partie</p>
        <p class="empty-hint">Lancez une partie depuis un quiz</p>
      </div>

      <div v-else class="games-list">
        <div v-for="game in gameStore.games" :key="game.id" class="game-row">
          <div class="game-info">
            <div class="game-title-line">
              <span class="status-dot" :style="{ background: statusColor(game.status) }" />
              <span class="game-title">{{ game.quizTitle }}</span>
            </div>
            <div class="game-meta">
              <span v-if="game.code" class="game-code">{{ game.code }}</span>
              <span v-if="game.code" class="game-sep">--</span>
              <span class="game-status">{{ statusLabel(game.status) }}</span>
              <span class="game-sep">--</span>
              <span class="game-date">{{ new Date(game.createdAt).toLocaleDateString('fr-FR') }}</span>
            </div>
          </div>
          <div class="game-actions">
            <ion-button
              fill="solid"
              size="small"
              :color="game.status === 'finished' ? 'medium' : 'primary'"
              class="action-btn"
              @click="router.push('/game/' + game.id)"
            >
              <ion-icon slot="icon-only" :icon="game.status === 'finished' ? trophyOutline : arrowForwardOutline" />
            </ion-button>
            <ion-button
              v-if="game.hostId === currentUserId"
              fill="clear"
              size="small"
              color="danger"
              class="action-btn"
              :disabled="game.status === 'question' || game.status === 'results'"
              @click="handleDelete(game.id)"
            >
              <ion-icon slot="icon-only" :icon="trashOutline" />
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
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60%;
  text-align: center;
  padding: 20px;
}
.empty-icon {
  font-size: 3rem;
  color: var(--ion-color-medium);
  margin-bottom: 12px;
}
.empty-text {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ion-text-color);
  margin: 0 0 4px;
}
.empty-hint {
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  margin: 0;
}
.games-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.game-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 14px;
}
.game-info {
  flex: 1;
  min-width: 0;
}
.game-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.game-title {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.game-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--app-text-secondary);
}
.game-code {
  font-family: monospace;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.game-sep { opacity: 0.4; }
.game-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.action-btn {
  --border-radius: 8px;
}
</style>
