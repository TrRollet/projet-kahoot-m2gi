<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage, IonHeader, IonToolbar, IonContent, IonFooter,
  IonButton, IonInput, IonIcon, IonSpinner, toastController
} from '@ionic/vue'
import {
  copyOutline, checkmarkCircle, chevronBackOutline, exitOutline,
  rocketOutline, flashOutline, trophyOutline, homeOutline, personOutline,
  checkmarkOutline, eyeOutline, eyeOffOutline
} from 'ionicons/icons'
import { useGameStore } from '@/stores/game.store'
import { useAuthStore } from '@/stores/auth.store'
import { useAchievementsStore } from '@/stores/achievements.store'
import { TIME_LIMIT } from '@/models/game'
import QRCode from 'qrcode'
import { Keyboard } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const authStore = useAuthStore()
const achievementsStore = useAchievementsStore()

const gameId = computed(() => route.params.id as string)
const uid = computed(() => authStore.currentUser?.uid || '')
const isHost = computed(() => gameStore.currentGame?.hostId === uid.value)
const game = computed(() => gameStore.currentGame)
const players = computed(() => gameStore.players)

const lastKnownStatus = ref<string | null>(null)
watch(() => game.value?.status, s => { if (s) lastKnownStatus.value = s })

const currentQuestion = computed(() => {
  const g = game.value
  if (!g || !g.questions?.length) return null
  return g.questions[g.currentQuestionIndex] ?? null
})

// -- QR code --
const qrCodeUrl = ref('')

async function generateQR() {
  try {
    const url = `projet-kahoot://join/${game.value?.code || ''}`
    qrCodeUrl.value = await QRCode.toDataURL(url, { margin: 1, width: 200 })
  } catch (err) { console.error('QR Error', err) }
}

// -- Timer --
const remaining = ref(TIME_LIMIT)
const timerInterval = ref<ReturnType<typeof setInterval> | null>(null)
const autoAdvancing = ref(false)

// -- Réponse --
const answered = ref(false)
const selectedChoice = ref<number | null>(null)
const numericAnswer = ref<number | null>(null)
const earnedPoints = ref(0)
const isAnswerCorrect = ref(false)
const showGameCode = ref(false)
const isKeyboardOpen = ref(false)

// Réponse déjà soumise par le joueur courant pour la question en cours
const myPreviousAnswer = computed(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  const me = players.value.find(p => p.uid === uid.value)
  return (me?.answers as Record<number, { choiceIndex?: number; answerData?: any; points: number; isCorrect: boolean }>)?.[qIdx] ?? null
})

// Rétablir l'état local si une réponse a déjà été donnée (utile au montage ou changement de question)
watch([myPreviousAnswer, currentQuestion], ([a, q]) => {
  if (a !== null && q !== null && !answered.value) {
    answered.value = true
    earnedPoints.value = a.points || 0
    isAnswerCorrect.value = a.isCorrect || false

    const data = a.answerData ?? a.choiceIndex
    if (q.type === 'number') {
      numericAnswer.value = typeof data === 'number' ? data : null
    } else {
      selectedChoice.value = typeof data === 'number' ? data : null
    }
  }
}, { immediate: true })

// Surveiller la révélation des résultats pour calculer ses propres points (sécurité)
watch(() => game.value?.status, (status) => {
  if (status === 'results' && answered.value && earnedPoints.value === 0) {
    gameStore.claimPoints(gameId.value, game.value!.currentQuestionIndex).then(pts => {
      earnedPoints.value = pts
      isAnswerCorrect.value = pts > 0
    })
  }
})

// -- Résultats phases --
const displayedCounts = ref<number[]>([])

const voteCounts = computed(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  const q = currentQuestion.value
  if (!q || q.type === 'number') return []
  const counts = new Array(q.choices.length).fill(0)
  for (const p of players.value) {
    const a = (p.answers as Record<number, { choiceIndex?: number; answerData?: any }>)?.[qIdx]
    if (a !== undefined) {
      const data = a.answerData ?? a.choiceIndex
      if (typeof data === 'number' && data >= 0 && data < counts.length) {
        counts[data]++
      }
    }
  }
  return counts
})

const totalPlayers = computed(() => Math.max(1, players.value.length))

interface NumberGuessGroup {
  id: string;
  value: number;
  isClosest: boolean;
  positionPercent: number;
  users: { uid: string; username: string; isFirst: boolean }[];
}

