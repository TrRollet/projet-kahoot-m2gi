export const TIME_LIMIT = 20 // secondes par question (fixe)

import type { Question } from './question/types'

export interface Game {
  id: string
  quizId: string
  quizTitle: string
  hostId: string
  code: string
  status: 'waiting' | 'question' | 'results' | 'leaderboard' | 'finished'
  currentQuestionIndex: number
  questionStartTime: any
  timeLimit: number
  questions: Question[]
  playerIds: string[]
  createdAt: string
}
