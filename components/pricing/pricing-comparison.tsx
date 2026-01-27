'use client'

import { Check, X } from 'lucide-react'
import type { Tier } from '@/types/tier'

interface PricingComparisonProps {
  tiers: Tier[]
}

const comparisonFeatures = [
  { name: 'Số lượng bài kiểm tra', free: '3', basic: '10', pro: '50' },
  { name: 'Số lượng câu hỏi', free: '30', basic: '100', pro: '500' },
  { name: 'Tất cả loại câu hỏi', free: false, basic: true, pro: true },
  { name: 'Tải xuống PDF', free: true, basic: true, pro: true },
  { name: 'Phân tích chi tiết', free: false, basic: true, pro: true },
  { name: 'Xuất dữ liệu nâng cao', free: false, basic: true, pro: true },
  { name: 'AI tạo câu hỏi', free: false, basic: false, pro: true },
  { name: 'Quản lý nhóm', free: false, basic: false, pro: true },
  { name: 'API truy cập', free: false, basic: false, pro: true },
  { name: 'Hỗ trợ ưu tiên', free: false, basic: true, pro: true },
  { name: 'Hỗ trợ 24/7', free: false, basic: false, pro: true },
]

export default function PricingComparison({ tiers }: PricingComparisonProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            <th className="px-6 py-4 text-left font-semibold text-foreground">Tính năng</th>
            {tiers.map((tier) => (
              <th
                key={tier.id}
                className="px-6 py-4 text-center font-semibold text-foreground min-w-[150px]"
              >
                {tier.tier_name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonFeatures.map((feature, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}
            >
              <td className="px-6 py-4 text-foreground font-medium border-r border-border">
                {feature.name}
              </td>
              {tiers.map((tier) => {
                const tierKey = tier.tier_name.toLowerCase() as 'free' | 'basic' | 'pro'
                const value = feature[tierKey as keyof typeof feature]

                return (
                  <td key={tier.id} className="px-6 py-4 text-center">
                    {typeof value === 'boolean' ? (
                      value ? (
                        <Check className="w-5 h-5 text-accent mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground mx-auto" />
                      )
                    ) : (
                      <span className="font-semibold text-foreground">{value}</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
