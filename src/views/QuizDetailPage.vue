<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonButton, IonIcon, IonSpinner, loadingController, modalController, toastController } from '@ionic/vue';
import { createOutline, trashOutline, playCircleOutline, shareOutline } from 'ionicons/icons';
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuizStore } from '@/stores/quiz.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGameStore } from '@/stores/game.store';
import QuizFormModal from '@/components/QuizFormModal.vue';
import ShareQuizModal from '@/components/ShareQuizModal.vue';
import type { Quiz } from '@/models/quiz';

const route = useRoute();
const router = useRouter();
const quizStore = useQuizStore();
const authStore = useAuthStore();
const gameStore = useGameStore();
const quiz = ref<Quiz | null>(null);
const isLoading = ref(true);
const showShareModal = ref(false);

// Vérifier les permissions
const currentUserId = computed(() => authStore.currentUser?.uid || '');
const userRole = computed(() => {
  if (!quiz.value || !currentUserId.value) return 'none';
  return quizStore.getUserRole(quiz.value, currentUserId.value);
});
const canEditQuiz = computed(() => {
  if (!quiz.value || !currentUserId.value) return false;
  return quizStore.canEdit(quiz.value, currentUserId.value);
});
const canDeleteQuiz = computed(() => {
  if (!quiz.value || !currentUserId.value) return false;
  return quizStore.canDelete(quiz.value, currentUserId.value);
});
const isOwner = computed(() => userRole.value === 'owner');

onMounted(async () => {
  await loadQuiz();
});

const loadQuiz = async () => {
  isLoading.value = true;
  const quizId = route.params.id as string;
  const result = await quizStore.fetchQuizById(quizId);
  if (result) {
    quiz.value = result;
  } else {
    router.push('/home');
  }
  isLoading.value = false;
};

const openEditModal = async () => {
  if (!quiz.value) return;

  const modal = await modalController.create({
    component: QuizFormModal,
    componentProps: {
      quiz: quiz.value,
      title: 'Modifier le Quiz'
    }
  });

  await modal.present();

  const { data, role } = await modal.onWillDismiss();

  if (role === 'confirm' && data) {
    const updatedQuiz: Quiz = {
      id: quiz.value.id,
      title: data.title,
      description: data.description,
      questions: data.questions,
      ownerId: quiz.value.ownerId,
      editors: quiz.value.editors,
      readers: quiz.value.readers
    };

    const loading = await loadingController.create({
      message: 'Mise à jour du quiz...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await quizStore.updateQuiz(updatedQuiz);
      await loadQuiz();
      await loading.dismiss();
      const toast = await toastController.create({
        message: 'Quiz modifié avec succès !',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      await loading.dismiss();
      const toast = await toastController.create({
        message: 'Erreur lors de la modification du quiz',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }
};

const handleDelete = async () => {
  if (quiz.value && confirm('Êtes-vous sûr de vouloir supprimer ce quiz ?')) {
    const quizId = quiz.value.id;
    
    const loading = await loadingController.create({
      message: 'Suppression du quiz...',
      spinner: 'crescent'
    });
    await loading.present();
    
    try {
      await quizStore.deleteQuiz(quizId);
      await loading.dismiss();
      const toast = await toastController.create({
        message: 'Quiz supprimé avec succès',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
      await router.push('/home');
    } catch (error) {
      await loading.dismiss();
      console.error('Erreur lors de la suppression:', error);
      const toast = await toastController.create({
        message: 'Erreur lors de la suppression du quiz',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }
};

const openShareModal = () => {
  showShareModal.value = true;
};

const closeShareModal = async () => {
  showShareModal.value = false;
  await loadQuiz();
};

const handleCreateGame = async () => {
  if (!quiz.value) return;
  const loading = await loadingController.create({ message: 'Création de la partie...', spinner: 'crescent' });
  await loading.present();
  try {
    const game = await gameStore.createGame(quiz.value.id, quiz.value.title);
    await loading.dismiss();
    const toast = await toastController.create({
      message: `Partie créée ! Code : ${game.code}`,
      duration: 5000,
      color: 'success'
    });
    await toast.present();
    router.push('/tabs/games');
  } catch {
    await loading.dismiss();
    const toast = await toastController.create({ message: 'Erreur lors de la création', duration: 2000, color: 'danger' });
    await toast.present();
  }
};
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/quizzes"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ quiz?.title || 'Quiz' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openShareModal" v-if="quiz && isOwner">
            <ion-icon slot="start" :icon="shareOutline"></ion-icon>
            Partager
          </ion-button>
          <ion-button @click="openEditModal" v-if="quiz && canEditQuiz">
            <ion-icon slot="start" :icon="createOutline"></ion-icon>
            Modifier
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div v-if="isLoading" style="display: flex; justify-content: center; align-items: center; height: 100%; padding: 50px;">
        <ion-spinner name="crescent" style="transform: scale(2);"></ion-spinner>
      </div>

      <div v-else-if="quiz">
      <ion-card>
        <ion-card-header>
          <ion-card-title>{{ quiz.title }}</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ quiz.description || 'Aucune description' }}</p>
          <p><strong>{{ quiz.questions?.length || 0 }} question(s)</strong></p>
          <p><em>Rôle: {{ userRole }}</em></p>
        </ion-card-content>
      </ion-card>

      <ion-card v-if="quiz.questions && quiz.questions.length > 0">
        <ion-card-header>
          <ion-card-title>Questions</ion-card-title>
        </ion-card-header>
        <ion-list>
          <ion-item v-for="(question, index) in quiz.questions" :key="question.id">
            <ion-label>
              <h3>{{ index + 1 }}. {{ question.text }}</h3>
              <p>{{ question.choices?.length || 0 }} réponses possibles</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </ion-card>

      <div style="padding: 16px;">
        <ion-button expand="block" color="success" @click="handleCreateGame" v-if="isOwner && quiz.questions && quiz.questions.length > 0">
          <ion-icon slot="start" :icon="playCircleOutline"></ion-icon>
          Créer une partie
        </ion-button>
        <ion-button expand="block" color="danger" @click="handleDelete" v-if="canDeleteQuiz">
          <ion-icon slot="start" :icon="trashOutline"></ion-icon>
          Supprimer le Quiz
        </ion-button>
      </div>
      </div>
      
      <!-- Share Modal -->
      <ShareQuizModal :quiz="quiz" v-if="showShareModal" @close="closeShareModal" />
    </ion-content>
  </ion-page>
</template>