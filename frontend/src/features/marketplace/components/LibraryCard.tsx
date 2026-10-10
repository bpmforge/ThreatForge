"use client";

/**
 * Library Card for Marketplace
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Library,
  FileText,
  Users,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { PublishedLibrary } from "../types";

interface LibraryCardProps {
  library: PublishedLibrary;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
  isPending?: boolean;
}

export function LibraryCard({
  library,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  isPending,
}: LibraryCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Library className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{library.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Building2 className="h-3 w-3" />
                {library.organizationName}
              </CardDescription>
            </div>
          </div>

          {isSubscribed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onUnsubscribe}
              disabled={isPending}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Subscribed
            </Button>
          ) : (
            <Button size="sm" onClick={onSubscribe} disabled={isPending}>
              Subscribe
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {library.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {library.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {library.templateCount} template
            {library.templateCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {library.subscriberCount} subscriber
            {library.subscriberCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs">
            Updated{" "}
            {formatDistanceToNow(new Date(library.updatedAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
