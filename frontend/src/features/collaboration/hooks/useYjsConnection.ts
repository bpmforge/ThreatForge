/**
 * Yjs WebSocket Connection Hook
 *
 * Manages Y.Doc and WebsocketProvider lifecycle with reconnection handling.
 * yjs and y-websocket are imported dynamically to avoid Turbopack's module
 * evaluation crashing on lib0's typed-array initialization at module scope.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import type * as YTypes from "yjs";
import type { WebsocketProvider as WsProviderType } from "y-websocket";
import type {
  CollaborationOptions,
  Collaborator,
  ConnectionStatus,
} from "../types";

const DEFAULT_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
    : "");

interface UseYjsConnectionReturn {
  doc: YTypes.Doc | null;
  provider: WsProviderType | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  collaborators: Collaborator[];
  reconnectAttempts: number;
  lastSyncedAt: Date | null;
  reconnect: () => void;
}

export function useYjsConnection({
  modelId,
  userId,
  userName,
  token,
  enabled = true,
  serverUrl = DEFAULT_WS_URL,
}: CollaborationOptions): UseYjsConnectionReturn {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [doc, setDoc] = useState<YTypes.Doc | null>(null);
  const [provider, setProvider] = useState<WsProviderType | null>(null);
  const providerRef = useRef<WsProviderType | null>(null);

  const reconnect = useCallback(() => {
    if (providerRef.current) {
      setConnectionStatus("reconnecting");
      providerRef.current.connect();
    }
  }, []);

  useEffect(() => {
    if (!enabled || !modelId) return;

    let cancelled = false;

    async function setup() {
      const Y = await import("yjs");
      const { WebsocketProvider } = await import("y-websocket");

      if (cancelled) return;

      const newDoc = new Y.Doc();
      const wsParams = new URLSearchParams();
      if (token) wsParams.set("token", token);
      const wsBase = `${serverUrl}/ws${wsParams.toString() ? `?${wsParams.toString()}` : ""}`;
      const newProvider = new WebsocketProvider(wsBase, modelId, newDoc, {
        connect: true,
        maxBackoffTime: 10000,
      });
      providerRef.current = newProvider;

      // y-websocket throws decode errors inside native onmessage handlers which
      // bypass Promise catch chains and appear as "Uncaught Error" in the console.
      // Wrap the handler to catch truncated/corrupt frames and let the provider reconnect.
      newProvider.on("status", (event: { status: string }) => {
        if (
          event.status === "connected" &&
          (newProvider as unknown as { ws?: WebSocket }).ws
        ) {
          const ws = (newProvider as unknown as { ws: WebSocket }).ws;
          const orig = ws.onmessage?.bind(ws);
          if (orig) {
            ws.onmessage = (msgEvent) => {
              try {
                orig(msgEvent);
              } catch (e) {
                console.warn(
                  "[Yjs] WebSocket frame decode error — provider will reconnect:",
                  e,
                );
                ws.close();
              }
            };
          }
        }
      });

      queueMicrotask(() => {
        if (cancelled) return;
        setDoc(newDoc);
        setProvider(newProvider);
        setConnectionStatus("connecting");
      });

      newProvider.on("status", (event: { status: string }) => {
        if (event.status === "connected") {
          setConnectionStatus("connected");
          setReconnectAttempts(0);
          setLastSyncedAt(new Date());
        } else if (event.status === "disconnected") {
          setConnectionStatus("reconnecting");
        }
      });

      newProvider.on("sync", (isSynced: boolean) => {
        if (isSynced) setLastSyncedAt(new Date());
      });

      const awarenessHandler = () => {
        const states = newProvider.awareness.getStates();
        const others: Collaborator[] = [];
        states.forEach((state, clientId) => {
          if (clientId === newDoc.clientID) return;
          const user = state.user as
            | { id: string; name: string; color: string }
            | undefined;
          if (user) {
            others.push({
              id: user.id,
              name: user.name,
              color: user.color,
              cursor: state.cursor as { x: number; y: number } | undefined,
              selection: state.selection as string[] | undefined,
            });
          }
        });
        setCollaborators(others);
      };
      newProvider.awareness.on("change", awarenessHandler);

      // Store cleanup in a closure the outer effect can call
      cleanupRef.current = () => {
        newProvider.awareness.off("change", awarenessHandler);
        newProvider.disconnect();
        newProvider.destroy();
        newDoc.destroy();
        providerRef.current = null;
        setDoc(null);
        setProvider(null);
        setConnectionStatus("disconnected");
      };
    }

    const cleanupRef = { current: () => {} };
    setup().catch((err) => {
      // Corrupt Yjs state from the server — log and leave status as "disconnected"
      // so the UI degrades gracefully rather than crashing the canvas.
      console.warn(
        "[useYjsConnection] setup failed — collaboration unavailable:",
        err,
      );
      setConnectionStatus("disconnected");
    });

    return () => {
      cancelled = true;
      cleanupRef.current();
    };
  }, [enabled, modelId, userId, userName, token, serverUrl]);

  return {
    doc,
    provider,
    isConnected: connectionStatus === "connected",
    connectionStatus,
    collaborators,
    reconnectAttempts,
    lastSyncedAt,
    reconnect,
  };
}
