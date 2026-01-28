"use client"

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Info, GraduationCap, BookOpen, Layers, FileText, CheckCircle2, AlertCircle, Trash2 } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Plus, Minus, ChevronDown, ChevronUp } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import type { QuestionFormData, InsertedQuestion, QuestionFormProps, Grade, Subject, Chapter, Lesson } from "@/types/question"
import { useUser } from "@/app/providers/UserProvider"
import { useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const availableTypes = [
  { value: "multiple_choice", label: "Trắc nghiệm nhiều lựa chọn", description: "Chọn 1 đáp án đúng", icon: "📝", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { value: "true_false", label: "Đúng/Sai", description: "Câu hỏi nhị phân", icon: "✓", color: "bg-green-500/10 text-green-600 border-green-200" },
  { value: "multiple_select", label: "Chọn nhiều đáp án", description: "Nhiều đáp án đúng", icon: "☑", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { value: "open_ended", label: "Tự luận", description: "Câu hỏi mở", icon: "✍", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
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
  
  // Thêm state để track khi nào fetch xong
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  
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
  const [showAdvanced, setShowAdvanced] = useState(false)

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
    if (!gradeId) {
      setSubjects([]);
      return;
    }
    
    setIsLoadingSubjects(true);
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
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  const fetchChapters = async (subjectId: number) => {
    if (!subjectId) {
      setChapters([]);
      return;
    }
    
    setIsLoadingChapters(true);
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
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const fetchLessons = async (chapterId: number) => {
    if (!chapterId) {
      setLessons([]);
      return;
    }
    
    setIsLoadingLessons(true);
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
    } finally {
      setIsLoadingLessons(false);
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
    } else {
      setSubjects([]);
      setSelectedSubjectId(0);
    }
  }, [selectedGradeId]);

  useEffect(() => {
    if (selectedSubjectId > 0) {
      fetchChapters(selectedSubjectId);
    } else {
      setChapters([]);
      setSelectedChapterId(0);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedChapterId > 0) {
      fetchLessons(selectedChapterId);
    } else {
      setLessons([]);
      setSelectedLessonId(0);
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

  // Lưu draft
  useEffect(() => {
    if (initialData) return;

    const timeoutId = setTimeout(() => {
      const dataToSave = {
        formData: {
          exercise_name: formData.exercise_name,
          user_instructions: formData.user_instructions,
          selected_types: formData.selected_types,
          num_questions: formData.num_questions,
          num_answers: formData.num_answers,
          difficulty: formData.difficulty,
        },
        typeQuantities,
        selectedGradeId,
        selectedSubjectId,
        selectedChapterId,
        selectedLessonId,
        timestamp: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    formData.exercise_name,
    formData.user_instructions,
    formData.selected_types,
    formData.num_questions,
    formData.num_answers,
    formData.difficulty,
    typeQuantities,
    selectedGradeId,
    selectedSubjectId,
    selectedChapterId,
    selectedLessonId,
    initialData,
  ]);

  // Load draft
  useEffect(() => {
    if (initialData || hasLoadedDraft.current) return;

    const loadDraft = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        hasLoadedDraft.current = true;
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        console.log("Loading draft from localStorage:", parsed);

        // Kiểm tra timestamp (xóa draft cũ hơn 24h)
        if (parsed.timestamp && Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEY);
          hasLoadedDraft.current = true;
          return;
        }

        // Set trạng thái cơ bản
        if (parsed.formData) {
          setFormData(prev => ({
            ...prev,
            exercise_name: parsed.formData.exercise_name || prev.exercise_name,
            user_instructions: parsed.formData.user_instructions || prev.user_instructions,
            selected_types: parsed.formData.selected_types || prev.selected_types,
            num_questions: parsed.formData.num_questions || prev.num_questions,
            num_answers: parsed.formData.num_answers || prev.num_answers,
            difficulty: parsed.formData.difficulty || prev.difficulty,
            type: parsed.formData.selected_types?.length > 1 
              ? "mixed" 
              : (parsed.formData.selected_types?.[0] || "multiple_choice"),
          }));
        }

        if (parsed.typeQuantities) {
          setTypeQuantities(parsed.typeQuantities);
        }

        // Set các ID đã chọn
        if (parsed.selectedGradeId) setSelectedGradeId(parsed.selectedGradeId);
        if (parsed.selectedSubjectId) setSelectedSubjectId(parsed.selectedSubjectId);
        if (parsed.selectedChapterId) setSelectedChapterId(parsed.selectedChapterId);
        if (parsed.selectedLessonId) setSelectedLessonId(parsed.selectedLessonId);

        hasLoadedDraft.current = true;
      } catch (err) {
        console.error("Lỗi load draft:", err);
        localStorage.removeItem(STORAGE_KEY);
        hasLoadedDraft.current = true;
      }
    };

    const timer = setTimeout(loadDraft, 100);
    return () => clearTimeout(timer);
  }, [initialData]);

  // Tính toán summary
  const selectedGrade = grades.find(g => g.id === selectedGradeId);
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedChapter = chapters.find(c => c.id === selectedChapterId);
  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  const totalQuestions = formData.num_questions;
  const selectedTypesCount = formData.selected_types.length;


  
const difficulties: {
  label: string
  value: "Easy" | "Medium" | "Hard"
  color: string
}[] = [
  { label: "Dễ", value: "Easy", color: "bg-green-500" },
  { label: "Vừa", value: "Medium", color: "bg-yellow-500" },
  { label: "Khó", value: "Hard", color: "bg-red-500" },
]


  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Tạo Bài Tập Mới
              </h1>
              <p className="text-muted-foreground mt-1">
                Tạo bài tập tự động bằng AI cho học sinh THPT
              </p>
            </div>
          </div>
          <Badge variant="outline" className="px-3 py-1.5 text-sm bg-blue-50">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tự động lưu bản nháp</span>
            </span>
          </Badge>
        </div>

        {/* Summary Card */}
        <Card className="mb-8 border-l-4 border-l-primary shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium mb-1">Khối lớp</span>
                <span className="font-medium text-foreground">
                  {selectedGrade ? selectedGrade.name : "Chưa chọn"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium mb-1">Môn học</span>
                <span className="font-medium text-foreground">
                  {selectedSubject ? selectedSubject.name : "Chưa chọn"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium mb-1">Chương</span>
                <span className="font-medium text-foreground">
                  {selectedChapter ? selectedChapter.title : "Chưa chọn"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-medium mb-1">Tổng câu hỏi</span>
                <span className="font-bold text-lg text-primary">
                  {totalQuestions} câu
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Thông tin cơ bản */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Thông tin bài tập</h3>
                  <p className="text-sm text-muted-foreground">Nhập thông tin cơ bản của bài tập</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="exercise_name" className="text-base font-medium flex items-center gap-2">
                    Tên Bài Tập *
                    <Badge variant="outline" className="text-xs px-2 py-0.5">Hiển thị cho học sinh</Badge>
                  </Label>
                  <Input
                    id="exercise_name"
                    name="exercise_name"
                    placeholder="VD: Kiểm tra 15 phút - Phương trình bậc 2"
                    value={formData.exercise_name || ""}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">Tên bài tập sẽ hiển thị cho học sinh khi làm bài</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lesson_name" className="text-base font-medium flex items-center gap-2">
                    Nội Dung Bài Học *
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Info className="w-4 h-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80">
                        <p className="text-sm">
                          Mô tả chi tiết nội dung bài học để AI tạo câu hỏi phù hợp. Càng chi tiết, câu hỏi càng chính xác.
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  </Label>
                  <Textarea
                    id="lesson_name"
                    name="user_instructions"
                    placeholder="Ví dụ: Bài học về phương trình bậc 2, công thức nghiệm, định lý Vi-et, ứng dụng trong giải toán..."
                    value={formData.user_instructions || ""}
                    onChange={handleInputChange}
                    rows={4}
                    disabled={isLoading}
                    className="resize-none text-base"
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>AI sẽ phân tích nội dung này để tạo câu hỏi phù hợp</span>
                    <span className="font-medium">{formData.user_instructions.length}/2000 ký tự</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phân loại bài học */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Phân loại bài học</h3>
                  <p className="text-sm text-muted-foreground">Chọn khối lớp, môn học, chương và bài học</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Khối lớp */}
                <div className="space-y-3">
                  <Label htmlFor="grade_id" className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Khối Lớp *
                  </Label>
                  <div className="relative">
                    <select
                      id="grade_id"
                      name="grade_id"
                      value={selectedGradeId}
                      onChange={handleSelectChange}
                      disabled={isLoading || !grades.length}
                      className="w-full h-12 px-4 pl-10 border border-input rounded-lg bg-background text-foreground font-medium appearance-none cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <option value={0}>Chọn khối lớp...</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Môn học */}
                <div className="space-y-3">
                  <Label htmlFor="subject_id" className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Môn Học *
                    {isLoadingSubjects && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  <div className="relative">
                    <select
                      id="subject_id"
                      name="subject_id"
                      value={selectedSubjectId}
                      onChange={handleSelectChange}
                      disabled={isLoading || !subjects.length || !selectedGradeId || isLoadingSubjects}
                      className="w-full h-12 px-4 pl-10 border border-input rounded-lg bg-background text-foreground font-medium appearance-none cursor-pointer hover:border-primary/50 transition-colors disabled:cursor-not-allowed"
                    >
                      <option value={0}>Chọn môn học...</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Chương */}
                <div className="space-y-3">
                  <Label htmlFor="chapter_id" className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Chương *
                    {isLoadingChapters && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  <div className="relative">
                    <select
                      id="chapter_id"
                      name="chapter_id"
                      value={selectedChapterId}
                      onChange={handleSelectChange}
                      disabled={isLoading || !chapters.length || !selectedSubjectId || isLoadingChapters}
                      className="w-full h-12 px-4 pl-10 border border-input rounded-lg bg-background text-foreground font-medium appearance-none cursor-pointer hover:border-primary/50 transition-colors disabled:cursor-not-allowed"
                    >
                      <option value={0}>Chọn chương...</option>
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Layers className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Bài học */}
                <div className="space-y-3">
                  <Label htmlFor="lesson_id" className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Bài Học *
                    {isLoadingLessons && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  <div className="relative">
                    <select
                      id="lesson_id"
                      name="lesson_id"
                      value={selectedLessonId}
                      onChange={handleSelectChange}
                      disabled={isLoading || !lessons.length || !selectedChapterId || isLoadingLessons}
                      className="w-full h-12 px-4 pl-10 border border-input rounded-lg bg-background text-foreground font-medium appearance-none cursor-pointer hover:border-primary/50 transition-colors disabled:cursor-not-allowed"
                    >
                      <option value={0}>Chọn bài học...</option>
                      {lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                          {lesson.lesson_order && ` (Bài ${lesson.lesson_order})`}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Thông tin đã chọn */}
              {(selectedGrade || selectedSubject || selectedChapter || selectedLesson) && (
                <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex flex-wrap gap-2">
                    {selectedGrade && (
                      <Badge variant="secondary" className="px-3 py-1.5">
                        <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
                        {selectedGrade.name}
                      </Badge>
                    )}
                    {selectedSubject && (
                      <Badge variant="secondary" className="px-3 py-1.5">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                        {selectedSubject.name}
                      </Badge>
                    )}
                    {selectedChapter && (
                      <Badge variant="secondary" className="px-3 py-1.5">
                        <Layers className="w-3.5 h-3.5 mr-1.5" />
                        {selectedChapter.title}
                      </Badge>
                    )}
                    {selectedLesson && (
                      <Badge variant="secondary" className="px-3 py-1.5">
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        {selectedLesson.title}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loại câu hỏi */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-lg">📝</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Loại câu hỏi</h3>
                  <p className="text-sm text-muted-foreground">Chọn các dạng câu hỏi muốn tạo (có thể chọn nhiều)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {availableTypes.map((type) => {
                  const selected = formData.selected_types.includes(type.value)
                  const quantity = typeQuantities[type.value] || 0

                  return (
                    <div
                      key={type.value}
                      className={`border-2 rounded-xl p-5 transition-all duration-200 ${
                        selected 
                          ? `${type.color.split(' ')[0]} border-2 border-primary shadow-md` 
                          : "border-border hover:border-primary/30 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${type.color.split(' ')[0]}`}>
                            <span className="text-2xl">{type.icon}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <label htmlFor={type.value} className="font-semibold text-foreground text-base cursor-pointer">
                                {type.label}
                              </label>
                              <Checkbox
                                id={type.value}
                                checked={selected}
                                onCheckedChange={() => handleTypeChange(type.value)}
                                disabled={isLoading}
                                className="h-5 w-5"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{type.description}</p>
                            
                            {selected && (
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">
                                    Số câu hỏi:
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 w-9 rounded-lg"
                                      onClick={() => decrementQuantity(type.value)}
                                      disabled={isLoading || quantity <= 1}
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </Button>

                                    <div className="relative">
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
                                        className="w-20 h-9 text-center font-medium text-base"
                                        disabled={isLoading}
                                      />
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9 w-9 rounded-lg"
                                      onClick={() => incrementQuantity(type.value)}
                                      disabled={isLoading || quantity >= 50}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                  <span>Mỗi loại từ 1-50 câu</span>
                                  <span className="font-medium">{quantity} câu</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tổng số câu hỏi */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-xl">📊</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">Tổng số câu hỏi</h4>
                      <p className="text-sm text-muted-foreground">Tự động tính từ số lượng các loại đã chọn</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">{totalQuestions}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedTypesCount} loại câu hỏi
                    </div>
                  </div>
                </div>
                {selectedTypesCount > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {formData.selected_types.map(type => {
                      const typeInfo = availableTypes.find(t => t.value === type);
                      return (
                        <div key={type} className="flex items-center justify-between p-2 bg-white rounded-lg border">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{typeInfo?.icon}</span>
                            <span className="text-sm font-medium">{typeInfo?.label.split(' ')[0]}</span>
                          </span>
                          <span className="font-bold text-primary">{typeQuantities[type] || 0}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cài đặt nâng cao */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <span className="text-lg">⚙️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Cài đặt nâng cao</h3>
                    <p className="text-sm text-muted-foreground">Tùy chỉnh độ khó và số đáp án</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="gap-2"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showAdvanced ? "Ẩn cài đặt" : "Hiển thị cài đặt"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Độ khó */}
                    <div className="space-y-3">
                      <Label htmlFor="difficulty" className="text-base font-medium flex items-center gap-2">
                        Độ Khó *
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Info className="w-4 h-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 border-green-200">Dễ</Badge>
                                <span className="text-sm">Câu hỏi cơ bản, kiểm tra kiến thức nền tảng</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Bình thường</Badge>
                                <span className="text-sm">Câu hỏi trung bình, phù hợp với đa số học sinh</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-red-100 text-red-800 border-red-200">Khó</Badge>
                                <span className="text-sm">Câu hỏi nâng cao, yêu cầu tư duy và phân tích</span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {difficulties.map((diff) => (
                          <Button
                            key={diff.value}
                            type="button"
                            variant={formData.difficulty?.toLowerCase() === diff.value.toLowerCase() ? "default" : "outline"}
                            onClick={() => setFormData(prev => ({ ...prev, difficulty: diff.value }))}
                            disabled={isLoading}
                            className={`h-11 ${formData.difficulty?.toLowerCase() === diff.value.toLowerCase() ? diff.color : ''}`}
                          >
                            {diff.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Số đáp án cho trắc nghiệm */}
                    {hasMultipleChoice && (
                      <div className="space-y-3">
                        <Label htmlFor="num_answers" className="text-base font-medium flex items-center gap-2">
                          Số Đáp Án *
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                              <p className="text-sm">
                                Số lượng đáp án cho câu hỏi trắc nghiệm nhiều lựa chọn. 
                                <br/>• 2-3 đáp án: Dễ chọn
                                <br/>• 4 đáp án: Tiêu chuẩn
                                <br/>• 5 đáp án: Phân loại tốt hơn
                              </p>
                            </HoverCardContent>
                          </HoverCard>
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Input
                              id="num_answers"
                              type="range"
                              name="num_answers"
                              min={2}
                              max={5}
                              step={1}
                              value={formData.num_answers || 4}
                              onChange={handleInputChange}
                              disabled={isLoading}
                              className="h-2 cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              {[2, 3, 4, 5].map(num => (
                                <span key={num} className={`font-medium ${formData.num_answers === num ? 'text-primary' : ''}`}>
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="w-16">
                            <Input
                              type="number"
                              min={2}
                              max={5}
                              step={1}
                              value={formData.num_answers || 4}
                              onChange={handleInputChange}
                              disabled={isLoading}
                              className="h-11 text-center text-lg font-bold"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Từ 2 đến 5 đáp án cho mỗi câu trắc nghiệm
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Thông báo lỗi */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-destructive font-medium">{error}</p>
              <p className="text-sm text-muted-foreground mt-1">Vui lòng kiểm tra lại thông tin đã nhập</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4" />
            <span>Bản nháp tự động lưu mỗi 0.5 giây</span>
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setFormData({
                  ...formData,
                  exercise_name: "",
                  user_instructions: "",
                  selected_types: ["multiple_choice"],
                  num_questions: 5,
                  num_answers: 4,
                  difficulty: "Medium",
                });
                setTypeQuantities({
                  multiple_choice: 5,
                  true_false: 0,
                  multiple_select: 0,
                  open_ended: 0,
                });
                setSelectedGradeId(0);
                setSelectedSubjectId(0);
                setSelectedChapterId(0);
                setSelectedLessonId(0);
                setError("");
              }}
              disabled={isLoading}
              className="h-11 px-6 gap-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              Xóa bản nháp
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="h-11 px-6"
            >
              Hủy
            </Button>
            
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="h-11 px-8 gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang tạo câu hỏi...
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" />
                  Tạo Bài Tập Ngay
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}