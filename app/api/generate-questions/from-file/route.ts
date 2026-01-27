// // api/generate-questions/from-file/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { setTimeout } from 'timers/promises';
// import pool from '@/lib/db';
// import mammoth from 'mammoth';
// import {
//   createExerciseWithQuestions,
//   fetchQuestionTypes,
//   QuestionType,
//   GeneratedQuestion,
//   insertQuestionTypeIfNotExists,
//   normalizeForMatch,
//   InsertedExercise,
// } from '@/lib/services/exerciseService';

// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

// let keyIndex = 0;

// const geminiKeys: string[] = [];
// let i = 1;
// while (process.env[`GEMINI_API_KEY_${i}`]) {
//   geminiKeys.push(process.env[`GEMINI_API_KEY_${i}`]!);
//   i++;
// }
// if (geminiKeys.length === 0) {
//   if (process.env.GEMINI_API_KEY) geminiKeys.push(process.env.GEMINI_API_KEY);
//   else throw new Error("No valid Gemini API key found.");
// }

// // Helper: Detect question types từ raw text (FIX: Regex để classify trước khi AI)
// function detectQuestionTypes(extractedText: string): { 
//     multiple_choice_count: number; 
//     open_ended_count: number; 
//     examples: string[];
//     detected_questions: Array<{
//         type: 'multiple_choice' | 'open_ended';
//         content: string;
//         question_number?: string;
//     }>;
// } {
//     // Clean text
//     let cleanText = extractedText.replace(/([a-zA-Z0-9])([A-Z])/g, '$1 $2')
//                                  .replace(/([.?!])\s*([a-zA-Z])/g, '$1 $2')
//                                  .replace(/\s+/g, ' ')
//                                  .trim();

//     const detected_questions: Array<{
//         type: 'multiple_choice' | 'open_ended';
//         content: string;
//         question_number?: string;
//     }> = [];

//     // Phát hiện theo cấu trúc Bài 1, Bài 2,...
//     const sections = cleanText.split(/(?:Bài|BÀI)\s*(\d+)[.:]/gi);
    
//     let mcCount = 0;
//     let oeCount = 0;

//     // Phân tích Bài 1 - Chắc chắn là multiple choice
//     const bài1Match = cleanText.match(/Bài\s*1[.:]([\s\S]*?)(?=Bài\s*2|Bài\s*3|$)/i);
//     if (bài1Match) {
//         const bài1Content = bài1Match[1];
//         // Đếm số câu trắc nghiệm trong Bài 1
//         const mcQuestions = bài1Content.match(/(?:[a-d]\))|\*\*[a-f]\)/gi) || [];
//         mcCount += mcQuestions.length;
        
//         // Lưu từng câu trắc nghiệm
//         const individualQuestions = bài1Content.split(/(?:[a-f]\)|\*\*[a-f]\))/).filter(q => q.trim().length > 10);
//         individualQuestions.forEach((q, idx) => {
//             detected_questions.push({
//                 type: 'multiple_choice',
//                 content: q.trim().substring(0, 200),
//                 question_number: `1.${String.fromCharCode(97 + idx)}` // 1.a, 1.b,...
//             });
//         });
//     }

//     // Phân tích các bài tự luận (Bài 6, Bài 7)
//     const openEndedPattern = /Bài\s*(?:6|7)[.:]([\s\S]*?)(?=Bài\s*\d|$)/gi;
//     let match;
//     while ((match = openEndedPattern.exec(cleanText)) !== null) {
//         const content = match[1];
//         if (content.includes("Bài giải") || content.includes("Hỏi") || content.includes("bao nhiêu")) {
//             oeCount++;
//             detected_questions.push({
//                 type: 'open_ended',
//                 content: content.trim().substring(0, 300),
//                 question_number: match[0].match(/Bài\s*(\d+)/i)?.[1]
//             });
//         }
//     }

//     // Phát hiện các dạng khác
//     if (cleanText.includes("Tính nhẩm") || cleanText.includes("Quan sát tranh")) {
//         oeCount += 2; // Ước lượng cho Bài 2, 3
//     }
    