const numberGuesses = computed<NumberGuessGroup[]>(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  const q = currentQuestion.value
  if (q?.type !== 'number') return []

  const rawGuesses: any[] = []

  let closestDiff = Infinity
  for (const p of players.value) {
    const a = (p.answers as Record<number, { answerData?: any; timeTaken: number }>)?.[qIdx]
    if (a !== undefined && typeof a.answerData === 'number') {
      const diff = Math.abs((q.correctNumber || 0) - a.answerData)
      if (diff < closestDiff) closestDiff = diff
    }
  }

  let minTime = Infinity
  for (const p of players.value) {
    const a = (p.answers as Record<number, { answerData?: any; timeTaken: number }>)?.[qIdx]
    if (a !== undefined && typeof a.answerData === 'number') {
      const diff = Math.abs((q.correctNumber || 0) - a.answerData)
      if (diff === closestDiff && a.timeTaken < minTime) minTime = a.timeTaken
    }
  }

  for (const p of players.value) {
    const a = (p.answers as Record<number, { answerData?: any; timeTaken: number }>)?.[qIdx]
    if (a !== undefined && typeof a.answerData === 'number') {
      const diff = Math.abs((q.correctNumber || 0) - a.answerData)
      const isClosest = diff === closestDiff
      rawGuesses.push({
        uid: p.uid,
        username: p.username,
        value: a.answerData,
        isClosest,
        isFirst: isClosest && a.timeTaken === minTime
      })
    }
  }

  const grouped = new Map<number, NumberGuessGroup>()
  for (const g of rawGuesses) {
    if (!grouped.has(g.value)) {
      grouped.set(g.value, {
        id: g.value.toString(),
        value: g.value,
        isClosest: g.isClosest,
        positionPercent: 0,
        users: []
      })
    }
    grouped.get(g.value)!.users.push({ uid: g.uid, username: g.username, isFirst: g.isFirst })
  }

  const list = Array.from(grouped.values())

  const c = q.correctNumber || 0
  const vals = list.map(x => x.value).concat([c])
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) { min -= 10; max += 10 }
  const pad = (max - min) * 0.1
  const lineMin = min - pad
  const lineMax = max + pad

  for (const g of list) {
    g.positionPercent = ((g.value - lineMin) / (lineMax - lineMin)) * 100
  }

  list.sort((a, b) => a.positionPercent - b.positionPercent)

  return list
})

const numberLineBounds = computed(() => {
  const q = currentQuestion.value
  if (q?.type !== 'number') return { min: 0, max: 100 }
  const c = q.correctNumber || 0
  const vals = numberGuesses.value.map(x => x.value).concat([c])
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) { min -= 10; max += 10 }
  const pad = (max - min) * 0.1
  return { min: Math.floor(min - pad), max: Math.ceil(max + pad) }
})

const correctAnswerLinePosition = computed(() => {
  const q = currentQuestion.value
  if (q?.type !== 'number') return 50
  const c = q.correctNumber || 0
  const vals = numberGuesses.value.map(x => x.value).concat([c])
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (min === max) { min -= 10; max += 10 }
  const pad = (max - min) * 0.1
  const lineMin = min - pad
  const lineMax = max + pad
  return ((c - lineMin) / (lineMax - lineMin)) * 100
})

const myAnswer = computed(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  const me = players.value.find(p => p.uid === uid.value)
  return (me?.answers as Record<number, { choiceIndex?: number; answerData?: any; points: number; isCorrect: boolean; timeTaken: number }>)?.[qIdx]
})

watch(myAnswer, (ans) => {
  if (ans !== undefined && game.value?.status === 'question' && !answered.value) {
    answered.value = true
    earnedPoints.value = ans.points
    isAnswerCorrect.value = ans.isCorrect

    const data = ans.answerData ?? ans.choiceIndex
    const type = currentQuestion.value?.type || 'single'
    if (type === 'number') numericAnswer.value = data as number
    else selectedChoice.value = data as number
  }
})

function startVoteAnimation() {
  const targets = voteCounts.value.slice()
  displayedCounts.value = new Array(targets.length).fill(0)
  const steps = 24
  const intervalMs = 1000 / steps
  let step = 0
  const t = setInterval(() => {
    step++
    displayedCounts.value = targets.map(v => Math.round((v * step) / steps))
    if (step >= steps) {
      clearInterval(t)
      displayedCounts.value = targets
    }
  }, intervalMs)
}

function resetQuestionState() {
  answered.value = false
  selectedChoice.value = null
  numericAnswer.value = null
  earnedPoints.value = 0
  isAnswerCorrect.value = false
  autoAdvancing.value = false
  autoAdvancing.value = false
  displayedCounts.value = []
}

function stopTimer() {
  if (timerInterval.value) { clearInterval(timerInterval.value); timerInterval.value = null }
}

function startTimer(reset = true) {
  stopTimer()
  if (reset) resetQuestionState()

  timerInterval.value = setInterval(() => {
    const g = game.value
    if (!g || g.status !== 'question' || !g.questionStartTime) return
    const q = currentQuestion.value
    if (!q) return

    const startMs = g.questionStartTime?.toMillis?.() || Date.now()
    const elapsed = Math.floor((Date.now() - startMs) / 1000)
    remaining.value = Math.max(0, TIME_LIMIT - elapsed)

    if (remaining.value === 0 && !autoAdvancing.value && isHost.value) {
      autoAdvancing.value = true
      setTimeout(() => gameStore.showResults(gameId.value), 800)
    }
  }, 250)
}

