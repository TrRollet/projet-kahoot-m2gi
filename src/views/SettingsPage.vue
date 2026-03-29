<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonContent,
  IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel,
  IonModal, IonInput, IonItem, IonList,
  toastController
} from '@ionic/vue'
import { logOutOutline, personCircleOutline, moonOutline, sunnyOutline, phonePortraitOutline, settingsOutline, keyOutline, createOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore, type ThemeMode } from '@/stores/settings.store'
import { useNetwork } from '@/utils/useNetwork'
import OfflineBanner from '@/components/OfflineBanner.vue'
import { ref } from 'vue'

const router = useRouter()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { isOnline } = useNetwork()

// Modals
const showPasswordModal = ref(false)
const showUsernameModal = ref(false)

// Forms
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const newUsername = ref('')

function onThemeChange(ev: CustomEvent) {
  settingsStore.setTheme(ev.detail.value as ThemeMode)
}

async function handleLogout() {
  try {
    await authStore.signOut()
    const toast = await toastController.create({
      position: 'top',
      message: 'Déconnexion réussie', duration: 2000, color: 'success'
    })
    await toast.present()
    router.push('/login')
  } catch {
    const toast = await toastController.create({
      position: 'top',
      message: 'Erreur lors de la déconnexion', duration: 2000, color: 'danger'
    })
    await toast.present()
  }
}

async function handlePasswordChange() {
  if (!newPassword.value || !confirmPassword.value) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Veuillez remplir tous les champs', duration: 2000, color: 'warning'
    })
    await toast.present()
    return
  }

  // Si l'utilisateur a déjà un mot de passe, vérifier qu'il a entré l'ancien
  if (authStore.hasPasswordProvider && !currentPassword.value) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Veuillez entrer votre mot de passe actuel', duration: 2000, color: 'warning'
    })
    await toast.present()
    return
  }

  if (newPassword.value.length < 6) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Le mot de passe doit contenir au moins 6 caractères', duration: 2000, color: 'warning'
    })
    await toast.present()
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Les mots de passe ne correspondent pas', duration: 2000, color: 'warning'
    })
    await toast.present()
    return
  }

  try {
    await authStore.updateUserPassword(currentPassword.value || null, newPassword.value)
    const toast = await toastController.create({
      position: 'top',
      message: authStore.hasPasswordProvider ? 'Mot de passe modifié avec succès' : 'Mot de passe défini avec succès',
      duration: 2000,
      color: 'success'
    })
    await toast.present()
    showPasswordModal.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    const toast = await toastController.create({
      position: 'top',
      message: authStore.error || 'Erreur lors du changement de mot de passe', duration: 3000, color: 'danger'
    })
    await toast.present()
  }
}

async function handleUsernameChange() {
  if (!newUsername.value || newUsername.value.trim().length < 3) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Le pseudo doit contenir au moins 3 caractères', duration: 2000, color: 'warning'
    })
    await toast.present()
    return
  }

  try {
    await authStore.updateUserUsername(newUsername.value)
    const toast = await toastController.create({
      position: 'top',
      message: 'Pseudo modifié avec succès', duration: 2000, color: 'success'
    })
    await toast.present()
    showUsernameModal.value = false
    newUsername.value = ''
  } catch (e: any) {
    const toast = await toastController.create({
      position: 'top',
      message: e.message || 'Erreur lors du changement de pseudo', duration: 3000, color: 'danger'
    })
    await toast.present()
  }
}

function openPasswordModal() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordModal.value = true
}

