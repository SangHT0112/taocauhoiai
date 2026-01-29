// app/api/pusher/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Pusher from 'pusher'
import jwt from 'jsonwebtoken'

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { socket_id, channel_name } = body

    // Lấy token từ cookie
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify token lấy userId
    let userId: number
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number }
      userId = decoded.userId
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Chỉ cho phép subscribe channel của chính user
    if (channel_name === `private-user-${userId}`) {
      const authResponse = pusher.authenticate(socket_id, channel_name, {
        user_id: userId.toString(),
        user_info: { id: userId }
      })
      return NextResponse.json(authResponse)
    }

    return NextResponse.json({ error: 'Forbidden channel' }, { status: 403 })
  } catch (error) {
    console.error('Pusher auth error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}