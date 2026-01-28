import mysql, { OkPacket, FieldPacket, Connection } from 'mysql2/promise';
import { Exercise } from '@/types/question';
import pool from "@/lib/db"

export interface QuestionType {
  id: number;
  type_name: string;
  description?: string;
  is_multiple_choice: boolean;
}

export interface GeneratedQuestion {
  question_text: string;
  explanation: string;
  model_answer?: string;
  answers?: string[];
  suggested_type?: string;
}

export interface InsertedQuestion extends GeneratedQuestion {
  id: number;
  order_num: number;
  question_type_id: number;
}

export interface InsertedExercise extends Exercise {
  questions: InsertedQuestion[];
}

// ← CẬP NHẬT: Thêm các field mới vào query nếu muốn fetch chúng (tùy chọn, hiện giữ nguyên để tương thích cũ)
export async function getExercisesByUser(userId: number) {
  const connection = await pool.getConnection()
  try {
    const [rows] = await connection.execute(
      `
      SELECT id, name, user_instructions, type, num_questions, difficulty, created_at
      FROM exercises
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    )
    return rows as Exercise[]
  } finally {
    connection.release()
  }
}

// Helper: Normalize name for matching (giữ nguyên)
export function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[_ ]/g, '');  // "multiple_choice" or "multiple choice" → "multiplechoice"
}

// ← CẬP NHẬT: Main service function - Thay class_id/book_id bằng grade_id/subject_id/chapter_id/lesson_id
export async function createExerciseWithQuestions(
  connection: Connection,
  exerciseData: {
    name: string;
    user_instructions: string;
    type: Exercise['type'];
    num_questions: number;
    num_answers?: number;
    difficulty: string;
    // ← THÊM: Các field mới từ schema
    grade_id: number;
    subject_id: number;
    chapter_id: number;
    lesson_id: number;
    // ← XÓA: class_id, book_id (không dùng nữa)
    user_id: number;
    question_type_id: number | null;
  },
  questions: GeneratedQuestion[],
  existingTypes: QuestionType[]
): Promise<InsertedExercise> {
  await connection.beginTransaction();

  try {
    const exerciseId = await insertExercise(connection, exerciseData);

    const insertedQuestions = await insertQuestionsWithAnswers(
      connection,
      exerciseId,
      questions,
      existingTypes
    );

    await connection.commit();

    const insertedExercise: InsertedExercise = {
      ...exerciseData,
      id: exerciseId,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      questions: insertedQuestions,
      question_type_id: exerciseData.question_type_id ?? undefined,
    };

    return insertedExercise;
  } catch (err) {
    await connection.rollback();
    throw err;
  }
}

// Helper: Fetch all QuestionTypes (giữ nguyên)
export async function fetchQuestionTypes(connection: Connection): Promise<QuestionType[]> {
  const [rows] = await connection.execute('SELECT * FROM questiontypes') as [QuestionType[], FieldPacket[]];
  return rows;
}

// Helper: Insert new QuestionType nếu chưa tồn tại (giữ nguyên)
export async function insertQuestionTypeIfNotExists(
  connection: Connection,
  typeName: string,
  isMultipleChoice: boolean,
  existingTypes: QuestionType[]  // ← THÊM PARAM NÀY để match in JS
): Promise<number> {
  const normalizedInput = normalizeForMatch(typeName);
  console.log(`🔍 Checking type: "${typeName}" (normalized: "${normalizedInput}")`);

  // Match in JS: Normalize all existing types
  const matched = existingTypes.find(t => normalizeForMatch(t.type_name) === normalizedInput);
  if (matched) {
    console.log(`✅ Found existing: "${matched.type_name}" (ID: ${matched.id}) for "${typeName}"`);
    return matched.id;
  }

  // Không tồn tại → Insert với tên gốc (không thay đổi)
  const [insertResult] = await connection.execute(
    'INSERT INTO questiontypes (type_name, is_multiple_choice) VALUES (?, ?)',
    [typeName, isMultipleChoice]
  ) as [OkPacket, FieldPacket[]];
  const newId = (insertResult as any).insertId;
  console.log(`🆕 Inserted: "${typeName}" (ID: ${newId})`);
  return newId;
}

// ← CẬP NHẬT: Helper: Insert Exercise - Thay đổi SQL và params cho các field mới
async function insertExercise(
  connection: Connection,
  data: {
    name: string;
    user_instructions: string;
    type: Exercise['type'];
    num_questions: number;
    num_answers?: number;
    difficulty: string;
    // ← THÊM: Các field mới
    grade_id: number;
    subject_id: number;
    chapter_id: number;
    lesson_id: number;
    // ← XÓA: class_id, book_id
    user_id: number;
    question_type_id: number | null;
  }
): Promise<number> {
  const [insertResult] = await connection.execute(
    // ← CẬP NHẬT: SQL - Thay class_id/book_id bằng grade_id/subject_id/chapter_id/lesson_id
    `INSERT INTO exercises (name, user_instructions, type, num_questions, num_answers, difficulty, grade_id, subject_id, chapter_id, lesson_id, user_id, question_type_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.user_instructions,
      data.type,
      data.num_questions,
      data.num_answers || null,
      data.difficulty,
      // ← THÊM: Các params mới
      data.grade_id,
      data.subject_id,
      data.chapter_id,
      data.lesson_id,
      // ← XÓA: data.class_id, data.book_id
      data.user_id,
      data.question_type_id,
    ]
  ) as [OkPacket, FieldPacket[]];
  return (insertResult as any).insertId;
}

// Helper: Insert Questions và Answers (giữ nguyên)
async function insertQuestionsWithAnswers(
  connection: Connection,
  exerciseId: number,
  questions: GeneratedQuestion[],
  existingTypes: QuestionType[]
): Promise<InsertedQuestion[]> {
  const insertedQuestions: InsertedQuestion[] = [];
  const choiceBasedTypes = ['multiple_choice', 'true_false', 'multiple_select'];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    let qTypeId: number;
    if (q.suggested_type) {
      // FIX: Normalize both suggested and DB for match
      const suggestedNormalized = normalizeForMatch(q.suggested_type);
      const suggestedMatch = existingTypes.find(t => normalizeForMatch(t.type_name) === suggestedNormalized);
      if (suggestedMatch) {
        qTypeId = suggestedMatch.id;
        console.log(`✅ Per-q match: "${q.suggested_type}" → "${suggestedMatch.type_name}" (ID: ${qTypeId})`);
      } else {
        const isMulti = choiceBasedTypes.includes(q.suggested_type || '');
        // Gọi với existingTypes để match in JS
        qTypeId = await insertQuestionTypeIfNotExists(connection, q.suggested_type!, isMulti, existingTypes);
        existingTypes.push({ id: qTypeId, type_name: q.suggested_type!, is_multiple_choice: isMulti });
        console.log(`🆕 Per-q inserted: ID ${qTypeId} for "${q.suggested_type}"`);
      }
    } else {
      qTypeId = existingTypes[0]?.id || 1;
      console.log(`⚠️ No suggested_type for q${i+1}, fallback ID: ${qTypeId}`);
    }

    // Insert Question (giữ nguyên)
    const [qInsertResult] = await connection.execute(
      `INSERT INTO questions (exercise_id, order_num, question_text, question_type_id, explanation, model_answer)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [exerciseId, i + 1, q.question_text, qTypeId, q.explanation || '', q.model_answer || null]
    ) as [OkPacket, FieldPacket[]];
    const questionId = (qInsertResult as any).insertId;

    // Insert Answers nếu là multiple choice (giữ nguyên)
    if (q.answers && q.answers.length > 0 && existingTypes.find(t => t.id === qTypeId)?.is_multiple_choice) {
      for (let j = 0; j < q.answers.length; j++) {
        const answerText = q.answers[j].replace(/\(correct\)/gi, '').trim();
        const isCorrect = q.answers[j].includes('(correct)');
        await connection.execute(
          `INSERT INTO answers (question_id, order_num, answer_text, is_correct) VALUES (?, ?, ?, ?)`,
          [questionId, j + 1, answerText, isCorrect]
        );
      }
    }

    insertedQuestions.push({
      ...q,
      id: questionId,
      order_num: i + 1,
      question_type_id: qTypeId,
    });
  }

  return insertedQuestions;
}