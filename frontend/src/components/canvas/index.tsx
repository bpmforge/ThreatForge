"use client";

/**
 * Canvas module exports.
 *
 * Provides the ThreatModelCanvasProvider wrapper and all canvas components.
 * CollaborativeCanvasWrapper is loaded dynamically to prevent Turbopack from
 * evaluating yjs/lib0 at module-graph build time (causes "Unexpected end of array").
 */
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";
import { ThreatModelCanvas } from "./ThreatModelCanvas";
import { CanvasContextMenu } from "./ContextMenu";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";

const CollaborativeCanvasWrapper = dynamic(
  () => import("./CollaborativeCanvasWrapper"),
  { ssr: false, loading: () => <ThreatModelCanvas /> },
);

interface ThreatModelCanvasProviderProps {
  children?: React.ReactNode;
  enableCollaboration?: boolean;
}

export function ThreatModelCanvasProvider({
  children,
  enableCollaboration = true,
}: ThreatModelCanvasProviderProps) {
  const { data: session } = useSession();
  const params = useParams();
  const modelId = params?.id as string | undefined;

  // Defer collaboration check until after mount. On the server session is null
  // so shouldCollaborate=false → renders {children}. On the client with a real
  // user it becomes true → renders <CollaborativeCanvasWrapper>{children}</>.
  // This ternary change is a structural DOM difference that fires React #418.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shouldCollaborate =
    mounted && enableCollaboration && !!modelId && !!session?.user;

  return (
    <ReactFlowProvider>
      <CanvasContextMenu>
        {shouldCollaborate ? (
          <CollaborativeCanvasWrapper
            modelId={modelId!}
            userId={session!.user!.id!}
            userName={session!.user!.name ?? "Anonymous"}
          >
            {children}
          </CollaborativeCanvasWrapper>
        ) : (
          (children ?? <ThreatModelCanvas />)
        )}
      </CanvasContextMenu>
    </ReactFlowProvider>
  );
}
