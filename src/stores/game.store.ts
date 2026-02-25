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
  query,
  where,
  updateDoc,
  deleteDoc
} from 'firebase/firestore'
import type { Game } from '@/models/game'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const useGameStore = defineStore('game', () => {
  const games = ref<Game[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMyGames(): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) return
    loading.value = true
    try {
      const q = query(collection(db, 'games'), where('hostId', '==', uid))
      const snapshot = await getDocs(q)
      games.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Game))
    } finally {
      loading.value = false
    }
  }

  async function createGame(quizId: string, quizTitle: string): Promise<Game> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) throw new Error('Non authentifié')

    // Générer un code unique
    let code = generateCode()
    let exists = true
    while (exists) {
      const q = query(collection(db, 'games'), where('code', '==', code))
      const snap = await getDocs(q)
      if (snap.empty) exists = false
      else code = generateCode()
    }

    const gameData = {
      quizId,
      quizTitle,
      hostId: uid,
      code,
      status: 'waiting' as const,
      createdAt: new Date().toISOString()
    }
    const docRef = await addDoc(collection(db, 'games'), gameData)
    const game: Game = { id: docRef.id, ...gameData }
    games.value.unshift(game)
    return game
  }

  async function getGameByCode(code: string): Promise<Game | null> {
    const q = query(collection(db, 'games'), where('code', '==', code.toUpperCase().trim()))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    return { id: d.id, ...d.data() } as Game
  }

  async function deleteGame(gameId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    const gameSnap = await getDoc(doc(db, 'games', gameId))
    if (!gameSnap.exists() || gameSnap.data().hostId !== uid) {
      throw new Error('Non autorisé')
    }
    await deleteDoc(doc(db, 'games', gameId))
    games.value = games.value.filter(g => g.id !== gameId)
  }

  async function updateStatus(gameId: string, status: Game['status']): Promise<void> {
    await updateDoc(doc(db, 'games', gameId), { status })
    const g = games.value.find(g => g.id === gameId)
    if (g) g.status = status
  }

  return { games, loading, error, fetchMyGames, createGame, getGameByCode, deleteGame, updateStatus }
})
