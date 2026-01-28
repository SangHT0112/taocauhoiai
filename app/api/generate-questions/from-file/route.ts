// api/generate-questions/from-file/route.ts
import { NextRequest, NextResponse } from "next/server";
import { setTimeout } from 'timers/promises';
import pool from '@/lib/db';
import mammoth from 'mammoth';
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

// Helper: Detect question types từ raw text (giữ nguyên để hỗ trợ detection ban đầu nếu cần)
function detectQuestionTypes(extractedText: string): { 
  multiple_choice_count: number; 
  open_ended_count: number; 
  examples: string[];
  detected_questions: Array<{
    type: 'multiple_choice' | 'open_ended';
    content: string;
    question_number?: string;
  }>;
} {
  // Clean text
  let cleanText = extractedText.replace(/([a-zA-Z0-9])([A-Z])/g, '$1 $2')
                               .replace(/([.?!])\s*([a-zA-Z])/g, '$1 $2')
                               .replace(/\s+/g, ' ')
                               .trim();

  const detected_questions: Array<{
    type: 'multiple_choice' | 'open_ended';
    content: string;
    question_number?: string;
  }> = [];

  // Phát hiện theo cấu trúc Bài 1, Bài 2,...
  const sections = cleanText.split(/(?:Bài|BÀI)\s*(\d+)[.:]/gi);
  
  let mcCount = 0;
  let oeCount = 0;

  // Phân tích Bài 1 (trắc nghiệm)
  const bài1Match = cleanText.match(/Bài\s*1[.:]([\s\S]*?)(?=Bài\s*2|Bài\s*3|$)/i);
  if (bài1Match) {
    const bài1Content = bài1Match[1];
    const mcQuestions = bài1Content.match(/(?:[a-d]\))|\*\*[a-f]\)/gi) || [];
    mcCount += mcQuestions.length;
    
    const individualQuestions = bài1Content.split(/(?:[a-f]\)|\*\*[a-f]\))/).filter(q => q.trim().length > 10);
    individualQuestions.forEach((q, idx) => {
      detected_questions.push({
        type: 'multiple_choice',
        content: q.trim().substring(0, 200),
        question_number: `1.${String.fromCharCode(97 + idx)}`
      });
    });
  }

  // Phân tích các bài tự luận (Bài 6, Bài 7, v.v.)
  const openEndedPattern = /Bài\s*(?:6|7|\d+)[.:]([\s\S]*?)(?=Bài\s*\d|$)/gi;
  let match;
  while ((match = openEndedPattern.exec(cleanText)) !== null) {
    const content = match[1];
    if (content.includes("Bài giải") || content.includes("Hỏi") || content.includes("bao nhiêu") || content.includes("Tính") || content.includes("Quan sát")) {
      oeCount++;
      detected_questions.push({
        type: 'open_ended',
        content: content.trim().substring(0, 300),
        question_number: match[0].match(/Bài\s*(\d+)/i)?.[1]
      });
    }
  }

  // Phát hiện các dạng khác (tổng quát hơn)
  if (cleanText.includes("Tính nhẩm") || cleanText.includes("Quan sát tranh") || cleanText.includes("Số?") || cleanText.includes(">; <; =")) {
    oeCount += Math.floor(cleanText.split('Bài').length / 2) - 1; // Ước lượng
  }
  
  // Extract examples
  const examples = cleanText.match(/(?:\d+\s*[×x]\s*\d+\s*=)|(?:\d+\s*[\+\-\×÷=]\s*)+/g) || [];

  console.log(`🔍 Detected: Multiple_choice: ${mcCount}, Open_ended: ${oeCount}`);
  console.log(`📋 Sample detected questions:`, detected_questions.slice(0, 3));
  
  return { 
    multiple_choice_count: mcCount, 
    open_ended_count: oeCount, 
    examples, 
    detected_questions 
  };
}