watch(
  () => game.value?.status,
  async (status, oldStatus) => {
    if (!status) return

    if (status === 'question') {
      startTimer(false)
    } else if (status === 'results') {
      stopTimer()
      // Animation seulement si on vient de finir une question ou au re-join sur la phase results
      if (!oldStatus || oldStatus === 'question') {
        displayedCounts.value = []
        setTimeout(() => startVoteAnimation(), 200)
      }
    } else if (status === 'leaderboard') {
      stopTimer()
      // Plus rien à faire ici, le template réagit au statut
    } else if (status === 'finished') {
      stopTimer()
      // ... logique achievements ...
      const processedKey = `stats_processed_${gameId.value}`
      if (!localStorage.getItem(processedKey)) {
        localStorage.setItem(processedKey, 'true')

        let hostedGamesInc = 0
        if (isHost.value) hostedGamesInc = 1

        const me = players.value.find(p => p.uid === uid.value)
        if (me?.answers) {
          const answersList = Object.values(me.answers) as any[]
          const totalQuestions = game.value?.questions?.length || 0
          let fastestCount = 0

          for (let qIdx = 0; qIdx < totalQuestions; qIdx++) {
            let fastestTime = Infinity
            let fastestUid = null
            for (const p of players.value) {
              const ans = (p.answers as any)?.[qIdx]
              if (ans?.isCorrect && ans.timeTaken < fastestTime) {
                fastestTime = ans.timeTaken
                fastestUid = p.uid
              }
            }
            if (fastestUid === uid.value) fastestCount++
          }

          achievementsStore.updateStats({
            gamesPlayed: 1,
            totalScore: me.score || 0,
            answersGiven: answersList.length,
            perfectAnswers: answersList.filter(a => a.isCorrect).length,
            fastestAnswers: fastestCount,
            ...(hostedGamesInc ? { hostedGames: 1 } : {})
          }).catch(console.error)
        } else if (hostedGamesInc) {
          achievementsStore.updateStats({ hostedGames: 1 }).catch(console.error)
        }
      }
    }
  },
  { immediate: true }
)

watch(
  () => game.value?.currentQuestionIndex,
  (newVal, oldVal) => {
    // On ne reset que si c'est un vrai changement de question (pas au chargement initial)
    const isNewQuestion = oldVal !== undefined && newVal !== oldVal
    if (game.value?.status === 'question') startTimer(isNewQuestion)
  }
)

watch(
  () => game.value?.code,
  (code) => { if (code) generateQR() },
  { immediate: true }
)

// -- Montage / démontage / changement de partie --
let unsubGame: (() => void) | null = null
let unsubPlayers: (() => void) | null = null

// Gestion dynamique du changement de partie (évite les conflits si on change de jeu sans démonter le composant)
watch(gameId, async (id) => {
  // Nettoyage de la partie précédente
  if (unsubGame) unsubGame()
  if (unsubPlayers) unsubPlayers()
  stopTimer()
  resetQuestionState()
  qrCodeUrl.value = ''
  gameStore.gameNotFound = false

  if (!id) return

  // Abonnements à la nouvelle partie
  unsubGame = gameStore.subscribeToGame(id)
  unsubPlayers = gameStore.subscribeToPlayers(id)

  try {
    await gameStore.ensureJoined(id)
    if (game.value?.status === 'waiting' && game.value.code) {
      generateQR()
    }
    // Re-déclencher le timer si on arrive en pleine question (SANS reset car on a déjà restauré via watch)
    if (game.value?.status === 'question') startTimer(false)
  } catch (e: any) {
    if (e.message) console.warn('Erreur', e.message)
  }

  // Listeners clavier (une seule fois suffit mais on les remet pour s'assurer qu'ils sont actifs)
  if (Capacitor.isNativePlatform()) {
    Keyboard.removeAllListeners()
    Keyboard.addListener('keyboardWillShow', () => { isKeyboardOpen.value = true })
    Keyboard.addListener('keyboardWillHide', () => { isKeyboardOpen.value = false })
  }
}, { immediate: true })

onUnmounted(() => {
  if (unsubGame) unsubGame()
  if (unsubPlayers) unsubPlayers()
  stopTimer()
  gameStore.gameNotFound = false
  if (Capacitor.isNativePlatform()) Keyboard.removeAllListeners()
})

watch(
  () => gameStore.gameNotFound,
  async (notFound) => {
    if (!notFound) return
    if (lastKnownStatus.value === 'finished') return
    const t = await toastController.create({ position: 'top', message: 'Cette partie n\'existe plus', duration: 2500, color: 'warning' })
    await t.present()
    await gameStore.fetchMyGames()
    router.replace('/tabs/games')
  }
)

// -- Lobby --
async function copyCode() {
  try { await navigator.clipboard.writeText(game.value?.code || '') } catch { /* ignore */ }
  const t = await toastController.create({ position: 'top', message: 'Code copié !', duration: 1500, color: 'success' })
  await t.present()
}

// -- Actions --
async function handleStart() {
  if (!game.value?.quizId) return
  await gameStore.launchGame(gameId.value, game.value.quizId)
}

// -- Question --

const timerPercent = computed(() => (remaining.value / TIME_LIMIT) * 100)
const timerColor = computed(() => {
  if (remaining.value > TIME_LIMIT * 0.5) return 'var(--ion-color-success)'
  if (remaining.value > TIME_LIMIT * 0.25) return 'var(--ion-color-warning)'
  return 'var(--ion-color-danger)'
})

