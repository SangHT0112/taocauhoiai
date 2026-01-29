'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Zap, Star, Sparkles, X } from 'lucide-react'
import PricingCard from '@/components/pricing/pricing-card'
import PricingHeader from '@/components/pricing/pricing-header'
import Pusher from 'pusher-js'
import Swal from 'sweetalert2'

export interface Tier {
  id: number
  tier_name: string
  price: number
  max_tests: number
  max_questions: number
  description: string
  features: string[]
  isPopular?: boolean
}

interface Subscription {
  tier_id: number
  tier_name: string
  status: string
  end_date: string
}

export default function PricingPage() {
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)
  const [pricingTiers, setPricingTiers] = useState<Tier[]>([])
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingTier, setPendingTier] = useState<Tier | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<{
    amount: number
    description: string
    vietqrUrl: string
  } | null>(null)

  // Lấy userId từ token
  const [userId, setUserId] = useState<number | null>(null)

  const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price)

  // Lấy userId từ cookie token
  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUserId(payload.userId)
      } catch {}
    }
  }, [])

  // Pusher realtime
  useEffect(() => {
    if (!userId) return

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      authEndpoint: '/api/pusher/auth', // <-- thêm dòng này
      auth: {
        headers: {
          'Authorization': `Bearer ${document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] || ''}`
        }
      }
    })

    const channel = pusher.subscribe(`private-user-${userId}`)

    channel.bind('pusher:subscription_succeeded', () => {
      console.log(`Subscribed thành công: private-user-${userId}`)
    })

    // channel.bind('pusher:subscription_error', (err) => {
    //   console.error('Subscription error:', err)
    // })

    channel.bind('payment_success', (data: any) => {
      console.log('Nhận event payment_success:', data)
      Swal.fire({
        title: '🎉 Thanh toán thành công!',
        text: data.message || 'Gói của bạn đã được kích hoạt!',
        icon: 'success',
        confirmButtonText: 'OK'
      }).then(() => {
        fetch('/api/user-subscriptions', { credentials: 'include' })
          .then(res => res.json())
          .then(sub => setCurrentSubscription(sub.subscription || null))
      })
    })

    return () => {
      channel.unbind_all()
      channel.unsubscribe()
      pusher.disconnect()
    }
  }, [userId])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        const tiersRes = await fetch('/api/pricing-tiers', { cache: 'no-store' })
        if (!tiersRes.ok) throw new Error('Lỗi tải gói')
        setPricingTiers(await tiersRes.json())

        const subRes = await fetch('/api/user-subscriptions', { credentials: 'include', cache: 'no-store' })
        if (subRes.ok) {
          const subData = await subRes.json()
          setCurrentSubscription(subData.subscription || null)
        }
      } catch (err: any) {
        setError(err.message || 'Không thể tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleUpgrade = (tier: Tier) => {
    if (currentSubscription?.tier_id === tier.id) {
      alert('Bạn đang sử dụng gói này')
      return
    }

    const amount = selectedBillingCycle === 'yearly'
      ? Math.round(tier.price * 12 * 0.8)
      : tier.price

    const description = `Nang cap goi ${tier.tier_name} user ${userId || 'unknown'}`

    const bank_id = "KLB"
    const account_no = "101499100004323939"
    const account_name = "KhoaHocOnline"
    const template = "compact2"

    const vietqrUrl = `https://img.vietqr.io/image/${bank_id}-${account_no}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(account_name)}`

    setPendingTier(tier)
    setPaymentInfo({ amount, description, vietqrUrl })
    setShowPaymentModal(true)
  }

  const confirmPayment = async () => {
    if (!pendingTier) return

    try {
      const res = await fetch('/api/pricing-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier_id: pendingTier.id, billing_cycle: selectedBillingCycle }),
        credentials: 'include'
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Kích hoạt gói thất bại')
      }

      const data = await res.json()
      alert(data.message || 'Yêu cầu kích hoạt đã được gửi! Chờ xác nhận thanh toán.')

      setShowPaymentModal(false)
      setPendingTier(null)
      setPaymentInfo(null)
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối')
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>

  return (
    <main className="min-h-screen bg-background">
      <PricingHeader />

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-2 bg-secondary p-1 rounded-full border border-border">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  selectedBillingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:text-foreground/80'
                }`}
              >
                Hàng tháng
              </button>
              <button
                onClick={() => setSelectedBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  selectedBillingCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:text-foreground/80'
                }`}
              >
                Hàng năm
                <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                  Tiết kiệm 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier) => {
              const isActive = currentSubscription?.tier_id === tier.id
              const isPopular = tier.isPopular

              return (
                <div
                  key={tier.id}
                  onMouseEnter={() => setHoveredCard(tier.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className={`relative transition-all duration-300 ${
                    isActive ? 'ring-2 ring-primary scale-[1.02]' : ''
                  }`}
                >
                  {isActive && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1 bg-green-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                        <Check className="w-4 h-4" />
                        Đang sử dụng
                      </span>
                    </div>
                  )}

                  {isPopular && !isActive && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-4 py-1 rounded-full text-sm font-semibold">
                        <Star className="w-4 h-4" />
                        Phổ biến nhất
                      </span>
                    </div>
                  )}

                  <PricingCard
                    tier={tier}
                    isHovered={hoveredCard === tier.id}
                    isPopular={isPopular}
                    billingCycle={selectedBillingCycle}
                    formatPrice={formatPrice}
                  />

                  <div className="mt-4 px-6 pb-6">
                    {isActive ? (
                      <Button variant="outline" disabled className="w-full">
                        Đang sử dụng
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(tier)}
                        className="w-full"
                        variant={tier.id === 1 ? "secondary" : "default"}
                      >
                        {tier.id === 1 ? 'Đăng ký miễn phí' : 'Nâng cấp ngay'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Modal VietQR */}
      {showPaymentModal && paymentInfo && pendingTier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden">
            <button
              onClick={() => {
                setShowPaymentModal(false)
                setPendingTier(null)
                setPaymentInfo(null)
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10"
            >
              <X size={28} />
            </button>

            <div className="p-8 text-center">
              <h3 className="text-2xl font-bold text-blue-700 mb-4">
                Thanh toán nâng cấp gói {pendingTier.tier_name}
              </h3>

              <p className="text-gray-700 mb-6">
                Vui lòng quét mã VietQR để thanh toán <br />
                <span className="font-bold text-green-600 text-2xl block mt-2">
                  {formatPrice(paymentInfo.amount)}
                </span>
              </p>

              <img
                src={paymentInfo.vietqrUrl}
                alt="Mã VietQR thanh toán"
                className="mx-auto w-64 rounded-lg shadow-md border mb-6"
              />

              <div className="text-sm text-gray-600 mb-6 space-y-2">
                <p><strong>Ngân hàng:</strong> Kien Long Bank</p>
                <p><strong>Số TK:</strong> 101499100004323939</p>
                <p><strong>Chủ TK:</strong> KhoaHocOnline</p>
                <p><strong>Nội dung CK:</strong> <br />
                  <code className="bg-gray-100 px-2 py-1 rounded">{paymentInfo.description}</code>
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={confirmPayment}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-6"
                >
                  Tôi đã chuyển khoản xong
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPendingTier(null)
                    setPaymentInfo(null)
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}