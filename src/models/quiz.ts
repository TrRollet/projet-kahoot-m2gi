import { Question } from "./question"

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  ownerId?: string;
  editors?: string[];
  readers?: string[];
}

export type UserRole = 'owner' | 'editor' | 'reader' | 'none';