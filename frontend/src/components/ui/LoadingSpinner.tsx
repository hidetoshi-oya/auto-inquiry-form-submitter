import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  message?: string
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  className?: string
}

const sizeConfig = {
  small: 'h-4 w-4',
  medium: 'h-6 w-6', 
  large: 'h-8 w-8',
  xlarge: 'h-12 w-12'
}

export function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'medium',
  className 
}: LoadingSpinnerProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 min-h-[200px]",
      className
    )}>
      <div className="flex flex-col items-center space-y-3">
        <Loader2 
          className={cn(
            "animate-spin text-primary",
            sizeConfig[size]
          )}
          data-testid="loading-spinner"
        />
        {message && (
          <p className="text-sm text-muted-foreground text-center">
            {message}
          </p>
        )}
      </div>
    </div>
  )
} 