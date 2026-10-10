/**
 * ParticipantPicker - Dialog for adding participants to sequence diagram
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Link2,
  Box,
  Server,
  Database,
  User,
  Cloud,
  Shield,
  Globe,
  Loader2,
} from "lucide-react";
import { useArchitectureComponents } from "../hooks/useSequenceDiagrams";
import type { ArchitectureComponent } from "../types";

interface ParticipantPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (label: string, componentId?: string) => Promise<void>;
  threatModelId: string;
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

export function ParticipantPicker({
  open,
  onOpenChange,
  onAdd,
  threatModelId,
}: ParticipantPickerProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "component">("manual");
  const [manualLabel, setManualLabel] = useState("");
  const [selectedComponent, setSelectedComponent] =
    useState<ArchitectureComponent | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch components from architecture diagram
  const { data, isLoading: isLoadingComponents } =
    useArchitectureComponents(threatModelId);
  // Ensure components is always an array (API might return non-array data)
  const components = Array.isArray(data) ? data : [];

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      if (activeTab === "manual" && manualLabel.trim()) {
        await onAdd(manualLabel.trim());
        setManualLabel("");
      } else if (activeTab === "component" && selectedComponent) {
        await onAdd(selectedComponent.name, selectedComponent.id);
        setSelectedComponent(null);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setManualLabel("");
    setSelectedComponent(null);
    setActiveTab("manual");
    onOpenChange(false);
  };

  const canAdd =
    activeTab === "manual"
      ? manualLabel.trim().length > 0
      : selectedComponent !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogDescription>
            Add a participant to the sequence diagram. You can create a new one
            or link to an architecture component.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "manual" | "component")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="component">
              <Link2 className="h-4 w-4 mr-2" />
              From Architecture
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="participant-label">Participant Name</Label>
              <Input
                id="participant-label"
                placeholder="e.g., User, API Gateway, Database"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdd && handleAdd()}
                autoFocus
              />
            </div>
          </TabsContent>

          <TabsContent value="component" className="py-4">
            {isLoadingComponents ? (
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
                      onClick={() => setSelectedComponent(component)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-md text-left
                        transition-colors
                        ${
                          selectedComponent?.id === component.id
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
                      {selectedComponent?.id === component.id && (
                        <span className="text-xs text-blue-600">Selected</span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!canAdd || isAdding}>
            {isAdding ? "Adding..." : "Add Participant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
