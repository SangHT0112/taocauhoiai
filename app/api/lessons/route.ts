// app/api/lessons/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapter_id');

    if (!chapterId) {
      return NextResponse.json({ error: 'Thiếu chapter_id' }, { status: 400 });
    }

    // Sắp xếp theo lesson_order ASC, nếu null thì cuối cùng
    const [rows] = await pool.execute(
      `SELECT id, title, content, lesson_order 
       FROM lessons 
       WHERE chapter_id = ? 
       ORDER BY lesson_order ASC, id ASC`,
      [chapterId]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Lỗi fetch lessons:', error);
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}