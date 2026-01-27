'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Zap, Star, Sparkles } from 'lucide-react'
import PricingCard from '@/components/pricing/pricing-card'
import PricingHeader from '@/components/pricing/pricing-header'
import PricingComparison from '@/components/pricing/pricing-comparison'

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

const pricingTiers: Tier[] = [
  {
    id: 1,
    tier_name: 'Free',
    price: 0,
    max_tests: 3,
    max_questions: 30,
    description: 'Hoàn hảo để bắt đầu',
    features: [
      'Tạo tối đa 3 bài kiểm tra',
      'Tối đa 30 câu hỏi',
      'Hỗ trợ các loại câu hỏi cơ bản',
      'Tải xuống kết quả PDF',
      'Hỗ trợ cộng đồng'
    ],
    isPopular: false
  },
  {
    id: 2,
    tier_name: 'Basic',
    price: 99000,
    max_tests: 10,
    max_questions: 100,
    description: 'Cho những người học tập',
    features: [
      'Tạo tối đa 10 bài kiểm tra',
      'Tối đa 100 câu hỏi',
      'Tất cả các loại câu hỏi',
      'Phân tích chi tiết kết quả',
      'Xuất dữ liệu nâng cao',
      'Hỗ trợ ưu tiên'
    ],
    isPopular: true
  },
  {
    id: 3,
    tier_name: 'Pro',
    price: 199000,
    max_tests: 50,
    max_questions: 500,
    description: 'Cho chuyên gia và tổ chức',
    features: [
      'Tạo tối đa 50 bài kiểm tra',
      'Tối đa 500 câu hỏi',
      'AI tạo câu hỏi tự động',
      'Quản lý nhóm người dùng',
      'Báo cáo thống kê nâng cao',
      'API truy cập',
      'Hỗ trợ 24/7 chuyên dụng'
    ],
    isPopular: false
  }
]

export default function PricingPage() {
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price)
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header Section */}
      <PricingHeader />

      {/* Pricing Cards Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-2 bg-secondary p-1 rounded-full border border-border">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:text-foreground/80'
                }`}
              >
                Hàng tháng
              </button>
              <button
                onClick={() => setSelectedBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  selectedBillingCycle === 'yearly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:text-foreground/80'
                }`}
              >
                Hàng năm
                <span className="ml-2 text-xs bg-accent text-accent-foreground px-2 py-1 rounded-full">
                  Tiết kiệm 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier) => (
              <div
                key={tier.id}
                onMouseEnter={() => setHoveredCard(tier.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className="relative"
              >
                {tier.isPopular && (
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
                  isPopular={tier.isPopular}
                  billingCycle={selectedBillingCycle}
                  formatPrice={formatPrice}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Bảng so sánh</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            So sánh chi tiết các tính năng giữa các gói để chọn lựa phù hợp nhất
          </p>
          <PricingComparison tiers={pricingTiers} />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Các câu hỏi thường gặp</h2>
          <div className="space-y-6">
            {[
              {
                q: 'Tôi có thể thay đổi gói của mình bất kỳ lúc nào không?',
                a: 'Có, bạn có thể nâng cấp hoặc hạ cấp gói của mình bất kỳ lúc nào. Bất kỳ thay đổi nào sẽ có hiệu lực ngay lập tức.'
              },
              {
                q: 'Bạn có hỗ trợ hoàn tiền không?',
                a: 'Chúng tôi cung cấp hoàn tiền 30 ngày nếu bạn không hài lòng với dịch vụ của chúng tôi.'
              },
              {
                q: 'Dữ liệu của tôi có an toàn không?',
                a: 'Có, tất cả dữ liệu của bạn được mã hóa và lưu trữ an toàn trên các máy chủ đáng tin cậy.'
              },
              {
                q: 'Có gói doanh nghiệp không?',
                a: 'Có, chúng tôi cung cấp các gói tùy chỉnh cho doanh nghiệp. Vui lòng liên hệ với chúng tôi để biết thêm chi tiết.'
              }
            ].map((item, idx) => (
              <div key={idx} className="border border-border rounded-lg p-6 hover:bg-secondary/50 transition-colors">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  {item.q}
                </h3>
                <p className="text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Sẵn sàng bắt đầu?</h2>
          <p className="text-lg opacity-90 mb-8">
            Tham gia hàng nghìn người dùng đang sử dụng nền tảng của chúng tôi
          </p>
          <Button
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            Bắt đầu miễn phí
          </Button>
        </div>
      </section>
    </main>
  )
}