//     if (cleanText.includes("Số?")) {
//         oeCount++; // Bài 5
//     }
    
//     if (cleanText.includes(">; <; =")) {
//         oeCount++; // Bài 4
//     }

//     // Extract examples
//     const examples = cleanText.match(/(?:\d+\s*[×x]\s*\d+\s*=)|(?:\d+\s*[\+\-\×÷=]\s*)+/g) || [];

//     console.log(`🔍 Detected: Multiple_choice: ${mcCount}, Open_ended: ${oeCount}`);
//     console.log(`📋 Sample detected questions:`, detected_questions.slice(0, 3));
    
//     return { 
//         multiple_choice_count: mcCount, 
//         open_ended_count: oeCount, 
//         examples, 
//         detected_questions 
//     };
// }
// // Helper: Force add answers nếu type choice-based
// function ensureAnswers(q: Partial<GeneratedQuestion>, targetType: string, numAns: number): void {
//   if (['multiple_choice', 'true_false', 'multiple_select'].includes(targetType) && (!q.answers || q.answers.length === 0)) {
//     let dummyAnswers: string[];
//     if (targetType === 'true_false') {
//       dummyAnswers = ['Đúng', 'Sai (correct)'];
//     } else if (targetType === 'multiple_select') {
//       dummyAnswers = Array(numAns).fill('Sai').map((_, j) => j % 3 === 1 ? 'Đúng (correct)' : 'Sai');  // >1 correct
//     } else {  // multiple_choice
//       dummyAnswers = Array(numAns).fill('Sai').map((_, j) => j === 0 ? 'Đúng (correct)' : 'Sai');
//     }
//     (q as GeneratedQuestion).answers = dummyAnswers;
//     console.log(`🔧 Forced answers for ${targetType}:`, dummyAnswers);
//   } else if (targetType === 'open_ended' && !q.model_answer) {
//     (q as GeneratedQuestion).model_answer = "Đáp án mẫu dựa trên file.";
//   }
// }

// function getDummyAnswers(targetType: string, numAns: number): string[] | undefined {
//   if (targetType === 'true_false') return ['Đúng', 'Sai (correct)'];
//   if (targetType === 'multiple_select') {
//     const base = ['Sai', 'Đúng (correct)', 'Đúng (correct)', 'Sai'];
//     return base.slice(0, numAns).concat(Array(numAns - base.length).fill('Sai'));
//   }
//   if (targetType === 'multiple_choice') return Array(numAns).fill('Sai').map((_, j) => j === 0 ? 'Đúng (correct)' : 'Sai');
//   return undefined;
// }

// function processQuestions(questions: GeneratedQuestion[], typeDistribution: { type: string; count: number }[], num_questions: number, effectiveNumAnswers: number, typesToUse: string[]): GeneratedQuestion[] {
//   // Enforce distribution
//   const currentCounts = new Map(typeDistribution.map(({ type }) => [type, 0]));
//   questions.forEach(q => q.suggested_type && currentCounts.set(q.suggested_type, (currentCounts.get(q.suggested_type) || 0) + 1));

//   // Assign missing types
//   const questionsToAssign = questions.filter(q => !typesToUse.includes(q.suggested_type || ''));
//   let distIndex = 0;
//   questionsToAssign.forEach(q => {
//     const targetType = typeDistribution[distIndex % typeDistribution.length].type;
//     q.suggested_type = targetType;
//     ensureAnswers(q, targetType, effectiveNumAnswers);
//     currentCounts.set(targetType, (currentCounts.get(targetType) || 0) + 1);
//     distIndex++;
//   });

//   // Sort by type order
//   questions.sort((a, b) => {
//     const aOrder = typeDistribution.findIndex(({ type }) => type === (a.suggested_type || ''));
//     const bOrder = typeDistribution.findIndex(({ type }) => type === (b.suggested_type || ''));
//     return aOrder - bOrder;
//   });

//   // Force answers cho tất cả choice-based
//   questions.forEach(q => {
//     if (q.suggested_type && ['multiple_choice', 'true_false', 'multiple_select'].includes(q.suggested_type) && (!q.answers || q.answers.length < 2)) {
//       ensureAnswers(q, q.suggested_type, effectiveNumAnswers);
//     }
//   });

