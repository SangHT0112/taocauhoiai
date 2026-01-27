import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [rows]: any = await pool.query(
    "SELECT id, username, email, role FROM users WHERE id = ?",
    [id]
  )

  if (rows.length === 0) {
    return NextResponse.json({ message: "User not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}
