import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { useAuthStore } from './auth.store'

export interface UserStats {
  gamesPlayed: number;
  totalScore: number;
  answersGiven: number;
  perfectAnswers: number; // bonnes réponses exactes
  fastestAnswers: number; // combien de fois a répondu le plus vite
  hostedGames: number;
  quizzesCreated: number;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'none'

export interface AchievementConfig {
  id: string
  title: string
  description: (target: number) => string
  icon: string
  thresholds: {
    bronze: number
    silver: number
    gold: number
  }
  metric: keyof UserStats
}

// Définitions des Succès
export const ACHIEVEMENTS: AchievementConfig[] = [
  {
    id: 'games_played',
    title: 'Joueur assidu',
    description: (t) => `Terminer ${t} partie${t > 1 ? 's' : ''}`,
    icon: 'game-controller-outline',
    thresholds: { bronze: 5, silver: 20, gold: 100 },
    metric: 'gamesPlayed'
  },
  {
    id: 'total_score',
    title: 'Collectionneur',
    description: (t) => `Cumuler ${t.toLocaleString()} points de score`,
    icon: 'cash-outline',
    thresholds: { bronze: 25000, silver: 80000, gold: 500000 },
    metric: 'totalScore'
  },
  {
    id: 'perfect_answers',
    title: 'Cerveau brillant',
    description: (t) => `Donner ${t} bonne${t > 1 ? 's' : ''} réponse${t > 1 ? 's' : ''}`,
    icon: 'bulb-outline',
    thresholds: { bronze: 10, silver: 50, gold: 200 },
    metric: 'perfectAnswers'
  },
  {
    id: 'fastest_answers',
    title: 'Hyper-vitesse',
    description: (t) => `Être le joueur le plus rapide à répondre ${t} fois`,
    icon: 'flash-outline',
    thresholds: { bronze: 5, silver: 20, gold: 50 },
    metric: 'fastestAnswers'
  },
  {
    id: 'answers_given',
    title: 'Sur tous les fronts',
    description: (t) => `Répondre à ${t} question${t > 1 ? 's' : ''} au total`,
    icon: 'chatbubbles-outline',
    thresholds: { bronze: 20, silver: 100, gold: 500 },
    metric: 'answersGiven'
  },
  {
    id: 'hosted_games',
    title: 'Animateur',
    description: (t) => `Mener à bien ${t} partie${t > 1 ? 's' : ''}`,
    icon: 'people-outline',
    thresholds: { bronze: 1, silver: 5, gold: 20 },
    metric: 'hostedGames'
  },
  {
    id: 'quizzes_created',
    title: 'Architecte',
    description: (t) => `Créer ${t} quiz complet${t > 1 ? 's' : ''}`,
    icon: 'construct-outline',
    thresholds: { bronze: 1, silver: 5, gold: 15 },
    metric: 'quizzesCreated'
  }
]

export const useAchievementsStore = defineStore('achievements', () => {
  const stats = ref<UserStats>({
    gamesPlayed: 0,
    totalScore: 0,
    answersGiven: 0,
    perfectAnswers: 0,
    fastestAnswers: 0,
    hostedGames: 0,
    quizzesCreated: 0
  })

  const loading = ref(false)

  // Fetch from user profile
  async function fetchStats() {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) return

    loading.value = true
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists() && docSnap.data().stats) {
        stats.value = { ...stats.value, ...docSnap.data().stats }
      }
    } catch (e) {
      console.error('Erreur fetch stats:', e)
    } finally {
      loading.value = false
    }
  }

  // Update in Firestore (and local)
  async function updateStats(additions: Partial<UserStats>) {
    const authStore = useAuthStore()
    const uid = authStore.currentUser?.uid
    if (!uid) return

    // Apply locally
    Object.keys(additions).forEach((k) => {
      const key = k as keyof UserStats
      stats.value[key] += (additions[key] || 0)
    })

    // Prepare firestore increment payload
    const payload: any = {}
    Object.keys(additions).forEach((k) => {
      const key = k as keyof UserStats
      payload[`stats.${key}`] = increment(additions[key] || 0)
    })

    try {
      await updateDoc(doc(db, 'users', uid), payload)
    } catch (e: any) {
      if (e.code === 'not-found') {
        const fullPayload = { stats: stats.value }
        await setDoc(doc(db, 'users', uid), fullPayload, { merge: true })
      } else {
        console.error('Erreur update stats:', e)
      }
    }
  }

  const getTier = (value: number, config: AchievementConfig) => {
    if (value >= config.thresholds.gold) return 'gold'
    if (value >= config.thresholds.silver) return 'silver'
    if (value >= config.thresholds.bronze) return 'bronze'
    return 'none'
  }

  const getNextTarget = (value: number, config: AchievementConfig) => {
    if (value < config.thresholds.bronze) return config.thresholds.bronze
    if (value < config.thresholds.silver) return config.thresholds.silver
    if (value < config.thresholds.gold) return config.thresholds.gold
    return config.thresholds.gold
  }

  const progress = computed(() => {
    return ACHIEVEMENTS.map((ach) => {
      const val = stats.value[ach.metric] || 0
      const tier = getTier(val, ach)
      const target = getNextTarget(val, ach)
      return {
        ...ach,
        value: val,
        target,
        tier,
        completed: tier === 'gold'
      }
    })
  })

  return { stats, loading, progress, fetchStats, updateStats }
})