//   // Pad dummies
//   let padIndex = 0;
//   while (questions.length < num_questions) {
//     const targetType = typeDistribution[padIndex % typeDistribution.length].type;
//     const dummyQ: GeneratedQuestion = {
//       question_text: `Câu hỏi mẫu ${questions.length + 1} dựa trên file.`,
//       emoji: "❓",
//       explanation: "Giải thích mẫu từ nội dung file.",
//       suggested_type: targetType,
//     };
//     ensureAnswers(dummyQ, targetType, effectiveNumAnswers);
//     questions.push(dummyQ);
//     padIndex++;
//   }

//   // Check real questions (threshold 0.3)
//   const realQuestions = questions.filter(q => !q.question_text.includes('mẫu') && !q.question_text.includes('fix') && q.question_text.trim().length > 10);
//   if (realQuestions.length < num_questions * 0.3) throw new Error("Quá nhiều dummy, retry");

//   console.log("📊 Post-process: Types enforced, answers added for choice-based");
//   return questions.slice(0, num_questions);
// }

// function extractAndRepairJson(text: string, num_questions: number, typeDistribution: { type: string; count: number }[], effectiveNumAnswers: number, typesToUse: string[]): GeneratedQuestion[] {
//   if (!text.endsWith(']')) text += ']';
//   const jsonMatch = text.match(/\[[\s\S]*\]/);
//   if (!jsonMatch) throw new Error("Không tìm thấy JSON");

//   let jsonStr = jsonMatch[0]
//     .replace(/(\r\n|\n|\r)/g, " ")
//     .replace(/,\s*([}\]])/g, "$1")
//     .replace(/:\s*([A-Za-z0-9_]+)\s*(?=[,}])/g, ':"$1"')
//     .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":');

//   try {
//     let questions = JSON.parse(jsonStr);
//     if (!Array.isArray(questions)) throw new Error("Not array");
//     // Filter invalid & force type nếu suggested_type ngoài typesToUse
//     questions = questions.filter((q: any) => q.question_text && q.question_text.trim().length > 5).map((q: any) => {
//       if (!typesToUse.includes(q.suggested_type)) {
//         q.suggested_type = typesToUse[0];
//         console.log(`🔧 Repaired type for q: ${q.question_text.substring(0, 50)}... → ${q.suggested_type}`);
//       }
//       return q as GeneratedQuestion;
//     });
//     return processQuestions(questions, typeDistribution, num_questions, effectiveNumAnswers, typesToUse);
//   } catch {
//     // Manual parse objects
//     const objMatches = jsonStr.match(/\{[\s\S]*?\}/g) || [];
//     const fixedQuestions = objMatches.slice(0, num_questions).map((objStr, j) => {
//       try {
//         const q: Partial<GeneratedQuestion> = JSON.parse(objStr.replace(/,\s*([}\]])/g, "$1"));
//         q.question_text ||= `Câu hỏi ${j + 1} từ file`;
//         q.emoji ||= "📚";
//         q.explanation ||= "Giải thích dựa trên nội dung file.";
//         const targetType = typesToUse[j % typesToUse.length] || 'multiple_choice';
//         q.suggested_type ||= targetType;
//         ensureAnswers(q, targetType, effectiveNumAnswers);
//         return q as GeneratedQuestion;
//       } catch {
//         const dummyType = typesToUse[j % typesToUse.length] || 'multiple_choice';
//         const dummyQ: GeneratedQuestion = {
//           question_text: `Câu hỏi ${j + 1} (fix từ file).`,
//           emoji: "❓",
//           explanation: "Parse error, dùng mẫu từ file.",
//           suggested_type: dummyType,
//         };
//         ensureAnswers(dummyQ, dummyType, effectiveNumAnswers);
//         return dummyQ;
//       }
//     });
//     return processQuestions(fixedQuestions, typeDistribution, num_questions, effectiveNumAnswers, typesToUse);
//   }
// }

