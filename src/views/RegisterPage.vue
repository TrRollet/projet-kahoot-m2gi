<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonBackButton,
  IonButtons,
  toastController
} from '@ionic/vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')
const isSubmitting = ref(false)

const handleRegister = async () => {
  // Validation
  if (!email.value || !password.value || !confirmPassword.value || !username.value) {
    const toast = await toastController.create({
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
      message: 'Le pseudo doit contenir 3 à 20 caractères (lettres, chiffres, _)',
      duration: 3000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  if (password.value !== confirmPassword.value) {
    const toast = await toastController.create({
      message: 'Les mots de passe ne correspondent pas',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  if (password.value.length < 6) {
    const toast = await toastController.create({
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
        message: 'Compte créé ! Vérifiez votre email avant de vous connecter.',
        duration: 5000,
        color: 'success'
      })
      await toast.present()
    } catch (verifyError) {
      // Si l'envoi de l'email échoue, on continue quand même
      const toast = await toastController.create({
        message: 'Compte créé ! Vérifiez votre email avant de vous connecter.',
        duration: 4000,
        color: 'success'
      })
      await toast.present()
    }
    
    // Déconnecter l'utilisateur et rediriger vers login
    await authStore.signOut()
    router.push('/login')
  } catch (error: any) {
    const toast = await toastController.create({
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
  router.push('/login')
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/login"></ion-back-button>
        </ion-buttons>
        <ion-title>Créer un compte</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="register-container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Inscription</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <form @submit.prevent="handleRegister">
              <ion-item>
                <ion-label position="stacked">Pseudo</ion-label>
                <ion-input
                  v-model="username"
                  type="text"
                  placeholder="mon_pseudo"
                  required
                  autocomplete="username"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Email</ion-label>
                <ion-input
                  v-model="email"
                  type="email"
                  placeholder="votre@email.com"
                  required
                  autocomplete="email"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Mot de passe</ion-label>
                <ion-input
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autocomplete="new-password"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Confirmer le mot de passe</ion-label>
                <ion-input
                  v-model="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  autocomplete="new-password"
                />
              </ion-item>

              <ion-button
                expand="block"
                type="submit"
                :disabled="isSubmitting"
                style="margin-top: 20px;"
              >
                <ion-spinner v-if="isSubmitting" name="crescent" />
                <span v-else>
                  Créer mon compte
                </span>
              </ion-button>
            </form>

            <div class="login-link">
              <ion-text color="medium">
                Déjà un compte ?
              </ion-text>
              <ion-button fill="clear" @click="goToLogin">
                Se connecter
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 20px;
}

ion-card {
  max-width: 500px;
  width: 100%;
}

ion-item {
  margin-bottom: 16px;
}

.login-link {
  text-align: center;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-link ion-button {
  margin-top: -10px;
}
</style>
