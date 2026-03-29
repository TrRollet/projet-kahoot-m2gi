<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue';
import { playOutline, layersOutline } from 'ionicons/icons';
import type { Quiz } from '@/models/quiz';

interface Props {
  quiz: Quiz;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [quizId: string];
  launch: [quiz: Quiz];
}>();
</script>

<template>
  <div class="quiz-card" @click="emit('click', quiz.id)">
    <div class="card-top">
      <div class="card-icon-box">
        <ion-icon :icon="layersOutline" />
      </div>
      <div class="card-info">
        <h3 class="card-title">{{ quiz.title }}</h3>
        <p class="card-meta">{{ quiz.questions?.length || 0 }} question{{ (quiz.questions?.length || 0) > 1 ? 's' : '' }}</p>
      </div>
    </div>
    <p class="card-desc">{{ quiz.description || '' }}</p>
    <div class="card-actions">
      <ion-button
        v-if="quiz.questions && quiz.questions.length > 0"
        fill="solid"
        size="small"
        color="secondary"
        class="launch-btn"
        @click.stop="emit('launch', quiz)"
      >
        <ion-icon slot="start" :icon="playOutline" />
        Lancer
      </ion-button>
    </div>
  </div>
</template>

<style scoped>
.quiz-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  min-height: 140px;
  display: flex;
  flex-direction: column;
}
.quiz-card:active {
  transform: scale(0.98);
}
.card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.card-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--app-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.2rem;
  color: var(--ion-color-primary);
}
.card-info {
  flex: 1;
  min-width: 0;
}
.card-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--ion-text-color);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-meta {
  font-size: 0.8rem;
  color: var(--app-text-secondary);
  margin: 2px 0 0;
}
.card-desc {
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  margin: 0 0 10px;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
}
.launch-btn {
  --border-radius: 8px;
  font-weight: 600;
}
</style>