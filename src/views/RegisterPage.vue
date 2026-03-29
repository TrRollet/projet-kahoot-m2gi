<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonSpinner,
  toastController
} from '@ionic/vue'
import { schoolOutline, arrowBackOutline } from 'ionicons/icons'
import { useNetwork } from '@/utils/useNetwork'
import OfflineBanner from '@/components/OfflineBanner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isOnline } = useNetwork()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const isSubmitting = ref(false)

const handleRegister = async () => {
  if (!isOnline.value) return
  // Validation
  if (!email.value || !password.value || !confirmPassword.value || !username.value) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Veuillez remplir tous les champs',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
  if (!usernameRegex.test(username.value.trim())) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Le pseudo doit contenir 3 à 20 caractères (lettres, chiffres, _)',
      duration: 3000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  if (password.value !== confirmPassword.value) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Les mots de passe ne correspondent pas',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  if (password.value.length < 6) {
    const toast = await toastController.create({
      position: 'top',
      message: 'Le mot de passe doit contenir au moins 6 caractères',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  isSubmitting.value = true
  try {
    await authStore.createUser(email.value, password.value, username.value)

    // Envoyer l'email de vérification
    try {
      await authStore.sendVerificationEmail()
      const toast = await toastController.create({
        position: 'top',
        message: 'Compte créé ! Vérifiez votre email avant de vous connecter.',
        duration: 5000,
        color: 'success'
      })
      await toast.present()
    } catch (verifyError) {
      // Si l'envoi de l'email échoue, on continue quand même
      const toast = await toastController.create({
        position: 'top',
        message: 'Compte créé ! Vérifiez votre email avant de vous connecter.',
        duration: 4000,
        color: 'success'
      })
      await toast.present()
    }

    // Déconnecter l'utilisateur et rediriger vers login
    await authStore.signOut()
    const loginQuery = route.query.redirect ? { redirect: route.query.redirect as string } : {}
    router.push({ name: 'Login', query: loginQuery })
  } catch (error: any) {
    const toast = await toastController.create({
      position: 'top',
      message: authStore.error || 'Erreur lors de la création du compte',
      duration: 3000,
      color: 'danger'
    })
    await toast.present()
  } finally {
    isSubmitting.value = false
  }
}

const goToLogin = () => {
  const query = route.query.redirect ? { redirect: route.query.redirect as string } : {}
  router.push({ name: 'Login', query })
}
</script>

<template>
  <ion-page>
    <ion-content class="ion-padding" :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div class="auth-container">
        <ion-button fill="clear" size="small" class="back-btn" @click="goToLogin">
          <ion-icon slot="start" :icon="arrowBackOutline" />
          Retour
        </ion-button>

        <div class="auth-brand">
          <ion-icon :icon="schoolOutline" class="brand-icon" />
          <h1 class="brand-title">Inscription</h1>
        </div>

        <form @submit.prevent="handleRegister" class="auth-form">
          <ion-input v-model="username" type="text" label="Pseudo" label-placement="floating" fill="outline"
            placeholder="mon_pseudo" autocomplete="username" :maxlength="20" class="auth-input" />
          <ion-input v-model="email" type="email" label="Email" label-placement="floating" fill="outline"
            placeholder="votre@email.com" autocomplete="email" class="auth-input" />
          <ion-input v-model="password" type="password" label="Mot de passe" label-placement="floating" fill="outline"
            placeholder="6 caractères minimum" autocomplete="new-password" class="auth-input" />
          <ion-input v-model="confirmPassword" type="password" label="Confirmer le mot de passe"
            label-placement="floating" fill="outline" placeholder="********" autocomplete="new-password"
            class="auth-input" />

          <ion-button expand="block" type="submit" :disabled="isSubmitting || !isOnline" class="auth-btn">
            <ion-spinner v-if="isSubmitting" name="crescent" />
            <span v-else>Créer mon compte</span>
          </ion-button>
        </form>

        <div class="auth-footer">
          <span class="footer-text">Déjà un compte ?</span>
          <ion-button fill="clear" size="small" @click="goToLogin">Se connecter</ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px 20px;
  max-width: 400px;
  margin: 0 auto;
}

.back-btn {
  align-self: flex-start;
  --color: var(--app-text-secondary);
  margin-bottom: 8px;
}

.auth-brand {
  text-align: center;
  margin-bottom: 32px;
}

.brand-icon {
  font-size: 2.8rem;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.brand-title {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0;
  color: var(--ion-text-color);
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-input {
  --border-radius: 12px;
}

.auth-btn {
  --border-radius: 12px;
  margin-top: 6px;
  font-weight: 600;
  height: 48px;
}

.auth-footer {
  margin-top: 24px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-text {
  color: var(--app-text-secondary);
  font-size: 0.9rem;
}
</style>
