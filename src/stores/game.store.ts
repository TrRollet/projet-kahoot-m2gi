import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/firebase/config'
import { useAuthStore } from '@/stores/auth.store'
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  orderBy
} from 'firebase/firestore'
import type { Game } from '@/models/game'
import type { Question } from '@/models/question/types'
import { TIME_LIMIT } from '@/models/game'
import type { GamePlayer } from '@/models/game-player'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export const useGameStore = defineStore('game', () => {
  // Liste des parties (lobby + mes parties)
  const games = ref<Game[]>([])
  const loading = ref(false)

  // Partie courante (temps réel)
  const currentGame = ref<Game | null>(null)
  const players = ref<GamePlayer[]>([])
  const gameNotFound = ref(false)

  // --- Abonnements temps réel ----- ------------------------------------------

  function subscribeToGame(gameId: string): () => void {
    if (currentGame.value?.id !== gameId) {
      currentGame.value = null
    }
    gameNotFound.value = false
    return onSnapshot(
      doc(db, 'games', gameId),
      snap => {
        if (snap.exists()) {
          currentGame.value = { id: snap.id, ...snap.data() } as Game
          gameNotFound.value = false
        } else {
          currentGame.value = null
          gameNotFound.value = true
        }
      },
      err => console.warn('subscribeToGame error:', err.code)
    )
  }

  function subscribeToPlayers(gameId: string): () => void {
    if (currentGame.value?.id !== gameId) {
      players.value = []
    }
    return onSnapshot(
      query(collection(db, 'games', gameId, 'players'), orderBy('score', 'desc')),
      snap => {
        players.value = snap.docs.map(d => d.data() as GamePlayer)
      },
      err => console.warn('subscribeToPlayers error:', err.code)
    )
  }

  // --- Lobby ----------------------------------------------------------------

  let gamesUnsub: (() => void) | null = null

  async function fetchMyGames(): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) return

    if (gamesUnsub) return

    loading.value = true
    return new Promise((resolve) => {
      const q = query(collection(db, 'games'), where('playerIds', 'array-contains', uid))
      gamesUnsub = onSnapshot(q, snap => {
        games.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        loading.value = false
        resolve()
      }, err => {
        console.warn('fetchMyGames error:', err)
        loading.value = false
        resolve()
      })
    })
  }

  async function createGame(quizId: string, quizTitle: string): Promise<Game> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) throw new Error('Non authentifié')

    let code = generateCode()
    let exists = true
    while (exists) {
      const snap = await getDocs(query(collection(db, 'games'), where('code', '==', code)))
      if (snap.empty) exists = false
      else code = generateCode()
    }

    const gameData = {
      quizId,
      quizTitle,
      hostId: uid,
      code,
      status: 'waiting' as const,
      currentQuestionIndex: 0,
      questionStartTime: null,
      timeLimit: TIME_LIMIT,
      questions: [],
      playerIds: [uid],
      createdAt: new Date().toISOString()
    }
    const docRef = await addDoc(collection(db, 'games'), gameData)
    const game: Game = { id: docRef.id, ...gameData }
    return game
  }

  async function getGameByCode(code: string): Promise<Game | null> {
    const snap = await getDocs(
      query(collection(db, 'games'), where('code', '==', code.toUpperCase().trim()))
    )
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() } as Game
  }

  // Rejoindre une partie (créer le doc player si pas encore présent)
  async function ensureJoined(gameId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    const username = authStore.currentUsername || 'Anonyme'
    if (!uid) throw new Error('Non authentifié')

    const gameDoc = await getDoc(doc(db, 'games', gameId))
    if (!gameDoc.exists()) throw new Error('Partie introuvable')

    const playerRef = doc(db, 'games', gameId, 'players', uid)
    const existing = await getDoc(playerRef)
    if (!existing.exists()) {
      await Promise.all([
        setDoc(playerRef, {
          uid,
          username,
          score: 0,
          answers: {},
          joinedAt: new Date().toISOString()
        }),
        // Enregistre l'UID dans le doc game pour permettre la requête array-contains
        updateDoc(doc(db, 'games', gameId), { playerIds: arrayUnion(uid) })
      ])
    }
  }

  async function leaveGame(gameId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) return
    await Promise.all([
      deleteDoc(doc(db, 'games', gameId, 'players', uid)),
      updateDoc(doc(db, 'games', gameId), { playerIds: arrayRemove(uid) })
    ])
    games.value = games.value.filter(g => g.id !== gameId)
  }


  async function deleteGame(gameId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    const gameSnap = await getDoc(doc(db, 'games', gameId))
    if (!gameSnap.exists() || gameSnap.data().hostId !== uid) throw new Error('Non autorisé')
    // Supprimer les joueurs d'abord
    const playersSnap = await getDocs(collection(db, 'games', gameId, 'players'))
    await Promise.all(playersSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'games', gameId))
    games.value = games.value.filter(g => g.id !== gameId)
  }

  // --- Contrôle du jeu (host) -----------------------------------------------

  async function launchGame(gameId: string, quizId: string): Promise<void> {
    const questionsSnap = await getDocs(collection(db, 'quizzes', quizId, 'questions'))
    const questions: Question[] = questionsSnap.docs.map(d => {
      const qd = d.data()
      const type = (qd.type as 'single' | 'number') || 'single'
      const base = {
        id: d.id,
        text: qd.text || '',
        order: qd.order ?? 0,
        ...(qd.imageBase64 ? { imageBase64: qd.imageBase64 } : {})
      }

      if (type === 'number') {
        return {
          ...base,
          type: 'number',
          numberType: qd.numberType || 'amount'
        } as any
      } else {
        return {
          ...base,
          type: 'single',
          choices: qd.choices || []
        } as any
      }
    }).sort((a, b) => (a as any).order - (b as any).order)

    await updateDoc(doc(db, 'games', gameId), {
      status: 'question',
      currentQuestionIndex: 0,
      questionStartTime: serverTimestamp(),
      questions
    })
  }

  async function showResults(gameId: string): Promise<void> {
    const game = currentGame.value
    if (!game) return
    const qIdx = game.currentQuestionIndex

    // Récupérer la vraie réponse depuis le quiz (sécurité)
    const qSnap = await getDoc(doc(db, 'quizzes', game.quizId, 'questions', game.questions[qIdx].id))
    const qData = qSnap.data()
    if (!qData) return

    // clone du tableau pour mise à jour Firebase
    const questions = [...game.questions]
    const updatedQ = { ...questions[qIdx] }

    if (updatedQ.type === 'single') {
      (updatedQ as any).correctAnswerIndex = qData.correctAnswerIndex ?? 0
    } else {
      (updatedQ as any).correctNumber = qData.correctNumber ?? 0
    }
    questions[qIdx] = updatedQ as Question

    await updateDoc(doc(db, 'games', gameId), {
      status: 'results',
      questions
    })
  }

  async function showLeaderboard(gameId: string): Promise<void> {
    await updateDoc(doc(db, 'games', gameId), { status: 'leaderboard' })
  }

  async function nextQuestion(gameId: string, nextIndex: number): Promise<void> {
    await updateDoc(doc(db, 'games', gameId), {
      status: 'question',
      currentQuestionIndex: nextIndex,
      questionStartTime: serverTimestamp()
    })
  }

  async function endGame(gameId: string): Promise<void> {
    await updateDoc(doc(db, 'games', gameId), { status: 'finished', code: '' })
  }

  // --- Réponse joueur -------------------------------------------------------

  function calculatePoints(q: Question, answerData: any, timeTaken: number): number {
    const gracePeriod = q.type === 'number' ? 3 : 2
    const timeTakenAdjusted = Math.max(0, timeTaken - gracePeriod)
    const timeRatio = Math.min(1, timeTakenAdjusted / TIME_LIMIT)
    const basePointsMax = Math.round(200 + 800 * (1 - Math.pow(timeRatio, 2)))

    if (q.type === 'single') {
      const correctIdx = (q as any).correctAnswerIndex
      return answerData === correctIdx ? basePointsMax : 0
    } else if (q.type === 'number') {
      const correctNum = (q as any).correctNumber ?? 0
      const userNum = typeof answerData === 'number' ? answerData : Number.NaN
      if (Number.isNaN(userNum)) return 0

      const diff = Math.abs(correctNum - userNum)
      if (diff === 0) return 900 + Math.round(100 * (1 - timeRatio))

      // Scoring basé sur le type de donnée
      const nType = (q as any).numberType || 'amount'
      let margin = 0

      if (nType === 'date') {
        margin = 50 // Marge fixe de 50 ans pour les dates
      } else if (nType === 'percent') {
        margin = 10 // Marge fixe de 10 points de pourcentage
      } else {
        // 'amount' : Marge relative (10% avec un minimum de 10)
        margin = Math.max(10, Math.abs(correctNum * 0.1))
      }

      if (diff <= margin) {
        // Puissance 5 pour une chute progressive mais sélective
        const accuracyFactor = Math.pow(1 - (diff / margin), 5)
        return Math.round(800 * accuracyFactor) + Math.round(100 * (1 - timeRatio))
      }
    }
    return 0
  }

  async function submitAnswer(
    gameId: string,
    questionIndex: number,
    answerData: any,
    timeTaken: number
  ): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) throw new Error('Non authentifié')

    const gameDoc = await getDoc(doc(db, 'games', gameId))
    if (!gameDoc.exists()) throw new Error('Partie introuvable')

    const gameData = gameDoc.data() as Game
    if (gameData.status !== 'question') return
    if (gameData.currentQuestionIndex !== questionIndex) return

    const playerRef = doc(db, 'games', gameId, 'players', uid)
    const playerDoc = await getDoc(playerRef)
    if (playerDoc.exists() && playerDoc.data()?.answers?.[questionIndex] !== undefined) return

    // On sauvegarde juste la réponse brute (sécurité : pas de points calculés maintenant)
    await updateDoc(playerRef, {
      [`answers.${questionIndex}`]: { answerData, timeTaken }
    })
  }

  async function claimPoints(gameId: string, questionIndex: number): Promise<number> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid || !currentGame.value) return 0

    const game = currentGame.value
    if (game.status !== 'results' || game.currentQuestionIndex !== questionIndex) return 0

    const q = game.questions[questionIndex]
    const playerRef = doc(db, 'games', gameId, 'players', uid)
    const playerDoc = await getDoc(playerRef)
    const playerData = playerDoc.data()
    const myAnswer = playerData?.answers?.[questionIndex]

    if (!myAnswer || myAnswer.points !== undefined) return 0

    const points = calculatePoints(q, myAnswer.answerData, myAnswer.timeTaken)
    const isCorrect = points > 0

    await updateDoc(playerRef, {
      score: increment(points),
      [`answers.${questionIndex}.points`]: points,
      [`answers.${questionIndex}.isCorrect`]: isCorrect
    })
    return points
  }

  function reset(): void {
    if (gamesUnsub) { gamesUnsub(); gamesUnsub = null }
    games.value = []
    currentGame.value = null
    players.value = []
    loading.value = false
  }

  return {
    games,
    loading,
    currentGame,
    gameNotFound,
    players,
    subscribeToGame,
    subscribeToPlayers,
    fetchMyGames,
    reset,
    createGame,
    getGameByCode,
    ensureJoined,
    leaveGame,
    deleteGame,
    launchGame,
    showResults,
    showLeaderboard,
    nextQuestion,
    endGame,
    submitAnswer,
    claimPoints
  }
})
