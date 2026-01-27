"use client"

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType
} from "docx"
import { saveAs } from "file-saver"
import type { PDFQuestion } from "@/types/pdf"

/* ================= OPTIONS ================= */
interface GenerateWordOptions {
  filename?: string
  exerciseName?: string
  lessonName?: string
  showAnswers?: boolean
  showExplanation?: boolean
}

/* ================= ANSWER RENDER HELPER ================= */
const renderAnswerRun = (
  prefix: string,
  text: string,
  isCorrect: boolean
) => [
  new TextRun({ text: prefix, font: "Times New Roman" }),
  ...(isCorrect
    ? [new TextRun({ text: "✓ ", bold: true, color: "16a34a" })]
    : []),
  new TextRun({
    text,
    font: "Times New Roman",
    ...(isCorrect ? { bold: true, color: "16a34a" } : {}),
  }),
]

/* ================= TAB STOPS ================= */
// 4 cột đều trên A4
const TAB_4_COLS = [
  { type: TabStopType.LEFT, position: 1800 },
  { type: TabStopType.LEFT, position: 3600 },
  { type: TabStopType.LEFT, position: 5400 },
]

const TAB_2_COLS = [
  { type: TabStopType.LEFT, position: 3600 },
]
/* ================= DOCUMENT BUILDER ================= */
const createWordDocument = ({
  questions,
  exerciseName,
  lessonName,
  showAnswers,
  showExplanation,
}: {
  questions: PDFQuestion[]
  exerciseName: string
  lessonName: string
  showAnswers: boolean
  showExplanation: boolean
}) => {
  const children: Paragraph[] = []

  /* ========== HEADER ========== */
  children.push(
    new Paragraph({
      text: exerciseName,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  )

  /* ========== QUESTIONS ========== */
  questions.forEach((q, index) => {
    const isOpenEnded = !q.answers || q.answers.length === 0

    // Question text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Câu ${index + 1}: `, bold: true }),
          new TextRun({ text: ` ${q.emoji ?? ""} `, font: "Segoe UI Emoji" }),
          new TextRun({ text: q.question_text, font: "Times New Roman" }),
        ],
        spacing: { after: 200 },
      })
    )

    /* ========== MULTIPLE CHOICE ========== */
    if (!isOpenEnded && q.answers) {
      const maxLength = Math.max(
        ...q.answers.map((a) => a.answer_text.trim().length)
      )

      /* ===== CASE 1: RẤT NGẮN → 1 HÀNG (A B C D) ===== */
      if (maxLength <= 3) {
        children.push(
          new Paragraph({
            children: q.answers.flatMap((ans, i) => [
              ...renderAnswerRun(
                `${String.fromCharCode(65 + i)}. `,
                ans.answer_text,
                showAnswers && ans.is_correct
              ),
              new TextRun({ text: "\t" }),
            ]),
            indent: { left: 400 },
            tabStops: TAB_4_COLS,
            spacing: { after: 150 },
          })
        )
      }

      /* ===== CASE 2: NGẮN → 2 CỘT (A B / C D) ===== */
      else if (maxLength <= 20) {
        for (let i = 0; i < q.answers.length; i += 2) {
          const left = q.answers[i]
          const right = q.answers[i + 1]

          children.push(
            new Paragraph({
              children: [
                ...renderAnswerRun(
                  `${String.fromCharCode(65 + i)}. `,
                  left.answer_text,
                  showAnswers && left.is_correct
                ),
                new TextRun({ text: "\t" }),
                ...(right
                  ? renderAnswerRun(
                      `${String.fromCharCode(65 + i + 1)}. `,
                      right.answer_text,
                      showAnswers && right.is_correct
                    )
                  : []),
              ],
              indent: { left: 400 },
              tabStops: TAB_2_COLS,
              spacing: { after: 150 },
            })
          )
        }
      }

      /* ===== CASE 3: DÀI → 1 CỘT ===== */
      else {
        q.answers.forEach((ans, i) => {
          children.push(
            new Paragraph({
              children: renderAnswerRun(
                `${String.fromCharCode(65 + i)}. `,
                ans.answer_text,
                showAnswers && ans.is_correct
              ),
              indent: { left: 400 },
              spacing: { after: 150 },
            })
          )
        })
      }
    }

    /* ========== OPEN ENDED ANSWER ========== */
    if (isOpenEnded && showAnswers && q.model_answer) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Đáp án mẫu: ",
              bold: true,
              color: "16a34a",
              font: "Times New Roman",
            }),
            new TextRun({
              text: q.model_answer,
              color: "16a34a",
              font: "Times New Roman",
            }),
          ],
          indent: { left: 400 },
          spacing: { after: 200 },
        })
      )
    }

    /* ========== BLANK SPACE ========== */
    if (isOpenEnded && !showAnswers) {
      for (let i = 0; i < 4; i++) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text:
                  "................................................................",
                font: "Times New Roman",
                color: "CCCCCC",
              }),
            ],
            spacing: { after: 120 },
          })
        )
      }
    }

    /* ========== EXPLANATION ========== */
    if (showAnswers && showExplanation && q.explanation) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Giải thích: ",
              italics: true,
              font: "Times New Roman",
            }),
            new TextRun({
              text: q.explanation,
              italics: true,
              font: "Times New Roman",
            }),
          ],
          indent: { left: 400 },
          spacing: { after: 300 },
        })
      )
    }

    children.push(new Paragraph({ spacing: { after: 150 } }))
  })

  /* ========== DOCUMENT ========== */
  return new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 28, // 14pt
          },
        },
      },
    },
  })
}

/* ================= EXPORT ================= */
export const generateAndDownloadWord = async (
  questions: PDFQuestion[],
  options: GenerateWordOptions = {}
) => {
  const {
    filename = "bai-tap.docx",
    exerciseName = "Bài Tập",
    lessonName = "",
    showAnswers = true,
    showExplanation = true,
  } = options

  try {
    const doc = createWordDocument({
      questions,
      exerciseName,
      lessonName,
      showAnswers,
      showExplanation,
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, filename)
  } catch (err) {
    console.error("Lỗi tạo Word:", err)
    alert("Không thể tạo file Word")
  }
}
