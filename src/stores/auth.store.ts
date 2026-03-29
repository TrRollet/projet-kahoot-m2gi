import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, db } from '@/firebase/config'
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  type UserCredential,
  type User
} from 'firebase/auth'
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isInitialized = ref(false)
  const currentUsername = ref<string | null>(null)

  // Getters
  const isConnected = computed(() => currentUser.value !== null)
  const userEmail = computed(() => currentUser.value?.email || '')
  const userUsername = computed(() => currentUsername.value || '')
  const hasPasswordProvider = computed(() => {
    if (!currentUser.value) return false
    return currentUser.value.providerData.some(provider => provider.providerId === 'password')
  })

  // Promise pour attendre l'initialisation
  let initPromise: Promise<void> | null = null

  // Initialiser l'observateur d'état d'authentification
  function initAuthListener() {
    if (initPromise) return initPromise
    
    initPromise = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        currentUser.value = user
        try {
          if (user) {
            const userDocSnap = await getDoc(doc(db, 'users', user.uid))
            currentUsername.value = userDocSnap.exists() ? (userDocSnap.data().username || null) : null
          } else {
            currentUsername.value = null
          }
        } catch {
          currentUsername.value = null
        } finally {
          isInitialized.value = true
          resolve()
        }
      })
    })
    
    return initPromise
  }

  // Attendre que l'authentification soit initialisée
  async function waitForAuthInit(): Promise<void> {
    if (isInitialized.value) return
    if (initPromise) return initPromise
    return initAuthListener()
  }

  // Actions
  async function createUser(email: string, password: string, username: string): Promise<UserCredential> {
    loading.value = true
    error.value = null
    try {
      const normalizedUsername = username.trim().toLowerCase()

      // Vérifier l'unicité du pseudo
      const usernameQuery = query(collection(db, 'users'), where('username', '==', normalizedUsername))
      const usernameSnapshot = await getDocs(usernameQuery)
      if (!usernameSnapshot.empty) {
        error.value = 'Ce pseudo est déjà utilisé'
        loading.value = false
        throw new Error('username-already-in-use')
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      currentUser.value = userCredential.user

      // Créer le document users/{uid} avec username + email (email nécessaire pour la connexion par pseudo)
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username: normalizedUsername,
        email: email
      })

      currentUsername.value = normalizedUsername
      loading.value = false

      firebaseSignOut(auth)
      return userCredential
    } catch (e: any) {
      console.error('Erreur lors de la création du compte:', e)
      if (!error.value) error.value = getErrorMessage(e.code)
      loading.value = false
      throw e
    }
  }

  async function signIn(emailOrUsername: string, password: string): Promise<UserCredential> {
    loading.value = true
    error.value = null
    try {
      let email = emailOrUsername.trim()

      // Si ce n'est pas un email (pas de @), chercher l'email par pseudo dans users
      if (!email.includes('@')) {
        const q = query(collection(db, 'users'), where('username', '==', email.toLowerCase()))
        const snapshot = await getDocs(q)
        if (snapshot.empty) {
          error.value = 'Aucun compte trouvé avec ce pseudo'
          loading.value = false
          throw new Error('user-not-found')
        }
        email = snapshot.docs[0].data().email
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      currentUser.value = userCredential.user

      // Charger le pseudo depuis users/{uid}
      const userDocSnap = await getDoc(doc(db, 'users', userCredential.user.uid))
      currentUsername.value = userDocSnap.exists() ? (userDocSnap.data().username || null) : null

      loading.value = false
      return userCredential
    } catch (e: any) {
      if (!error.value) error.value = getErrorMessage(e.code)
      loading.value = false
      throw e
    }
  }

  async function signInWithGoogle(): Promise<UserCredential> {
    loading.value = true
    error.value = null
    try {
      let userCredential: UserCredential

      if (Capacitor.isNativePlatform()) {
        // Natif : utiliser le plugin SocialLogin
        const result = await SocialLogin.login({
          provider: 'google',
          options: {}
        })

        const googleResult = result.result as any
        const idToken = googleResult.idToken
        if (!idToken) throw new Error('Aucun token Google reçu')
        userCredential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
      } else {
        // Web : popup classique
        userCredential = await signInWithPopup(auth, new GoogleAuthProvider())
      }
      currentUser.value = userCredential.user

      // Créer/mettre à jour le document user si nécessaire
      const userDocRef = doc(db, 'users', userCredential.user.uid)
      const userDocSnap = await getDoc(userDocRef)
      
      if (!userDocSnap.exists()) {
        // Générer un username basé sur l'email
        const baseUsername = userCredential.user.email?.split('@')[0]?.toLowerCase() || 'user'
        let username = baseUsername
        let counter = 1
        
        // Vérifier l'unicité (max 100 tentatives)
        let isUnique = false
        while (!isUnique && counter < 100) {
          const q = query(collection(db, 'users'), where('username', '==', username))
          const snap = await getDocs(q)
          if (snap.empty) {
            isUnique = true
          } else {
            username = `${baseUsername}${counter}`
            counter++
          }
        }
        
        await setDoc(userDocRef, {
          username,
          email: userCredential.user.email || ''
        })
        currentUsername.value = username
      } else {
        currentUsername.value = userDocSnap.data().username || null
      }

      loading.value = false
      return userCredential
    } catch (e: any) {
      console.error('Erreur Google Sign-In:', e)
      error.value = getErrorMessage(e.code) || e.message || 'Erreur lors de la connexion avec Google'
      loading.value = false
      throw e
    }
  }

  async function signOut(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await firebaseSignOut(auth)
      currentUser.value = null
      loading.value = false
    } catch (e: any) {
      error.value = 'Erreur lors de la déconnexion'
      loading.value = false
      throw e
    }
  }

  async function sendVerificationEmail(): Promise<void> {
    if (!currentUser.value) {
      throw new Error('Aucun utilisateur connecté')
    }
    loading.value = true
    error.value = null
    try {
      await sendEmailVerification(currentUser.value)
      loading.value = false
    } catch (e: any) {
      error.value = 'Erreur lors de l\'envoi de l\'email de vérification'
      loading.value = false
      throw e
    }
  }

  async function resetPassword(email: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await sendPasswordResetEmail(auth, email)
      loading.value = false
    } catch (e: any) {
      error.value = getErrorMessage(e.code)
      loading.value = false
      throw e
    }
  }

  async function getUserIdByEmail(email: string): Promise<string | null> {
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      return snapshot.docs[0].data().uid
    } catch (e) {
      console.error('Erreur lors de la recherche par email:', e)
      return null
    }
  }

  async function getUserIdByUsername(username: string): Promise<string | null> {
    try {
      const q = query(collection(db, 'users'), where('username', '==', username.trim().toLowerCase()))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      return snapshot.docs[0].id
    } catch (e) {
      console.error('Erreur lors de la recherche par pseudo:', e)
      return null
    }
  }

  async function getUsernameByUserId(uid: string): Promise<string | null> {
    try {
      const userDocSnap = await getDoc(doc(db, 'users', uid))
      if (!userDocSnap.exists()) return null
      return userDocSnap.data().username || null
    } catch (e) {
      console.error('Erreur lors de la recherche du pseudo:', e)
      return null
    }
  }

  async function getEmailByUserId(uid: string): Promise<string | null> {
    try {
      const userDocSnap = await getDoc(doc(db, 'users', uid))
      if (!userDocSnap.exists()) return null
      return userDocSnap.data().email || null
    } catch (e) {
      console.error('Erreur lors de la recherche de l\'email:', e)
      return null
    }
  }

  function resetError() {
    error.value = null
  }

  // Changer le mot de passe
  async function updateUserPassword(currentPassword: string | null, newPassword: string): Promise<void> {
    if (!currentUser.value || !currentUser.value.email) {
      throw new Error('Aucun utilisateur connecté')
    }
    loading.value = true
    error.value = null
    try {
      // Si l'utilisateur a déjà un mot de passe, réauthentifier
      const hasPassword = currentUser.value.providerData.some(p => p.providerId === 'password')
      
      if (hasPassword && currentPassword) {
        // Réauthentifier l'utilisateur avec son mot de passe actuel
        const credential = EmailAuthProvider.credential(
          currentUser.value.email,
          currentPassword
        )
        await reauthenticateWithCredential(currentUser.value, credential)
      } else if (hasPassword && !currentPassword) {
        throw new Error('Mot de passe actuel requis')
      }
      // Si pas de mot de passe (connexion Google), on peut directement définir un nouveau mot de passe
      
      // Maintenant changer/définir le mot de passe
      await updatePassword(currentUser.value, newPassword)
      loading.value = false
    } catch (e: any) {
      console.error('Erreur lors du changement de mot de passe:', e)
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
        error.value = 'Mot de passe actuel incorrect'
      } else {
        error.value = getErrorMessage(e.code)
      }
      loading.value = false
      throw e
    }
  }

  // Changer le username
  async function updateUserUsername(newUsername: string): Promise<void> {
    if (!currentUser.value) {
      throw new Error('Aucun utilisateur connecté')
    }
    
    const trimmedUsername = newUsername.trim().toLowerCase()
    
    if (trimmedUsername.length < 3) {
      throw new Error('Le pseudo doit contenir au moins 3 caractères')
    }
    
    loading.value = true
    error.value = null
    
    try {
      // Vérifier que le username n'est pas déjà pris
      const q = query(collection(db, 'users'), where('username', '==', trimmedUsername))
      const snapshot = await getDocs(q)
      
      // Si le username existe déjà et n'est pas le nôtre
      if (!snapshot.empty && snapshot.docs[0].id !== currentUser.value.uid) {
        throw new Error('Ce pseudo est déjà utilisé')
      }
      
      // Mettre à jour le document Firestore
      const userDocRef = doc(db, 'users', currentUser.value.uid)
      await setDoc(userDocRef, { username: trimmedUsername }, { merge: true })
      
      // Mettre à jour le state local
      currentUsername.value = trimmedUsername
      
      loading.value = false
    } catch (e: any) {
      console.error('Erreur lors du changement de pseudo:', e)
      error.value = e.message || 'Erreur lors du changement de pseudo'
      loading.value = false
      throw e
    }
  }

  // Helper pour traduire les erreurs Firebase
  function getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée'
      case 'auth/invalid-email':
        return 'Adresse email invalide'
      case 'auth/operation-not-allowed':
        return 'Opération non autorisée'
      case 'auth/weak-password':
        return 'Le mot de passe est trop faible'
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé'
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cette adresse email'
      case 'auth/wrong-password':
        return 'Mot de passe incorrect'
      case 'auth/invalid-credential':
        return 'Identifiants invalides'
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Réessayez plus tard'
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Connexion annulée'
      case 'auth/popup-blocked':
        return 'La fenêtre popup a été bloquée par le navigateur'
      case 'auth/network-request-failed':
        return 'Erreur réseau. Vérifiez votre connexion internet'
      case 'auth/internal-error':
        return 'Erreur interne. Réessayez'
      case 'auth/account-exists-with-different-credential':
        return 'Un compte existe déjà avec cet email'
      default:
        return 'Une erreur est survenue'
    }
  }

  return {
    // State
    currentUser,
    currentUsername,
    loading,
    error,
    isInitialized,
    // Getters
    isConnected,
    userEmail,
    userUsername,
    hasPasswordProvider,
    // Actions
    initAuthListener,
    waitForAuthInit,
    createUser,
    signIn,
    signInWithGoogle,
    signOut,
    sendVerificationEmail,
    resetPassword,
    updateUserPassword,
    updateUserUsername,
    getUserIdByEmail,
    getUserIdByUsername,
    getUsernameByUserId,
    getEmailByUserId,
    resetError
  }
})