// export async function POST(request: NextRequest) {
//   let connection;
//   try {
//     const formData = await request.formData();
//     const file = formData.get('file') as File;
//     const userIdStr = formData.get('user_id')?.toString();

//     if (!file) return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });

//     let user_id = userIdStr && !isNaN(Number(userIdStr)) ? Number(userIdStr) : 1;
//     console.log(`📁 File: ${file.name}, user_id: ${user_id}`);

//     // Validate & extract file
//     const fileName = file.name.toLowerCase();
//     if (!fileName.endsWith('.docx') && !fileName.endsWith('.doc')) return NextResponse.json({ error: "Chỉ hỗ trợ DOCX/DOC" }, { status: 400 });

//     const buffer = Buffer.from(await file.arrayBuffer());
//     const result = await mammoth.convertToHtml({ buffer });
//     let extractedText = result.value
//       .replace(/<[^>]*>/g, ' ')
//       .replace(/\s+/g, ' ')
//       .trim();
//     if (!extractedText) return NextResponse.json({ error: "File rỗng" }, { status: 400 });

//     // Detect types & examples
//     const { multiple_choice_count: mcCount, open_ended_count: oeCount, examples } = detectQuestionTypes(extractedText);
//     const exampleStr = examples.length > 0 ? `Ví dụ từ file: ${examples.slice(0, 3).join('; ')}.` : '';
//     const totalDetected = mcCount + oeCount;
//     const mcRatio = totalDetected > 0 ? Math.round((mcCount / totalDetected) * 10) : 7;  // Default 70%
//     const oeRatio = 10 - mcRatio;

//     console.log("📄 Full extracted text length:", extractedText.length);
//     console.log("📄 Preview:", extractedText.substring(0, 200));

//     // Validate user
//     connection = await pool.getConnection();
//     const [userRows] = await connection.execute('SELECT id FROM users WHERE id = ?', [user_id]);
//     if ((userRows as any[]).length === 0) return NextResponse.json({ error: `User ${user_id} không tồn tại` }, { status: 400 });

//     // AI Analysis
//     const maxTextLen = 3000;
//     const textChunk = extractedText.length > maxTextLen ? extractedText.substring(0, maxTextLen) + "..." : extractedText;
// const analysisPrompt = `Phân tích CHI TIẾT file giáo dục Toán lớp 2 về phép nhân. 

// CẤU TRÚC FILE HIỆN TẠI:
// "${textChunk}"

// PHÂN TÍCH CỤ THỂ:
// 1. Bài 1 (Khoanh tròn): ${mcCount} câu TRẮC NGHIỆM (A, B, C, D)
//    - Mỗi câu có 4 lựa chọn
//    - Dạng: Chọn đáp án đúng, điền dấu, bài toán thực tế

// 2. Bài 2 (Tính nhẩm): TỰ LUẬN - tính kết quả phép nhân

// 3. Bài 3 (Quan sát tranh): TỰ LUẬN - viết phép nhân từ tranh

// 4. Bài 4 (>; <; =): TỰ LUẬN - so sánh kết quả

// 5. Bài 5 (Số?): TỰ LUẬN - điền số vào bảng

// 6. Bài 6-7: TỰ LUẬN - giải bài toán có lời văn

// YÊU CẦU TẠO CÂU HỎI: Tạo ĐÚNG SỐ LƯỢNG và ĐÚNG LOẠI như file gốc.

// Trả lời DUY NHẤT JSON:
// {
//   "exercise_name": "Ôn tập phép nhân lớp 2",
//   "lesson_name": "Phép nhân cơ bản",
//   "subject": "Toán",
//   "grade_level": "Lớp 2",
//   "difficulty": "Easy",
//   "num_questions": ${Math.max(10, mcCount + oeCount)}, // Tổng số câu trong file
//   "type": "mixed",
//   "selected_types": ["multiple_choice", "open_ended"],
//   "type_quantities": {"multiple_choice": ${mcCount}, "open_ended": ${oeCount}},
//   "num_answers": 4,
//   "topic_summary": "File gồm ${mcCount} câu trắc nghiệm (Bài 1) và ${oeCount} câu tự luận (Bài 2-7). Nội dung: chuyển tổng thành phép nhân, tính nhẩm bảng cửu chương 2 và 5, so sánh kết quả, giải bài toán thực tế về phép nhân.",
//   "file_structure": "Bài 1 (MC) → Bài 2-7 (Open-ended)"
// }`;

