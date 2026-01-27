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

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("user_id", String(userId)) 
      // console.log("userid:", userId)
      const res = await fetch("/api/generate-questions/from-file", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error("Không thể tạo bài tập từ file")
      }

      const data = await res.json()

      // 👉 Sau này: redirect hoặc đổ data vào QuestionForm
      console.log("AI generated:", data)

      router.push(`/exercises/${data.exerciseId}`)
      router.refresh()  // Refresh để update data nếu cần
    } catch (err) {
      setError((err as Error).message)
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
