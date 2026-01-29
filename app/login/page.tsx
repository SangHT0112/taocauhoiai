"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google"
import { Button } from "@/components/ui/button"
import { Shield, Zap } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || "Đăng nhập thất bại")
      }

      router.push("/")
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi kết nối máy chủ"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div className="min-h-screen bg-gradient-to-br from-white via-white to-slate-50 flex items-center justify-center px-4 py-12">
        
        {/* LEFT - GIỚI THIỆU */}
        <div className="hidden lg:flex flex-col justify-center items-start w-1/2 pr-12 max-w-2xl">
          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 mb-6">
                <Zap className="w-6 h-6 text-white" />
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                Tạo câu hỏi bằng AI
              </h1>

              <p className="text-lg text-gray-600">
                Công cụ hỗ trợ giáo viên tiểu học tạo câu hỏi, đề kiểm tra
                và xuất file Word nhanh chóng, dễ sử dụng.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: <Zap className="w-5 h-5" />,
                  title: "Tạo câu hỏi tự động",
                  desc: "Sinh câu hỏi theo bài học, phù hợp chương trình tiểu học",
                },
                {
                  icon: <Shield className="w-5 h-5" />,
                  title: "Dễ dùng & an toàn",
                  desc: "Không cần kỹ thuật, bảo mật thông tin giáo viên",
                },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600">
              Chưa có tài khoản?{" "}
              <span className="text-purple-600 font-semibold cursor-pointer hover:underline">
                Đăng ký ngay
              </span>
            </p>
          </div>
        </div>

        {/* RIGHT - ĐĂNG NHẬP */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white rounded-3xl shadow-lg p-8 md:p-10">
            
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Đăng nhập hệ thống
              </h2>
              <p className="text-gray-600">
                Tạo đề bài và xuất file Word cho học sinh
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="mb-6 flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  setErrorMessage("Đăng nhập bằng Google thất bại")
                }
              />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
             
            </div>

        

            
          </div>

          <div className="lg:hidden text-center mt-8 text-sm text-gray-600">
            Công cụ AI hỗ trợ giáo viên tiểu học tạo đề kiểm tra
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  )
}
