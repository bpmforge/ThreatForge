import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * SkeletonText - Text placeholder
 */
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-4", index === lines - 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard - Card placeholder
 */
interface SkeletonCardProps {
  className?: string;
  hasImage?: boolean;
}

function SkeletonCard({ className, hasImage }: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4", className)}
      aria-hidden="true"
    >
      {hasImage && <Skeleton className="h-32 w-full mb-4" />}
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-4" />
      <SkeletonText lines={2} />
    </div>
  );
}

/**
 * SkeletonTable - Table placeholder
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn("w-full", className)}
      aria-hidden="true"
      role="presentation"
    >
      {/* Header */}
      <div className="flex gap-4 pb-4 border-b">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-4 py-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonList - List placeholder
 */
interface SkeletonListProps {
  items?: number;
  className?: string;
}

function SkeletonList({ items = 5, className }: SkeletonListProps) {
  return (
    <div
      className={cn("space-y-3", className)}
      aria-hidden="true"
      role="presentation"
    >
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonThreatCard - Threat card placeholder
 */
function SkeletonThreatCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border p-3", className)} aria-hidden="true">
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-6 w-12 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      {/* Title */}
      <Skeleton className="h-5 w-full mb-1" />
      {/* Description */}
      <Skeleton className="h-3 w-3/4" />
      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-7 w-24 rounded" />
        </div>
        <Skeleton className="h-7 w-28 rounded" />
      </div>
    </div>
  );
}

/**
 * SkeletonDashboard - Dashboard layout placeholder
 */
function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-6", className)}
      aria-hidden="true"
      role="presentation"
    >
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonCard className="min-h-[200px]" />
        <SkeletonCard className="min-h-[200px]" />
      </div>
      {/* Table */}
      <SkeletonTable rows={3} columns={5} />
    </div>
  );
}

/**
 * LoadingSpinner - Simple spinner component
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-label="Loading"
    >
      <svg
        className={cn("animate-spin text-muted-foreground", spinnerSizes[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * LoadingOverlay - Full-screen or container loading overlay
 */
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

function LoadingOverlay({
  message = "Loading...",
  className,
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonList,
  SkeletonThreatCard,
  SkeletonDashboard,
  LoadingSpinner,
  LoadingOverlay,
};
