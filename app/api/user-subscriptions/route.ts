// app/api/user-subscriptions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, FieldPacket } from 'mysql2';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

async function getUserId(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  if (!token) throw new Error('Unauthorized');

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(request: NextRequest) {
  let connection;
  try {
    const userId = await getUserId(request);
    connection = await pool.getConnection();

    // Sửa lỗi: Ép kiểu toàn bộ tuple [rows, fields]
    const result = await connection.execute(
      `
        SELECT 
          us.tier_id, st.tier_name, us.billing_cycle, us.start_date, us.end_date, us.status
        FROM user_subscriptions us
        JOIN subscription_tiers st ON us.tier_id = st.id
        WHERE us.user_id = ? AND us.status = 'active' AND us.end_date >= CURDATE()
        ORDER BY us.created_at DESC LIMIT 1
      `,
      [userId]
    ) as [RowDataPacket[], FieldPacket[]];

    const rows = result[0]; // lấy phần tử đầu tiên (rows)

    const subscription = rows.length > 0 ? rows[0] : null;

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error('Lỗi GET user-subscriptions:', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Invalid')) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}