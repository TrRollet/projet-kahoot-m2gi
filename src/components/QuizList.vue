<script setup lang="ts">
import QuizCard from '@/components/QuizCard.vue';
import type { Quiz } from '@/models/quiz';

interface Props {
  quizzes: Quiz[];
}

defineProps<Props>();

const emit = defineEmits<{
  quizClick: [quizId: string];
  quizLaunch: [quiz: Quiz];
}>();
</script>

<template>
  <div class="quiz-grid" v-if="quizzes.length > 0">
    <quiz-card
      v-for="quiz in quizzes"
      :key="quiz.id"
      :quiz="quiz"
      @click="emit('quizClick', quiz.id)"
      @launch="emit('quizLaunch', quiz)"
    />
  </div>
  <div v-else class="empty-state">
    <p class="empty-text">Aucun quiz pour l'instant</p>
    <p class="empty-hint">Creez votre premier quiz avec le bouton +</p>
  </div>
</template>

<style scoped>
.quiz-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 100px;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
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
</style>