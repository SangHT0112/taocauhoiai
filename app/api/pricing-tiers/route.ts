// app/api/pricing-tiers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, OkPacket } from 'mysql2';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

// Helper: Lấy userId từ cookie token (dùng cho POST)
async function getUserIdFromRequest(request: NextRequest): Promise<number> {
  const token = request.cookies.get('token')?.value;
  if (!token) {
    throw new Error('Unauthorized: No token');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

export async function GET(request: NextRequest) {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        t.id, t.tier_name, t.price_monthly AS price,
        t.max_tests, t.max_questions, t.description,
        t.is_popular AS isPopular,
        GROUP_CONCAT(f.feature_name ORDER BY f.feature_order SEPARATOR '\n') AS features_str
      FROM subscription_tiers t
      LEFT JOIN tier_features f ON t.id = f.tier_id
      GROUP BY t.id
      ORDER BY t.id ASC
    `);

    // Ép kiểu an toàn
    const dataRows = rows as RowDataPacket[];

    const tiers = dataRows.map((row) => ({
      ...row,
      isPopular: Boolean(row.isPopular),
      features: row.features_str && typeof row.features_str === 'string'
        ? row.features_str.split('\n').filter(f => f.trim() !== '')
        : [],
    }));

    return NextResponse.json(tiers);
  } catch (error) {
    console.error('Lỗi fetch pricing tiers:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let connection: any;

  try {
    const userId = await getUserIdFromRequest(request);
    const body = await request.json();
    const { tier_id, billing_cycle = 'monthly' } = body;

    if (!tier_id || typeof tier_id !== 'number') {
      return NextResponse.json({ error: 'Thiếu hoặc sai tier_id' }, { status: 400 });
    }

    connection = await pool.getConnection();

    const [tierRows] = await connection.execute(
      'SELECT id, tier_name, price_monthly FROM subscription_tiers WHERE id = ?',
      [tier_id]
    ) as [RowDataPacket[]];

    if (tierRows.length === 0) {
      return NextResponse.json({ error: 'Gói không tồn tại' }, { status: 404 });
    }

    const selectedTier = tierRows[0];

    const startDate = new Date().toISOString().split('T')[0];
    let endDate = new Date();
    if (billing_cycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    const endDateStr = endDate.toISOString().split('T')[0];

    await connection.execute(
      `UPDATE user_subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    const [result] = await connection.execute(
      `
        INSERT INTO user_subscriptions (
          user_id, tier_id, billing_cycle, start_date, end_date, status, 
          current_tests_used, current_questions_used
        ) VALUES (?, ?, ?, ?, ?, 'active', 0, 0)
      `,
      [userId, tier_id, billing_cycle, startDate, endDateStr]
    ) as [OkPacket];

    return NextResponse.json({
      success: true,
      subscription_id: result.insertId,
      tier_name: selectedTier.tier_name,
      message: `Đăng ký/nâng cấp gói ${selectedTier.tier_name} thành công`,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Lỗi POST /api/pricing-tiers:', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Invalid')) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập lại' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}