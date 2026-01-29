import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import jwt from "jsonwebtoken"
import db from "@/lib/db"
import { cookies } from "next/headers"
import type { OkPacket, FieldPacket, RowDataPacket } from "mysql2"

const JWT_SECRET = process.env.JWT_SECRET!

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID
)

/* ======================
   TYPE USER
====================== */
interface UserRow extends RowDataPacket {
  id: number
  username: string
  email: string
  google_id: string
  role: string
}

async function ensureFreeSubscription(connection: any, userId: number): Promise<void> {
  try {
    // Kiểm tra subscription active hiện tại
    const [subs] = await connection.execute(
      `SELECT id FROM user_subscriptions 
       WHERE user_id = ? AND status = 'active' AND end_date >= CURDATE() 
       LIMIT 1`,
      [userId]
    ) as [RowDataPacket[]]

    if (subs.length > 0) return // Đã có gói active → không tạo mới

    // Tạo gói Free (tier_id = 1)
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30) // Free 30 ngày (có thể đổi thành vĩnh viễn)
    const endDateStr = endDate.toISOString().split('T')[0]

    await connection.execute(
      `INSERT INTO user_subscriptions (
        user_id, tier_id, billing_cycle, start_date, end_date, status,
        current_tests_used, current_questions_used
      ) VALUES (?, 1, 'monthly', ?, ?, 'active', 0, 0)`,
      [userId, startDate, endDateStr]
    )

    console.log(`Đã tạo gói Free cho user ${userId}`)
  } catch (err) {
    console.error("Lỗi tạo gói Free:", err)
    // Không throw để tránh làm hỏng quá trình login
  }
}

/* ======================
   POST /api/auth/google
====================== */
export async function POST(req: NextRequest) {
  let connection

  try {
    const { credential } = await req.json()
    if (!credential) {
      return NextResponse.json({ message: "Thiếu credential" }, { status: 400 })
    }

    /* 1️⃣ Verify Google ID Token */
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json({ message: "Token Google không hợp lệ" }, { status: 401 })
    }

    const { email, name, sub: googleId } = payload

    /* 2️⃣ Kết nối DB */
    connection = await db.getConnection()

    const [rows]: [UserRow[], FieldPacket[]] = await connection.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    )

    let user: UserRow

    if (rows.length > 0) {
      user = rows[0]

      await connection.execute(
        "UPDATE users SET username = ?, google_id = ? WHERE id = ?",
        [name, googleId, user.id]
      )
    } else {
      const [result]: [OkPacket, FieldPacket[]] = await connection.execute(
        "INSERT INTO users (email, username, google_id, role, is_active) VALUES (?, ?, ?, ?, 1)",
        [email, name, googleId, "teacher"]
      )

      user = {
        id: result.insertId,
        email,
        username: name,
        google_id: googleId,
        role: "teacher",
      } as UserRow
    }

    /* BỔ SUNG: Đảm bảo user có gói Free */
    await ensureFreeSubscription(connection, user.id)

    /* 3️⃣ Tạo JWT */
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    )

    /* 4️⃣ SET COOKIE */
    const cookieStore = await cookies()
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    })

    /* 5️⃣ Trả response */
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Google login error:", error)
    return NextResponse.json({ message: "Lỗi server" }, { status: 500 })
  } finally {
    if (connection) connection.release()
  }
}