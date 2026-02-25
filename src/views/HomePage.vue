<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonButton, IonIcon, IonSpinner, IonFab, IonFabButton, loadingController, modalController, onIonViewWillEnter, toastController } from '@ionic/vue';
import { add, logOutOutline } from 'ionicons/icons';
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuizStore } from '@/stores/quiz.store';
import { useAuthStore } from '@/stores/auth.store';
import QuizList from '@/components/QuizList.vue';
import QuizFormModal from '@/components/QuizFormModal.vue';
import type { Quiz } from '@/models/quiz';

const router = useRouter();
const quizStore = useQuizStore();
const authStore = useAuthStore();

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
      id: '', // Firestore générera l'ID automatiquement
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
        message: 'Quiz créé avec succès !',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      await loading.dismiss();
      const toast = await toastController.create({
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

const handleLogout = async () => {
  try {
    await authStore.signOut()
    const toast = await toastController.create({
      message: 'Déconnexion réussie',
      duration: 2000,
      color: 'success'
    })
    await toast.present()
    router.push('/login')
  } catch (error) {
    const toast = await toastController.create({
      message: 'Erreur lors de la déconnexion',
      duration: 2000,
      color: 'danger'
    })
    await toast.present()
  }
};
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Kahoot</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleLogout" color="medium">
            <ion-icon slot="icon-only" :icon="logOutOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Quiz</ion-title>
        </ion-toolbar>
      </ion-header>

      <div v-if="quizStore.loading" style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 50px;">
        <ion-spinner name="crescent" style="transform: scale(2);"></ion-spinner>
      </div>

      <quiz-list v-else :quizzes="quizStore.allQuizzes" @quizClick="goToQuizDetail" />
      
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button @click="openCreateModal">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  </ion-page>
</template>


<style scoped>

</style>
