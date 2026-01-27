"use client"

import { useState } from "react"
import { Plus, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import QuestionForm from "@/components/form/question-form"
import FileQuestionForm from "@/components/form/file-question-form"


export default function QuestionsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isFileFormOpen, setIsFileFormOpen] = useState(false)
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-4xl text-center space-y-10">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Tạo bài tập bằng AI
          </h1>

          <p className="text-lg text-muted-foreground">
            Tạo và quản lý bộ câu hỏi thông minh chỉ trong vài bước
          </p>
        </div>

        {/* Action Card */}
        <Card className="p-10 shadow-xl border bg-white">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            {/* Tạo mới */}
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={() => setIsFormOpen(true)}
                size="lg"
                className="h-20 px-14 text-xl font-bold gap-3 shadow-lg hover:scale-105 transition"
              >
                <Plus className="w-8 h-8" />
                Tạo bài tập mới
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                AI hỗ trợ tạo bài tập từ mô tả của bạn
              </p>
            </div>

            {/* Theo mẫu / file */}
            <div className="flex flex-col items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsFileFormOpen(true)}
                 className="h-20 px-14 text-xl font-bold gap-3 shadow-lg hover:scale-105 transition"
              >
                <FileText className="w-8 h-8" />
                Tạo bài theo mẫu
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Upload file để AI tạo bài tập tương tự
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modal tạo bài mới */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <QuestionForm
                onCancel={() => setIsFormOpen(false)}
                initialData={{
                  exercise_name: "",
                  user_instructions: "",
                  type: "multiple_choice",
                }}
              />
            </div>
          </Card>
        </div>
      )}

      {isFileFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl">
            <FileQuestionForm onCancel={() => setIsFileFormOpen(false)} />
          </div>
        </div>
      )}

    </div>
  )
}
