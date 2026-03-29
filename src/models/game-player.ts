export interface PlayerAnswer {
  choiceIndex: number
  points: number
  isCorrect: boolean
  timeTaken: number
}

export interface GamePlayer {
  uid: string
  username: string
  score: number
  answers: Record<number, PlayerAnswer>
  joinedAt: string
}
