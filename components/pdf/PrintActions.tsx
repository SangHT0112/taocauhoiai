// PrintActions.tsx (cập nhật)
"use client"

import { Button } from "@/components/ui/button"
// Thay PDFGenerator bằng WordGenerator
import { generateAndDownloadWord } from "./WordGenerator"
import type { PDFQuestion } from "@/types/pdf"

interface PrintActionsProps {
  exerciseName: string
  questions: PDFQuestion[]
}

export default function PrintActions({
  exerciseName,
  questions,
}: PrintActionsProps) {
  return (
    <div className="flex gap-4 justify-center mt-10">
      {/* IN KHÔNG ĐÁP ÁN */}
      <Button
        variant="outline"
        onClick={() =>
          generateAndDownloadWord(questions, {
            filename: `${exerciseName}-khong-dap-an.docx`,
            exerciseName,
            showAnswers: false,
            showExplanation: false,
          })
        }
      >
        📄 In không đáp án (Word)
      </Button>

      {/* IN CÓ ĐÁP ÁN */}
      <Button
        onClick={() =>
          generateAndDownloadWord(questions, {
            filename: `${exerciseName}-co-dap-an.docx`,
            exerciseName,
            showAnswers: true,
            showExplanation: true,
          })
        }
      >
        📄 In có đáp án (Word)
      </Button>
    </div>
  )
}