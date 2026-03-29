import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/firebase/config'
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  or,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore'
import type { Quiz, UserRole } from '@/models/quiz'
import type { NumberQuestion, SingleChoiceQuestion } from '@/models/question/types'
import { useAuthStore } from './auth.store'
import { useAchievementsStore } from './achievements.store'

export const useQuizStore = defineStore('quiz', () => {
  // State
  const quizzes = ref<Quiz[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Référence à la collection Firestore
  const quizzesCollection = collection(db, 'quizzes')

  // Getters
  const allQuizzes = computed(() => quizzes.value)
  
  const getQuizById = computed(() => {
    return (id: string) => quizzes.value.find(q => q.id === id)
  })
  
  const quizCount = computed(() => quizzes.value.length)

  // Helper pour déterminer le rôle de l'utilisateur sur un quiz
  function getUserRole(quiz: Quiz, userId: string): UserRole {
    if (quiz.ownerId === userId) return 'owner'
    if (quiz.editors?.includes(userId)) return 'editor'
    if (quiz.readers?.includes(userId)) return 'reader'
    return 'none'
  }

  // Vérifier si l'utilisateur peut éditer
  function canEdit(quiz: Quiz, userId: string): boolean {
    const role = getUserRole(quiz, userId)
    return role === 'owner' || role === 'editor'
  }

  // Vérifier si l'utilisateur peut supprimer
  function canDelete(quiz: Quiz, userId: string): boolean {
    return getUserRole(quiz, userId) === 'owner'
  }

  // Actions
  async function fetchQuizzes() {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        quizzes.value = []
        loading.value = false
        return
      }

      // Récupérer uniquement les quiz où l'utilisateur est owner, editor ou reader
      const q = query(
        quizzesCollection,
        or(
          where('ownerId', '==', currentUserId),
          where('editors', 'array-contains', currentUserId),
          where('readers', 'array-contains', currentUserId)
        )
      )
      
      const snapshot = await getDocs(q)
      
      // Récupérer chaque quiz avec ses questions depuis la sous-collection
      const quizzesPromises = snapshot.docs.map(async (quizDoc) => {
        const data = quizDoc.data()
        
        // Récupérer les questions depuis la sous-collection
        const questionsCollection = collection(db, 'quizzes', quizDoc.id, 'questions')
        const questionsSnapshot = await getDocs(questionsCollection)
        
        const questions = questionsSnapshot.docs.map(qDoc => {
          const qData = qDoc.data()
          const base = {
            id: qDoc.id,
            type: qData.type || 'single',
            text: qData.text || '',
            order: qData.order ?? 0,
            ...(qData.imageBase64 ? { imageBase64: qData.imageBase64 } : {})
          }

          if (base.type === 'number') {
            return {
              ...base,
              type: 'number',
              correctNumber: qData.correctNumber ?? 0,
              numberType: qData.numberType || 'amount'
            } as NumberQuestion
          } else {
            return {
              ...base,
              type: 'single',
              choices: qData.choices || [],
              correctAnswerIndex: qData.correctAnswerIndex ?? 0
            } as SingleChoiceQuestion
          }
        }).sort((a, b) => (a as any).order - (b as any).order)

        return {
          id: quizDoc.id,
          title: data.title || '',
          description: data.description || '',
          questions: questions,
          ownerId: data.ownerId || '',
          editors: data.editors || [],
          readers: data.readers || []
        } as Quiz
      })
      
      quizzes.value = await Promise.all(quizzesPromises)
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors du chargement des quiz'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function fetchQuizById(quizId: string): Promise<Quiz | null> {
    loading.value = true
    error.value = null
    try {
      const quizDoc = await getDoc(doc(db, 'quizzes', quizId))
      
      if (!quizDoc.exists()) {
        loading.value = false
        return null
      }
      
      const data = quizDoc.data()
      
      // Récupérer les questions depuis la sous-collection (choices est un array dans chaque question)
      const questionsCollection = collection(db, 'quizzes', quizDoc.id, 'questions')
      const questionsSnapshot = await getDocs(questionsCollection)
      
      const questions = questionsSnapshot.docs.map(qDoc => {
        const qData = qDoc.data()
        const question: any = {
          id: qDoc.id,
          type: qData.type || 'single',
          text: qData.text || '',
          order: qData.order ?? 0,
          ...(qData.imageBase64 ? { imageBase64: qData.imageBase64 } : {})
        }

        if (question.type === 'number') {
          question.correctNumber = qData.correctNumber ?? 0
          question.numberType = qData.numberType || 'amount'
        } else {
          question.choices = qData.choices || []
          question.correctAnswerIndex = qData.correctAnswerIndex ?? 0
        }
        return question as any
      }).sort((a, b) => a.order - b.order)
      
      const quiz = {
        id: quizDoc.id,
        title: data.title || '',
        description: data.description || '',
        questions: questions,
        ownerId: data.ownerId || '',
        editors: data.editors || [],
        readers: data.readers || []
      } as Quiz
      
      loading.value = false
      return quiz
    } catch (e) {
      error.value = 'Erreur lors du chargement du quiz'
      loading.value = false
      console.error('Erreur Firestore:', e)
      return null
    }
  }

  async function addQuiz(quiz: Quiz) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('User must be authenticated to create a quiz')
      }
      
      // Ajouter le quiz avec ownership (sans les questions)
      const quizData = {
        title: quiz.title,
        description: quiz.description,
        ownerId: currentUserId,
        editors: [],
        readers: []
      }
      
      const docRef = await addDoc(quizzesCollection, quizData)
      
      // Ajouter les questions dans la sous-collection (avec choices comme array)
      if (quiz.questions && quiz.questions.length > 0) {
        const questionsCollection = collection(db, 'quizzes', docRef.id, 'questions')

        const savedQuestions: any[] = []
        for (let i = 0; i < quiz.questions.length; i++) {
          const question = quiz.questions[i]
          const isNumber = question.type === 'number'
          let questionData: any
          if (isNumber) {
            questionData = {
              type: 'number',
              text: question.text,
              order: i,
              correctNumber: (question as NumberQuestion).correctNumber ?? 0,
              numberType: (question as NumberQuestion).numberType || 'amount',
              ...(question.imageBase64 ? { imageBase64: question.imageBase64 } : {})
            }
          } else {
            const q = question as SingleChoiceQuestion
            questionData = {
              type: 'single',
              text: q.text,
              order: i,
              choices: q.choices || [],
              correctAnswerIndex: q.correctAnswerIndex ?? 0,
              ...(q.imageBase64 ? { imageBase64: q.imageBase64 } : {})
            }
          }

          const qDocRef = await addDoc(questionsCollection, questionData)
          savedQuestions.push({ id: qDocRef.id, ...questionData })
        }
        
        // Mettre à jour les questions avec les versions nettoyées et leurs IDs
        quiz.questions = savedQuestions
      }
      
      // Ajouter localement avec le nouvel ID
      const newQuiz = {
        id: docRef.id,
        title: quizData.title,
        description: quizData.description,
        ownerId: quizData.ownerId,
        editors: quizData.editors,
        readers: quizData.readers,
        questions: quiz.questions || []
      } as Quiz
      
      quizzes.value.push(newQuiz)
      
      const achievementsStore = useAchievementsStore()
      achievementsStore.updateStats({ quizzesCreated: 1 }).catch(console.error)

      loading.value = false
      return newQuiz
    } catch (e) {
      error.value = 'Erreur lors de l\'ajout du quiz'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function updateQuiz(updatedQuiz: Quiz) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié pour modifier un quiz')
      }
      
      // Vérifier les permissions
      if (!canEdit(updatedQuiz, currentUserId)) {
        throw new Error('Vous n\'avez pas la permission de modifier ce quiz')
      }
      
      // Référence au document
      const quizDoc = doc(db, 'quizzes', updatedQuiz.id)
      
      // Mettre à jour les informations du quiz (sans les questions)
      const quizData = {
        title: updatedQuiz.title,
        description: updatedQuiz.description
      }
      
      await updateDoc(quizDoc, quizData)
      
      // Supprimer toutes les anciennes questions de la sous-collection
      const questionsCollection = collection(db, 'quizzes', updatedQuiz.id, 'questions')
      const oldQuestionsSnapshot = await getDocs(questionsCollection)
      
      for (const questionDoc of oldQuestionsSnapshot.docs) {
        await deleteDoc(doc(db, 'quizzes', updatedQuiz.id, 'questions', questionDoc.id))
      }
      
      // Ajouter les nouvelles questions avec leurs choices comme array
      if (updatedQuiz.questions && updatedQuiz.questions.length > 0) {
        const savedQuestions: any[] = []
        for (let i = 0; i < updatedQuiz.questions.length; i++) {
          const question = updatedQuiz.questions[i]
          const isNumber = question.type === 'number'
          let questionData: any
          if (isNumber) {
            questionData = {
              type: 'number',
              text: question.text,
              order: i,
              correctNumber: (question as NumberQuestion).correctNumber ?? 0,
              numberType: (question as NumberQuestion).numberType || 'amount',
              ...(question.imageBase64 ? { imageBase64: question.imageBase64 } : {})
            }
          } else {
            const q = question as SingleChoiceQuestion
            questionData = {
              type: 'single',
              text: q.text,
              order: i,
              choices: q.choices || [],
              correctAnswerIndex: q.correctAnswerIndex ?? 0,
              ...(q.imageBase64 ? { imageBase64: q.imageBase64 } : {})
            }
          }

          const qDocRef = await addDoc(questionsCollection, questionData)
          savedQuestions.push({ id: qDocRef.id, ...questionData })
        }
        updatedQuiz.questions = savedQuestions
      }
      
      // Mettre à jour localement
      const index = quizzes.value.findIndex(q => q.id === updatedQuiz.id)
      if (index !== -1) {
        quizzes.value[index] = updatedQuiz
      }
      
      loading.value = false
      return updatedQuiz
    } catch (e) {
      error.value = 'Erreur lors de la mise à jour du quiz'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function deleteQuiz(quizId: string) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié pour supprimer un quiz')
      }
      
      // Récupérer le quiz pour vérifier les permissions
      const quiz = await fetchQuizById(quizId)
      if (!quiz) {
        throw new Error('Quiz non trouvé')
      }
      
      // Vérifier les permissions
      if (!canDelete(quiz, currentUserId)) {
        throw new Error('Vous n\'avez pas la permission de supprimer ce quiz')
      }
      
      // Supprimer toutes les questions de la sous-collection
      const questionsCollection = collection(db, 'quizzes', quizId, 'questions')
      const questionsSnapshot = await getDocs(questionsCollection)
      
      for (const questionDoc of questionsSnapshot.docs) {
        await deleteDoc(doc(db, 'quizzes', quizId, 'questions', questionDoc.id))
      }
      
      // Supprimer le document quiz
      const quizDoc = doc(db, 'quizzes', quizId)
      await deleteDoc(quizDoc)
      
      // Supprimer localement
      quizzes.value = quizzes.value.filter(q => q.id !== quizId)
      
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors de la suppression du quiz'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function addEditor(quizId: string, userId: string) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié')
      }
      
      // Récupérer le quiz pour vérifier les permissions
      const quiz = await fetchQuizById(quizId)
      if (!quiz) {
        throw new Error('Quiz non trouvé')
      }
      
      // Seul l'owner peut ajouter des editors
      if (quiz.ownerId !== currentUserId) {
        throw new Error('Seul le propriétaire peut ajouter des éditeurs')
      }
      
      // Ajouter l'userId aux editors
      const quizDoc = doc(db, 'quizzes', quizId)
      await updateDoc(quizDoc, {
        editors: arrayUnion(userId)
      })
      
      // Mettre à jour localement
      const index = quizzes.value.findIndex(q => q.id === quizId)
      if (index !== -1 && quizzes.value[index].editors) {
        if (!quizzes.value[index].editors!.includes(userId)) {
          quizzes.value[index].editors!.push(userId)
        }
      }
      
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors de l\'ajout d\'un éditeur'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function removeEditor(quizId: string, userId: string) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié')
      }
      
      // Récupérer le quiz pour vérifier les permissions
      const quiz = await fetchQuizById(quizId)
      if (!quiz) {
        throw new Error('Quiz non trouvé')
      }
      
      // Seul l'owner peut retirer des editors
      if (quiz.ownerId !== currentUserId) {
        throw new Error('Seul le propriétaire peut retirer des éditeurs')
      }
      
      // Retirer l'userId des editors
      const quizDoc = doc(db, 'quizzes', quizId)
      await updateDoc(quizDoc, {
        editors: arrayRemove(userId)
      })
      
      // Mettre à jour localement
      const index = quizzes.value.findIndex(q => q.id === quizId)
      if (index !== -1 && quizzes.value[index].editors) {
        quizzes.value[index].editors = quizzes.value[index].editors!.filter(id => id !== userId)
      }
      
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors du retrait d\'un éditeur'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function addReader(quizId: string, userId: string) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié')
      }
      
      // Récupérer le quiz pour vérifier les permissions
      const quiz = await fetchQuizById(quizId)
      if (!quiz) {
        throw new Error('Quiz non trouvé')
      }
      
      // Seul l'owner peut ajouter des readers
      if (quiz.ownerId !== currentUserId) {
        throw new Error('Seul le propriétaire peut ajouter des lecteurs')
      }
      
      // Ajouter l'userId aux readers
      const quizDoc = doc(db, 'quizzes', quizId)
      await updateDoc(quizDoc, {
        readers: arrayUnion(userId)
      })
      
      // Mettre à jour localement
      const index = quizzes.value.findIndex(q => q.id === quizId)
      if (index !== -1 && quizzes.value[index].readers) {
        if (!quizzes.value[index].readers!.includes(userId)) {
          quizzes.value[index].readers!.push(userId)
        }
      }
      
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors de l\'ajout d\'un lecteur'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function removeReader(quizId: string, userId: string) {
    loading.value = true
    error.value = null
    try {
      const authStore = useAuthStore()
      const currentUserId = authStore.currentUser?.uid
      
      if (!currentUserId) {
        throw new Error('Vous devez être authentifié')
      }
      
      // Récupérer le quiz pour vérifier les permissions
      const quiz = await fetchQuizById(quizId)
      if (!quiz) {
        throw new Error('Quiz non trouvé')
      }
      
      // Seul l'owner peut retirer des readers
      if (quiz.ownerId !== currentUserId) {
        throw new Error('Seul le propriétaire peut retirer des lecteurs')
      }
      
      // Retirer l'userId des readers
      const quizDoc = doc(db, 'quizzes', quizId)
      await updateDoc(quizDoc, {
        readers: arrayRemove(userId)
      })
      
      // Mettre à jour localement
      const index = quizzes.value.findIndex(q => q.id === quizId)
      if (index !== -1 && quizzes.value[index].readers) {
        quizzes.value[index].readers = quizzes.value[index].readers!.filter(id => id !== userId)
      }
      
      loading.value = false
    } catch (e) {
      error.value = 'Erreur lors du retrait d\'un lecteur'
      loading.value = false
      console.error('Erreur Firestore:', e)
      throw e
    }
  }

  async function removeSelf(quizId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) throw new Error('Non authentifié')

    const quiz = await fetchQuizById(quizId)
    if (!quiz) throw new Error('Quiz non trouvé')

    const role = getUserRole(quiz, uid)
    if (role === 'owner' || role === 'none') return

    const field = role === 'editor' ? 'editors' : 'readers'
    await updateDoc(doc(db, 'quizzes', quizId), { [field]: arrayRemove(uid) })

    quizzes.value = quizzes.value.filter(q => q.id !== quizId)
  }

  function resetError() {
    error.value = null
  }

  return {
    // State
    quizzes,
    loading,
    error,
    // Getters
    allQuizzes,
    getQuizById,
    quizCount,
    // Helper functions
    getUserRole,
    canEdit,
    canDelete,
    // Actions
    fetchQuizzes,
    fetchQuizById,
    addQuiz,
    updateQuiz,
    deleteQuiz,
    addEditor,
    removeEditor,
    addReader,
    removeReader,
    removeSelf,
    resetError
  }
})
