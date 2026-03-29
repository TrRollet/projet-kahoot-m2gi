<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonToolbar, IonIcon, IonSpinner, IonFab, IonFabButton, loadingController, modalController, onIonViewWillEnter, toastController } from '@ionic/vue';
import { add } from 'ionicons/icons';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuizStore } from '@/stores/quiz.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGameStore } from '@/stores/game.store';
import { useNetwork } from '@/utils/useNetwork';
import QuizList from '@/components/QuizList.vue';
import QuizFormModal from '@/components/QuizFormModal.vue';
import OfflineBanner from '@/components/OfflineBanner.vue';
import type { Quiz } from '@/models/quiz';

const router = useRouter();
const quizStore = useQuizStore();
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isOnline } = useNetwork();

onMounted(async () => {
  await quizStore.fetchQuizzes();
});

onIonViewWillEnter(async () => {
  await quizStore.fetchQuizzes();
});

const openCreateModal = async () => {
  const modal = await modalController.create({
    component: QuizFormModal,
    componentProps: {
      title: 'Nouveau Quiz'
    }
  });

  await modal.present();

  const { data, role } = await modal.onWillDismiss();

  if (role === 'confirm' && data) {
    const newQuiz: Quiz = {
      id: '',
      title: data.title,
      description: data.description,
      questions: data.questions || []
    };

    const loading = await loadingController.create({
      message: 'Création du quiz...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await quizStore.addQuiz(newQuiz);
      await loading.dismiss();
      const toast = await toastController.create({
        position: 'top',
        message: 'Quiz créé avec succès !',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      await loading.dismiss();
      const toast = await toastController.create({
        position: 'top',
        message: 'Erreur lors de la création du quiz',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }
};

const goToQuizDetail = (quizId: string) => {
  router.push(`/quiz/${quizId}`);
};

const handleLaunchQuiz = async (quiz: Quiz) => {
  const loading = await loadingController.create({ message: 'Création de la partie...', spinner: 'crescent' });
  await loading.present();
  try {
    const game = await gameStore.createGame(quiz.id, quiz.title);
    await loading.dismiss();
    router.push('/game/' + game.id);
  } catch {
    await loading.dismiss();
    const toast = await toastController.create({ position: 'top', message: 'Erreur lors de la création', duration: 2000, color: 'danger' });
    await toast.present();
  }
};
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <div slot="start" class="header-greeting">
          <span class="greeting-text">Bonjour, <strong>{{ authStore.userUsername || 'Joueur' }}</strong></span>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div class="page-header">
        <h1 class="page-title">Mes quiz</h1>
        <p class="page-subtitle">{{ quizStore.allQuizzes.length }} quiz disponible{{ quizStore.allQuizzes.length > 1
          ? 's' : '' }}</p>
      </div>

      <div v-if="quizStore.loading" class="loading-box">
        <ion-spinner name="crescent" />
      </div>

      <quiz-list v-else :quizzes="quizStore.allQuizzes" @quizClick="goToQuizDetail" @quizLaunch="handleLaunchQuiz" />

      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button @click="openCreateModal" color="secondary">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.header-greeting {
  padding-left: 16px;
}

.greeting-text {
  font-size: 0.9rem;
  color: var(--app-text-secondary);
}

.page-header {
  padding: 20px 16px 8px;
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color);
}

.page-subtitle {
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  margin: 4px 0 0;
}

.loading-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
}
</style>
