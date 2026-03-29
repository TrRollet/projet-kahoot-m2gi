<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonInput,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonIcon,
  toastController
} from '@ionic/vue'
import { trashOutline } from 'ionicons/icons'
import type { Quiz } from '@/models/quiz'
import { useQuizStore } from '@/stores/quiz.store'
import { useAuthStore } from '@/stores/auth.store'

const props = defineProps<{
  quiz: Quiz | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const quizStore = useQuizStore()
const authStore = useAuthStore()
const userIdentifier = ref('')
const role = ref<'editor' | 'reader'>('editor')
const adding = ref(false)
const editorsWithUsernames = ref<Array<{ uid: string, username: string | null }>>([])
const readersWithUsernames = ref<Array<{ uid: string, username: string | null }>>([])

onMounted(async () => {
  await loadCollaborators()
})

async function loadCollaborators() {
  if (!props.quiz) return

  const editorsPromises = (props.quiz.editors || []).map(async (uid) => {
    const username = await authStore.getUsernameByUserId(uid)
    return { uid, username }
  })
  editorsWithUsernames.value = await Promise.all(editorsPromises)

  const readersPromises = (props.quiz.readers || []).map(async (uid) => {
    const username = await authStore.getUsernameByUserId(uid)
    return { uid, username }
  })
  readersWithUsernames.value = await Promise.all(readersPromises)
}

async function handleAddUser() {
  if (!props.quiz || !userIdentifier.value.trim()) {
    return
  }

  adding.value = true
  try {
    // Rechercher l'uid par pseudo
    const foundUid = await authStore.getUserIdByUsername(userIdentifier.value.trim())
    if (!foundUid) {
      const toast = await toastController.create({
        position: 'top',
        message: 'Aucun utilisateur trouvé avec ce pseudo',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
      adding.value = false
      return
    }
    const uid = foundUid

    // Vérifier qu'on ne s'ajoute pas soi-même
    if (uid === authStore.currentUser?.uid) {
      const toast = await toastController.create({
        position: 'top',
        message: 'Vous ne pouvez pas vous ajouter vous-même aux collaborateurs',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
      adding.value = false
      return
    }

    // Vérifier que l'utilisateur n'est pas déjà dans la liste
    const alreadyEditor = props.quiz.editors?.includes(uid)
    const alreadyReader = props.quiz.readers?.includes(uid)

    if (alreadyEditor || alreadyReader) {
      const toast = await toastController.create({
        position: 'top',
        message: 'Cet utilisateur a déjà accès à ce quiz',
        duration: 3000,
        color: 'warning'
      })
      await toast.present()
      adding.value = false
      return
    }

    if (role.value === 'editor') {
      await quizStore.addEditor(props.quiz.id, uid)
    } else {
      await quizStore.addReader(props.quiz.id, uid)
    }

    const toast = await toastController.create({
      position: 'top',
      message: 'Utilisateur ajouté avec succès',
      duration: 2000,
      color: 'success'
    })
    await toast.present()

    // Recharger le quiz complet depuis Firestore
    const updatedQuiz = await quizStore.fetchQuizById(props.quiz.id)
    if (updatedQuiz) {
      // Mettre à jour la référence du quiz
      Object.assign(props.quiz, updatedQuiz)
    }

    // Recharger les pseudos
    await loadCollaborators()

    // Réinitialiser le formulaire
    userIdentifier.value = ''
  } catch (error) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Erreur lors de l\'ajout de l\'utilisateur',
      duration: 2000,
      color: 'danger'
    })
    await toast.present()
    console.error('Erreur:', error)
  } finally {
    adding.value = false
  }
}

async function handleRemoveEditor(editorId: string) {
  if (!props.quiz) return

  try {
    await quizStore.removeEditor(props.quiz.id, editorId)

    const toast = await toastController.create({
      position: 'top',
      message: 'Éditeur retiré avec succès',
      duration: 2000,
      color: 'success'
    })
    await toast.present()

    // Recharger le quiz complet depuis Firestore
    const updatedQuiz = await quizStore.fetchQuizById(props.quiz.id)
    if (updatedQuiz) {
      Object.assign(props.quiz, updatedQuiz)
    }

    // Recharger les pseudos
    await loadCollaborators()
  } catch (error) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Erreur lors du retrait de l\'éditeur',
      duration: 2000,
      color: 'danger'
    })
    await toast.present()
    console.error('Erreur:', error)
  }
}

