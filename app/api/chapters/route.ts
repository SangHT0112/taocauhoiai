// app/api/chapters/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');

    if (!subjectId) {
      return NextResponse.json({ error: 'Thiếu subject_id' }, { status: 400 });
    }

    const [rows] = await pool.execute(
      'SELECT id, title FROM chapters WHERE subject_id = ? ORDER BY id ASC',
      [subjectId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Lỗi fetch chapters:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}