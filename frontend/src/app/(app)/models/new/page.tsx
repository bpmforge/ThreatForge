import { Suspense } from "react";
import { NewModelFlow } from "@/features/dashboard/components/NewModelFlow";

function NewModelPageLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function NewModelPage() {
  return (
    <Suspense fallback={<NewModelPageLoading />}>
      <NewModelFlow />
    </Suspense>
  );
}
