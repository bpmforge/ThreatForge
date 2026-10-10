"use client";

/**
 * Reviews Page — shows pending security reviews across all models.
 */
import { AppHeader, type BreadcrumbItem } from "@/components/layout";
import { usePendingReviews } from "@/features/review";
import { FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function ReviewsPage() {
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Reviews" }];
  const { data: reviews, isLoading } = usePendingReviews();
  const pending = reviews ?? [];

  return (
    <>
      <AppHeader breadcrumbs={breadcrumbs} />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Security Reviews
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage approval workflows for threat models.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileCheck className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No pending reviews.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Request a review from the threat model canvas to start the
                approval workflow.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((review) => (
                <Card key={review.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        <Link
                          href={`/models/${review.threatModelId}`}
                          className="hover:text-primary transition-colors"
                        >
                          {review.threatModelName}
                        </Link>
                      </CardTitle>
                      <Badge
                        variant={
                          review.status === "APPROVED"
                            ? "default"
                            : review.status === "CHANGES_REQUESTED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {review.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>By {review.requestedByName}</span>
                      <span>Priority: {review.priority}</span>
                      {review.dueDate && (
                        <span>
                          Due: {new Date(review.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {review.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {review.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
