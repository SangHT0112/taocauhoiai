// app/api/webhook/sepay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import Pusher from 'pusher';
import { RowDataPacket, OkPacket, FieldPacket } from 'mysql2';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(request: NextRequest) {
  let connection;

  try {
    const body = await request.json();
    console.log('SePay Webhook received:', body);

    // Bỏ verify secret nếu muốn đơn giản (hoặc giữ lại nếu cần)

    const rawDescription = body.description || body.content || '';
    const amount = body.transferAmount;

    if (!rawDescription || !amount) {
      console.log('Missing description or amount');
      return NextResponse.json({ status: 'ignored' });
    }

    // Trích xuất userId từ description (linh hoạt với prefix ngân hàng)
    const userMatch = rawDescription.match(/user\s+(\d+)/i);
    if (!userMatch) {
      console.log('No user_id found');
      return NextResponse.json({ status: 'ignored - no user' });
    }

    const userId = parseInt(userMatch[1], 10);
    console.log(`User ${userId} thanh toán ${amount}₫`);

    connection = await pool.getConnection();

    // Xác định tier_id và billing_cycle từ amount (bạn cần map theo gói thật)
    // Ví dụ đơn giản: giả sử amount 5000 = Basic monthly, 48000 = Basic yearly, v.v.
    let tierId: number;
    let billingCycle: 'monthly' | 'yearly' = 'monthly';

    // Map amount → tier (thay bằng giá thật của bạn)
    if (amount === 5000) {
      tierId = 2; // giả sử id của gói Basic monthly
    } else if (amount === 48000) { // yearly 5000*12*0.8 = 48000
      tierId = 2;
      billingCycle = 'yearly';
    } else if (amount === 10000) {
      tierId = 3; // Premium monthly
    } else {
      console.log('Amount không khớp gói nào:', amount);
      return NextResponse.json({ status: 'ignored - unknown amount' });
    }

    await connection.beginTransaction();

    try {
      // Hủy gói cũ nếu đang active
      await connection.execute(
        `UPDATE user_subscriptions SET status = 'cancelled' 
         WHERE user_id = ? AND status = 'active'`,
        [userId]
      );

      // Tạo gói mới active
      const startDate = new Date().toISOString().split('T')[0];
      let endDate = new Date();
      if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      const endDateStr = endDate.toISOString().split('T')[0];

      await connection.execute(
        `INSERT INTO user_subscriptions 
         (user_id, tier_id, billing_cycle, start_date, end_date, status, current_tests_used, current_questions_used)
         VALUES (?, ?, ?, ?, ?, 'active', 0, 0)`,
        [userId, tierId, billingCycle, startDate, endDateStr]
      );

      await connection.commit();

      // Trigger Pusher
      await pusher.trigger(`private-user-${userId}`, 'payment_success', {
        message: `Thanh toán thành công ${amount.toLocaleString('vi-VN')}₫! Gói đã được kích hoạt.`,
        amount,
        tier_id: tierId,
        billing_cycle: billingCycle,
      });

      console.log(`Activated subscription for user ${userId}`);

      return NextResponse.json({ status: 'success' });

    } catch (innerErr) {
      await connection.rollback();
      throw innerErr;
    }

  } catch (error) {
    console.error('Webhook error:', error);
    if (connection) await connection.rollback();
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}