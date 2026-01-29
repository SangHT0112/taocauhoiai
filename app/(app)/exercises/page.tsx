import { redirect } from "next/navigation"
import Link from "next/link"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import pool from "@/lib/db"

interface Exercise {
  id: number
  name: string
  type: string
  num_questions: number
  difficulty: string
  created_at: string
}

export default async function ExercisesPage() {
  /* 1. LẤY TOKEN TỪ COOKIE */
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) {
    redirect("/login")
  }

  let userId: number

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { userId: number }

    userId = decoded.userId
  } catch {
    redirect("/login")
  }

  /* 2. QUERY DB */
  const connection = await pool.getConnection()

  try {
    const [rows] = await connection.execute(
      `
      SELECT id, name, type, num_questions, difficulty, created_at
      FROM exercises
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    ) as [Exercise[], any]

    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">
          Danh sách bộ câu hỏi của bạn
        </h1>

        {rows.length === 0 ? (
          <p>
            Bạn chưa tạo bộ câu hỏi nào.{" "}
            <Link href="/generate" className="text-blue-500 underline">
              Tạo mới ngay
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((exercise) => (
                <div key={exercise.id} className="border p-4 rounded-lg">
                    <h2 className="text-xl font-semibold">{exercise.name}</h2>
                    {/* <p>Bài học: {exercise.lesson_name}</p> */}
                    <p>Loại: {exercise.type}</p>
                    <p>Số câu: {exercise.num_questions}</p>
                    <p>Độ khó: {exercise.difficulty}</p>

                    <Link
                    href={`/exercises/${exercise.id}`}
                    className="text-blue-500 underline mt-2 inline-block"
                    >
                    Xem chi tiết
                    </Link>
                </div>
                ))}

          </div>
        )}
      </div>
    )
  } finally {
    connection.release()
  }
}
