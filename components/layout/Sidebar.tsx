// components/layout/sidebar.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, BookOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Exercise } from "@/types/question"

export default function Sidebar({
  exercises,
}: {
  exercises: Exercise[]
}) {
  const [searchQuery, setSearchQuery] = useState("")

  /* 🔍 Filter theo search */
  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) =>
      ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      // ex.lesson_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [exercises, searchQuery])

  return (
    <aside className="hidden lg:flex flex-col w-80 border-r bg-white h-screen">
      {/* ===== Header ===== */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold">Danh sách bài tập</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý các bộ câu hỏi của bạn
        </p>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm bài tập..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ===== Content ===== */}
      <ScrollArea className="flex-1 p-4">
        {filteredExercises.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Không có bài tập nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExercises.map((exercise) => (
              <Link
                key={exercise.id}
                href={`/exercises/${exercise.id}`}
                className="block p-4 rounded-lg border hover:border-blue-400 hover:shadow transition"
              >
                <h4 className="font-semibold line-clamp-1">
                  {exercise.name}
                </h4>

                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  {/* <p>Bài học: {exercise.lesson_name}</p> */}
                  <p>Loại: {exercise.type}</p>
                  <p>Số câu: {exercise.num_questions}</p>
                  <p>Độ khó: {exercise.difficulty}</p>
                </div>

                <div className="mt-2">
                  <Badge variant="secondary">
                    {new Date(exercise.created_at).toLocaleDateString("vi-VN")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ===== Footer ===== */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tổng: {exercises.length} bài tập
          </span>

          <Button variant="outline" size="sm" asChild>
            <Link href="/exercises">Xem tất cả</Link>
          </Button>
        </div>
      </div>
    </aside>
  )
}
