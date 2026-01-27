"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from "@react-oauth/google"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

      /* ✅ Backend đã set cookie token */
      router.push("/") // hoặc redirectAfterLogin
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi kết nối server"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur border-white/20">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl text-white">Đăng nhập</CardTitle>
            <CardDescription className="text-gray-300">
              Sử dụng Google để tiếp tục
            </CardDescription>
          </CardHeader>

          {errorMessage && (
            <div className="mx-4 mb-4 p-3 bg-red-500/20 text-red-300 rounded">
              {errorMessage}
            </div>
          )}

          <CardContent className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMessage("Đăng nhập Google thất bại")}
            />
          </CardContent>
        </Card>
      </div>
    </GoogleOAuthProvider>
  )
}
