// app/api/subjects/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get('grade_id');

    if (!gradeId) {
      return NextResponse.json({ error: 'Thiếu grade_id' }, { status: 400 });
    }

    const [rows] = await pool.execute(
      'SELECT id, name FROM subjects WHERE grade_id = ? ORDER BY id ASC',
      [gradeId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Lỗi fetch subjects:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}