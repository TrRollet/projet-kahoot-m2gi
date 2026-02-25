<script setup lang="ts">
import { IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent } from '@ionic/vue';
import type { Quiz } from '@/models/quiz';

interface Props {
  quiz: Quiz;
}

defineProps<Props>();

const emit = defineEmits<{
  click: [quizId: string];
}>();
</script>

<template>
  <ion-card @click="emit('click', quiz.id)" button>
    <ion-card-header>
      <ion-card-title>{{ quiz.title }}</ion-card-title>
      <ion-card-subtitle>
        {{ quiz.questions?.length || 0 }} question{{ (quiz.questions?.length || 0) > 1 ? 's' : '' }}
      </ion-card-subtitle>
    </ion-card-header>

    <ion-card-content>
      {{ quiz.description || 'Aucune description' }}
    </ion-card-content>
  </ion-card>
</template>

<style scoped>
ion-card {
  cursor: pointer;
  transition: transform 0.2s;
}

ion-card:hover {
  transform: translateY(-4px);
}
</style>