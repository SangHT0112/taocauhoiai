// app/api/answers/route.ts - Fix validation (remove unnecessary question_id for PUT, make fields optional)
import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import jwt from "jsonwebtoken"
import type { RowDataPacket } from "mysql2/promise"

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
  const { id, answer_text, is_correct, order_num } = body  // Remove question_id from destructuring

  if (!id) {  // Only require id for UPDATE
    return NextResponse.json({ error: "Answer ID is required" }, { status: 400 })
  }

  // Optional validation for provided fields
  if (answer_text !== undefined && !answer_text.trim()) {
    return NextResponse.json({ error: "Answer text cannot be empty" }, { status: 400 })
  }

  const connection = await pool.getConnection()
  try {
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

    // Build update query dynamically if fields provided
    const updates: string[] = []
    const params: any[] = [id]  // Last param is id for WHERE
    if (answer_text !== undefined) {
      updates.push("answer_text = ?")
      params.unshift(answer_text)
    }
    if (is_correct !== undefined) {
      updates.push("is_correct = ?")
      params.unshift(is_correct ? 1 : 0)
    }
    if (order_num !== undefined) {
      updates.push("order_num = ?")
      params.unshift(order_num)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    await connection.execute(
      `UPDATE answers SET ${updates.join(", ")} WHERE id = ?`,
      params
    )

    console.log(`✅ Updated answer ID ${id} for user ${userId}`)

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
    const [checkRows]: any = await connection.execute(
      `SELECT q.id FROM questions q 
       JOIN exercises e ON q.exercise_id = e.id 
       WHERE q.id = ? AND e.user_id = ?`,
      [question_id, userId]
    )
    if (!checkRows.length) {
      return NextResponse.json({ error: "Question not found or unauthorized" }, { status: 404 })
    }

    let nextOrderNum = order_num
    if (!nextOrderNum) {
      const [rows]: [MaxOrderResult[], any] = await connection.execute(
        `SELECT COALESCE(MAX(order_num), 0) + 1 as next_order FROM answers WHERE question_id = ?`,
        [question_id]
      )
      nextOrderNum = rows[0]?.next_order || 1
    }

    const [insertResult]: any = await connection.execute(
      `INSERT INTO answers (question_id, answer_text, is_correct, order_num) VALUES (?, ?, ?, ?)`,
      [question_id, answer_text, is_correct ? 1 : 0, nextOrderNum]
    )

    console.log(`✅ Created answer ID ${insertResult.insertId} for question ${question_id}`)

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

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Answer ID is required" }, { status: 400 })
  }

  const connection = await pool.getConnection()
  try {
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

    console.log(`✅ Deleted answer ID ${id} for user ${userId}`)

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error deleting answer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    connection.release()
  }
}