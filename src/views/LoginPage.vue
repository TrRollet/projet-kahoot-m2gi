<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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
  toastController,
  alertController,
  onIonViewDidEnter
} from '@ionic/vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const identifier = ref('')
const password = ref('')
const isSubmitting = ref(false)

// Vider les champs à chaque fois qu'on revient sur la page (après déconnexion notamment)
onIonViewDidEnter(() => {
  identifier.value = ''
  password.value = ''
  authStore.resetError()
})

const handleLogin = async () => {
  if (!identifier.value || !password.value) {
    const toast = await toastController.create({
      message: 'Veuillez remplir tous les champs',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }

  isSubmitting.value = true
  try {
    await authStore.signIn(identifier.value, password.value)
    
    // Vérifier si l'email est vérifié
    if (authStore.currentUser && !authStore.currentUser.emailVerified) {
      // Déconnecter l'utilisateur
      await authStore.signOut()
      
      const toast = await toastController.create({
        message: 'Veuillez vérifier votre email avant de vous connecter. Consultez votre boîte mail.',
        duration: 5000,
        color: 'warning'
      })
      await toast.present()
      return
    }
    
    const toast = await toastController.create({
      message: 'Connexion réussie !',
      duration: 2000,
      color: 'success'
    })
    await toast.present()
    
    // Rediriger vers la page demandée ou /home par défaut
    const redirectPath = (route.query.redirect as string) || '/home'
    router.push(redirectPath)
  } catch (error: any) {
    const toast = await toastController.create({
      message: authStore.error || 'Erreur de connexion',
      duration: 3000,
      color: 'danger'
    })
    await toast.present()
  } finally {
    isSubmitting.value = false
  }
}

const goToRegister = () => {
  router.push('/register')
}

const handleForgotPassword = async () => {
  const alert = await alertController.create({
    header: 'Mot de passe oublié',
    message: 'Entrez votre adresse email pour recevoir un lien de réinitialisation',
    inputs: [
      {
        name: 'email',
        type: 'email',
        placeholder: 'votre@email.com',
        value: identifier.value.includes('@') ? identifier.value : ''
      }
    ],
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Envoyer',
        handler: async (data) => {
          if (!data.email || !data.email.trim()) {
            const toast = await toastController.create({
              message: 'Veuillez entrer une adresse email',
              duration: 2000,
              color: 'warning'
            })
            await toast.present()
            return false
          }
          
          try {
            await authStore.resetPassword(data.email)
            const toast = await toastController.create({
              message: 'Email de réinitialisation envoyé !',
              duration: 3000,
              color: 'success'
            })
            await toast.present()
            return true
          } catch (error) {
            const toast = await toastController.create({
              message: authStore.error || 'Erreur lors de l\'envoi de l\'email',
              duration: 3000,
              color: 'danger'
            })
            await toast.present()
            return false
          }
        }
      }
    ]
  })
  
  await alert.present()
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Connexion</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="login-container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Bienvenue</ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <form @submit.prevent="handleLogin">
              <ion-item>
                <ion-label position="stacked">Email ou pseudo</ion-label>
                <ion-input
                  v-model="identifier"
                  type="text"
                  placeholder="votre@email.com ou mon_pseudo"
                  required
                  autocomplete="username"
                />
              </ion-item>

              <ion-item>
                <ion-label position="stacked">Mot de passe</ion-label>
                <ion-input
                  v-model="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  autocomplete="current-password"
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
                  Se connecter
                </span>
              </ion-button>
            </form>

            <div style="text-align: center; margin-top: 10px;">
              <ion-button fill="clear" size="small" @click="handleForgotPassword">
                Mot de passe oublié ?
              </ion-button>
            </div>

            <div class="register-link">
              <ion-text color="medium">
                Pas encore de compte ?
              </ion-text>
              <ion-button fill="clear" @click="goToRegister">
                Créer un compte
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.login-container {
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

.register-link {
  text-align: center;
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.register-link ion-button {
  margin-top: -10px;
}
</style>
