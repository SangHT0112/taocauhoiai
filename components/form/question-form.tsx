"use client"

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Info, GraduationCap } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Plus, Minus } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { QuestionFormData, InsertedQuestion, QuestionFormProps, Grade, Subject, Chapter, Lesson } from "@/types/question"
import { useUser } from "@/app/providers/UserProvider"
import { useRef } from "react"

const availableTypes = [
  { value: "multiple_choice", label: "Trắc nghiệm nhiều lựa chọn", description: "1 đáp án đúng", icon: "📝" },
  { value: "true_false", label: "Đúng/Sai", description: "Câu hỏi nhị phân", icon: "✓" },
  { value: "multiple_select", label: "Chọn nhiều đáp án", description: "Nhiều đáp án đúng", icon: "☑" },
  { value: "open_ended", label: "Tự luận", description: "Câu hỏi mở", icon: "✍" },
] as const

export default function QuestionForm({ onCancel, initialData }: QuestionFormProps) {
  const { userId } = useUser()
  const router = useRouter()

  const hasLoadedDraft = useRef(false)

  const initialSelectedTypes = initialData?.selected_types || ["multiple_choice"]
  const initialType = initialData?.type || (initialSelectedTypes.length > 1 ? "mixed" : initialSelectedTypes[0])
  const [typeQuantities, setTypeQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    availableTypes.forEach((t) => {
      const fromInitial = initialData?.type_quantities?.[t.value]
      init[t.value] = fromInitial !== undefined ? fromInitial : initialSelectedTypes.includes(t.value) ? 5 : 0
    })
    return init
  })

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  type QuestionTypeKeys = "multiple_choice" | "true_false" | "multiple_select" | "open_ended"
  const [selectedGradeId, setSelectedGradeId] = useState<number>(initialData?.grade_id || 0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(initialData?.subject_id || 0);
  const [selectedChapterId, setSelectedChapterId] = useState<number>(initialData?.chapter_id || 0);
  const [selectedLessonId, setSelectedLessonId] = useState<number>(initialData?.lesson_id || 0);
  const [formData, setFormData] = useState<Required<QuestionFormData>>({
    exercise_name: initialData?.exercise_name || "",
    type: initialType as "multiple_choice" | "open_ended" | "mixed",
    selected_types: initialSelectedTypes as QuestionTypeKeys[],
    user_instructions: initialData?.user_instructions || initialData?.topic || "",
    num_questions: initialData?.num_questions || initialData?.quantity || 5,
    num_answers: initialData?.num_answers || initialData?.number_of_answers || 4,
    difficulty: initialData?.difficulty || "Medium",
    user_id: initialData?.user_id || userId,
    grade_id: initialData?.grade_id || 0,
    subject_id: initialData?.subject_id || 0,
    chapter_id: initialData?.chapter_id || 0,
    lesson_id: initialData?.lesson_id || 0,
    topic: "",
    quantity: 0,
    number_of_answers: 0,
    description: "",
    question_text: "",
    emoji: "",
    question_type: "",
    answers: [],
    explanation: "",
    type_quantities: (() => {
      const init: Record<QuestionTypeKeys, number> = {
        multiple_choice: 5,
        true_false: 5,
        multiple_select: 5,
        open_ended: 5,
      }
      if (initialData?.type_quantities) {
        ;(Object.keys(initialData.type_quantities) as QuestionTypeKeys[]).forEach((key) => {
          if (initialData.type_quantities && initialData.type_quantities[key] != null) {
            init[key] = initialData.type_quantities[key]
          }
        })
      }
      return init
    })(),
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)

  const hasMultipleChoice = formData.selected_types.includes("multiple_choice")

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const parsedValue = ["num_questions", "num_answers"].includes(name) ? Number.parseInt(value) || 0 : value
    setFormData((prev) => ({ ...prev, [name]: parsedValue }))
  }

  const fetchGrades = async () => {
    try {
      const res = await fetch("/api/grades");
      if (res.ok) setGrades(await res.json());
    } catch (err) {
      console.error("Lỗi fetch grades:", err);
    }
  };

  const fetchSubjects = async (gradeId: number) => {
    if (!gradeId) return;
    try {
      const res = await fetch(`/api/subjects?grade_id=${gradeId}`);
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
        // Chỉ reset nếu KHÔNG đang load draft VÀ selectedSubjectId không hợp lệ
        if (!isLoadingDraft && selectedSubjectId > 0 && !data.some((s: Subject) => s.id === selectedSubjectId)) {
          setSelectedSubjectId(0);
          setChapters([]);
          setLessons([]);
        }
      }
    } catch (err) {
      console.error("Lỗi fetch subjects:", err);
    }
  };

  const fetchChapters = async (subjectId: number) => {
    if (!subjectId) return;
    try {
      const res = await fetch(`/api/chapters?subject_id=${subjectId}`);
      if (res.ok) {
        const data = await res.json();
        setChapters(data);
        if (!isLoadingDraft && selectedChapterId > 0 && !data.some((c: Chapter) => c.id === selectedChapterId)) {
          setSelectedChapterId(0);
          setLessons([]);
        }
      }
    } catch (err) {
      console.error("Lỗi fetch chapters:", err);
    }
  };

  const fetchLessons = async (chapterId: number) => {
    if (!chapterId) return;
    try {
      const res = await fetch(`/api/lessons?chapter_id=${chapterId}`);
      if (res.ok) {
        const data = await res.json();
        setLessons(data.sort((a: Lesson, b: Lesson) => (a.lesson_order || 0) - (b.lesson_order || 0)));
        if (!isLoadingDraft && selectedLessonId > 0 && !data.some((l: Lesson) => l.id === selectedLessonId)) {
          setSelectedLessonId(0);
        }
      }
    } catch (err) {
      console.error("Lỗi fetch lessons:", err);
    }
  };

  // Fetch grades ngay khi mount
  useEffect(() => {
    fetchGrades();
  }, []);

  // Trigger fetches khi selectedId thay đổi
  useEffect(() => {
    if (selectedGradeId > 0) {
      fetchSubjects(selectedGradeId);
    }
  }, [selectedGradeId]);

  useEffect(() => {
    if (selectedSubjectId > 0) {
      fetchChapters(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedChapterId > 0) {
      fetchLessons(selectedChapterId);
    }
  }, [selectedChapterId]);

  // Sync formData với selectedIds
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      grade_id: selectedGradeId,
      subject_id: selectedSubjectId,
      chapter_id: selectedChapterId,
      lesson_id: selectedLessonId,
    }));
  }, [selectedGradeId, selectedSubjectId, selectedChapterId, selectedLessonId]);

  // Handle select change
  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const id = parseInt(value) || 0;
    switch (name) {
      case "grade_id":
        setSelectedGradeId(id);
        break;
      case "subject_id":
        setSelectedSubjectId(id);
        break;
      case "chapter_id":
        setSelectedChapterId(id);
        break;
      case "lesson_id":
        setSelectedLessonId(id);
        break;
    }
  };

  const handleTypeChange = (typeValue: "multiple_choice" | "open_ended" | "true_false" | "multiple_select") => {
    const wasSelected = formData.selected_types.includes(typeValue)
    const newTypes = wasSelected
      ? formData.selected_types.filter((t) => t !== typeValue)
      : [...formData.selected_types, typeValue]

    const newType = newTypes.length > 1 ? "mixed" : newTypes[0] || "multiple_choice"

    setFormData((prev) => ({
      ...prev,
      selected_types: newTypes as ("multiple_choice" | "open_ended" | "true_false" | "multiple_select")[],
      type: newType as "multiple_choice" | "open_ended" | "mixed",
    }))

    setTypeQuantities((prev) => {
      const newQ = { ...prev }
      if (wasSelected) {
        newQ[typeValue] = 0
      } else {
        if (newQ[typeValue] <= 0) newQ[typeValue] = 5
      }
      return newQ
    })
  }

  const incrementQuantity = (typeValue: string) => {
    setTypeQuantities((prev) => ({
      ...prev,
      [typeValue]: Math.min((prev[typeValue] || 0) + 1, 50),
    }))
  }

  const decrementQuantity = (typeValue: string) => {
    setTypeQuantities((prev) => ({
      ...prev,
      [typeValue]: Math.max((prev[typeValue] || 0) - 1, 1),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    const errorMessages = {
      exerciseName: "Vui lòng nhập tên bài tập",
      userInstructions: "Vui lòng nhập nội dung bài học",
      numQuestions: "Số câu hỏi phải từ 1 đến 50",
      selectedTypes: "Vui lòng chọn ít nhất 1 loại câu hỏi",
      numAnswers: "Số đáp án phải từ 2-5 cho trắc nghiệm nhiều lựa chọn",
    }

    if (!formData.exercise_name?.trim()) return setError(errorMessages.exerciseName)
    if (!formData.user_instructions?.trim()) return setError(errorMessages.userInstructions)
    if ((formData.num_questions || 0) < 1 || (formData.num_questions || 0) > 50)
      return setError(errorMessages.numQuestions)
    if (formData.selected_types.length === 0) return setError(errorMessages.selectedTypes)
    if (hasMultipleChoice && (!formData.num_answers || formData.num_answers < 2 || formData.num_answers > 5)) {
      return setError(errorMessages.numAnswers)
    }

    if (!selectedGradeId) return setError("Vui lòng chọn khối lớp");
    if (!selectedSubjectId) return setError("Vui lòng chọn môn học");
    if (!selectedChapterId) return setError("Vui lòng chọn chương");
    if (!selectedLessonId) return setError("Vui lòng chọn bài học");

    setIsLoading(true)

    try {
      const submitData: Omit<QuestionFormData & { grade_id: number; subject_id: number; chapter_id: number; lesson_id: number }, "class_id" | "book_id"> = {
        ...formData,
        grade_id: selectedGradeId,
        subject_id: selectedSubjectId,
        chapter_id: selectedChapterId,
        lesson_id: selectedLessonId,
        num_questions: formData.num_questions,
        num_answers: formData.num_answers,
        user_id: userId,
        selected_types: formData.selected_types,
        type_quantities: typeQuantities,
      }

      const apiEndpoint = "/api/generate-questions"
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Lỗi khi tạo câu hỏi")
      }

      const generatedData = await response.json()

      const exerciseId = generatedData.exercise?.id || generatedData.id
      if (!exerciseId) {
        throw new Error("Không nhận được ID bài tập từ server")
      }

      // Clear draft sau submit thành công
      localStorage.removeItem(STORAGE_KEY);

      router.push(`/exercises/${exerciseId}`)
      router.refresh()
    } catch (err: unknown) {
      setError((err as Error).message || "Lỗi khi tạo câu hỏi. Vui lòng thử lại.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const totalQuestions = formData.selected_types.reduce((sum, type) => {
      return sum + (typeQuantities[type] || 0)
    }, 0)

    setFormData((prev) => ({ ...prev, num_questions: totalQuestions }))
  }, [formData.selected_types, typeQuantities])

  const STORAGE_KEY = "question_form_draft"

  // Lưu draft mỗi khi state thay đổi (debounce nếu cần, nhưng simple là ok)
  useEffect(() => {
    if (initialData) return; // Không lưu nếu edit mode

    const dataToSave = {
      formData,
      typeQuantities,
      selectedGradeId,
      selectedSubjectId,
      selectedChapterId,
      selectedLessonId,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
  }, [
    formData,
    typeQuantities,
    selectedGradeId,
    selectedSubjectId,
    selectedChapterId,
    selectedLessonId,
    initialData,
  ])

  // Load draft SAU KHI grades fetch xong, để tránh race condition
  useEffect(() => {
    if (initialData) {
      // Edit mode: clear draft
      localStorage.removeItem(STORAGE_KEY);
      hasLoadedDraft.current = true;
      return;
    }

    if (hasLoadedDraft.current || grades.length === 0) return;

    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      hasLoadedDraft.current = true;
      return;
    }

    setIsLoadingDraft(true);
    try {
      const parsed = JSON.parse(saved);

      console.log("Loading draft from localStorage:", parsed); // Debug log

      // Set non-id fields trước (không trigger fetch)
      if (parsed.formData) {
        const newType = parsed.formData.selected_types?.length > 1 
          ? "mixed" 
          : (parsed.formData.selected_types?.[0] || "multiple_choice") as any
        setFormData(prev => ({
          ...prev,
          exercise_name: parsed.formData.exercise_name || prev.exercise_name,
          user_instructions: parsed.formData.user_instructions || prev.user_instructions,
          selected_types: parsed.formData.selected_types || prev.selected_types,
          num_questions: parsed.formData.num_questions || prev.num_questions,
          num_answers: parsed.formData.num_answers || prev.num_answers,
          difficulty: parsed.formData.difficulty || prev.difficulty,
          type: newType,
          // Reset generated fields
          topic: "",
          quantity: 0,
          number_of_answers: 0,
          description: "",
          question_text: "",
          emoji: "",
          question_type: "",
          answers: [],
          explanation: "",
        }));
      }
      if (parsed.typeQuantities) setTypeQuantities(parsed.typeQuantities)

      // Set selected ids (sẽ trigger fetch, nhưng isLoadingDraft = true nên không reset)
      if (parsed.selectedGradeId) setSelectedGradeId(parsed.selectedGradeId)
      if (parsed.selectedSubjectId) setSelectedSubjectId(parsed.selectedSubjectId)
      if (parsed.selectedChapterId) setSelectedChapterId(parsed.selectedChapterId)
      if (parsed.selectedLessonId) setSelectedLessonId(parsed.selectedLessonId)

      hasLoadedDraft.current = true;
      setIsLoadingDraft(false);
    } catch (err) {
      console.error("Lỗi load draft:", err)
      localStorage.removeItem(STORAGE_KEY);
      hasLoadedDraft.current = true;
      setIsLoadingDraft(false);
    }
  }, [grades, initialData]) // Dependency: grades array thay đổi khi fetch xong, initialData

  // Điều chỉnh difficulties
  const difficulties = ["Dễ", "Bình thường", "Khó"]

  // Labels động cho một số phần
  const exerciseNameLabel = "Tên Bài Tập *"
  const userInstructionsLabel = "Nội Dung Bài Học *"
  const questionTypeLabel = "Loại Câu Hỏi *"
  const totalQuestionsLabel = "Tổng Số Câu Hỏi"
  const difficultyLabel = "Độ Khó *"
  const numAnswersLabel = "Số Đáp Án (cho câu trắc nghiệm) *"
  const createButtonText = "Tạo Câu Hỏi"
  const loadingText = "Đang Tạo..."
  const cancelText = "Hủy"

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              Tạo Bài Tập Mới
            </h2>
            <p className="text-sm text-muted-foreground">
              Tạo bài tập tự động bằng AI cho học sinh THPT
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-2">
          <Label htmlFor="exercise_name" className="text-base font-medium">
            {exerciseNameLabel}
          </Label>
          <Input
            id="exercise_name"
            name="exercise_name"
            placeholder="VD: Kiểm tra 15 phút - Phương trình bậc 2"
            value={formData.exercise_name || ""}
            onChange={handleInputChange}
            disabled={isLoading}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lesson_name" className="text-base font-medium flex items-center gap-2">
            {userInstructionsLabel}
            <HoverCard>
              <HoverCardTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <p className="text-sm">
                  Mô tả chi tiết nội dung bài học để AI tạo câu hỏi phù hợp. VD: Phương trình bậc 2 - Công thức nghiệm, biệt thức delta, điều kiện có nghiệm...
                </p>
              </HoverCardContent>
            </HoverCard>
          </Label>
          <Textarea
            id="lesson_name"
            name="user_instructions"
            placeholder="VD: Chương 3 - Phương trình bậc 2: Công thức nghiệm, biệt thức delta, điều kiện có nghiệm..."
            value={formData.user_instructions || ""}
            onChange={handleInputChange}
            rows={4}
            disabled={isLoading}
            className="resize-none"
          />
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Chọn Khối lớp */}
          <div className="space-y-2">
            <Label htmlFor="grade_id" className="text-base font-medium">
              Khối Lớp *
            </Label>
            <select
              id="grade_id"
              name="grade_id"
              value={selectedGradeId}
              onChange={handleSelectChange}
              disabled={isLoading || !grades.length}
              className="w-full h-11 px-3 border border-input rounded-lg bg-background text-foreground font-medium"
            >
              <option value={0}>Chọn khối lớp...</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Môn học */}
          <div className="space-y-2">
            <Label htmlFor="subject_id" className="text-base font-medium">
              Môn Học *
            </Label>
            <select
              id="subject_id"
              name="subject_id"
              value={selectedSubjectId}
              onChange={handleSelectChange}
              disabled={isLoading || !subjects.length || !selectedGradeId}
              className="w-full h-11 px-3 border border-input rounded-lg bg-background text-foreground font-medium"
            >
              <option value={0}>Chọn môn học...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Chương */}
          <div className="space-y-2">
            <Label htmlFor="chapter_id" className="text-base font-medium">
              Chương *
            </Label>
            <select
              id="chapter_id"
              name="chapter_id"
              value={selectedChapterId}
              onChange={handleSelectChange}
              disabled={isLoading || !chapters.length || !selectedSubjectId}
              className="w-full h-11 px-3 border border-input rounded-lg bg-background text-foreground font-medium"
            >
              <option value={0}>Chọn chương...</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Bài học */}
          <div className="space-y-2">
            <Label htmlFor="lesson_id" className="text-base font-medium">
              Bài Học *
            </Label>
            <select
              id="lesson_id"
              name="lesson_id"
              value={selectedLessonId}
              onChange={handleSelectChange}
              disabled={isLoading || !lessons.length || !selectedChapterId}
              className="w-full h-11 px-3 border border-input rounded-lg bg-background text-foreground font-medium"
            >
              <option value={0}>Chọn bài học...</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title} {lesson.lesson_order ? `(Thứ tự: ${lesson.lesson_order})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-base font-medium flex items-center gap-2">
            {questionTypeLabel}
            <HoverCard>
              <HoverCardTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <p className="text-sm">
                  Chọn các dạng câu hỏi muốn tạo. Bạn có thể kết hợp nhiều loại trong một bài tập.
                </p>
              </HoverCardContent>
            </HoverCard>
          </Label>

          <div className="grid gap-4">
            {availableTypes.map((type) => {
              const selected = formData.selected_types.includes(type.value)
              const quantity = typeQuantities[type.value] || 0

              return (
                <div
                  key={type.value}
                  className={`border rounded-lg p-4 transition-all ${
                    selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      id={type.value}
                      checked={selected}
                      onCheckedChange={() => handleTypeChange(type.value)}
                      disabled={isLoading}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <label htmlFor={type.value} className="flex items-center gap-2 cursor-pointer">
                        <span className="text-2xl">{type.icon}</span>
                        <div>
                          <div className="font-medium text-foreground">{type.label}</div>
                          <div className="text-sm text-muted-foreground">{type.description}</div>
                        </div>
                      </label>

                      {selected && (
                        <div className="mt-4 flex items-center gap-3">
                          <Label className="text-sm font-medium min-w-fit">
                            Số câu hỏi:
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-lg bg-transparent"
                              onClick={() => decrementQuantity(type.value)}
                              disabled={isLoading || quantity <= 1}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={quantity}
                              onChange={(e) =>
                                setTypeQuantities((prev) => ({
                                  ...prev,
                                  [type.value]: Math.min(Math.max(Number.parseInt(e.target.value) || 1, 1), 50),
                                }))
                              }
                              className="w-20 h-9 text-center font-medium"
                              disabled={isLoading}
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-lg bg-transparent"
                              onClick={() => incrementQuantity(type.value)}
                              disabled={isLoading || quantity >= 50}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>

                            <span className="text-sm text-muted-foreground ml-1">
                              câu
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">{totalQuestionsLabel}</Label>
            <div className="relative">
              <Input
                type="number"
                value={formData.num_questions || 0}
                disabled
                className="h-11 bg-muted/30 cursor-not-allowed font-semibold text-lg"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-2 rounded">
                tự động
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tổng số câu = tổng các loại đã chọn
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty" className="text-base font-medium flex items-center gap-2">
              {difficultyLabel}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <p className="text-sm">
                    <strong>Dễ:</strong> Câu hỏi cơ bản<br/><strong>Bình thường:</strong> Câu hỏi trung bình<br/><strong>Khó:</strong> Câu hỏi nâng cao
                  </p>
                </HoverCardContent>
              </HoverCard>
            </Label>
            <select
              id="difficulty"
              name="difficulty"
              value={formData.difficulty || "Bình thường"}
              onChange={handleInputChange}
              disabled={isLoading}
              className="w-full h-11 px-3 border border-input rounded-lg bg-background text-foreground font-medium"
            >
              {difficulties.map((diff) => (
                <option key={diff} value={diff === "Bình thường" ? "Medium" : diff.toLowerCase()}>
                  {diff}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasMultipleChoice && (
          <div className="space-y-2">
            <Label htmlFor="num_answers" className="text-base font-medium flex items-center gap-2">
              {numAnswersLabel}
              <HoverCard>
                <HoverCardTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <p className="text-sm">
                    Số lượng đáp án cho câu hỏi trắc nghiệm nhiều lựa chọn (2-5 đáp án)
                  </p>
                </HoverCardContent>
              </HoverCard>
            </Label>
            <Input
              id="num_answers"
              type="number"
              name="num_answers"
              min={2}
              max={5}
              step={1}
              value={formData.num_answers || 4}
              onChange={handleInputChange}
              disabled={isLoading}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Từ 2 đến 5 đáp án
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="h-11 px-6 bg-transparent"
          >
            {cancelText}
          </Button>
          <Button type="submit" disabled={isLoading} className="h-11 px-8">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {loadingText}
              </>
            ) : (
              createButtonText
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}