// Couleurs de tuiles (plus douces avec opacité)
const TILE_STYLES = [
  { cssVar: '--ion-color-primary', label: 'A' },
  { cssVar: '--ion-color-secondary', label: 'B' },
  { cssVar: '--ion-color-tertiary', label: 'C' },
  { cssVar: '--ion-color-success', label: 'D' }
]

async function handleAnswer(answerData: any) {
  if (answered.value || !game.value || !currentQuestion.value) return
  const g = game.value
  if (!g.questionStartTime) return
  const elapsed = Math.floor((Date.now() - g.questionStartTime.toMillis()) / 1000)
  if (elapsed >= TIME_LIMIT) return
  const timeTaken = elapsed

  answered.value = true

  const type = currentQuestion.value.type || 'single'
  if (type === 'single') selectedChoice.value = answerData

  try {
    await gameStore.submitAnswer(gameId.value, g.currentQuestionIndex, answerData, timeTaken)
    // On ne reçoit plus les points tout de suite pour la sécurité
  } catch (e) { console.error(e) }
}

// -- Résultats --
const topPlayers = computed(() => players.value.slice(0, 5))

const answeredCount = computed(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  return players.value.filter(p => (p.answers as Record<number, any>)?.[qIdx] !== undefined).length
})

const firstCorrectPlayer = computed(() => {
  const qIdx = game.value?.currentQuestionIndex ?? 0
  const q = currentQuestion.value
  if (!q) return null

  let best: { uid: string; username: string } | null = null

  if (q.type === 'number') {
    let closestDiff = Infinity
    let minTime = Infinity
    for (const p of players.value) {
      const a = (p.answers as any)?.[qIdx]
      if (a && typeof a.answerData === 'number') {
        const diff = Math.abs((q.correctNumber || 0) - a.answerData)
        if (diff < closestDiff) {
          closestDiff = diff
          minTime = a.timeTaken
          best = p
        } else if (diff === closestDiff && a.timeTaken < minTime) {
          minTime = a.timeTaken
          best = p
        }
      }
    }
  } else {
    let minTime = Infinity
    for (const p of players.value) {
      const a = (p.answers as Record<number, { isCorrect: boolean; timeTaken: number }>)?.[qIdx]
      if (a?.isCorrect && a.timeTaken < minTime) {
        minTime = a.timeTaken
        best = p
      }
    }
  }

  return best
})

async function handleNext() {
  const g = game.value
  if (!g) return
  const nextIndex = g.currentQuestionIndex + 1
  if (nextIndex >= g.questions.length) await gameStore.endGame(gameId.value)
  else await gameStore.nextQuestion(gameId.value, nextIndex)
}

// -- Terminé --
const podiumOrder = computed(() => {
  const p1 = players.value[0] || null
  const p2 = players.value[1] || null
  const p3 = players.value[2] || null
  return [p2, p1, p3]
})
const podiumHeights = ['90px', '120px', '60px']
const podiumLabels = ['2e', '1er', '3e']

const restOfPlayers = computed(() => players.value.slice(3))

async function handleLeave() {
  try {
    await gameStore.leaveGame(gameId.value)
    router.replace('/tabs/games')
  } catch (e) {
    console.warn('leaveGame error:', e)
    const t = await toastController.create({ position: 'top', message: 'Erreur en quittant la partie', duration: 2500, color: 'danger' })
    await t.present()
  }
}

function goBack() { router.push('/tabs/games') }
</script>

