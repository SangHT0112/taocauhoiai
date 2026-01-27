// app/api/answers/route.ts
import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"  // Giả sử pool là mysql2 Pool instance
import jwt from "jsonwebtoken"
import type { RowDataPacket } from "mysql2/promise"  // Import type cho rows

// Interface cho result của query MAX (scalar)
interface MaxOrderResult extends RowDataPacket {
  next_order: number
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("token")?.value
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let userId: number
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    userId = decoded.userId
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const body = await request.json()
  const { id, answer_text, is_correct, order_num, question_id } = body

  if (!id || !answer_text?.trim() || !question_id) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 })
  }

  const connection = await pool.getConnection()
  try {
    // Check ownership
    const [checkRows]: any = await connection.execute(
      `SELECT a.id FROM answers a 
       JOIN questions q ON a.question_id = q.id 
       JOIN exercises e ON q.exercise_id = e.id 
       WHERE a.id = ? AND e.user_id = ?`,
      [id, userId]
    )
    if (!checkRows.length) {
      return NextResponse.json({ error: "Answer not found or unauthorized" }, { status: 404 })
    }

    await connection.execute(
      `UPDATE answers SET answer_text = ?, is_correct = ?, order_num = ? WHERE id = ?`,
      [answer_text, is_correct || 0, order_num || 1, id]
    )

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error updating answer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    connection.release()
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let userId: number
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    userId = decoded.userId
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const body = await request.json()
  const { question_id, answer_text, is_correct = false, order_num } = body

  if (!question_id || !answer_text?.trim()) {
    return NextResponse.json({ error: "question_id and answer_text are required" }, { status: 400 })
  }

  const connection = await pool.getConnection()
  try {
    // Check ownership qua question_id
    const [checkRows]: any = await connection.execute(
      `SELECT q.id FROM questions q 
       JOIN exercises e ON q.exercise_id = e.id 
       WHERE q.id = ? AND e.user_id = ?`,
      [question_id, userId]
    )
    if (!checkRows.length) {
      return NextResponse.json({ error: "Question not found or unauthorized" }, { status: 404 })
    }

    // Tính order_num nếu không cung cấp (max +1) - FIX TYPE
    let nextOrderNum = order_num
    if (!nextOrderNum) {
      const [rows]: [MaxOrderResult[], any] = await connection.execute(
        `SELECT COALESCE(MAX(order_num), 0) + 1 as next_order FROM answers WHERE question_id = ?`,
        [question_id]
      )
      // FIX: Truy cập rows[0] an toàn với optional chaining
      nextOrderNum = rows[0]?.next_order || 1
    }

    const [insertResult]: any = await connection.execute(
      `INSERT INTO answers (question_id, answer_text, is_correct, order_num) VALUES (?, ?, ?, ?)`,
      [question_id, answer_text, is_correct ? 1 : 0, nextOrderNum]
    )

    return NextResponse.json({ success: true, id: insertResult.insertId, order_num: nextOrderNum })
  } catch (error) {
    console.error("Error creating answer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    connection.release()
  }
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("token")?.value
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let userId: number
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    userId = decoded.userId
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 })
  }

  const { id } = await request.json()  // Body: { id: answerId }

  if (!id) {
    return NextResponse.json({ error: "Answer ID is required" }, { status: 400 })
  }

  const connection = await pool.getConnection()
  try {
    // Check ownership
    const [checkRows]: any = await connection.execute(
      `SELECT a.id FROM answers a 
       JOIN questions q ON a.question_id = q.id 
       JOIN exercises e ON q.exercise_id = e.id 
       WHERE a.id = ? AND e.user_id = ?`,
      [id, userId]
    )
    if (!checkRows.length) {
      return NextResponse.json({ error: "Answer not found or unauthorized" }, { status: 404 })
    }

    await connection.execute(`DELETE FROM answers WHERE id = ?`, [id])

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error deleting answer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    connection.release()
  }
}