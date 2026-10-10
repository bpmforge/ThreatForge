"use client";

import { useCollaborativeCanvas } from "@/features/collaboration";
import { ThreatModelCanvas } from "./ThreatModelCanvas";

export default function CollaborativeCanvasWrapper({
  modelId,
  userId,
  userName,
  children,
}: {
  modelId: string;
  userId: string;
  userName: string;
  children?: React.ReactNode;
}) {
  const { isConnected, collaborators, updateCursor, updateSelection } =
    useCollaborativeCanvas({ modelId, userId, userName, enabled: true });

  if (children) {
    return <>{children}</>;
  }

  return (
    <ThreatModelCanvas
      isCollaborating={isConnected}
      collaborators={collaborators}
      onCursorMove={updateCursor}
      onSelectionChange={updateSelection}
    />
  );
}