<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-button slot="start" fill="clear" @click="goBack">
          <ion-icon :icon="chevronBackOutline" />
        </ion-button>
        <div class="toolbar-title">{{ game?.quizTitle || 'Partie' }}</div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- Loading -->
      <div v-if="!game" class="center-box">
        <ion-spinner name="crescent" />
      </div>

      <!-- ════ LOBBY ════ -->
      <div v-else-if="game.status === 'waiting'" class="lobby">
        <div class="qr-section">
          <div v-if="qrCodeUrl" class="qr-box">
            <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-image" />
          </div>
          <p class="code-value">{{ game.code }}</p>
          <ion-button fill="outline" size="small" class="copy-btn" @click="copyCode">
            <ion-icon slot="start" :icon="copyOutline" />
            Copier le code
          </ion-button>
        </div>

        <div class="players-section">
          <p class="section-label">Joueurs ({{ players.length }})</p>
          <div class="players-grid">
            <div v-for="(p, i) in players" :key="p.uid" class="player-chip">
              <span class="player-avatar" :style="{ background: `var(${TILE_STYLES[i % 4].cssVar})` }">
                <ion-icon :icon="personOutline" />
              </span>
              <span class="player-name">{{ p.username }}</span>
            </div>
          </div>
        </div>

        <ion-button v-if="isHost" expand="block" size="large" color="secondary" :disabled="players.length === 0"
          class="launch-btn" @click="handleStart">
          <ion-icon slot="start" :icon="rocketOutline" />
          Lancer la partie
        </ion-button>
        <div v-else class="lobby-player-actions">
          <div class="waiting-pulse">
            <ion-spinner name="dots" color="primary" />
            <p class="hint">En attente du lancement par l'hôte…</p>
          </div>
          <ion-button expand="block" fill="outline" color="danger" class="leave-btn" @click="handleLeave">
            <ion-icon slot="start" :icon="exitOutline" />
            Quitter la partie
          </ion-button>
        </div>
      </div>

      <!-- ════ QUESTION ════ -->
      <div v-else-if="game.status === 'question' && currentQuestion" class="question-view">
        <div class="q-header">
          <span class="q-counter-badge">{{ game.currentQuestionIndex + 1 }} / {{ game.questions.length }}</span>
          <span class="timer-num" :style="{ color: timerColor }">{{ remaining }}s</span>
        </div>

        <div class="timer-track">
          <div class="timer-fill" :style="{ width: timerPercent + '%', background: timerColor }" />
        </div>

        <img v-if="currentQuestion.imageBase64" :src="currentQuestion.imageBase64" class="q-image"
          :class="{ 'q-image-keyboard': isKeyboardOpen }" alt="" />
        <p class="q-text">{{ currentQuestion.text }}</p>

        <div v-if="currentQuestion.type === 'single'" class="tiles">
          <button v-for="(choice, i) in currentQuestion.choices" :key="i" class="tile"
            :class="{ 'tile-selected': selectedChoice === i, 'tile-dimmed': answered && selectedChoice !== i }"
            :style="{ '--tile-color': `var(${TILE_STYLES[i % 4].cssVar})`, '--tile-color-rgb': `var(${TILE_STYLES[i % 4].cssVar}-rgb)` }"
            :disabled="answered || remaining === 0" @click="handleAnswer(i)">
            <img v-if="choice.imageBase64" :src="choice.imageBase64" class="tile-img" alt="" />
            <span class="tile-letter">{{ TILE_STYLES[i % 4].label }}</span>
            <span v-if="choice.text" class="tile-text">{{ choice.text }}</span>
          </button>
        </div>
        <div v-else-if="currentQuestion.type === 'number'" class="number-container">
          <ion-input type="number" v-model.number="numericAnswer" placeholder="Entrez la réponse..." fill="outline"
            :disabled="answered || remaining === 0" class="num-input" />
          <ion-button v-if="!answered" expand="block" :disabled="numericAnswer === null" class="submit-btn"
            @click="handleAnswer(numericAnswer)">Valider</ion-button>
        </div>

        <div v-if="answered" class="feedback slide-up">
          <ion-icon :icon="checkmarkCircle" style="color: var(--ion-color-primary); font-size: 1.8rem" />
          <span class="feedback-text neutral">Réponse enregistrée</span>
        </div>
      </div>

      <!-- ════ RÉSULTATS (Votes) ════ -->
      <div v-else-if="game.status === 'results' && currentQuestion" class="results-view">
        <div class="answered-gauge">
          <div class="gauge-header">
            <span class="gauge-label">Ont répondu</span>
            <span class="gauge-count">{{ answeredCount }} / {{ players.length }}</span>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill" :style="{ width: (answeredCount / totalPlayers * 100) + '%' }" />
          </div>
        </div>

        <div v-if="firstCorrectPlayer" class="first-correct slide-up">
          <ion-icon :icon="flashOutline" class="first-correct-icon" />
          <div class="first-correct-info">
            <span class="first-correct-label">{{ currentQuestion?.type === 'number' ? 'Premier à être le plus proche' :
              'Premier à avoir bien répondu' }}</span>
            <span class="first-correct-name">{{ firstCorrectPlayer.username }}</span>
          </div>
        </div>

        <div v-if="currentQuestion.type !== 'number'" class="vote-list">
          <div v-for="(choice, i) in currentQuestion.choices" :key="i" class="vote-row"
            :class="{ 'vote-correct': i === currentQuestion.correctAnswerIndex }"
            :style="{ '--tile-color': `var(${TILE_STYLES[i % 4].cssVar})`, '--tile-color-rgb': `var(${TILE_STYLES[i % 4].cssVar}-rgb)` }">
            <div class="vote-bar-bg" :style="{
              width: ((displayedCounts[i] ?? 0) / totalPlayers * 100) + '%',
              background: i === currentQuestion.correctAnswerIndex ? 'rgba(var(--ion-color-success-rgb), 0.2)' : 'rgba(var(--tile-color-rgb), 0.2)'
            }" />
            <span class="vote-letter">{{ TILE_STYLES[i % 4].label }}</span>
            <img v-if="choice.imageBase64" :src="choice.imageBase64" class="vote-img" alt="" />
            <span class="vote-text">
              {{ choice.text }}
              <span v-if="i === currentQuestion.correctAnswerIndex" class="correct-badge">
                <ion-icon :icon="checkmarkOutline" /> Bonne réponse
              </span>
            </span>
            <span class="vote-count">{{ displayedCounts[i] ?? 0 }}</span>
          </div>
        </div>

        <div v-else class="number-result">
          <h3 class="correct-num-label">Bonne réponse</h3>

          <div class="number-line-container">
            <div class="number-line-bounds">
              <span class="bound-min">{{ numberLineBounds.min }}</span>
              <span class="bound-max">{{ numberLineBounds.max }}</span>
            </div>
            <div class="number-line">
              <!-- Correct answer marker -->
              <div class="marker correct-marker" :style="{ left: correctAnswerLinePosition + '%' }">
                <div class="marker-label">{{ currentQuestion.correctNumber }}</div>
                <div class="marker-tick"></div>
              </div>

              <!-- Guess markers -->
              <div v-for="g in numberGuesses" :key="g.id" class="marker guess-marker"
                :style="{ left: g.positionPercent + '%' }" :class="{ 'is-closest': g.isClosest }">
                <div class="marker-tick"></div>
              </div>
            </div>
          </div>
        </div>

        <ion-button v-if="isHost" expand="block" color="primary" class="next-btn"
          @click="gameStore.showLeaderboard(gameId)">
          Suivant
        </ion-button>
        <p v-else class="hint">En attente de l'hôte…</p>
      </div>

      <!-- ════ RÉSULTATS (Leaderboard) ════ -->
      <div v-else-if="game.status === 'leaderboard' && currentQuestion" class="results-view p-0">
        <div class="header-with-icon">
          <ion-icon :icon="trophyOutline" class="section-icon" />
          <h2 class="section-title">Classement</h2>
        </div>

        <div v-if="earnedPoints > 0" class="points-pop">+{{ earnedPoints }} points</div>
        <div v-else-if="answered" class="points-pop wrong">Aucun point</div>

        <div class="leaderboard">
          <div v-for="(p, i) in topPlayers" :key="p.uid" class="lb-row" :class="{ 'lb-me': p.uid === uid }">
            <span class="lb-rank">
              <span class="rank-badge">{{ i + 1 }}</span>
            </span>
            <span class="lb-name">{{ p.username }}</span>
            <span class="lb-score">{{ p.score }} pts</span>
          </div>
        </div>

        <ion-button v-if="isHost" expand="block" color="primary" class="next-btn" @click="handleNext">
          {{ game.currentQuestionIndex + 1 < game.questions.length ? 'Question suivante' : 'Terminer la partie' }}
            </ion-button>
            <p v-else class="hint">En attente de l'hôte…</p>
      </div>

      <!-- ════ TERMINÉ ════ -->
      <div v-else-if="game.status === 'finished'" class="finished-view">
        <div class="header-with-icon">
          <ion-icon :icon="checkmarkCircle" class="section-icon-large" />
          <h2 class="finished-title">Partie terminée !</h2>
        </div>

        <div v-if="players.length > 0" class="podium">
          <div v-for="(p, i) in podiumOrder" :key="i" class="podium-col" :class="{ 'hidden': !p }">
            <template v-if="p">
              <span class="podium-username">{{ p.username }}</span>
              <span class="podium-pts">{{ p.score }} pts</span>
              <div class="podium-bar" :style="{ height: podiumHeights[i] }">
                <span class="podium-label">{{ podiumLabels[i] }}</span>
              </div>
            </template>
          </div>
        </div>

        <div class="leaderboard" v-if="restOfPlayers.length > 0">
          <p class="section-label">Reste du classement</p>
          <div v-for="(p, i) in restOfPlayers" :key="p.uid" class="lb-row" :class="{ 'lb-me': p.uid === uid }">
            <span class="lb-rank">
              <span class="rank-badge neutral">{{ i + 4 }}</span>
            </span>
            <span class="lb-name">{{ p.username }}</span>
            <span class="lb-score">{{ p.score }} pts</span>
          </div>
        </div>

        <ion-button expand="block" color="primary" class="next-btn" @click="goBack">
          <ion-icon slot="start" :icon="homeOutline" />
          Retour à l'accueil
        </ion-button>
      </div>
    </ion-content>

    <ion-footer v-if="game && (game.status === 'question' || game.status === 'results')">
      <div class="game-code-footer">
        <span class="code-label">CODE:</span>
        <span class="code-text" v-if="showGameCode">{{ game.code }}</span>
        <span class="code-text" v-else>••••••</span>
        <ion-button fill="clear" size="small" color="medium" @click="showGameCode = !showGameCode">
          <ion-icon :icon="showGameCode ? eyeOffOutline : eyeOutline" />
        </ion-button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<style scoped>
