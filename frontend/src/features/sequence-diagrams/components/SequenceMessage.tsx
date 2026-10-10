/**
 * SequenceMessage - Message arrow in sequence diagram
 */
"use client";

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, GripVertical } from "lucide-react";
import type {
  SequenceMessage as MessageType,
  MessageType as MsgType,
} from "../types";

interface SequenceMessageProps {
  message: MessageType;
  fromIndex: number;
  toIndex: number;
  participantCount: number;
  onUpdate: (data: Partial<MessageType>) => void;
  onDelete: () => void;
  isDragging?: boolean;
}

/** Get arrow style based on message type */
function getArrowStyle(type: MsgType, isReturn: boolean) {
  if (isReturn || type === "RETURN") {
    return {
      strokeDasharray: "5,5",
      markerEnd: "url(#arrow-open)",
    };
  }
  if (type === "ASYNC") {
    return {
      strokeDasharray: "none",
      markerEnd: "url(#arrow-open)",
    };
  }
  return {
    strokeDasharray: "none",
    markerEnd: "url(#arrow-filled)",
  };
}

export const SequenceMessage = memo(function SequenceMessage({
  message,
  fromIndex,
  toIndex,
  onUpdate,
  onDelete,
  isDragging,
}: SequenceMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.label);

  const handleSave = () => {
    if (editValue.trim() && editValue !== message.label) {
      onUpdate({ label: editValue.trim() });
    }
    setIsEditing(false);
  };

  // Calculate arrow direction and position
  const isSelfCall = fromIndex === toIndex;
  const isLeftToRight = fromIndex < toIndex;
  const startCol = Math.min(fromIndex, toIndex);
  const endCol = Math.max(fromIndex, toIndex);
  const arrowStyle = getArrowStyle(message.messageType, message.isReturn);

  // For self-call, we render a special loop
  if (isSelfCall) {
    return (
      <div
        className={`relative h-10 ${isDragging ? "opacity-50" : ""}`}
        style={{
          gridColumn: `${fromIndex + 1} / ${fromIndex + 2}`,
        }}
      >
        {/* Self-call loop */}
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          style={{ left: "50%" }}
        >
          <path
            d="M 0 5 L 30 5 L 30 25 L 0 25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-foreground"
            {...arrowStyle}
          />
        </svg>

        {/* Label */}
        <div
          className="absolute left-1/2 top-0 transform translate-x-4 text-xs text-foreground whitespace-nowrap"
          style={{ marginTop: "2px" }}
        >
          {isEditing ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setEditValue(message.label);
                  setIsEditing(false);
                }
              }}
              className="h-5 text-xs w-32"
              autoFocus
            />
          ) : (
            <span
              className="cursor-pointer hover:bg-muted px-1 rounded"
              onDoubleClick={() => setIsEditing(true)}
            >
              {message.label}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative h-8 flex items-center ${isDragging ? "opacity-50" : ""}`}
      style={{
        gridColumn: `${startCol + 1} / ${endCol + 2}`,
      }}
    >
      {/* Drag handle */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Arrow line */}
      <div className="relative flex-1 h-full flex items-center">
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <marker
              id="arrow-filled"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L0,6 L9,3 z"
                fill="currentColor"
                className="text-foreground"
              />
            </marker>
            <marker
              id="arrow-open"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L9,3 L0,6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-foreground"
              />
            </marker>
          </defs>
          <line
            x1={isLeftToRight ? "16" : "calc(100% - 16px)"}
            y1="50%"
            x2={isLeftToRight ? "calc(100% - 16px)" : "16"}
            y2="50%"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-foreground"
            {...arrowStyle}
          />
        </svg>

        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-background px-2 pointer-events-auto">
            {isEditing ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") {
                    setEditValue(message.label);
                    setIsEditing(false);
                  }
                }}
                className="h-5 text-xs w-40"
                autoFocus
              />
            ) : (
              <span
                className="text-xs text-foreground cursor-pointer hover:bg-muted px-1 rounded"
                onDoubleClick={() => setIsEditing(true)}
              >
                {message.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 opacity-0 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
