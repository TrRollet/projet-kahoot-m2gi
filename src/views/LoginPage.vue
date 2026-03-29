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
  toastController,
  alertController,
  onIonViewDidEnter
} from '@ionic/vue'
import { schoolOutline, logoGoogle } from 'ionicons/icons'
import { useNetwork } from '@/utils/useNetwork'
import OfflineBanner from '@/components/OfflineBanner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isOnline } = useNetwork()

const identifier = ref('')
const password = ref('')
const isSubmitting = ref(false)
const isGoogleSignIn = ref(false)

// Vider les champs à chaque fois qu'on revient sur la page (après déconnexion notamment)
onIonViewDidEnter(() => {
  identifier.value = ''
  password.value = ''
  authStore.resetError()
})

const handleGoogleSignIn = async () => {
  if (!isOnline.value) return
  isGoogleSignIn.value = true
  try {
    await authStore.signInWithGoogle()
    const toast = await toastController.create({ position: 'top',
      message: 'Connexion avec Google réussie !',
      duration: 2000,
      color: 'success'
    })
    await toast.present()
    const redirectPath = (route.query.redirect as string) || '/home'
    router.push(redirectPath)
  } catch (error: any) {
    const toast = await toastController.create({ position: 'top',
      message: authStore.error || error.message || 'Erreur lors de la connexion avec Google',
      duration: 3000,
      color: 'danger'
    })
    await toast.present()
  } finally {
    isGoogleSignIn.value = false
  }
}

const handleLogin = async () => {
  if (!isOnline.value) return
  if (!identifier.value || !password.value) {
    const toast = await toastController.create({ position: 'top',
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
      
      const toast = await toastController.create({ position: 'top',
        message: 'Veuillez vérifier votre email avant de vous connecter. Consultez votre boîte mail.',
        duration: 5000,
        color: 'warning'
      })
      await toast.present()
      return
    }
    
    const toast = await toastController.create({ position: 'top',
      message: 'Connexion réussie !',
      duration: 2000,
      color: 'success'
    })
    await toast.present()
    
    // Rediriger vers la page demandée ou /home par défaut
    const redirectPath = (route.query.redirect as string) || '/home'
    router.push(redirectPath)
  } catch (error: any) {
    const toast = await toastController.create({ position: 'top',
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
  const query = route.query.redirect ? { redirect: route.query.redirect as string } : {}
  router.push({ name: 'Register', query })
}

const handleForgotPassword = async () => {
  if (!isOnline.value) {
    const toast = await toastController.create({ position: 'top',
      message: 'Pas de connexion internet',
      duration: 2000,
      color: 'warning'
    })
    await toast.present()
    return
  }
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
            const toast = await toastController.create({ position: 'top',
              message: 'Veuillez entrer une adresse email',
              duration: 2000,
              color: 'warning'
            })
            await toast.present()
            return false
          }
          
          try {
            await authStore.resetPassword(data.email)
            const toast = await toastController.create({ position: 'top',
              message: 'Email de réinitialisation envoyé !',
              duration: 3000,
              color: 'success'
            })
            await toast.present()
            return true
          } catch (error) {
            const toast = await toastController.create({ position: 'top',
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
    <ion-content class="ion-padding" :fullscreen="true">
      <offline-banner v-if="!isOnline" />
      <div class="auth-container">
        <div class="auth-brand">
          <ion-icon :icon="schoolOutline" class="brand-icon" />
          <h1 class="brand-title">Kahoot</h1>
          <p class="brand-sub">Testez vos connaissances en temps réel</p>
        </div>

        <form @submit.prevent="handleLogin" class="auth-form">
          <ion-input
            v-model="identifier"
            type="text"
            label="Email ou pseudo"
            label-placement="floating"
            fill="outline"
            placeholder="votre@email.com ou pseudo"
            autocomplete="username"
            class="auth-input"
          />
          <ion-input
            v-model="password"
            type="password"
            label="Mot de passe"
            label-placement="floating"
            fill="outline"
            placeholder="********"
            autocomplete="current-password"
            class="auth-input"
          />

          <ion-button expand="block" type="submit" :disabled="isSubmitting || !isOnline" class="auth-btn">
            <ion-spinner v-if="isSubmitting" name="crescent" />
            <span v-else>Se connecter</span>
          </ion-button>

          <div class="divider">
            <span class="divider-line" />
            <span class="divider-text">ou</span>
            <span class="divider-line" />
          </div>

          <ion-button expand="block" fill="outline" :disabled="isGoogleSignIn || !isOnline" class="google-btn" @click="handleGoogleSignIn">
            <ion-spinner v-if="isGoogleSignIn" name="crescent" />
            <template v-else>
              <ion-icon slot="start" :icon="logoGoogle" />
              Continuer avec Google
            </template>
          </ion-button>
        </form>

        <ion-button fill="clear" size="small" class="forgot-btn" @click="handleForgotPassword" :disabled="!isOnline">
          Mot de passe oublié ?
        </ion-button>

        <div class="auth-footer">
          <span class="footer-text">Pas encore de compte ?</span>
          <ion-button fill="clear" size="small" @click="goToRegister">Créer un compte</ion-button>
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
.auth-brand {
  text-align: center;
  margin-bottom: 40px;
}
.brand-icon {
  font-size: 3.2rem;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}
.brand-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -0.02em;
  color: var(--ion-text-color);
}
.brand-sub {
  margin: 6px 0 0;
  font-size: 0.9rem;
  color: var(--app-text-secondary);
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
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 8px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: var(--app-border);
}
.divider-text {
  font-size: 0.82rem;
  color: var(--app-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.google-btn {
  --border-radius: 12px;
  --border-width: 1.5px;
  --border-color: var(--app-border);
  font-weight: 600;
  height: 48px;
}
.forgot-btn {
  margin-top: 4px;
  --color: var(--app-text-secondary);
  font-size: 0.85rem;
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