//     // Retry cho analysis
//     let analysisJson = {
//       exercise_name: "Ôn tập phép nhân từ file",
//       lesson_name: "Phép nhân lớp 2",
//       subject: "Toán",
//       grade_level: "Lớp 2",
//       difficulty: "Easy",
//       num_questions: 10,
//       type: "mixed" as const,
//       selected_types: ["multiple_choice", "open_ended"],
//       type_quantities: { multiple_choice: Math.round(10 * mcRatio / 10), open_ended: Math.round(10 * oeRatio / 10) },
//       num_answers: 4,
//       topic_summary: `File về phép nhân: ${mcCount} trắc nghiệm, ${oeCount} tự luận. ${exampleStr} (fallback).`
//     };

//     let analysisRetry = 0;
//     const maxAnalysisRetries = 2;
//     while (analysisRetry <= maxAnalysisRetries) {
//       const currentKey = geminiKeys[keyIndex++ % geminiKeys.length];
//       const analysisRes = await fetch(`${GEMINI_API_URL}?key=${currentKey}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ parts: [{ text: analysisPrompt }] }],
//           generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
//         }),
//       });

//       if (analysisRes.ok) {
//         const analysisText = (await analysisRes.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
//         console.log("🧠 Analysis raw:", analysisText.substring(0, 200));
//         const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
//         if (jsonMatch) {
//           try {
//             const parsed = JSON.parse(jsonMatch[0]);
//             analysisJson = { ...analysisJson, ...parsed };
//             console.log("✅ Analysis success:", JSON.stringify(analysisJson, null, 2));
//             break;
//           } catch (parseErr) {
//             console.warn("⚠️ Analysis parse failed:", parseErr);
//           }
//         }
//       } else {
//         console.warn(`⚠️ Analysis API error (attempt ${analysisRetry + 1}):`, await analysisRes.text());
//       }

//       analysisRetry++;
//       if (analysisRetry <= maxAnalysisRetries) await setTimeout(1000 * analysisRetry);
//     }

//     // Destructure & validate
//     const { exercise_name, lesson_name, type: exercise_type, selected_types, type_quantities, num_questions, num_answers, difficulty, topic_summary } = analysisJson;
//     const validatedType = (['mixed', 'multiple_choice', 'open_ended', 'true_false', 'multiple_select'] as const).includes(exercise_type as any) ? exercise_type as "mixed" | "multiple_choice" | "open_ended" | "true_false" | "multiple_select" : 'mixed';
//     if (!exercise_name?.trim() || num_questions < 1 || num_questions > 50) return NextResponse.json({ error: "Dữ liệu AI không hợp lệ" }, { status: 400 });

//     let typesToUse = selected_types || ['multiple_choice', 'open_ended'];
//     let typeDistribution = Object.entries(type_quantities || {}).filter(([, count]) => count > 0).map(([type, count]) => ({ type, count: Number(count) }));
//     if (typeDistribution.length === 0) {
//       const perType = Math.floor(num_questions / typesToUse.length);
//       const remainder = num_questions % typesToUse.length;
//       typeDistribution = typesToUse.map((type, idx) => ({ type, count: perType + (idx < remainder ? 1 : 0) }));
//     }
//     const total = typeDistribution.reduce((sum, { count }) => sum + count, 0);
//     if (total !== num_questions) return NextResponse.json({ error: `Tổng câu hỏi không khớp: ${total}` }, { status: 400 });

//     const isMixed = typesToUse.length > 1 || validatedType === 'mixed';
//     const choiceBasedTypes = ['multiple_choice', 'true_false', 'multiple_select'];
//     const isChoiceBased = !isMixed && choiceBasedTypes.includes(typesToUse[0]);
//     let effectiveNumAnswers = num_answers || (isChoiceBased ? 4 : 0);
//     if (typesToUse[0] === 'true_false') effectiveNumAnswers = 2;
//     if (isChoiceBased && (effectiveNumAnswers < 2 || effectiveNumAnswers > 5)) return NextResponse.json({ error: "Số đáp án 2-5" }, { status: 400 });

