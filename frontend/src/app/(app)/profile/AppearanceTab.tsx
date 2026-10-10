"use client";

/**
 * Appearance Tab
 *
 * Theme settings.
 */
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Theme</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Select your preferred color theme.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              className="h-24 flex-col gap-2 relative"
              onClick={() => setTheme("light")}
            >
              {theme === "light" && (
                <Check className="absolute top-2 right-2 h-4 w-4" />
              )}
              <Sun className="h-6 w-6" />
              <span className="text-sm">Light</span>
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              className="h-24 flex-col gap-2 relative"
              onClick={() => setTheme("dark")}
            >
              {theme === "dark" && (
                <Check className="absolute top-2 right-2 h-4 w-4" />
              )}
              <Moon className="h-6 w-6" />
              <span className="text-sm">Dark</span>
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              className="h-24 flex-col gap-2 relative"
              onClick={() => setTheme("system")}
            >
              {theme === "system" && (
                <Check className="absolute top-2 right-2 h-4 w-4" />
              )}
              <Monitor className="h-6 w-6" />
              <span className="text-sm">System</span>
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Theme changes are applied immediately and saved automatically.
        </p>
      </CardContent>
    </Card>
  );
}
