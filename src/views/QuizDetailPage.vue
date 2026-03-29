<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonToolbar, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner, loadingController, modalController, toastController } from '@ionic/vue';
import { createOutline, trashOutline, playOutline, shareOutline, layersOutline, exitOutline } from 'ionicons/icons';
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuizStore } from '@/stores/quiz.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGameStore } from '@/stores/game.store';
import { useNetwork } from '@/utils/useNetwork';
import QuizFormModal from '@/components/QuizFormModal.vue';
import ShareQuizModal from '@/components/ShareQuizModal.vue';
import OfflineBanner from '@/components/OfflineBanner.vue';
import type { Quiz } from '@/models/quiz';

const route = useRoute();
const router = useRouter();
const quizStore = useQuizStore();
const authStore = useAuthStore();
const gameStore = useGameStore();
const quiz = ref<Quiz | null>(null);
const isLoading = ref(true);
const showShareModal = ref(false);

const currentUserId = computed(() => authStore.currentUser?.uid || '');
const { isOnline } = useNetwork();
const userRole = computed(() => {
  if (!quiz.value || !currentUserId.value) return 'none';
  return quizStore.getUserRole(quiz.value, currentUserId.value);
});
const userRoleLabel = computed(() => {
  switch (userRole.value) {
    case 'owner': return 'Propriétaire'
    case 'editor': return 'Éditeur'
    case 'reader': return 'Lecteur'
    default: return ''
  }
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
    componentProps: { quiz: quiz.value, title: 'Modifier le quiz' }
  });
  await modal.present();
  const { data, role } = await modal.onWillDismiss();
  if (role === 'confirm' && data) {
    const updatedQuiz: Quiz = {
      id: quiz.value.id, title: data.title, description: data.description,
      questions: data.questions, ownerId: quiz.value.ownerId,
      editors: quiz.value.editors, readers: quiz.value.readers
    };
    const loading = await loadingController.create({ message: 'Mise à jour...', spinner: 'crescent' });
    await loading.present();
    try {
      await quizStore.updateQuiz(updatedQuiz);
      await loadQuiz();
      await loading.dismiss();
      const toast = await toastController.create({ position: 'top', message: 'Quiz modifié !', duration: 2000, color: 'success' });
      await toast.present();
    } catch {
      await loading.dismiss();
      const toast = await toastController.create({ position: 'top', message: 'Erreur de modification', duration: 2000, color: 'danger' });
      await toast.present();
    }
  }
};

const handleDelete = async () => {
  if (quiz.value && confirm('Supprimer ce quiz ?')) {
    const quizId = quiz.value.id;
    const loading = await loadingController.create({ message: 'Suppression...', spinner: 'crescent' });
    await loading.present();
    try {
      await quizStore.deleteQuiz(quizId);
      await loading.dismiss();
      const toast = await toastController.create({ position: 'top', message: 'Quiz supprimé', duration: 2000, color: 'success' });
      await toast.present();
      await router.push('/home');
    } catch {
      await loading.dismiss();
      const toast = await toastController.create({ position: 'top', message: 'Erreur de suppression', duration: 2000, color: 'danger' });
      await toast.present();
    }
  }
};

const openShareModal = () => { showShareModal.value = true; };
const closeShareModal = async () => { showShareModal.value = false; await loadQuiz(); };

const handleRemoveSelf = async () => {
  if (!quiz.value || !confirm('Retirer votre accès à ce quiz ?')) return;
  try {
    await quizStore.removeSelf(quiz.value.id);
    const toast = await toastController.create({ position: 'top', message: 'Accès retiré', duration: 2000, color: 'success' });
    await toast.present();
    router.push('/tabs/quizzes');
  } catch {
    const toast = await toastController.create({ position: 'top', message: 'Erreur', duration: 2000, color: 'danger' });
    await toast.present();
  }
};

const handleCreateGame = async () => {
  if (!quiz.value) return;
  const loading = await loadingController.create({ message: 'Création de la partie...', spinner: 'crescent' });
  await loading.present();
  try {
    const game = await gameStore.createGame(quiz.value.id, quiz.value.title);
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
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/quizzes" />
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button @click="openShareModal" v-if="quiz && isOwner">
            <ion-icon slot="icon-only" :icon="shareOutline" />
          </ion-button>
          <ion-button @click="openEditModal" v-if="quiz && canEditQuiz">
            <ion-icon slot="icon-only" :icon="createOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div v-if="isLoading" class="center-state">
        <ion-spinner name="crescent" />
      </div>

      <div v-else-if="quiz" class="detail-container">
        <!-- Hero -->
        <div class="detail-hero">
          <div class="hero-icon-box">
            <ion-icon :icon="layersOutline" />
          </div>
          <h1 class="detail-title">{{ quiz.title }}</h1>
          <p class="detail-desc" v-if="quiz.description">{{ quiz.description }}</p>
          <div class="detail-stats">
            <span class="stat">{{ quiz.questions?.length || 0 }} question{{ (quiz.questions?.length || 0) > 1 ? 's' : ''
            }}</span>
            <span class="stat-sep">--</span>
            <span class="stat">{{ userRoleLabel }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="detail-actions">
          <ion-button expand="block" color="secondary" @click="handleCreateGame"
            v-if="userRole !== 'none' && quiz.questions && quiz.questions.length > 0" class="action-main">
            <ion-icon slot="start" :icon="playOutline" />
            Lancer une partie
          </ion-button>
          <ion-button expand="block" fill="outline" color="danger" @click="handleDelete" v-if="canDeleteQuiz">
            <ion-icon slot="start" :icon="trashOutline" />
            Supprimer
          </ion-button>
          <ion-button expand="block" fill="outline" color="medium" @click="handleRemoveSelf"
            v-if="userRole === 'editor' || userRole === 'reader'">
            <ion-icon slot="start" :icon="exitOutline" />
            Retirer mon accès
          </ion-button>
        </div>

        <!-- Questions list -->
        <div class="questions-section" v-if="quiz.questions && quiz.questions.length > 0">
          <h2 class="section-heading">Questions</h2>
          <div class="question-list">
            <div v-for="(question, index) in quiz.questions" :key="question.id" class="question-row">
              <span class="q-num">{{ index + 1 }}</span>
              <div class="q-info">
                <span class="q-text">{{ question.text }}</span>
                <span class="q-meta">
                  <template v-if="question.type === 'number'">Valeur exacte à deviner</template>
                  <template v-else>{{ question.choices?.length || 0 }} réponses</template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ShareQuizModal :quiz="quiz" v-if="showShareModal" @close="closeShareModal" />
    </ion-content>
  </ion-page>
</template>

<style scoped>
.center-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60%;
}

.detail-container {
  padding: 20px 16px 40px;
  max-width: 520px;
  margin: 0 auto;
}

.detail-hero {
  text-align: center;
  margin-bottom: 24px;
}

.hero-icon-box {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--app-surface-alt);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--ion-color-primary);
  margin-bottom: 12px;
}

.detail-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color);
}

.detail-desc {
  font-size: 0.9rem;
  color: var(--app-text-secondary);
  margin: 8px 0 0;
  line-height: 1.4;
}

.detail-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: var(--app-text-secondary);
}

.stat-sep {
  opacity: 0.4;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}

.action-main {
  --border-radius: 12px;
  font-weight: 600;
  height: 48px;
}

.section-heading {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--ion-text-color);
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 14px;
}

.q-num {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--app-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.q-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.q-text {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-meta {
  font-size: 0.78rem;
  color: var(--app-text-secondary);
}
</style>