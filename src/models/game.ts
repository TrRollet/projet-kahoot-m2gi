export interface Game {
  id: string
  quizId: string
  quizTitle: string
  hostId: string
  code: string
  status: 'waiting' | 'active' | 'finished'
  createdAt: string
}
