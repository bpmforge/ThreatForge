/**
 * ComponentLinkDialog - Dialog for linking a participant to an architecture component
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box,
  Server,
  Database,
  User,
  Cloud,
  Shield,
  Globe,
  Loader2,
  Unlink,
} from "lucide-react";
import { useArchitectureComponents } from "../hooks/useSequenceDiagrams";
import type { SequenceParticipant } from "../types";

interface ComponentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: SequenceParticipant | null;
  threatModelId: string;
  onLink: (componentId: string | null) => void;
}

/** Get icon for component type */
function getComponentIcon(type: string) {
  switch (type) {
    case "process":
      return <Server className="h-4 w-4" />;
    case "dataStore":
      return <Database className="h-4 w-4" />;
    case "externalEntity":
      return <User className="h-4 w-4" />;
    case "service":
      return <Cloud className="h-4 w-4" />;
    case "trustBoundary":
      return <Shield className="h-4 w-4" />;
    case "webApp":
      return <Globe className="h-4 w-4" />;
    default:
      return <Box className="h-4 w-4" />;
  }
}

export function ComponentLinkDialog({
  open,
  onOpenChange,
  participant,
  threatModelId,
  onLink,
}: ComponentLinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && participant && (
          <ComponentLinkDialogContent
            key={participant.id}
            participant={participant}
            threatModelId={threatModelId}
            onLink={onLink}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Inner component that resets when participant changes via key prop */
function ComponentLinkDialogContent({
  participant,
  threatModelId,
  onLink,
  onOpenChange,
}: Omit<ComponentLinkDialogProps, "open"> & {
  participant: SequenceParticipant;
}) {
  // Initialize with participant's current componentId - component is keyed by participant.id
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    participant.componentId || null,
  );

  // Fetch components from architecture diagram
  const { data, isLoading } = useArchitectureComponents(threatModelId);
  // Ensure components is always an array (API might return non-array data)
  const components = Array.isArray(data) ? data : [];

  const handleSave = () => {
    onLink(selectedComponentId);
    onOpenChange(false);
  };

  const handleUnlink = () => {
    onLink(null);
    onOpenChange(false);
  };

  const isCurrentlyLinked = participant.componentId != null;
  const hasChanges = selectedComponentId !== (participant.componentId || null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Link to Architecture Component</DialogTitle>
        <DialogDescription>
          Link <strong>{participant.label}</strong> to a component from the
          architecture diagram.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-8 w-8 mb-2 text-muted-foreground animate-spin" />
            <p>Loading components...</p>
          </div>
        ) : components.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <Box className="h-8 w-8 mb-2 text-muted-foreground" />
            <p>No architecture components found.</p>
            <p className="text-xs mt-1">
              Add components to the architecture diagram first.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-1">
              {components.map((component) => (
                <button
                  key={component.id}
                  onClick={() => setSelectedComponentId(component.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-left
                    transition-colors
                    ${
                      selectedComponentId === component.id
                        ? "bg-blue-100 text-blue-900"
                        : "hover:bg-muted"
                    }
                  `}
                >
                  {getComponentIcon(component.type)}
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{component.name}</span>
                    {component.description && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {component.description}
                      </span>
                    )}
                  </div>
                  {selectedComponentId === component.id && (
                    <span className="text-xs text-blue-600">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <DialogFooter className="flex justify-between sm:justify-between">
        {isCurrentlyLinked && (
          <Button
            variant="outline"
            onClick={handleUnlink}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Unlink className="h-4 w-4 mr-2" />
            Unlink
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedComponentId || !hasChanges}
          >
            Link Component
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
