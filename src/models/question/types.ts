import { Choice } from "../choice";

export type QuestionType = 'single' | 'number';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageBase64?: string;
  order?: number;
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'single';
  choices: Choice[];
  correctAnswerIndex: number;
}

export interface NumberQuestion extends BaseQuestion {
  type: 'number';
  correctNumber: number;
  numberType?: 'amount' | 'date' | 'percent';
}

export type Question = SingleChoiceQuestion | NumberQuestion;
