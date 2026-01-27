export interface PDFQuestion {
  id: number
  question_text: string
  emoji: string
  explanation?: string
  model_answer?: string
  answers?: {
    order_num: number
    answer_text: string
    is_correct: boolean
  }[]
}