/* -- Common -- */
.toolbar-title {
  font-weight: 700;
  font-size: 1.05rem;
}

.center-box {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 70%;
}

.section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--app-text-secondary);
  margin: 0 0 10px;
  font-weight: 600;
}

.header-with-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.section-icon {
  font-size: 2.2rem;
  color: var(--ion-color-primary);
}

.section-icon-large {
  font-size: 3rem;
  color: var(--ion-color-primary);
}

.section-title {
  font-size: 1.4rem;
  font-weight: 800;
  text-align: center;
  margin: 0;
}

.hint {
  text-align: center;
  color: var(--app-text-secondary);
  font-size: 0.92rem;
  margin: 0;
}

/* -- Animations -- */
@keyframes slide-up {
  from {
    transform: translateY(12px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes pop {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }

  80% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.slide-up {
  animation: slideUp 0.3s ease forwards;
}

/* -- New Question Types -- */
.submit-btn {
  margin-top: 16px;
  --border-radius: 12px;
  font-weight: 700;
  height: 54px;
}

.number-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.num-input {
  --border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  background: var(--app-surface);
  margin-top: 8px;
  /* Reduit pour laisser plus de place */
  --padding-top: 12px;
  --padding-bottom: 12px;
}

.number-result {
  text-align: center;
  margin: 40px 0;
}

.correct-num-label {
  font-size: 1rem;
  color: var(--app-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.correct-num-value {
  font-size: 4rem;
  font-weight: 900;
  color: var(--ion-color-primary);
  margin: 10px 0 0;
}

/* -- Leaderboard shared -- */
.leaderboard {
  background: var(--app-surface);
  border-radius: 12px;
  padding: 14px;
  border: 1px solid var(--app-border);
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-bottom: 1px solid var(--app-border);
}

.lb-row:last-child {
  border-bottom: none;
}

.lb-me {
  background: rgba(var(--ion-color-primary-rgb), 0.08);
  border-radius: 8px;
}

.lb-rank {
  display: flex;
  justify-content: center;
  width: 36px;
}

.rank-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: white;
  font-weight: 700;
  font-size: 0.9rem;
}

.rank-badge.neutral {
  background: var(--app-surface-alt);
  color: var(--app-text-secondary);
  border: 1px solid var(--app-border);
}

.lb-name {
  flex: 1;
  font-weight: 600;
}

.lb-score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ion-color-primary);
}

/* ══ LOBBY ══ */
.lobby {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 480px;
  margin: 0 auto;
}

.qr-section {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-container {
  padding: 12px;
  border-radius: 16px;
  background: white;
  border: 1px solid var(--app-border);
}

.qr-image {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  display: block;
}

.code-value {
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: 0.3em;
  font-family: monospace;
  margin: 0;
  color: var(--ion-color-primary);
}

.copy-btn {
  margin-top: 4px;
}

.players-section {
  display: flex;
  flex-direction: column;
}

.players-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.player-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 20px;
  padding: 4px 14px 4px 4px;
}

.player-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
}

.player-name {
  font-size: 0.88rem;
  font-weight: 600;
}

.kick-btn {
  --padding-start: 4px;
  --padding-end: 4px;
  margin: 0;
  height: 24px;
  font-size: 1.2rem;
}

.launch-btn {
  margin-top: 8px;
  font-weight: 700;
  font-size: 1rem;
}

.lobby-player-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.waiting-pulse {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.leave-btn {
  font-weight: 600;
}

/* ══ QUESTION ══ */
.question-view {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 600px;
  margin: 0 auto;
}

.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.q-counter-badge {
  color: var(--ion-color-primary-contrast);
  font-size: 0.82rem;
  font-weight: 700;
  background: var(--ion-color-primary);
  padding: 4px 12px;
  border-radius: 16px;
}

.timer-num {
  font-size: 1.6rem;
  font-weight: 800;
  transition: color 0.3s;
}

.timer-track {
  height: 8px;
  background: var(--app-surface-alt);
  border-radius: 4px;
  overflow: hidden;
}

.timer-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.25s linear, background 0.3s;
}

.q-text {
  font-size: 1.25rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.5;
  padding: 8px 0;
}

.q-image {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 12px;
  background: var(--app-surface-alt);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.q-image-keyboard {
  max-height: 100px;
  opacity: 0.8;
}

.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tile {
  background: rgba(var(--tile-color-rgb), 0.1);
  border: 2px solid var(--tile-color);
  border-radius: 12px;
  padding: 16px 12px;
  color: var(--app-text);
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 110px;
  min-width: 0;
  overflow: hidden;
  transition: all 0.2s ease-out;
}

.tile:active {
  transform: scale(0.97);
}

.tile:disabled {
  cursor: not-allowed;
}

.tile-selected {
  outline: 3px solid var(--tile-color);
  outline-offset: 2px;
  background: rgba(var(--tile-color-rgb), 0.25);
  transform: scale(1.02);
}

.tile-dimmed {
  opacity: 0.4;
  transform: scale(0.97);
}

.tile-letter {
  font-size: 1.2rem;
  font-weight: 900;
  color: var(--tile-color);
}

.tile-text {
  text-align: center;
  line-height: 1.25;
  width: 100%;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.tile-img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  background: var(--app-surface-alt);
}

.feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 600;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 14px 18px;
}

.feedback-text.ok {
  color: var(--ion-color-success);
  font-size: 1.1rem;
  font-weight: 700;
}

.feedback-text.wrong {
  color: var(--ion-color-danger);
}

.feedback-text.neutral {
  color: var(--ion-color-primary);
  font-weight: 600;
}

/* ══ RESULTS ══ */
.results-view {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 520px;
  margin: 0 auto;
}

/* Gauge */
.answered-gauge {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.gauge-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--app-text-secondary);
  font-weight: 600;
}

