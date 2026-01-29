// components/layout/Header.tsx
"use client"

import { useState } from "react"
import useSWR from "swr"
import { Bell, Home, FileText, Settings, LogOut, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"  // Nếu dùng notifications
import Link from "next/link"
import { useRouter } from "next/navigation"  // Import mới cho logout mượt
import { useUser } from "@/app/providers/UserProvider"  // Adjust path nếu cần

// Fetcher cho SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Interface match API response (dựa trên schema DB)
interface UserInfo {
  id: number
  username: string
  email: string
  role: string  // "admin", "tenant", hoặc "1"
  google_id: string
  is_active: number
  created_at: Date
  updated_at: Date
  tier_id: number
}

export default function Header() {
  const { userId } = useUser()
  const router = useRouter()  // Cho logout
  
  // Fetch user info từ API
  const { data: user, error, isLoading } = useSWR<UserInfo>(
    userId ? `/api/users/${userId}` : null,
    fetcher
  )

  // DEBUG: Log để check data (xóa sau khi test OK)
  console.log('Debug - userId:', userId)
  console.log('Debug - User data:', user)
  console.log('Debug - Error:', error)

  const [notifications] = useState([
    { id: 1, title: "Bài tập mới", time: "5 phút trước" },
    { id: 2, title: "Bạn có 3 bài tập chưa hoàn thành", time: "1 giờ trước" },
  ])

  // Map role thành label tiếng Việt (adjust theo data thực)
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
      case "1":
        return "Quản trị viên"
      default:
        return "Giáo viên"
    }
  }

  // Logout function
  const handleLogout = () => {
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/login");  // SPA redirect mượt hơn
  }

  // Loading state
  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Q-GEN AI
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      </header>
    )
  }

  // Error state: Fallback + redirect nếu cần
  if (error || !user) {
    console.error("Error fetching user:", error)
    // Tự redirect sau 2s nếu error (hoặc dùng useEffect)
    setTimeout(() => router.push("/login"), 2000)
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo & Nav giữ nguyên */}
          <div className="flex items-center gap-6">
            <Link href="/">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600" />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Q-GEN AI
                </span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Button variant="ghost" className="gap-2">
                <Home className="h-4 w-4" />
                Trang chủ
              </Button>
              <Button variant="ghost" className="gap-2">
                <FileText className="h-4 w-4" />
                Bài tập
              </Button>
              <Button variant="ghost" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Đăng ký gói
              </Button>
            </nav>
          </div>

          {/* Fallback profile */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="block">  {/* Thay hidden md:block → block để luôn hiển thị */}
                <p className="text-sm font-semibold">Lỗi tải dữ liệu</p>
                <p className="text-xs text-muted-foreground">Đang chuyển hướng...</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
    )
  }

  // Success: Render với data từ DB
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left side - Logo and navigation (giữ nguyên) */}
        <div className="flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Q-GEN AI
              </span>
            </div>
          </Link>
          
      <nav className="hidden md:flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Home className="h-4 w-4" />
          <span>Trang chủ</span>
        </Link>

        <Link href="/exercises" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>Bài tập</span>
        </Link>

        <Link href="/pricing" className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          <span>Đăng ký gói</span>
        </Link>
      </nav>

        </div>

        {/* Right side - User actions */}
        <div className="flex items-center gap-4">
          {/* Notifications (uncomment nếu cần) */}
          {/* <div className="relative">...</div> */}

          {/* User profile - Động từ DB + THÊM EMAIL + AVATAR ĐẦY ĐỦ */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">  {/* Thêm class size nhỏ */}
              <AvatarImage src="https://github.com/shadcn.png" />  {/* Default */}
             <AvatarFallback>
                {user?.username?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>

            </Avatar>
            <div className="block">
              <p className="text-sm font-semibold truncate">{user.username}</p>  {/* Truncate nếu dài */}
              <p className="text-xs text-muted-foreground">
                {getRoleLabel(user.role)}
              </p>
              {/* THÊM EMAIL Ở ĐÂY - Hiển thị nhỏ hoặc tooltip nếu cần */}
              <p className="text-xs text-muted-foreground truncate">
                {user.email}  {/* e.g., "huynhtsang2004@gmail.com" */}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}