// app/api/webhook/sepay/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Server as SocketServer } from 'socket.io'

// Biến global để lưu socket server (chỉ init 1 lần)
let io: SocketServer | null = null

// Khởi tạo socket.io nếu chưa có
if (!io) {
  io = new SocketServer({
    path: '/api/socket',
    addTrailingSlash: false,
  })
  // Gắn vào server Next.js (chỉ chạy ở server-side)
  const server = (global as any).socketServer
  if (server) {
    io.attach(server)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log để debug
    console.log('SePay Webhook received:', body)

    // Verify webhook (thay bằng secret thật của SePay)
    const secret = process.env.SEPAY_WEBHOOK_SECRET
    if (!secret || body.secret !== secret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    const { description, transferAmount: amount } = body

    // Tìm user_id từ description (giống PHP của bạn)
    const match = description.match(/user\s+(\d+)/i)
    if (!match) {
      console.log('No user_id found in description')
      return NextResponse.json({ status: 'ignored' })
    }

    const userId = parseInt(match[1], 10)

    // Kiểm tra số tiền (tùy chọn)
    // Ví dụ: so sánh với giá gói mong đợi

    // Emit thông báo realtime đến user
    io?.to(`user_${userId}`).emit('payment_success', {
      message: `Thanh toán thành công! Số tiền: ${amount.toLocaleString('vi-VN')}₫`,
      amount,
      description
    })

    // Trả response cho SePay (bắt buộc 200 OK)
    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}