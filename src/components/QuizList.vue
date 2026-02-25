<script setup lang="ts">
import { IonGrid, IonRow, IonCol } from '@ionic/vue';
import QuizCard from '@/components/QuizCard.vue';
import type { Quiz } from '@/models/quiz';

interface Props {
  quizzes: Quiz[];
}

defineProps<Props>();

const emit = defineEmits<{
  quizClick: [quizId: string];
}>();
</script>

<template>
  <ion-grid>
    <ion-row>
      <ion-col v-for="quiz in quizzes" :key="quiz.id" size="12" size-sm="6" size-md="4" size-lg="3">
        <quiz-card :quiz="quiz" @click="emit('quizClick', quiz.id)" />
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<style scoped></style>