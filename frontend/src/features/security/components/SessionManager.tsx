"use client";

/**
 * Session Manager Component
 *
 * Sessions are stateless tokens, so the only control is signing out of every
 * device at once (including this one).
 */
import { useState } from "react";
import { Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRevokeAllSessions } from "../hooks/useSessions";
import { RevokeAllDialog } from "./RevokeAllDialog";

export function SessionManager() {
  const revokeAll = useRevokeAllSessions();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5" />
            Sessions
          </CardTitle>
          <CardDescription>
            Sign out of every device, including this one. Use it if you think
            someone else has access to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Sign out everywhere
          </Button>
        </CardContent>
      </Card>

      <RevokeAllDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => revokeAll.mutate()}
        isPending={revokeAll.isPending}
      />
    </>
  );
}
