"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FileText, Loader2 } from "lucide-react"
import { useUser } from "@/app/providers/UserProvider"
import { useRouter } from "next/navigation"

interface FileQuestionFormProps {
  onCancel: () => void
}

export default function FileQuestionForm({ onCancel }: FileQuestionFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
    const { userId } = useUser()
    const router = useRouter()
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null)
    setError("")
  }

  const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()

  if (!file) {
    setError("Vui lòng chọn file")
    return
  }

  setIsLoading(true)
  setError("")

  try {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("user_id", String(userId))
    // Thêm các field khác nếu cần (exercise_name, type, num_questions, v.v.)
    // Ví dụ: formData.append("num_questions", "10")

    const res = await fetch("/api/generate-questions/from-file", {
      method: "POST",
      body: formData,
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.error || "Không thể tạo bài tập từ file")
    }

    const data = await res.json()

    console.log("Response từ API:", data) // ← Debug: xem response có id không

    const exerciseId = data.id

    if (!exerciseId || typeof exerciseId !== 'number' || exerciseId <= 0) {
      throw new Error("Không nhận được ID bài tập hợp lệ từ server")
    }

    router.push(`/exercises/${exerciseId}`)
    router.refresh()
  } catch (err: any) {
    console.error("Lỗi tạo bài tập:", err)
    setError(err.message || "Đã xảy ra lỗi khi tạo bài tập")
  } finally {
    setIsLoading(false)
  }
}

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-semibold text-center mb-6">
        Tạo bài tập từ File
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload */}
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted transition">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />

          <FileText className="w-10 h-10 text-muted-foreground" />

          {file ? (
            <p className="mt-3 text-sm font-medium">📄 {file.name}</p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground text-center">
              Chọn hoặc kéo thả file PDF / Word / Excel
            </p>
          )}
        </label>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>

          <Button type="submit" disabled={!file || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang tạo...
              </>
            ) : (
              "Tạo bài tập bằng AI"
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
