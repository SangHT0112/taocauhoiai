// app/api/grades/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db'; // Đường dẫn đến file db của bạn

export async function GET() {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM grades ORDER BY id ASC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Lỗi fetch grades:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}