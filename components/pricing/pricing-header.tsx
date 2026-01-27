import { Sparkles } from 'lucide-react'

export default function PricingHeader() {
  return (
    <section className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full mb-6">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">Giá cả minh bạch và linh hoạt</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-balance">
          Gói dịch vụ phù hợp với bạn
        </h1>
        <p className="text-xl text-muted-foreground mb-4">
          Chọn gói phù hợp với nhu cầu của bạn. Không có chi phí ẩn, không có cam kết dài hạn.
        </p>
        <p className="text-base text-muted-foreground">
          Bắt đầu miễn phí ngay hôm nay và nâng cấp khi bạn sẵn sàng
        </p>
      </div>
    </section>
  )
}