//     // Question types
//     const existingTypes = await fetchQuestionTypes(connection);
//     let questionTypeId = !isMixed ? 
//       (existingTypes.find(t => normalizeForMatch(t.type_name) === normalizeForMatch(typesToUse[0]))?.id || 
//        await insertQuestionTypeIfNotExists(connection, typesToUse[0], choiceBasedTypes.includes(typesToUse[0]), existingTypes)) :
//       (existingTypes.find(t => normalizeForMatch(t.type_name) === normalizeForMatch('multiple choice'))?.id || 1);

//     // Generate prompt
//     const levelDesc = analysisJson.grade_level ? `học sinh ${analysisJson.grade_level}` : 'tiểu học';
//     const subjectHint = analysisJson.subject || 'Toán';
//     const typeList = existingTypes.map(t => `${t.id}: ${t.type_name}`).join('; ');
//     const typesStr = typesToUse.join(', ');
//     const distributionStr = typeDistribution.map(({ count, type }) => `${count} ${type}`).join(', ');
    
//     const objectStr = isMixed ? '{ "question_text": "...", "emoji": "...", "answers"?: [...], "model_answer"?: "...", "explanation": "...", "suggested_type": "..." }' :
//                        isChoiceBased ? `{ "question_text": "...", "emoji": "...", "answers": [...], "explanation": "...", "suggested_type": "${typesToUse[0]}" }` :
//                        '{ "question_text": "...", "emoji": "...", "model_answer": "...", "explanation": "...", "suggested_type": "open_ended" }';

//     const specificReq = isMixed ? `- MIMIC FILE: Phân bổ ${distributionStr} (${mcRatio}% multiple_choice như Bài 1: 4 options A-D, 1 "(correct)"; ${oeRatio}% open_ended như Bài 6: model_answer chi tiết, KHÔNG answers. Dùng ví dụ: ${exampleStr}` :
//                                   isChoiceBased ? `- 4 options A-D, 1 "(correct)", như Bài 1.` : '- Model_answer như bài giải tự luận.';

//     const fullTextChunk = extractedText.length > 1500 ? extractedText.substring(0, 1500) + `... (mimic: ${mcCount} trắc nghiệm, ${oeCount} tự luận)` : extractedText;
//     const generatePrompt = `Tạo câu hỏi Toán lớp 2 về phép nhân theo ĐÚNG CẤU TRÚC file mẫu:

//     CẤU TRÚC FILE MẪU (phải tuân theo):
//     1. BÀI 1: ${mcCount} câu TRẮC NGHIỆM (multiple_choice)
//     - Mỗi câu có 4 đáp án A, B, C, D
//     - Chỉ MỘT đáp án đúng, ghi "(correct)" sau đáp án đúng
//     - Dạng câu: Khoanh tròn chữ cái đặt trước câu trả lời đúng

//     2. BÀI 2 đến BÀI 7: ${oeCount} câu TỰ LUẬN (open_ended)
//     - Bài 2: Tính nhẩm (không cần lời giải)
//     - Bài 3: Quan sát tranh và viết phép nhân
//     - Bài 4: Điền dấu >, <, =
//     - Bài 5: Điền số vào bảng
//     - Bài 6-7: Giải bài toán có lời văn (có "Bài giải")

//     NỘI DUNG FILE MẪU: "${fullTextChunk}"

//     YÊU CẦU:
//     1. Tạo ĐÚNG ${mcCount} câu trắc nghiệm (suggested_type: "multiple_choice")
//     - Format: { "question_text": "...?", "emoji": "🔢", "answers": ["A. ...", "B. ... (correct)", "C. ...", "D. ..."], "explanation": "...", "suggested_type": "multiple_choice" }

//     2. Tạo ĐÚNG ${oeCount} câu tự luận (suggested_type: "open_ended")
//     - Format: { "question_text": "...", "emoji": "✏️", "model_answer": "Đáp án chi tiết...", "explanation": "...", "suggested_type": "open_ended" }

