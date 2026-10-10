"use client";

/**
 * Framework Card
 *
 * Card component for displaying custom framework details.
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2, Copy, Link2 } from "lucide-react";
import type { CustomFrameworkData } from "./types";

interface FrameworkCardProps {
  framework: CustomFrameworkData;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function FrameworkCard({
  framework,
  onEdit,
  onDuplicate,
  onDelete,
}: FrameworkCardProps) {
  const controlCount = framework.categories.reduce(
    (sum, c) => sum + c.controls.length,
    0,
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${framework.color}`} />
            <Badge variant="outline">{framework.shortName}</Badge>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              aria-label="Edit framework"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDuplicate}
              aria-label="Duplicate framework"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              aria-label="Delete framework"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-lg">{framework.name}</CardTitle>
        {framework.description && (
          <CardDescription className="line-clamp-2">
            {framework.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Categories</span>
            <span className="font-medium">{framework.categories.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Controls</span>
            <span className="font-medium">{controlCount}</span>
          </div>
          {framework.inheritedControls &&
            Object.keys(framework.inheritedControls).length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Inherits from:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(framework.inheritedControls).map((fw) => (
                    <Badge key={fw} variant="secondary" className="text-xs">
                      {fw}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>v{framework.version}</span>
            <span>
              Updated {new Date(framework.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
