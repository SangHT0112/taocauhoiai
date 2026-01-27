// api/generate-questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setTimeout } from 'timers/promises';
import pool from '@/lib/db';
import {
  createExerciseWithQuestions,
  fetchQuestionTypes,
  QuestionType,
  GeneratedQuestion,
  insertQuestionTypeIfNotExists,
  normalizeForMatch,
  InsertedExercise,
} from '@/lib/services/exerciseService';

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

// Round-robin API keys
let keyIndex = 0;
const geminiKeys: string[] = [];
let i = 1;
while (process.env[`GEMINI_API_KEY_${i}`]) {
  geminiKeys.push(process.env[`GEMINI_API_KEY_${i}`]!);
  i++;
}
if (geminiKeys.length === 0 && process.env.GEMINI_API_KEY) {
  geminiKeys.push(process.env.GEMINI_API_KEY);
}
if (geminiKeys.length === 0) {
  throw new Error("No Gemini API key configured");
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection();
  try {
    const formData = await request.json();
    const {
      exercise_name,
      type: exercise_type,
      selected_types,
      type_quantities,
      user_instructions = "",
      num_questions,
      num_answers,
      difficulty = 'Medium',
      user_id,
      grade_id = 0,
      subject_id = 0,
      chapter_id = 0,
      lesson_id = 0,
    } = formData as {
      exercise_name: string;
      type: 'multiple_choice' | 'open_ended' | 'mixed' | 'true_false' | 'multiple_select';
      selected_types?: string[];
      type_quantities?: Record<string, number>;
      user_instructions?: string;
      num_questions: number;
      num_answers?: number;
      difficulty?: string;
      user_id: number;
      grade_id?: number;
      subject_id?: number;
      chapter_id?: number;
      lesson_id?: number;
    };

    // Validation
    if (!user_id) return NextResponse.json({ error: "Thiếu user_id" }, { status: 400 });
    if (!exercise_name?.trim()) return NextResponse.json({ error: "Vui lòng nhập tên bài tập" }, { status: 400 });
    if (!['multiple_choice', 'open_ended', 'mixed', 'true_false', 'multiple_select'].includes(exercise_type)) {
      return NextResponse.json({ error: "Loại bài tập không hợp lệ" }, { status: 400 });
    }
    if (!num_questions || num_questions < 1 || num_questions > 50) {
      return NextResponse.json({ error: "Số câu hỏi phải từ 1-50" }, { status: 400 });
    }
    if ((selected_types && selected_types.length === 0) || (!selected_types && !type_quantities)) {
      return NextResponse.json({ error: "Phải chọn ít nhất 1 loại câu hỏi" }, { status: 400 });
    }
    if (!grade_id || grade_id <= 0) return NextResponse.json({ error: "Vui lòng chọn khối lớp (grade_id)" }, { status: 400 });
    if (!subject_id || subject_id <= 0) return NextResponse.json({ error: "Vui lòng chọn môn học (subject_id)" }, { status: 400 });
    if (!chapter_id || chapter_id <= 0) return NextResponse.json({ error: "Vui lòng chọn chương (chapter_id)" }, { status: 400 });
    if (!lesson_id || lesson_id <= 0) return NextResponse.json({ error: "Vui lòng chọn bài học (lesson_id)" }, { status: 400 });

    // Fetch lesson info từ DB
    let lessonTitle = '';
    let enrichedLessonInfo = user_instructions.trim() || 'Không có mô tả cụ thể';

    try {
      const [rows] = await connection.execute(
        `SELECT 
           g.name as grade_name,
           s.name as subject_name,
           c.title as chapter_title,
           l.title as lesson_title,
           l.content as lesson_content,
           l.lesson_order
         FROM lessons l
           JOIN chapters c ON l.chapter_id = c.id
           JOIN subjects s ON c.subject_id = s.id
           JOIN grades g ON s.grade_id = g.id
         WHERE l.id = ?`,
        [lesson_id]
      ) as any;

      if (rows.length > 0) {
        const row = rows[0];
        lessonTitle = row.lesson_title;
        enrichedLessonInfo = `
Lớp ${row.grade_name} - Môn ${row.subject_name} - Chương "${row.chapter_title}" - Bài "${row.lesson_title}" (Thứ tự: ${row.lesson_order || 'N/A'}).
Nội dung bài học: ${row.lesson_content || 'Không có nội dung chi tiết, dựa vào mô tả chung.'}
        `.trim();
        console.log("📚 Enriched lesson info:", enrichedLessonInfo.substring(0, 150) + '...');
      }
    } catch (fetchErr) {
      console.error("❌ Lỗi fetch lesson info:", fetchErr);
    }

    // Xử lý types & distribution - SỬA LỖI TYPE Ở ĐÂY
    let typesToUse: string[] = [];
    let typeDistribution: { type: string; count: number }[] = [];

    if (type_quantities) {
      // Filter và ép kiểu an toàn
      const validEntries = Object.entries(type_quantities)
      .filter((entry): entry is [string, number] => {
        const [, count] = entry;
        return typeof count === 'number' && count > 0 && Number.isInteger(count);
      });
      typesToUse = validEntries.map(([type]) => type);
      typeDistribution = validEntries.map(([type, count]) => ({ type, count })); // count giờ chắc chắn là number

      const totalFromQuantities = typeDistribution.reduce((sum, d) => sum + d.count, 0);
      if (totalFromQuantities !== num_questions) {
        return NextResponse.json({ error: `Tổng số lượng loại (${totalFromQuantities}) không khớp ${num_questions}` }, { status: 400 });
      }
    } else {
      typesToUse = selected_types?.length ? selected_types : 
                   (exercise_type === 'multiple_choice' ? ['multiple_choice'] :
                    exercise_type === 'open_ended' ? ['open_ended'] :
                    exercise_type === 'true_false' ? ['true_false'] :
                    exercise_type === 'multiple_select' ? ['multiple_select'] :
                    ['multiple_choice']);

      const numPerType = Math.floor(num_questions / typesToUse.length);
      const remainder = num_questions % typesToUse.length;
      typeDistribution = typesToUse.map((type, index) => ({
        type,
        count: numPerType + (index < remainder ? 1 : 0), // number rõ ràng
      }));
    }

    const distributionStr = typeDistribution.map(({ type, count }) => `${count} câu ${type}`).join(', ');
    const isMixed = typesToUse.length > 1 || exercise_type === 'mixed';
    const choiceBasedTypes = ['multiple_choice', 'true_false', 'multiple_select'];
    const isChoiceBased = !isMixed && choiceBasedTypes.includes(typesToUse[0]);

    let effectiveNumAnswers = num_answers;
    if (isChoiceBased && !effectiveNumAnswers) effectiveNumAnswers = 4;
    if (typesToUse[0] === 'true_false') effectiveNumAnswers = 2;

    if (isChoiceBased && (!effectiveNumAnswers || effectiveNumAnswers < 2 || effectiveNumAnswers > 5)) {
      return NextResponse.json({ error: "Số đáp án phải từ 2-5 cho trắc nghiệm" }, { status: 400 });
    }

    // Question type ID
    const existingTypes: QuestionType[] = await fetchQuestionTypes(connection);
    let questionTypeId: number;

    if (!isMixed) {
      const inputNormalized = normalizeForMatch(typesToUse[0]);
      const matchedType = existingTypes.find(t => normalizeForMatch(t.type_name) === inputNormalized);
      if (matchedType) {
        questionTypeId = matchedType.id;
      } else {
        const isMulti = choiceBasedTypes.includes(typesToUse[0]);
        questionTypeId = await insertQuestionTypeIfNotExists(connection, typesToUse[0], isMulti, existingTypes);
      }
    } else {
      const defaultNormalized = normalizeForMatch('multiple choice');
      const defaultMultiType = existingTypes.find(t => normalizeForMatch(t.type_name) === defaultNormalized);
      questionTypeId = defaultMultiType?.id || existingTypes[0]?.id || 1;
    }

    // ──────────────────────────────────────────────
    //              PROMPT
    // ──────────────────────────────────────────────
    const levelDescription = 'học sinh tiểu học, ngôn ngữ đơn giản, rõ ràng, gần gũi';
    const subjectHint = enrichedLessonInfo.toLowerCase().includes('toán') ? 'Toán học' :
                        enrichedLessonInfo.toLowerCase().includes('tiếng việt') ? 'Tiếng Việt' : 'kiến thức phổ thông';

    const typesStr = typesToUse.join(', ');
    const typeList = existingTypes.map(t => `${t.id}: ${t.type_name}`).join('; ');

    let objectStr: string;
    if (isMixed) {
      objectStr = '{ "question_text": "...", "emoji": "...", "answers"?: ["...", "... (correct)", ...], "model_answer"?: "...", "explanation": "...", "suggested_type": "multiple_choice|true_false|multiple_select|open_ended" }';
    } else if (isChoiceBased) {
      objectStr = `{ "question_text": "...", "emoji": "...", "answers": ["...", "... (correct)", ...], "explanation": "...", "suggested_type": "${typesToUse[0]}" }`;
    } else {
      objectStr = '{ "question_text": "...", "emoji": "...", "model_answer": "...", "explanation": "...", "suggested_type": "open_ended" }';
    }

    let specificReq = '';
    if (isMixed) {
      specificReq = `- Phân bổ: ${distributionStr}
- multiple_choice: ${effectiveNumAnswers || 4} đáp án, đúng 1 "(correct)"
- true_false: 2 đáp án ("Đúng","Sai"), 1 "(correct)"
- multiple_select: nhiều "(correct)" (>1)
- open_ended: chỉ "model_answer" ngắn gọn`;
    } else if (isChoiceBased) {
      const t = typesToUse[0];
      if (t === 'true_false') specificReq = `- 2 đáp án ("Đúng","Sai"), 1 "(correct)"`;
      else if (t === 'multiple_select') specificReq = `- ${effectiveNumAnswers} đáp án, có thể nhiều "(correct)"`;
      else specificReq = `- ${effectiveNumAnswers} đáp án, đúng 1 "(correct)"`;
    } else {
      specificReq = `- Câu hỏi mở, có "model_answer" ngắn gọn`;
    }

    const userReqPart = user_instructions.trim() 
      ? `YÊU CẦU CỤ THỂ TỪ GIÁO VIÊN (ƯU TIÊN TUÂN THỦ CAO NHẤT):\n${user_instructions.trim()}\n\n`
      : '';

    const contentPart = `NỘI DUNG BÀI HỌC THEO SÁCH GIÁO KHOA:\n${enrichedLessonInfo}\n\n`;

    const generatePrompt = `
Trả lời DUY NHẤT bằng mảng JSON hợp lệ chứa đúng ${num_questions} object. KHÔNG thêm bất kỳ text nào ngoài JSON.

Mỗi object: ${objectStr}

TẠO CÂU HỎI THEO THỨ TỰ ƯU TIÊN:

${userReqPart}${contentPart}

YÊU CẦU CHUNG:
- Ngôn ngữ: ${levelDescription}
- Chủ đề: ${subjectHint}
- Độ khó: ${difficulty}
- Phân bố loại: ${distributionStr}
- ${specificReq}
- Câu hỏi ngắn (<50 chữ), có emoji phù hợp
- Explanation học thuật, <30 chữ
- suggested_type chỉ dùng trong: ${typesStr}
`.trim();

    // ──────────────────────────────────────────────
    // HELPER FUNCTIONS - ĐẦY ĐỦ NHƯ CODE GỐC CỦA BẠN
    // ──────────────────────────────────────────────

    function sortQuestionsByTypeOrder(questions: GeneratedQuestion[]): GeneratedQuestion[] {
      if (!isMixed) return questions;
      const typeOrderMap = new Map(typeDistribution.map(({ type }, index) => [type, index]));
      return questions.sort((a, b) => {
        const aOrder = typeOrderMap.get(a.suggested_type || '') ?? typeDistribution.length;
        const bOrder = typeOrderMap.get(b.suggested_type || '') ?? typeDistribution.length;
        return aOrder - bOrder;
      });
    }

    function enforceTypeDistribution(questions: GeneratedQuestion[]): GeneratedQuestion[] {
      if (!isMixed) return questions;
      const currentCounts = new Map<string, number>();
      typesToUse.forEach(type => currentCounts.set(type, 0));
      questions.forEach((q: GeneratedQuestion) => {
        if (q.suggested_type && typesToUse.includes(q.suggested_type)) {
          currentCounts.set(q.suggested_type, (currentCounts.get(q.suggested_type) || 0) + 1);
        }
      });
      console.log("Current counts before enforce:", Object.fromEntries(currentCounts));
      const questionsToAssign: GeneratedQuestion[] = [];
      questions.forEach((q: GeneratedQuestion) => {
        if (!q.suggested_type || !typesToUse.includes(q.suggested_type)) {
          questionsToAssign.push(q);
        }
      });
      typeDistribution.forEach(({ type, count: required }) => {
        const current = currentCounts.get(type) || 0;
        if (current > required) {
          const excess = current - required;
          const typeQuestions = questions.filter((q: GeneratedQuestion) => q.suggested_type === type);
          for (let i = 0; i < excess && i < typeQuestions.length; i++) {
            questionsToAssign.push(typeQuestions[typeQuestions.length - 1 - i]);
          }
          currentCounts.set(type, required);
        }
      });
      let distIndex = 0;
      questionsToAssign.forEach((q: GeneratedQuestion) => {
        const targetType = typeDistribution[distIndex % typeDistribution.length].type;
        const required = typeDistribution[distIndex % typeDistribution.length].count;
        const current = currentCounts.get(targetType) || 0;
        if (current < required) {
          q.suggested_type = targetType;
          currentCounts.set(targetType, current + 1);
        }
        distIndex++;
      });
      console.log("Final counts after enforce:", Object.fromEntries(currentCounts));
      return questions;
    }

    function getDummyAnswers(targetType: string, numAns?: number): string[] | undefined {
      const effNum = numAns || 4;
      if (targetType === 'true_false') {
        return ['Đúng', 'Sai (correct)'];
      } else if (targetType === 'multiple_select') {
        const base = ['Sai', 'Đúng (correct)', 'Đúng (correct)', 'Sai'];
        return base.slice(0, effNum).concat(Array(effNum - base.length).fill('Sai'));
      } else if (targetType === 'multiple_choice') {
        return Array(effNum).fill('Mẫu').map((_, i) => i === 0 ? 'Mẫu (correct)' : 'Mẫu');
      }
      return undefined;
    }

    function extractAndRepairJson(text: string): GeneratedQuestion[] {
      if (!text.trim().endsWith(']')) {
        text = text.trim() + ']';
        console.log('🔧 Appended ] to fix truncate');
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Không tìm thấy mảng JSON");
      let jsonStr = jsonMatch[0];

      const lastBracket = jsonStr.lastIndexOf("]");
      if (lastBracket > 0) jsonStr = jsonStr.substring(0, lastBracket + 1);

      try {
        let questions = JSON.parse(jsonStr);
        if (!Array.isArray(questions)) throw new Error("Not array");
        questions = enforceTypeDistribution(questions);
        questions = sortQuestionsByTypeOrder(questions);
        let padIndex = 0;
        while (questions.length < num_questions) {
          const targetType = typeDistribution[padIndex % typeDistribution.length].type;
          const dummyAnswers = getDummyAnswers(targetType, effectiveNumAnswers);
          questions.push({
            question_text: `Câu hỏi mẫu ${questions.length + 1}.`,
            emoji: "❓",
            explanation: "Giải thích mẫu.",
            suggested_type: targetType,
            ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
            ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu." }),
          });
          padIndex++;
          questions = enforceTypeDistribution(questions);
          questions = sortQuestionsByTypeOrder(questions);
        }

        const realQuestions = questions.filter((q: GeneratedQuestion) => 
          !q.question_text.includes('mẫu') && 
          !q.question_text.includes('tự động fix') && 
          q.question_text.trim().length > 10
        );
        if (realQuestions.length < num_questions * 0.5) {
          throw new Error("Quá nhiều dummy (output có thể bị truncate), cần retry");
        }

        return questions.slice(0, num_questions);
      } catch (parseErr) {
        console.error("⚠️ Raw parse failed, applying minimal repairs:", parseErr);
        let repairedStr = jsonStr
          .replace(/(\r\n|\n|\r)/g, " ")
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/:\s*([A-Za-z0-9_]+)\s*(?=[,}])/g, ':"$1"');
        try {
          let questions = JSON.parse(repairedStr);
          if (!Array.isArray(questions)) throw new Error("Not array after repair");
          questions = enforceTypeDistribution(questions);
          questions = sortQuestionsByTypeOrder(questions);
          let padIndex = 0;
          while (questions.length < num_questions) {
            const targetType = typeDistribution[padIndex % typeDistribution.length].type;
            const dummyAnswers = getDummyAnswers(targetType, effectiveNumAnswers);
            questions.push({
              question_text: `Câu hỏi mẫu ${questions.length + 1}.`,
              emoji: "❓",
              explanation: "Giải thích mẫu.",
              suggested_type: targetType,
              ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
              ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu." }),
            });
            padIndex++;
            questions = enforceTypeDistribution(questions);
            questions = sortQuestionsByTypeOrder(questions);
          }

          const realQuestions = questions.filter((q: GeneratedQuestion) => 
            !q.question_text.includes('mẫu') && 
            !q.question_text.includes('tự động fix') && 
            q.question_text.trim().length > 10
          );
          if (realQuestions.length < num_questions * 0.5) {
            throw new Error("Quá nhiều dummy sau repair, cần retry");
          }

          return questions.slice(0, num_questions);
        } catch (repairErr) {
          console.error("⚠️ Repair failed, attempting manual fix:", repairErr);
          const objMatches = repairedStr.match(/\{[\s\S]*?\}/g) || [];
          const fixedQuestions: GeneratedQuestion[] = [];
          objMatches.slice(0, num_questions).forEach((objStr, i) => {
            try {
              const q: Partial<GeneratedQuestion> = JSON.parse(objStr.replace(/,\s*([}\]])/g, "$1"));
              q.question_text = q.question_text || `Câu hỏi ${i + 1}`;
              q.emoji = q.emoji || "❓";
              q.explanation = q.explanation || "Giải thích mẫu.";
              q.suggested_type = q.suggested_type || typesToUse[0];
              const st = q.suggested_type;
              if (st !== 'open_ended') {
                const dummyAnswers = getDummyAnswers(st, effectiveNumAnswers);
                q.answers = q.answers || dummyAnswers;
              } else {
                q.model_answer = q.model_answer || "Đáp án mẫu.";
              }
              fixedQuestions.push(q as GeneratedQuestion);
            } catch {
              let dummyType: string;
              if (isMixed) {
                const distIndex = Math.floor(fixedQuestions.length / (num_questions / typeDistribution.length)) % typesToUse.length;
                dummyType = typeDistribution[distIndex].type;
              } else {
                dummyType = typesToUse[0];
              }
              const dummyAnswers = getDummyAnswers(dummyType, effectiveNumAnswers);
              fixedQuestions.push({
                question_text: `Câu hỏi ${i + 1} (tự động fix).`,
                emoji: "❓",
                explanation: "Lỗi parse, dùng mẫu.",
                suggested_type: dummyType,
                ...(dummyType !== 'open_ended' && { answers: dummyAnswers }),
                ...(dummyType === 'open_ended' && { model_answer: "Mẫu." }),
              });
            }
          });
          let enforcedFixed = enforceTypeDistribution(fixedQuestions);
          let sortedFixed = sortQuestionsByTypeOrder(enforcedFixed);
          let padIndex = 0;
          while (sortedFixed.length < num_questions) {
            const targetType = typeDistribution[padIndex % typeDistribution.length].type;
            const dummyAnswers = getDummyAnswers(targetType, effectiveNumAnswers);
            sortedFixed.push({
              question_text: `Câu hỏi mẫu ${sortedFixed.length + 1}.`,
              emoji: "❓",
              explanation: "Giải thích mẫu.",
              suggested_type: targetType,
              ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
              ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu." }),
            });
            padIndex++;
            sortedFixed = enforceTypeDistribution(sortedFixed);
            sortedFixed = sortQuestionsByTypeOrder(sortedFixed);
          }

          const realQuestions = sortedFixed.filter((q: GeneratedQuestion) => 
            !q.question_text.includes('mẫu') && 
            !q.question_text.includes('tự động fix') && 
            q.question_text.trim().length > 10
          );
          if (realQuestions.length < num_questions * 0.5) {
            throw new Error("Quá nhiều dummy sau manual fix, cần retry");
          }

          return sortedFixed;
        }
      }
    }

    // ──────────────────────────────────────────────
    // GỌI GEMINI VỚI RETRY
    // ──────────────────────────────────────────────
    let questions: GeneratedQuestion[] = [];
    let retryCount = 0;
    const maxRetries = 3;
    let genText = "";

    while (retryCount <= maxRetries) {
      const currentKeyIndex = keyIndex % geminiKeys.length;
      const currentKey = geminiKeys[currentKeyIndex];
      keyIndex++;
      console.log(`Using key ${currentKeyIndex} - attempt ${retryCount + 1}`);

      const generateRes = await fetch(`${GEMINI_API_URL}?key=${currentKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: generatePrompt }] }],
          generationConfig: {
            temperature: difficulty === 'Hard' ? 0.85 : difficulty === 'Easy' ? 0.45 : 0.65,
            maxOutputTokens: 10000,
          },
        }),
      });

      if (!generateRes.ok) {
        const errorData = await generateRes.json().catch(() => ({}));
        console.warn(`Gemini error ${generateRes.status}:`, errorData);
        if (generateRes.status === 503 || String(errorData?.error?.message || '').toLowerCase().includes('overloaded')) {
          retryCount++;
          continue;
        }
        const backoff = Math.pow(2, retryCount) * 1000;
        await setTimeout(backoff);
        retryCount++;
        if (retryCount > maxRetries) {
          throw new Error(`Gemini failed after ${maxRetries} retries`);
        }
        continue;
      }

      const genData = await generateRes.json();
      genText = genData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log("Gemini raw output length:", genText.length);

      try {
        questions = extractAndRepairJson(genText);
        if (questions.length >= num_questions) break;
        throw new Error("Not enough valid questions");
      } catch (e) {
        console.warn(`Retry ${retryCount + 1}/${maxRetries}:`, e);
        retryCount++;
      }
    }

    if (questions.length < num_questions) {
      console.warn(`Only got ${questions.length}/${num_questions} questions, proceeding with what we have`);
    }

    questions = enforceTypeDistribution(questions);
    questions = sortQuestionsByTypeOrder(questions);

    // Insert
    const insertedExercise = await createExerciseWithQuestions(connection, {
      name: exercise_name,
      user_instructions: lessonTitle || user_instructions.substring(0, 120) || 'Bài tập tùy chỉnh',
      type: exercise_type,
      num_questions,
      num_answers: effectiveNumAnswers,
      difficulty,
      grade_id,
      subject_id,
      chapter_id,
      lesson_id,
      user_id,
      question_type_id: questionTypeId,
    }, questions, existingTypes);

    console.log(`Inserted exercise ID: ${insertedExercise.id || 'unknown'}`);
    return NextResponse.json(insertedExercise);
  } catch (err: any) {
    console.error("❌ Server error:", err);
    return NextResponse.json({ error: err.message || "Lỗi server khi tạo câu hỏi" }, { status: 500 });
  } finally {
    connection.release();
  }
}