function openUsernameModal() {
  newUsername.value = authStore.userUsername || ''
  showUsernameModal.value = true
}
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <div class="page-header-inline">
          <ion-icon :icon="settingsOutline" class="header-icon" />
          <h1 class="page-title-sm">Paramètres</h1>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div class="settings-container">
        <!-- Profile section -->
        <div class="settings-section">
          <p class="section-label">Compte</p>
          <div class="profile-card">
            <ion-icon :icon="personCircleOutline" class="profile-icon" />
            <div class="profile-info">
              <span class="profile-name">{{ authStore.userUsername || authStore.userEmail || '-' }}</span>
              <span class="profile-email">{{ authStore.userEmail }}</span>
            </div>
          </div>

          <!-- Edit buttons -->
          <div class="edit-buttons">
            <ion-button expand="block" fill="outline" @click="openUsernameModal" class="edit-btn" :disabled="!isOnline">
              <ion-icon slot="start" :icon="createOutline" />
              Changer le pseudo
            </ion-button>
            <ion-button expand="block" fill="outline" @click="openPasswordModal" class="edit-btn" :disabled="!isOnline">
              <ion-icon slot="start" :icon="keyOutline" />
              {{ authStore.hasPasswordProvider ? 'Changer le mot de passe' : 'Définir un mot de passe' }}
            </ion-button>
          </div>
        </div>

        <!-- Theme section -->
        <div class="settings-section">
          <p class="section-label">Apparence</p>
          <div class="setting-card">
            <p class="setting-title">Thème</p>
            <ion-segment :value="settingsStore.themeMode" @ionChange="onThemeChange" class="theme-segment">
              <ion-segment-button value="light">
                <ion-icon :icon="sunnyOutline" />
                <ion-label>Clair</ion-label>
              </ion-segment-button>
              <ion-segment-button value="system">
                <ion-icon :icon="phonePortraitOutline" />
                <ion-label>Système</ion-label>
              </ion-segment-button>
              <ion-segment-button value="dark">
                <ion-icon :icon="moonOutline" />
                <ion-label>Sombre</ion-label>
              </ion-segment-button>
            </ion-segment>
          </div>
        </div>

        <!-- Logout -->
        <div class="settings-section">
          <ion-button expand="block" color="danger" fill="outline" class="logout-btn" @click="handleLogout">
            <ion-icon slot="start" :icon="logOutOutline" />
            Se déconnecter
          </ion-button>
        </div>
      </div>

      <!-- Modal changement username -->
      <ion-modal :is-open="showUsernameModal" @didDismiss="showUsernameModal = false">
        <ion-header>
          <ion-toolbar>
            <h2 style="padding-left: 16px; font-size: 1.1rem; font-weight: 700;">Changer le pseudo</h2>
            <ion-button slot="end" fill="clear" @click="showUsernameModal = false">Fermer</ion-button>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-list>
            <ion-item>
              <ion-input v-model="newUsername" label="Nouveau pseudo" label-placement="floating"
                placeholder="Entrez votre nouveau pseudo" :maxlength="20" :clear-input="true" />
            </ion-item>
          </ion-list>
          <ion-button expand="block" @click="handleUsernameChange" class="modal-submit-btn"
            :disabled="authStore.loading">
            {{ authStore.loading ? 'Modification...' : 'Valider' }}
          </ion-button>
        </ion-content>
      </ion-modal>

      <!-- Modal changement mot de passe -->
      <ion-modal :is-open="showPasswordModal" @didDismiss="showPasswordModal = false">
        <ion-header>
          <ion-toolbar>
            <h2 style="padding-left: 16px; font-size: 1.1rem; font-weight: 700;">
              {{ authStore.hasPasswordProvider ? 'Changer le mot de passe' : 'Définir un mot de passe' }}
            </h2>
            <ion-button slot="end" fill="clear" @click="showPasswordModal = false">Fermer</ion-button>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-list>
            <ion-item v-if="authStore.hasPasswordProvider">
              <ion-input v-model="currentPassword" type="password" label="Mot de passe actuel"
                label-placement="floating" placeholder="Entrez votre mot de passe actuel" :clear-input="true" />
            </ion-item>
            <ion-item>
              <ion-input v-model="newPassword" type="password" label="Nouveau mot de passe" label-placement="floating"
                placeholder="Minimum 6 caractères" :clear-input="true" />
            </ion-item>
            <ion-item>
              <ion-input v-model="confirmPassword" type="password" label="Confirmer le mot de passe"
                label-placement="floating" placeholder="Retapez le mot de passe" :clear-input="true" />
            </ion-item>
          </ion-list>
          <ion-button expand="block" @click="handlePasswordChange" class="modal-submit-btn"
            :disabled="authStore.loading">
            {{ authStore.loading ? 'Modification...' : 'Valider' }}
          </ion-button>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.page-header-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
}

.header-icon {
  font-size: 1.2rem;
  color: var(--ion-color-primary);
}

.page-title-sm {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
}

.settings-container {
  padding: 20px 16px;
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--app-text-secondary);
  font-weight: 600;
  margin: 0 0 10px;
}

.settings-section {
  display: flex;
  flex-direction: column;
}

/* Profile */
.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 16px;
}

.profile-icon {
  font-size: 2.4rem;
  color: var(--ion-color-primary);
  flex-shrink: 0;
}

.profile-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-name {
  font-weight: 700;
  font-size: 1.05rem;
}

.profile-email {
  font-size: 0.82rem;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Settings card */
.setting-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 16px;
}

.setting-title {
  font-weight: 600;
  font-size: 1.05rem;
  margin-top: 0;
  margin-bottom: 12px;
}

.preferences-list {
  background: var(--app-surface);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  padding: 0;
}

.pref-item {
  --padding-start: 16px;
  --padding-end: 16px;
  --inner-padding-end: 0;
}

.pref-item ion-icon {
  margin-right: 12px;
  font-size: 1.4rem;
}

.pref-item ion-label {
  font-weight: 500;
  font-size: 0.95rem;
}

.theme-segment {
  --background: var(--app-surface-alt);
  border-radius: 10px;
}

.theme-segment ion-segment-button {
  --indicator-color: var(--ion-color-primary);
  --color-checked: var(--ion-text-color);
  --color: var(--ion-text-color);
  --border-radius: 8px;
  font-size: 0.78rem;
  min-height: 42px;
}

.theme-segment ion-segment-button ion-icon {
  font-size: 1rem;
  margin-bottom: 2px;
}

/* Logout */
.logout-btn {
  --border-radius: 14px;
  font-weight: 600;
  margin-top: 8px;
}

/* Edit buttons */
.edit-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.edit-btn {
  --border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
}

/* Modal */
.modal-submit-btn {
  --border-radius: 12px;
  margin-top: 20px;
  font-weight: 600;
}
</style>