//     3. Nội dung PHẢI giống file mẫu:
//     - Chủ đề: Phép nhân lớp 2 (bảng 2 và 5)
//     - Dạng: 5+5+5+5 = 5×4, 2 được lấy 8 lần, so sánh 2×7 ... 5×7
//     - Bài toán thực tế: sách, ghế, tuổi

//     4. Ngôn ngữ: Đơn giản, phù hợp lớp 2

//     Trả lời DUY NHẤT JSON array với ${num_questions} objects, KHÔNG text thừa.`;

//     console.log("🧠 Generate prompt preview:", generatePrompt.substring(0, 500) + "...");

//     // Generate with retry
//     let questions: GeneratedQuestion[] = [];
//     let retryCount = 0;
//     const maxRetries = 3;
//     while (retryCount <= maxRetries) {
//       const currentKey = geminiKeys[keyIndex++ % geminiKeys.length];
//       const genRes = await fetch(`${GEMINI_API_URL}?key=${currentKey}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           contents: [{ parts: [{ text: generatePrompt }] }],
//           generationConfig: { temperature: difficulty === 'Hard' ? 0.8 : difficulty === 'Easy' ? 0.4 : 0.6, maxOutputTokens: 8000 },
//         }),
//       });

//       if (!genRes.ok) {
//         const errMsg = (await genRes.json()).error?.message || genRes.statusText;
//         console.warn(`⚠️ Gen API error (attempt ${retryCount + 1}): ${errMsg}`);
//         if (genRes.status === 503) { retryCount++; continue; }
//         await setTimeout(Math.pow(2, retryCount) * 1000);
//         retryCount++;
//         if (retryCount > maxRetries) throw new Error(errMsg);
//         continue;
//       }

//       const genText = (await genRes.json()).candidates?.[0]?.content?.parts?.[0]?.text || "";
//       console.log("🧠 Gen raw output length:", genText.length);
//       try {
//         questions = extractAndRepairJson(genText, num_questions, typeDistribution, effectiveNumAnswers, typesToUse);
//         if (questions.length >= num_questions) {
//           console.log("✅ Generated questions based on file:", questions.map(q => ({ text: q.question_text, type: q.suggested_type })).slice(0, 3));
//           break;
//         }
//       } catch (e) {
//         console.warn(`⚠️ Gen extract failed (attempt ${retryCount + 1}):`, e);
//         retryCount++;
//         if (retryCount > maxRetries) throw e;
//       }
//     }

//     if (questions.length < num_questions * 0.7) {
//       console.warn(`⚠️ Only ${questions.length}/${num_questions} real questions, but proceeding...`);
//     }

//     // Log final distribution (FIX: Type as Record<string, number>)
//     const finalCounts: Record<string, number> = questions.reduce((acc, q) => {
//       const typeKey = q.suggested_type || 'unknown';
//       return { ...acc, [typeKey]: (acc[typeKey] || 0) + 1 };
//     }, {} as Record<string, number>);
//     console.log("📊 Final generated types:", finalCounts);

//     // Insert
//     const class_id = 2;
//     const book_id = 1;
//     const insertedExercise = await createExerciseWithQuestions(connection, {
//       name: exercise_name,
//       lesson_name,
//       type: validatedType,
//       num_questions,
//       num_answers: effectiveNumAnswers,
//       difficulty,
//       class_id,
//       book_id,
//       user_id,
//       question_type_id: questionTypeId,
//     }, questions, existingTypes);

//     const responseData = { ...insertedExercise, source_file_name: fileName, generated_from_summary: topic_summary, used_text_length: extractedText.length };

//     return NextResponse.json({ success: true, data: responseData, message: `Tạo ${num_questions} câu (detected: ${mcRatio}% trắc nghiệm, ${oeRatio}% tự luận) dựa sát "${fileName}"` });

//   } catch (err) {
//     console.error("❌ Error:", err);
//     return NextResponse.json({ error: (err as Error).message }, { status: 500 });
//   } finally {
//     if (connection) connection.release();
//   }
// }