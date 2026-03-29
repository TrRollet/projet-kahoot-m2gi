<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { wifiOutline } from 'ionicons/icons'
</script>

<template>
  <div class="offline-banner">
    <ion-icon :icon="wifiOutline" class="offline-icon" />
    <span>Pas de connexion internet</span>
  </div>
</template>

<style scoped>
.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--ion-color-danger);
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 10px 16px;
  width: 100%;
  animation: slide-down 0.25s ease;
  z-index: 100;
}

.offline-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
