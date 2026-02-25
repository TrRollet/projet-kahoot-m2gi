<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="quizzes" href="/tabs/quizzes">
          <ion-icon :icon="listOutline" />
          <ion-label>Mes Quiz</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="games" href="/tabs/games">
          <ion-icon :icon="gameControllerOutline" />
          <ion-label>Mes Parties</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="join" href="/tabs/join">
          <ion-icon :icon="enterOutline" />
          <ion-label>Rejoindre</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet
} from '@ionic/vue'
import { listOutline, gameControllerOutline, enterOutline } from 'ionicons/icons'
</script>
