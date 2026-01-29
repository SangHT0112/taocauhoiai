// app/exercises/[id]/page.tsx - Server Component (giữ nguyên fetch logic)
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import pool from "@/lib/db"
import PrintActions from "@/components/pdf/PrintActions"
import ExerciseList from "@/components/exercise/ExerciseList"  // Import client component riêng

interface Exercise {
  id: number
  name: string
  type: string
  num_questions: number
  difficulty: string
  created_at: string
}

interface Question {
  id: number
  order_num: number
  question_text: string
  emoji: string
  explanation: string
  model_answer?: string
  type_name?: string
  answers?: Answer[]
}

interface Answer {
  id: number
  order_num: number
  answer_text: string
  is_correct: boolean
}

interface ExerciseWithQuestions extends Exercise {
  questions: Question[]
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  multiple_select: "Chọn nhiều đáp án đúng",
  open_ended: "Tự luận",
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const exerciseId = Number(id)
  if (isNaN(exerciseId)) notFound()

  /* AUTH */
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value
  if (!token) redirect("/login")

  let userId: number
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number
    }
    userId = decoded.userId
  } catch {
    redirect("/login")
  }

  const connection = await pool.getConnection()

  try {
    // Fetch exercise
    const [exerciseRows]: any = await connection.execute(
      `SELECT * FROM exercises WHERE id = ? AND user_id = ?`,
      [exerciseId, userId]
    )

    if (exerciseRows.length === 0) notFound()

    const exercise: Exercise = exerciseRows[0]

    // Fetch questions (join với QuestionTypes để lấy type_name nếu cần)
    const [questionRows]: any = await connection.execute(
      `SELECT q.*, qt.type_name 
       FROM questions q 
       LEFT JOIN questiontypes qt ON q.question_type_id = qt.id 
       WHERE q.exercise_id = ? ORDER BY q.order_num ASC`,
      [exerciseId]
    )

    // Fetch answers cho mỗi question (thêm id cho answers)
    const questions: Question[] = []
    for (const qRow of questionRows) {
      const [answerRows]: any = await connection.execute(
        `SELECT id, order_num, answer_text, is_correct FROM answers WHERE question_id = ? ORDER BY order_num ASC`,
        [qRow.id]
      )

      questions.push({
        id: qRow.id,
        order_num: qRow.order_num,
        question_text: qRow.question_text,
        emoji: qRow.emoji || "❓",
        explanation: qRow.explanation || "",
        model_answer: qRow.model_answer,
        type_name: qRow.type_name,
        answers: answerRows,
      })
    }

    const exerciseWithQuestions: ExerciseWithQuestions = { ...exercise, questions }
    const printableQuestions = exerciseWithQuestions.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      emoji: q.emoji,
      explanation: q.explanation,
      model_answer: q.model_answer,
      answers: q.answers,
    }))

    return (
      <div className="container mx-auto p-8 max-w-4xl">
        <Link href="/exercises" className="text-blue-500 underline mb-4 inline-block">
          ← Quay lại danh sách
        </Link>

        <PrintActions
          exerciseName={exercise.name}
          questions={printableQuestions}
        />

        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{exercise.name}</h1>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="mb-1"><strong>Loại:</strong> {exercise.type.replace(/_/g, ' ').toUpperCase()}</p>
            <p className="mb-1"><strong>Số câu hỏi:</strong> {exercise.num_questions}</p>
            <p className="mb-1"><strong>Độ khó:</strong> {exercise.difficulty}</p>
            <p className="text-sm text-gray-600"><strong>Tạo lúc:</strong> {new Date(exercise.created_at).toLocaleString('vi-VN')}</p>
          </div>
        </header>

        <section>
          <h2 className="text-2xl font-bold mb-4">Danh sách câu hỏi</h2>
          {/* Sử dụng client component cho edit */}
          <ExerciseList questions={questions} exerciseId={exerciseId} />
        </section>
      </div>
    )
  } catch (error) {
    console.error("Lỗi tải chi tiết bài tập:", error)
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold text-red-600">Lỗi tải dữ liệu</h1>
        <p>Vui lòng thử lại sau. <Link href="/exercises" className="text-blue-500 underline">Quay lại danh sách</Link></p>
      </div>
    )
  } finally {
    connection.release()
  }
}