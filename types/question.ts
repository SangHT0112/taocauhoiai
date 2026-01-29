export interface Answer {
  id?: number  // Made optional for generated/preview
  answer_text: string
  is_correct: boolean
}

export interface Question {
  id: number
  question_text: string
  emoji: string
  question_type: string
  answers: Answer[]
  explanation: string
}

export interface Grade {
  id: number;
  name: string;
}

export interface Subject {
  id: number;
  name: string;
  grade_id: number;
}

export interface Chapter {
  id: number;
  title: string;
  subject_id: number;
}

export interface Lesson {
  id: number;
  title: string;
  chapter_id: number;
  lesson_order?: number;
}

export interface QuestionFormData {
  // Fields for generation (new exercise)
  exercise_name?: string;
  type?: 'multiple_choice' | 'open_ended' | 'mixed';
  // class_id?: number;  // Changed: string for Select value
  // book_id?: number;
  type_quantities?: Record<'multiple_choice' | 'open_ended' | 'true_false' | 'multiple_select', number>
  user_instructions?: string;
  num_questions?: number;
  num_answers?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  user_id?: number | null;
  selected_types?: ('multiple_choice' | 'open_ended' | 'true_false' | 'multiple_select')[];  // Available question types
  grade_id?: number;
  subject_id?: number;
  chapter_id?: number;
  lesson_id?: number;
  // Fields for manual/edit single question (legacy/optional)
  topic?: string;
  quantity?: number;
  number_of_answers?: number;
  description?: string;
  question_text?: string;
  emoji?: string;
  question_type?: string;
  answers?: Answer[];
  explanation?: string;
}

export interface InsertedQuestion {
  id: number
  question_text: string
  emoji: string
  question_type_id: number
  answers?: Answer[]  // Optional for open_ended
  explanation: string
  correct_answer_id?: number
  type_name?: string
  question_type: string
  suggested_type?: string;
  model_answer?: string;  // For open_ended
}

export interface QuestionFormProps {
  // onSubmit: (data: QuestionFormData | Question | Question[]) => void
  onCancel: () => void
  initialData?: Partial<QuestionFormData>
}

export interface Exercise {
  id: number;
  name: string;
  user_instructions: string;
  type: 'multiple_choice' | 'open_ended' | 'mixed' | 'true_false' | 'multiple_select';
  question_type_id?: number;
  num_questions: number;
  num_answers?: number;
  difficulty: string;
  user_id: number;
  created_at: string;
}



