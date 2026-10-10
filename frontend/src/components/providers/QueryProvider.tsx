"use client";

/**
 * TanStack Query Provider
 */
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useState, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { isReadOnlyError, READ_ONLY_TOAST } from "@/lib/read-only";
import { reportUnhandledMutationError } from "@/lib/mutation-error-fallback";

interface Props {
  children: ReactNode;
}

export function QueryProvider({ children }: Props) {
  const signingOut = useRef(false);

  const [queryClient] = useState(() => {
    const handle401 = (error: unknown) => {
      if (
        error instanceof ApiError &&
        error.statusCode === 401 &&
        !signingOut.current
      ) {
        signingOut.current = true;
        signOut({ redirect: true, callbackUrl: "/login" });
      }
    };

    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          gcTime: 10 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: (failureCount, error) => {
            if (error instanceof ApiError && error.statusCode === 401)
              return false;
            return failureCount < 3;
          },
        },
        mutations: {
          retry: false,
        },
      },
      queryCache: new QueryCache({ onError: handle401 }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          handle401(error);
          // One toast however many writes a read-only (demo) session attempts.
          if (isReadOnlyError(error)) {
            toast.info(READ_ONLY_TOAST, { id: "read-only-account" });
          }
          // A failed save nobody reports must not look like it worked.
          reportUnhandledMutationError(error, mutation, {
            toastCount: () => toast.getHistory().length,
            showError: (message) => toast.error(message),
            schedule: (fn, ms) => setTimeout(fn, ms),
          });
        },
      }),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