.gauge-count {
  font-size: 1.05rem;
  font-weight: 700;
}

.gauge-track {
  height: 10px;
  background: var(--app-surface-alt);
  border-radius: 5px;
  overflow: hidden;
}

.gauge-fill {
  height: 100%;
  background: var(--ion-color-primary);
  border-radius: 5px;
  transition: width 0.15s ease-out;
}

/* First correct */
.first-correct {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--app-surface);
  border: 1px solid var(--ion-color-success);
  border-radius: 12px;
  padding: 12px 16px;
}

.first-correct-icon {
  font-size: 1.8rem;
  color: var(--ion-color-success);
}

.first-correct-info {
  display: flex;
  flex-direction: column;
}

.first-correct-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ion-color-success);
  font-weight: 700;
}

.first-correct-name {
  font-weight: 700;
  font-size: 1.05rem;
}

/* Vote rows */
.vote-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vote-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(var(--tile-color-rgb), 0.05);
  border: 1px solid var(--tile-color);
  border-radius: 12px;
  padding: 14px;
  overflow: hidden;
}

.vote-row.vote-correct {
  border-color: var(--ion-color-success);
  border-width: 2px;
  background: rgba(var(--ion-color-success-rgb), 0.05);
}

.vote-bar-bg {
  position: absolute;
  inset: 0;
  opacity: 1;
  /* Translucent background applied via inline style above */
  border-radius: 12px;
  transition: width 0.042s linear;
  pointer-events: none;
}

