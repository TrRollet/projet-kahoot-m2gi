<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="app-tab-bar">
        <ion-tab-button tab="quizzes" href="/tabs/quizzes">
          <ion-icon :icon="layersOutline" />
          <ion-label>Quiz</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="games" href="/tabs/games">
          <ion-icon :icon="trophyOutline" />
          <ion-label>Parties</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="join" href="/tabs/join">
          <ion-icon :icon="qrCodeOutline" />
          <ion-label>Rejoindre</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="achievements" href="/tabs/achievements">
          <ion-icon :icon="medalOutline" />
          <ion-label>Succès</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="settings" href="/tabs/settings">
          <ion-icon :icon="settingsOutline" />
          <ion-label>Réglages</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet
} from '@ionic/vue'
import { layersOutline, trophyOutline, qrCodeOutline, settingsOutline, medalOutline } from 'ionicons/icons'
</script>

<style scoped>
.app-tab-bar {
  --border: 1px solid var(--app-border);
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
