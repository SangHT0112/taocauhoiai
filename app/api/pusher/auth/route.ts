// app/api/pusher/auth/route.ts
import { NextRequest, NextResponse } from "next/server"
import Pusher from "pusher"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.text() // 🔥 QUAN TRỌNG
    const params = new URLSearchParams(body)

    const socketId = params.get("socket_id")
    const channel = params.get("channel_name")

    if (!socketId || !channel) {
      return NextResponse.json({ error: "Missing socket_id or channel" }, { status: 400 })
    }

    const auth = pusher.authorizeChannel(socketId, channel)
    return NextResponse.json(auth)
  } catch (err) {
    console.error("❌ PUSHER AUTH ERROR:", err)
    return NextResponse.json({ error: "Auth failed" }, { status: 500 })
  }
}
