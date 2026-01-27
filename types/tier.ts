export interface Tier {
  id: number
  tier_name: string
  price: number
  max_tests: number
  max_questions: number
  description: string
  features: string[]
  isPopular?: boolean
}