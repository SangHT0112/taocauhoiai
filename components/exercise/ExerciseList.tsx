// components/exercise/ExerciseList.tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Edit, Save, Trash2, Plus, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

interface Question {
  id: number
  order_num: number
  question_text: string
  emoji: string
  explanation: string
  model_answer?: string
  type_name?: string
  answers?: Answer[]
}

interface Answer {
  id: number
  order_num: number
  answer_text: string
  is_correct: boolean
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  multiple_select: "Chọn nhiều đáp án đúng",
  open_ended: "Tự luận",
}

// Debounce utility
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])
}

type PendingChange = {
  field: string
  value: any
  isAnswer: boolean
  answerId?: number
}

export default function ExerciseList({ questions, exerciseId }: { questions: Question[]; exerciseId: number }) {
  const [editModes, setEditModes] = useState<Record<number, boolean>>({})
  const [localQuestions, setLocalQuestions] = useState(questions)
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  const [editingValues, setEditingValues] = useState<Record<string, any>>({})
  const [isDeletingQuestion, setIsDeletingQuestion] = useState<Record<number, boolean>>({})

  const pendingSavesRef = useRef<Record<number, PendingChange[]>>({})

  const debouncedSave = useDebounce(async (questionId: number) => {
    const pendingChanges = pendingSavesRef.current[questionId]
    if (!pendingChanges || pendingChanges.length === 0) return
    
    const savingKey = `q-${questionId}`
    setIsSaving(prev => ({ ...prev, [savingKey]: true }))

    const savePromises = pendingChanges.map(async (change) => {
      const { field, value, isAnswer, answerId } = change
      const individualKey = isAnswer ? `answer-${answerId}` : `q-${questionId}`
      
      try {
        if (isAnswer && answerId) {
          const res = await fetch("/api/answers", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: answerId, [field]: value }),
          })
          if (!res.ok) throw new Error(`Update answer failed: ${res.status}`)
        } else {
          const res = await fetch(`/api/questions/${questionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          })
          if (!res.ok) throw new Error(`Update question failed: ${res.status}`)
        }
      } catch (error) {
        console.error(`Save failed for ${field}:`, error)
        throw error
      } finally {
        setIsSaving(prev => ({ ...prev, [individualKey]: false }))
      }
    })

    try {
      await Promise.all(savePromises)
      pendingSavesRef.current[questionId] = []
    } catch (error) {
      alert("Lỗi cập nhật một số trường. Vui lòng thử lại.")
      setLocalQuestions(questions) // rollback
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }))
    }
  }, 500)

  const toggleEdit = (questionId: number) => {
    const isEditing = editModes[questionId]
    if (isEditing) {
      saveAllPendingChanges(questionId)
    }
    setEditModes(prev => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  const handleLocalChange = (questionId: number, field: string, value: any, isAnswer = false, answerId?: number) => {
    const key = isAnswer ? `answer-${answerId}-${field}` : `question-${questionId}-${field}`
    setEditingValues(prev => ({ ...prev, [key]: value }))
    
    if (!pendingSavesRef.current[questionId]) pendingSavesRef.current[questionId] = []
    pendingSavesRef.current[questionId].push({ field, value, isAnswer, answerId })
    
    debouncedSave(questionId)

    setLocalQuestions(prev => prev.map(q => {
      if (q.id !== questionId) return q
      if (isAnswer && answerId && q.answers) {
        return {
          ...q,
          answers: q.answers.map(a => a.id === answerId ? { ...a, [field]: value } : a)
        }
      }
      return { ...q, [field]: value }
    }))
  }

  const saveAllPendingChanges = async (questionId: number) => {
    const pendingChanges = pendingSavesRef.current[questionId]
    if (!pendingChanges || pendingChanges.length === 0) return
    
    const savingKey = `q-${questionId}`
    setIsSaving(prev => ({ ...prev, [savingKey]: true }))

    const savePromises = pendingChanges.map(async (change) => {
      const { field, value, isAnswer, answerId } = change
      const individualKey = isAnswer ? `answer-${answerId}` : `q-${questionId}`
      
      try {
        if (isAnswer && answerId) {
          const res = await fetch("/api/answers", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: answerId, [field]: value }),
          })
          if (!res.ok) throw new Error("Cập nhật đáp án thất bại")
        } else {
          const res = await fetch(`/api/questions/${questionId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: value }),
          })
          if (!res.ok) throw new Error("Cập nhật câu hỏi thất bại")
        }
      } catch (error) {
        console.error(`Lỗi cập nhật ${field}:`, error)
        alert("Lỗi cập nhật. Vui lòng thử lại.")
        setLocalQuestions(questions)
        throw error
      } finally {
        setIsSaving(prev => ({ ...prev, [individualKey]: false }))
      }
    })

    try {
      await Promise.all(savePromises)
      pendingSavesRef.current[questionId] = []
    } catch {}
    finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }))
    }
  }

  // XÓA CÂU HỎI
  const deleteQuestion = async (questionId: number) => {
    if (!confirm("Bạn chắc chắn muốn xóa toàn bộ câu hỏi này (bao gồm tất cả đáp án)? Hành động không thể hoàn tác.")) return

    setIsDeletingQuestion(prev => ({ ...prev, [questionId]: true }))

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Xóa câu hỏi thất bại")
      }

      // Optimistic: xóa khỏi UI
      setLocalQuestions(prev => prev.filter(q => q.id !== questionId))

      // Clear states
      delete pendingSavesRef.current[questionId]
      setEditModes(prev => {
        const newModes = { ...prev }
        delete newModes[questionId]
        return newModes
      })
      setEditingValues(prev => {
        const newValues = { ...prev }
        Object.keys(newValues).forEach(key => {
          if (key.startsWith(`question-${questionId}-`) || key.startsWith(`answer-`)) {
            delete newValues[key]
          }
        })
        return newValues
      })

      console.log(`✅ Deleted question ${questionId}`)
    } catch (error: any) {
      console.error("❌ Delete failed:", error)
      alert("Lỗi khi xóa: " + (error.message || "Không xác định"))
    } finally {
      setIsDeletingQuestion(prev => ({ ...prev, [questionId]: false }))
    }
  }

  const addAnswer = async (questionId: number) => {
    const savingKey = `add-${questionId}`
    const newOrderNum = (localQuestions.find(q => q.id === questionId)?.answers?.length || 0) + 1
    const newAnswer = { answer_text: "", is_correct: false, order_num: newOrderNum }
    setIsSaving(prev => ({ ...prev, [savingKey]: true }))

    try {
      const res = await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, ...newAnswer }),
      })
      if (!res.ok) throw new Error("Thêm thất bại")
      const data = await res.json()
      
      setLocalQuestions(prev => prev.map(q => q.id === questionId ? {
        ...q,
        answers: [...(q.answers || []), { ...newAnswer, id: data.id, order_num: data.order_num }]
      } : q))
    } catch (error) {
      console.error("Lỗi thêm đáp án:", error)
      alert("Lỗi thêm. Vui lòng thử lại.")
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }))
    }
  }

  const deleteAnswer = async (answerId: number, questionId: number) => {
    if (!confirm("Xóa đáp án này?")) return
    const savingKey = `del-${answerId}`
    setIsSaving(prev => ({ ...prev, [savingKey]: true }))

    try {
      const res = await fetch("/api/answers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: answerId }),
      })
      if (!res.ok) throw new Error("Xóa thất bại")
      
      setLocalQuestions(prev => prev.map(q => ({
        ...q,
        answers: q.answers?.filter(a => a.id !== answerId)
      })))
    } catch (error) {
      console.error("Lỗi xóa đáp án:", error)
      alert("Lỗi xóa. Vui lòng thử lại.")
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }))
    }
  }

  const saveQuestion = (questionId: number) => {
    saveAllPendingChanges(questionId)
    toggleEdit(questionId)
  }

  return (
    <div className="space-y-6">
      {localQuestions.map((question) => {
        const isEditing = editModes[question.id]
        const savingKey = `q-${question.id}`
        const deletingKey = question.id
        const hasPending = pendingSavesRef.current[question.id]?.length > 0 || false

        return (
          <article key={question.id} className="border border-gray-200 rounded-lg p-6 shadow-sm bg-white">
            {/* Header với nút Sửa + Xóa */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start flex-1 gap-3">
                <div className="flex-1">
                  {isEditing ? (
                    <Input
                      value={question.question_text}
                      onChange={(e) => handleLocalChange(question.id, "question_text", e.target.value)}
                      placeholder="Nội dung câu hỏi..."
                      className="text-lg font-semibold mb-1"
                    />
                  ) : (
                    <h3 className="text-lg font-semibold">{question.question_text}</h3>
                  )}
                  {question.type_name && (
                    <p className="text-sm text-gray-500 mt-1">
                      Loại: {QUESTION_TYPE_LABEL[question.type_name] ?? question.type_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Nút Sửa / Hủy */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleEdit(question.id)}
                  disabled={isSaving[savingKey] || isDeletingQuestion[deletingKey]}
                >
                  {isEditing ? <X className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
                  {isEditing ? "Hủy" : "Sửa"}
                  {isSaving[savingKey] && <span className="ml-1 text-xs">(Đang lưu...)</span>}
                  {hasPending && !isSaving[savingKey] && <span className="ml-1 text-xs text-yellow-600">Có thay đổi</span>}
                </Button>

                {/* Nút Xóa câu hỏi */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteQuestion(question.id)}
                  disabled={isEditing || isSaving[savingKey] || isDeletingQuestion[deletingKey]}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Xóa
                  {isDeletingQuestion[deletingKey] && <span className="ml-1 text-xs">(Đang xóa...)</span>}
                </Button>
              </div>
            </div>

            {/* Answers */}
            {(question.answers && question.answers.length > 0) || isEditing ? (
              <div className="ml-8 mb-4 space-y-3">
                <h4 className="font-medium text-gray-800">Đáp án:</h4>
                {(question.answers || []).map((answer) => {
                  const answerSavingKey = `answer-${answer.id}`
                  return (
                    <div key={answer.id} className="flex items-center gap-3">
                      {isEditing ? (
                        <>
                          <Input
                            value={answer.answer_text}
                            onChange={(e) => handleLocalChange(question.id, "answer_text", e.target.value, true, answer.id)}
                            className="flex-1"
                            placeholder="Nhập đáp án..."
                          />
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <Checkbox
                              checked={answer.is_correct}
                              onCheckedChange={(checked) => handleLocalChange(question.id, "is_correct", !!checked, true, answer.id)}
                            />
                            <span className="text-sm text-gray-600">Đúng</span>
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteAnswer(answer.id, question.id)}
                            disabled={isSaving[`del-${answer.id}`]}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <div className={`flex-1 p-3 rounded border ${answer.is_correct ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                          <span className="font-medium mr-2">{String.fromCharCode(65 + (answer.order_num - 1))}.</span>
                          {answer.answer_text}
                          {answer.is_correct && <span className="ml-2 text-green-700 font-medium">(Đúng)</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addAnswer(question.id)}
                    disabled={isSaving[`add-${question.id}`]}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Thêm đáp án
                  </Button>
                )}
              </div>
            ) : null}

            {/* Explanation & Model Answer */}
            {isEditing ? (
              <div className="ml-8 space-y-3">
                <Textarea
                  value={question.explanation || ""}
                  onChange={(e) => handleLocalChange(question.id, "explanation", e.target.value)}
                  placeholder="Giải thích chi tiết..."
                  rows={3}
                  className="resize-none"
                />
                <Input
                  value={question.model_answer || ""}
                  onChange={(e) => handleLocalChange(question.id, "model_answer", e.target.value)}
                  placeholder="Đáp án mẫu (dành cho câu tự luận)"
                />
              </div>
            ) : (
              <div className="ml-8 space-y-3">
                {question.explanation && (
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <strong className="block mb-1 text-blue-800">Giải thích:</strong>
                    {question.explanation}
                  </div>
                )}
                {question.model_answer && (
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <strong className="block mb-1 text-amber-800">Đáp án mẫu:</strong>
                    {question.model_answer}
                  </div>
                )}
              </div>
            )}

            {/* Nút Lưu / Hủy khi đang edit */}
            {isEditing && (
              <div className="ml-8 mt-6 flex gap-3">
                <Button 
                  onClick={() => saveQuestion(question.id)} 
                  disabled={isSaving[savingKey] || isDeletingQuestion[deletingKey]}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Lưu thay đổi
                  {hasPending && <span className="ml-2 text-xs">({pendingSavesRef.current[question.id]?.length})</span>}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    pendingSavesRef.current[question.id] = []
                    setLocalQuestions(questions)
                    setEditingValues(prev => {
                      const newValues = { ...prev }
                      Object.keys(newValues).forEach(k => {
                        if (k.startsWith(`question-${question.id}-`) || k.startsWith(`answer-`)) {
                          delete newValues[k]
                        }
                      })
                      return newValues
                    })
                    toggleEdit(question.id)
                  }}
                  disabled={isSaving[savingKey] || isDeletingQuestion[deletingKey]}
                >
                  Hủy
                </Button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}