.vote-letter {
  font-weight: 900;
  font-size: 1.1rem;
  width: 22px;
  text-align: center;
  color: var(--tile-color);
  position: relative;
  z-index: 1;
}

.vote-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.vote-text {
  flex: 1;
  font-weight: 600;
  font-size: 0.92rem;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.correct-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--ion-color-success);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.correct-badge ion-icon {
  font-size: 1rem;
}

.vote-count {
  font-size: 1.3rem;
  font-weight: 800;
  min-width: 28px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}

/* Points pop */
.points-pop {
  text-align: center;
  font-size: 1.8rem;
  font-weight: 900;
  color: var(--ion-color-success);
  animation: pop 0.4s ease-out;
}

.points-pop.wrong {
  color: var(--app-text-secondary);
  font-size: 1.2rem;
}

.next-btn {
  font-weight: 700;
  margin-top: 4px;
  font-size: 1rem;
}

/* ══ FINISHED ══ */
.finished-view {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 480px;
  margin: 0 auto;
}

.finished-title {
  font-size: 1.6rem;
  font-weight: 800;
  text-align: center;
  margin: 0;
}

.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  height: 180px;
}

.podium-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 90px;
}

.podium-col.hidden {
  visibility: hidden;
}

.podium-username {
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.podium-pts {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  margin-bottom: 6px;
  font-weight: 600;
}

.podium-bar {
  width: 100%;
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.podium-col:nth-child(1) .podium-bar {
  background: #94A3B8;
  /* Argent */
}

.podium-col:nth-child(2) .podium-bar {
  background: #F59E0B;
  /* Or */
}

.podium-col:nth-child(3) .podium-bar {
  background: #B45309;
  /* Bronze */
}

.podium-label {
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
}

/* --- Number Result Line --- */
.number-result {
  text-align: center;
  padding: 20px;
}

.correct-num-label {
  color: var(--ion-color-medium);
  text-transform: uppercase;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 4rem;
}

.number-line-container {
  position: relative;
  height: 120px;
  margin: 40px 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.number-line-bounds {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  font-size: 0.85rem;
  color: var(--app-text-secondary);
  font-weight: 600;
}

.number-line {
  position: relative;
  width: 100%;
  height: 4px;
  background: var(--app-border);
  border-radius: 2px;
}

.marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.marker-tick {
  width: 4px;
  height: 16px;
  background: var(--ion-color-medium);
  border-radius: 2px;
  margin-top: 4px;
}

.correct-marker {
  z-index: 2;
}

.correct-marker .marker-tick {
  background: var(--ion-color-success);
  height: 24px;
  width: 6px;
}

.correct-marker .marker-label {
  color: var(--ion-color-success);
  font-weight: 800;
  font-size: 2rem;
  position: absolute;
  bottom: 100%;
  margin-bottom: -25px;
}

.guess-marker {
  z-index: 1;
}

.guess-marker .marker-tick {
  background: var(--ion-color-primary);
}

.guess-marker.is-closest .marker-tick {
  background: var(--ion-color-warning);
  height: 20px;
}

.marker-label {
  color: var(--ion-text-color);
  font-size: 0.9rem;
  position: absolute;
  top: 100%;
  margin-top: 8px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

.fastest-icon {
  color: var(--ion-color-warning);
  font-size: 1.1rem;
}

/* Footer Game Code */
.game-code-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--app-surface-alt);
  padding: 2px 16px;
  height: 44px;
  border-top: 1px solid var(--app-border);
}

.code-label {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--app-text-secondary);
}

.code-text {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: 2px;
  color: var(--app-text-primary);
}
</style>