async function handleRemoveReader(readerId: string) {
  if (!props.quiz) return

  try {
    await quizStore.removeReader(props.quiz.id, readerId)

    const toast = await toastController.create({
      position: 'top',
      message: 'Lecteur retiré avec succès',
      duration: 2000,
      color: 'success'
    })
    await toast.present()

    // Recharger le quiz complet depuis Firestore
    const updatedQuiz = await quizStore.fetchQuizById(props.quiz.id)
    if (updatedQuiz) {
      Object.assign(props.quiz, updatedQuiz)
    }

    // Recharger les pseudos
    await loadCollaborators()
  } catch (error) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Erreur lors du retrait du lecteur',
      duration: 2000,
      color: 'danger'
    })
    await toast.present()
    console.error('Erreur:', error)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <ion-modal :is-open="!!quiz" @didDismiss="handleClose">
    <ion-header>
      <ion-toolbar>
        <ion-title>Partager le quiz</ion-title>
        <ion-button slot="end" fill="clear" @click="handleClose">
          Fermer
        </ion-button>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div v-if="quiz">
        <h2>{{ quiz.title }}</h2>

        <!-- Mon pseudo -->
        <div class="my-uid-section">
          <ion-item>
            <ion-label>
              <h3>Mon pseudo</h3>
              <p style="font-size: 1em; font-weight: 500;">{{ authStore.userUsername || '...' }}</p>
            </ion-label>
          </ion-item>
        </div>

        <!-- Formulaire d'ajout -->
        <div class="add-user-form">
          <h3>Ajouter un utilisateur</h3>
          <ion-item>
            <ion-label position="stacked">Pseudo de l'utilisateur</ion-label>
            <ion-input v-model="userIdentifier" type="text" placeholder="pseudo_de_l_utilisateur"
              :disabled="adding"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label>Rôle</ion-label>
            <ion-select v-model="role" :disabled="adding">
              <ion-select-option value="editor">Éditeur</ion-select-option>
              <ion-select-option value="reader">Lecteur</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-button expand="block" @click="handleAddUser" :disabled="adding || !userIdentifier.trim()">
            {{ adding ? 'Ajout en cours...' : 'Ajouter' }}
          </ion-button>
        </div>

        <!-- Liste des éditeurs -->
        <div class="collaborators-section">
          <h3>Éditeurs ({{ editorsWithUsernames.length }})</h3>
          <ion-list v-if="editorsWithUsernames.length > 0">
            <ion-item v-for="editor in editorsWithUsernames" :key="editor.uid">
              <ion-label>
                <h3>{{ editor.username || 'Pseudo non trouvé' }}</h3>
              </ion-label>
              <ion-button slot="end" fill="clear" color="danger" @click="handleRemoveEditor(editor.uid)">
                <ion-icon :icon="trashOutline"></ion-icon>
              </ion-button>
            </ion-item>
          </ion-list>
          <p v-else class="empty-message">Aucun éditeur pour le moment</p>
        </div>

        <!-- Liste des lecteurs -->
        <div class="collaborators-section">
          <h3>Lecteurs ({{ readersWithUsernames.length }})</h3>
          <ion-list v-if="readersWithUsernames.length > 0">
            <ion-item v-for="reader in readersWithUsernames" :key="reader.uid">
              <ion-label>
                <h3>{{ reader.username || 'Pseudo non trouvé' }}</h3>
              </ion-label>
              <ion-button slot="end" fill="clear" color="danger" @click="handleRemoveReader(reader.uid)">
                <ion-icon :icon="trashOutline"></ion-icon>
              </ion-button>
            </ion-item>
          </ion-list>
          <p v-else class="empty-message">Aucun lecteur pour le moment</p>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.my-uid-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--ion-color-light);
}

.add-user-form {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--ion-color-light);
}

.add-user-form h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.collaborators-section {
  margin-top: 1.5rem;
}

.collaborators-section h3 {
  margin-bottom: 0.5rem;
}

.empty-message {
  color: var(--ion-color-medium);
  font-style: italic;
  padding: 1rem;
}

ion-select {
  color: var(--ion-text-color);
}

ion-item {
  --color: var(--ion-text-color);
}
</style>
