// app/api/auth/me/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import db from "@/lib/db"
import type { RowDataPacket } from "mysql2/promise"

interface UserRow extends RowDataPacket {
  id: number
  username: string
  email: string
  role: string
  is_active: number
  tier_id: number | null
  created_at: Date
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
    const userId = decoded.userId

    // Query database để lấy thông tin user
    const [rows] = await db.query<UserRow[]>(
      "SELECT id, username, email, role, is_active, tier_id, created_at FROM users WHERE id = ?",
      [userId]
    )

    const user = rows[0]

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Format response
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.is_active === 1,
        tier_id: user.tier_id,
        created_at: user.created_at
      }
    })

  } catch (error) {
    console.error("Error fetching user:", error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}