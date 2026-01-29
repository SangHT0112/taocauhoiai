// app/layout.tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Header from "@/components/layout/Header"
import Sidebar from "@/components/layout/Sidebar"
import { getExercisesByUser } from "@/lib/services/exerciseService"

import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import "../globals.css";
// Import Provider mới
import { UserProvider } from "../providers/UserProvider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Q-GEN AI - Ôn tập thông minh",
  description: "Ứng dụng ôn tập thông minh hỗ trợ học tập bằng AI",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value

  if (!token) redirect("/login")

  let userId: number

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { userId: number }

    userId = decoded.userId
  } catch {
    redirect("/login")
  }

  const exercises = await getExercisesByUser(userId)

  return (
      <html lang="vi">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {/* Wrap UserProvider Ở ĐÂY – Bao Quát TOÀN BỘ Nội Dung */}
          <UserProvider userId={userId}>
            {/* ROOT */}
            <div className="h-screen flex flex-col overflow-hidden">

              {/* HEADER – Giờ Có Provider */}
              <Header />

              {/* CONTENT */}
              <div className="flex flex-1 min-h-0">

                {/* SIDEBAR – Giờ Có Provider */}
                {/* <Sidebar exercises={exercises} /> */}

                {/* MAIN SCROLL – Không cần wrap lại */}
                <main className="flex-1 min-h-0 overflow-y-auto">
                  {children}
                </main>

              </div>
            </div>
          </UserProvider>
        </body>
      </html>
    )
  }