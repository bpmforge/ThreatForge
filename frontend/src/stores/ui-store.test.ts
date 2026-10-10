/**
 * UI Store Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui-store";

describe("ui-store", () => {
  beforeEach(() => {
    // Reset store to initial state
    useUIStore.setState({
      activeRightPanel: "properties",
      addThreatToComponentId: null,
      openAISuggestions: false,
    });
  });

  describe("initial state", () => {
    it("should have properties as default right panel", () => {
      const state = useUIStore.getState();
      expect(state.activeRightPanel).toBe("properties");
    });

    it("should have no component selected for add threat", () => {
      const state = useUIStore.getState();
      expect(state.addThreatToComponentId).toBeNull();
    });

    it("should have AI suggestions closed", () => {
      const state = useUIStore.getState();
      expect(state.openAISuggestions).toBe(false);
    });
  });

  describe("setActiveRightPanel", () => {
    it("should set panel to threats", () => {
      useUIStore.getState().setActiveRightPanel("threats");
      expect(useUIStore.getState().activeRightPanel).toBe("threats");
    });

    it("should set panel to ai", () => {
      useUIStore.getState().setActiveRightPanel("ai");
      expect(useUIStore.getState().activeRightPanel).toBe("ai");
    });

    it("should set panel to chat", () => {
      useUIStore.getState().setActiveRightPanel("chat");
      expect(useUIStore.getState().activeRightPanel).toBe("chat");
    });

    it("should set panel to properties", () => {
      useUIStore.getState().setActiveRightPanel("threats");
      useUIStore.getState().setActiveRightPanel("properties");
      expect(useUIStore.getState().activeRightPanel).toBe("properties");
    });
  });

  describe("requestAddThreat", () => {
    it("should set component ID for add threat", () => {
      useUIStore.getState().requestAddThreat("component-123");
      expect(useUIStore.getState().addThreatToComponentId).toBe(
        "component-123",
      );
    });

    it("should switch to threats panel", () => {
      useUIStore.getState().requestAddThreat("component-123");
      expect(useUIStore.getState().activeRightPanel).toBe("threats");
    });

    it("should update component ID on subsequent calls", () => {
      useUIStore.getState().requestAddThreat("component-1");
      useUIStore.getState().requestAddThreat("component-2");
      expect(useUIStore.getState().addThreatToComponentId).toBe("component-2");
    });
  });

  describe("clearAddThreatRequest", () => {
    it("should clear the component ID", () => {
      useUIStore.getState().requestAddThreat("component-123");
      useUIStore.getState().clearAddThreatRequest();
      expect(useUIStore.getState().addThreatToComponentId).toBeNull();
    });

    it("should not affect active panel", () => {
      useUIStore.getState().requestAddThreat("component-123");
      useUIStore.getState().clearAddThreatRequest();
      expect(useUIStore.getState().activeRightPanel).toBe("threats");
    });
  });

  describe("requestAISuggestions", () => {
    it("should set openAISuggestions to true", () => {
      useUIStore.getState().requestAISuggestions();
      expect(useUIStore.getState().openAISuggestions).toBe(true);
    });

    it("should switch to AI panel", () => {
      useUIStore.getState().requestAISuggestions();
      expect(useUIStore.getState().activeRightPanel).toBe("ai");
    });
  });

  describe("clearAISuggestionsRequest", () => {
    it("should set openAISuggestions to false", () => {
      useUIStore.getState().requestAISuggestions();
      useUIStore.getState().clearAISuggestionsRequest();
      expect(useUIStore.getState().openAISuggestions).toBe(false);
    });

    it("should not affect active panel", () => {
      useUIStore.getState().requestAISuggestions();
      useUIStore.getState().clearAISuggestionsRequest();
      expect(useUIStore.getState().activeRightPanel).toBe("ai");
    });
  });

  describe("complex workflows", () => {
    it("should handle add threat then AI suggestions", () => {
      useUIStore.getState().requestAddThreat("component-1");
      expect(useUIStore.getState().activeRightPanel).toBe("threats");

      useUIStore.getState().requestAISuggestions();
      expect(useUIStore.getState().activeRightPanel).toBe("ai");
      expect(useUIStore.getState().addThreatToComponentId).toBe("component-1");
    });

    it("should handle multiple panel switches", () => {
      useUIStore.getState().setActiveRightPanel("threats");
      useUIStore.getState().setActiveRightPanel("ai");
      useUIStore.getState().setActiveRightPanel("chat");
      useUIStore.getState().setActiveRightPanel("properties");
      expect(useUIStore.getState().activeRightPanel).toBe("properties");
    });
  });
});