export async function POST(request: NextRequest) {
  const connection = await pool.getConnection();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: "Thiếu file upload" }, { status: 400 });

    // Parse other fields safely
    const rawData = Object.fromEntries(formData.entries());
    const exercise_name = String(rawData.exercise_name || '');
    const type_str = String(rawData.type || 'mixed');
    const selected_types_str = String(rawData.selected_types || '');
    const type_quantities_str = String(rawData.type_quantities || '');
    const user_instructions = String(rawData.user_instructions || '');
    const num_questions_str = String(rawData.num_questions || '10');
    const num_answers_str = String(rawData.num_answers || '4');
    const difficulty_str = String(rawData.difficulty || 'Medium');
    const user_id_str = String(rawData.user_id || '1');
    const grade_id_str = String(rawData.grade_id || '0');
    const subject_id_str = String(rawData.subject_id || '0');
    const chapter_id_str = String(rawData.chapter_id || '0');
    const lesson_id_str = String(rawData.lesson_id || '0');

    // Validate and cast types
    const exercise_type: 'multiple_choice' | 'open_ended' | 'mixed' | 'true_false' | 'multiple_select' = 
      ['multiple_choice', 'open_ended', 'mixed', 'true_false', 'multiple_select'].includes(type_str) 
        ? type_str as any 
        : 'mixed';
    const num_questions = Number(num_questions_str);
    const num_answers = Number(num_answers_str);
    const difficulty: string = difficulty_str;
    const user_id = Number(user_id_str);
    let grade_id = Number(grade_id_str);
    let subject_id = Number(subject_id_str);
    let chapter_id = Number(chapter_id_str);
    let lesson_id = Number(lesson_id_str);

    let selected_types: string[] = [];
    let type_quantities_input: Record<string, number> = {};
    try {
      if (selected_types_str) {
        selected_types = JSON.parse(selected_types_str);
      }
      if (type_quantities_str) {
        type_quantities_input = JSON.parse(type_quantities_str);
      }
    } catch (parseErr) {
      console.warn('⚠️ Parse error for types/quantities:', parseErr);
    }

    // Validation (tương tự main route, nhưng optional cho file)
    if (!user_id) return NextResponse.json({ error: "Thiếu user_id" }, { status: 400 });
    if (!num_questions || num_questions < 1 || num_questions > 50) {
      return NextResponse.json({ error: "Số câu hỏi phải từ 1-50" }, { status: 400 });
    }

    // Set defaults nếu không cung cấp (cho file upload)
    if (!grade_id || grade_id <= 0) grade_id = 2; // Default lớp 2 (tiểu học)
    if (!subject_id || subject_id <= 0) subject_id = 1; // Default Toán
    if (!chapter_id || chapter_id <= 0) chapter_id = 1; // Default chương 1
    if (!lesson_id || lesson_id <= 0) lesson_id = 1; // Default bài 1

    // Validate & extract file
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) return NextResponse.json({ error: "Chỉ hỗ trợ DOCX/DOC" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    let extractedText = result.value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!extractedText) return NextResponse.json({ error: "File rỗng hoặc không đọc được" }, { status: 400 });

    console.log(`📁 File: ${fileName}, extracted length: ${extractedText.length}`);
    console.log("📄 Preview:", extractedText.substring(0, 200));

    // Không fetch lesson info từ DB, luôn dùng nội dung từ file
    let lessonTitle = '';
    let enrichedLessonInfo = user_instructions.trim() || `Nội dung từ file "${fileName}": ${extractedText.substring(0, 500)}...`;
    console.log("📚 Using file content for lesson info:", enrichedLessonInfo.substring(0, 150) + '...');

    // Detect types từ file để hỗ trợ type_quantities/selected_types nếu không cung cấp
    const { multiple_choice_count: detected_mc, open_ended_count: detected_oe } = detectQuestionTypes(extractedText);
    const detectedTotal = detected_mc + detected_oe;

    // Nếu không có input, dùng detection để set default mixed
    if (selected_types.length === 0 && Object.keys(type_quantities_input).length === 0) {
      selected_types = detectedTotal > 0 && detected_mc / detectedTotal > 0.5 ? ['multiple_choice', 'open_ended'] : ['open_ended'];
      const mcQty = Math.floor(num_questions * (detected_mc / detectedTotal || 0.7));
      type_quantities_input = { multiple_choice: mcQty, open_ended: num_questions - mcQty };
    }

    // Xử lý types & distribution (copy từ main)
    let typesToUse: string[] = [];
    let typeDistribution: { type: string; count: number }[] = [];

    if (Object.keys(type_quantities_input).length > 0) {
      const validEntries = Object.entries(type_quantities_input)
        .filter((entry): entry is [string, number] => {
          const [, count] = entry;
          return typeof count === 'number' && count > 0 && Number.isInteger(count);
        });
      typesToUse = validEntries.map(([type]) => type);
      typeDistribution = validEntries.map(([type, count]) => ({ type, count }));

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
                    ['multiple_choice', 'open_ended']); // Default mixed cho file

      const numPerType = Math.floor(num_questions / typesToUse.length);
      const remainder = num_questions % typesToUse.length;
      typeDistribution = typesToUse.map((type, index) => ({
        type,
        count: numPerType + (index < remainder ? 1 : 0),
      }));
    }

    if (typesToUse.length === 0) {
      return NextResponse.json({ error: "Phải chọn ít nhất 1 loại câu hỏi" }, { status: 400 });
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

    // Question type ID (copy từ main)
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

    // Prompt building (copy từ main, nhưng integrate extractedText vào enrichedLessonInfo)
    const levelDescription = 'học sinh tiểu học, ngôn ngữ đơn giản, rõ ràng, gần gũi';
    const subjectHint = enrichedLessonInfo.toLowerCase().includes('toán') ? 'Toán học' :
                        enrichedLessonInfo.toLowerCase().includes('tiếng việt') ? 'Tiếng Việt' : 'kiến thức phổ thông';

    const typesStr = typesToUse.join(', ');
    const typeList = existingTypes.map(t => `${t.id}: ${t.type_name}`).join('; ');

    let objectStr: string;
    if (isMixed) {
      objectStr = '{ "question_text": "...", "answers"?: ["...", "... (correct)", ...], "model_answer"?: "...", "explanation": "...", "suggested_type": "multiple_choice|true_false|multiple_select|open_ended" }';
    } else if (isChoiceBased) {
      objectStr = `{ "question_text": "...", "answers": ["...", "... (correct)", ...], "explanation": "...", "suggested_type": "${typesToUse[0]}" }`;
    } else {
      objectStr = '{ "question_text": "...", "model_answer": "...", "explanation": "...", "suggested_type": "open_ended" }';
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

    const contentPart = `NỘI DUNG BÀI HỌC TỪ FILE VÀ SÁCH GIÁO KHOA:\n${enrichedLessonInfo}\n\n`;

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
- Câu hỏi ngắn (<50 chữ)
- Explanation học thuật, <30 chữ
- suggested_type chỉ dùng trong: ${typesStr}
`.trim();

    // Helper functions (copy từ main)
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
            question_text: `Câu hỏi mẫu ${questions.length + 1} từ file.`,
            explanation: "Giải thích mẫu từ file.",
            suggested_type: targetType,
            ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
            ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu từ file." }),
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
              question_text: `Câu hỏi mẫu ${questions.length + 1} từ file.`,
              explanation: "Giải thích mẫu từ file.",
              suggested_type: targetType,
              ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
              ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu từ file." }),
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
              q.question_text = q.question_text || `Câu hỏi ${i + 1} từ file`;
              q.explanation = q.explanation || "Giải thích mẫu từ file.";
              q.suggested_type = q.suggested_type || typesToUse[0];
              const st = q.suggested_type;
              if (st !== 'open_ended') {
                const dummyAnswers = getDummyAnswers(st, effectiveNumAnswers);
                q.answers = q.answers || dummyAnswers;
              } else {
                q.model_answer = q.model_answer || "Đáp án mẫu từ file.";
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
                question_text: `Câu hỏi ${i + 1} (tự động fix từ file).`,
                explanation: "Lỗi parse, dùng mẫu từ file.",
                suggested_type: dummyType,
                ...(dummyType !== 'open_ended' && { answers: dummyAnswers }),
                ...(dummyType === 'open_ended' && { model_answer: "Mẫu từ file." }),
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
              question_text: `Câu hỏi mẫu ${sortedFixed.length + 1} từ file.`,
              explanation: "Giải thích mẫu từ file.",
              suggested_type: targetType,
              ...(targetType !== 'open_ended' && { answers: dummyAnswers }),
              ...(targetType === 'open_ended' && { model_answer: "Đáp án mẫu từ file." }),
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

    // GỌI GEMINI VỚI RETRY (copy từ main)
    let questions: GeneratedQuestion[] = [];
    let retryCount = 0;
    const maxRetries = 3;
    let genText = "";

    while (retryCount <= maxRetries) {
      const currentKeyIndex = keyIndex % geminiKeys.length;
      const currentKey = geminiKeys[currentKeyIndex];
      keyIndex++;
      console.log(`Using key ${currentKeyIndex} - attempt ${retryCount + 1} (from file)`);

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
      console.log("Gemini raw output length (from file):", genText.length);

      try {
        questions = extractAndRepairJson(genText);
        if (questions.length >= num_questions) break;
        throw new Error("Not enough valid questions");
      } catch (e) {
        console.warn(`Retry ${retryCount + 1}/${maxRetries} (from file):`, e);
        retryCount++;
      }
    }

    if (questions.length < num_questions) {
      console.warn(`Only got ${questions.length}/${num_questions} questions from file, proceeding with what we have`);
    }

    questions = enforceTypeDistribution(questions);
    questions = sortQuestionsByTypeOrder(questions);

    // Insert (sử dụng exercise_name hoặc fallback từ file/lesson)
    const final_exercise_name = exercise_name.trim() || `Bài tập từ file "${fileName}" - ${lessonTitle || 'Tùy chỉnh'}`;
    const insertedExercise = await createExerciseWithQuestions(connection, {
      name: final_exercise_name,
      user_instructions: lessonTitle || user_instructions.substring(0, 120) || `Từ file "${fileName}"`,
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

    console.log(`Inserted exercise ID from file: ${insertedExercise.id || 'unknown'}`);
    return NextResponse.json({ ...insertedExercise, source_file: fileName });
  } catch (err: any) {
    console.error("❌ Server error (from file):", err);
    return NextResponse.json({ error: err.message || "Lỗi server khi tạo câu hỏi từ file" }, { status: 500 });
  } finally {
    connection.release();
  }
}