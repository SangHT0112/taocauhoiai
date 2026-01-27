import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Tier } from '@/types/tier'

interface PricingCardProps {
  tier: Tier
  isHovered: boolean
  isPopular?: boolean
  billingCycle: 'monthly' | 'yearly'
  formatPrice: (price: number) => string
}

export default function PricingCard({
  tier,
  isHovered,
  isPopular,
  billingCycle,
  formatPrice
}: PricingCardProps) {
  const displayPrice = billingCycle === 'yearly' 
    ? Math.floor(tier.price * 12 * 0.8)
    : tier.price

  return (
    <div
      className={`relative rounded-xl border transition-all duration-300 overflow-hidden h-full ${
        isPopular
          ? 'border-accent bg-accent/5 shadow-lg shadow-accent/20 scale-105'
          : isHovered
            ? 'border-primary/50 bg-secondary/50'
            : 'border-border bg-card hover:border-primary/30'
      }`}
    >
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold mb-2">{tier.tier_name}</h3>
          <p className="text-muted-foreground mb-4">{tier.description}</p>

          {/* Price */}
          <div className="mb-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">
                {tier.price === 0 ? 'Miễn phí' : formatPrice(displayPrice)}
              </span>
              {tier.price > 0 && (
                <span className="text-muted-foreground">
                  /{billingCycle === 'monthly' ? 'tháng' : 'năm'}
                </span>
              )}
            </div>
            {tier.price > 0 && billingCycle === 'yearly' && (
              <p className="text-xs text-accent mt-1">
                (Tiết kiệm {formatPrice(Math.floor(tier.price * 12 * 0.2))}/năm)
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 p-4 bg-secondary/50 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bài kiểm tra:</span>
              <span className="font-semibold">{tier.max_tests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Câu hỏi:</span>
              <span className="font-semibold">{tier.max_questions}</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          className="w-full mb-8"
          variant={isPopular ? 'default' : 'outline'}
          size="lg"
        >
          {tier.tier_name === 'Free' ? 'Bắt đầu ngay' : 'Chọn gói này'}
        </Button>

        {/* Features */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tính năng bao gồm
          </p>
          <ul className="space-y-3">
            {tier.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
