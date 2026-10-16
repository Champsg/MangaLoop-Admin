import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  bgColor?: string
  trend?: { value: number; label: string }
  className?: string
  children?: ReactNode
}

export function StatCard({ label, value, icon: Icon, color = 'text-primary', bgColor = 'bg-primary/10', trend, className }: StatCardProps) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <h3 className="text-3xl font-extrabold tracking-tight">{value}</h3>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-500' : 'text-rose-500'
            )}>
              <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', bgColor, color)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {/* Decorative gradient */}
      <div className={cn('absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-5', bgColor)} />
    </div>
  )
}
