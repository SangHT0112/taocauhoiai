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

    /* 3️⃣ Tạo JWT */
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    )

    /* 4️⃣ SET COOKIE (QUAN TRỌNG NHẤT) */
    const cookieStore = await cookies()
    cookieStore.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 ngày
    })

    /* 5️⃣ Trả response gọn */
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
