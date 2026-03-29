<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonContent, IonIcon, IonProgressBar, IonSpinner, onIonViewWillEnter } from '@ionic/vue'
import { gameControllerOutline, cashOutline, bulbOutline, flashOutline, chatbubblesOutline, medalOutline, starOutline, peopleOutline, constructOutline } from 'ionicons/icons'
import { useAchievementsStore } from '@/stores/achievements.store'

const achievementsStore = useAchievementsStore()

onIonViewWillEnter(async () => {
  await achievementsStore.fetchStats()
})

const getIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    'game-controller-outline': gameControllerOutline,
    'cash-outline': cashOutline,
    'bulb-outline': bulbOutline,
    'flash-outline': flashOutline,
    'chatbubbles-outline': chatbubblesOutline,
    'people-outline': peopleOutline,
    'construct-outline': constructOutline
  }
  return icons[iconName] || medalOutline
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'gold': return '#FFD700'
    case 'silver': return '#C0C0C0'
    case 'bronze': return '#CD7F32'
    default: return 'var(--app-surface-alt)'
  }
}

</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <div class="page-header-inline">
          <h1 class="page-title-sm">Succès</h1>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="bg-grad">
      <div v-if="achievementsStore.loading" class="center-state">
        <ion-spinner name="crescent" />
      </div>

      <div v-else class="achievements-container">

        <div class="stats-overview">
          <div class="stat-card">
            <span class="stat-value">{{ achievementsStore.stats.gamesPlayed }}</span>
            <span class="stat-label">Parties jouées</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ achievementsStore.stats.totalScore.toLocaleString() }}</span>
            <span class="stat-label">Score total</span>
          </div>
        </div>

        <h2 class="section-title">Progression Globale</h2>

        <div class="achievement-list">
          <div v-for="ach in achievementsStore.progress" :key="ach.id" class="achievement-card" :class="ach.tier">
            <div class="ach-icon-box" :style="{ background: getTierColor(ach.tier) }">
              <ion-icon :icon="getIcon(ach.icon)" />
              <ion-icon v-if="ach.tier !== 'none'" :icon="ach.completed ? starOutline : medalOutline"
                class="tier-badge" />
            </div>

            <div class="ach-content">
              <div class="ach-header">
                <h3>{{ ach.title }}</h3>
                <span v-if="ach.completed" class="ach-maxed">{{ ach.value }}</span>
                <span v-else class="ach-counter">{{ ach.value }} / {{ ach.target }}</span>
              </div>
              <p class="ach-desc">{{ ach.description(ach.target) }}</p>

              <div class="ach-progress" v-if="!ach.completed">
                <ion-progress-bar :value="ach.value / ach.target"
                  :style="{ '--progress-background': getTierColor(ach.tier === 'none' ? 'bronze' : ach.tier) }" />
              </div>
            </div>
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

.bg-grad {
  --background: var(--app-bg);
}

.center-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60%;
}

.achievements-container {
  padding: 24px 16px 40px;
  max-width: 600px;
  margin: 0 auto;
}

.stats-overview {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  flex: 1;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--ion-color-primary);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-title {
  font-size: 1.3rem;
  font-weight: 800;
  margin: 0 0 16px 4px;
  color: var(--ion-text-color);
}

.achievement-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.achievement-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  gap: 16px;
  align-items: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s ease;
}

.achievement-card.gold {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.05) 0%, var(--app-surface) 100%);
  border-color: rgba(255, 215, 0, 0.4);
}

.ach-icon-box {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2rem;
  color: #fff;
  flex-shrink: 0;
  position: relative;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.15);
}

.tier-badge {
  position: absolute;
  bottom: -6px;
  right: -6px;
  font-size: 1.2rem;
  background: var(--app-surface);
  color: var(--ion-text-color);
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.ach-content {
  flex: 1;
  min-width: 0;
}

.ach-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.ach-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ion-text-color);
}

.ach-counter {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--app-text-secondary);
  background: var(--app-surface-alt);
  padding: 4px 8px;
  border-radius: 8px;
}

.ach-maxed {
  font-size: 0.8rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  padding: 4px 8px;
  border-radius: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.ach-desc {
  margin: 0 0 12px 0;
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  line-height: 1.3;
}

.ach-progress {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--app-surface-alt);
}

ion-progress-bar {
  --background: transparent;
  height: 100%;
}
</style>
