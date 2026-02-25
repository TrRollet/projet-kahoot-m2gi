import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, db } from '@/firebase/config'
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
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

      // Vérifier l'unicité du pseudo (query sans auth → users doit être lisible sans auth)
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
    // Actions
    initAuthListener,
    waitForAuthInit,
    createUser,
    signIn,
    signOut,
    sendVerificationEmail,
    resetPassword,
    getUserIdByEmail,
    getUserIdByUsername,
    getUsernameByUserId,
    getEmailByUserId,
    resetError
  }
})
