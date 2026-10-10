/**
 * Setup Wizard Store
 * Manages state for the first-time setup wizard.
 */
import { create } from "zustand";

/** Wizard steps */
export type SetupStep =
  | "welcome"
  | "admin"
  | "organization"
  | "ai"
  | "auth"
  | "security"
  | "complete";

/** Step configuration */
export const SETUP_STEPS: SetupStep[] = [
  "welcome",
  "admin",
  "organization",
  "ai",
  "auth",
  "security",
  "complete",
];

export const STEP_LABELS: Record<SetupStep, string> = {
  welcome: "Welcome",
  admin: "Admin Account",
  organization: "Organization",
  ai: "AI Configuration",
  auth: "Authentication",
  security: "Security",
  complete: "Complete",
};

/** Admin account data */
interface AdminData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Organization data */
interface OrganizationData {
  name: string;
  slug: string;
}

/** AI configuration data */
interface AIConfigData {
  enabled: boolean;
  provider:
    | "anthropic"
    | "openai"
    | "google"
    | "vertexai"
    | "ollama"
    | "lmstudio"
    | "none";
  apiKey: string;
  baseUrl: string;
  model: string;
  testStatus: "idle" | "testing" | "success" | "error";
  testMessage: string;
}

/** Auth configuration data */
interface AuthConfigData {
  allowSignups: boolean;
  requireEmailVerification: boolean;
  sessionTimeoutHours: number;
}

/** Security configuration data */
interface SecurityConfigData {
  ipAllowlistEnabled: boolean;
  ipAllowlist: string;
  auditRetentionDays: number;
}

/** Setup wizard state */
interface SetupState {
  // Current step
  currentStep: SetupStep;

  // Step data
  admin: AdminData;
  organization: OrganizationData;
  ai: AIConfigData;
  auth: AuthConfigData;
  security: SecurityConfigData;

  // Validation state
  stepValidation: Record<SetupStep, boolean>;

  // Quick Start mode (skip ai, auth, security steps)
  quickStartMode: boolean;

  // Production installs: token from the server log, sent as X-Setup-Token
  setupTokenRequired: boolean;
  setupToken: string;

  // Submission state
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;

  // Actions
  setStep: (step: SetupStep) => void;
  setQuickStart: (enabled: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  setAdminData: (data: Partial<AdminData>) => void;
  setOrganizationData: (data: Partial<OrganizationData>) => void;
  setAIConfigData: (data: Partial<AIConfigData>) => void;
  setAuthConfigData: (data: Partial<AuthConfigData>) => void;
  setSecurityConfigData: (data: Partial<SecurityConfigData>) => void;
  setStepValidation: (step: SetupStep, valid: boolean) => void;
  setSetupToken: (token: string, required?: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setSubmitError: (error: string | null) => void;
  setSubmitSuccess: (success: boolean) => void;
  reset: () => void;
}

/** Default state values */
const defaultAdmin: AdminData = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const defaultOrganization: OrganizationData = {
  name: "",
  slug: "",
};

const defaultAIConfig: AIConfigData = {
  enabled: true,
  provider: "anthropic",
  apiKey: "",
  baseUrl: "",
  model: "",
  testStatus: "idle",
  testMessage: "",
};

const defaultAuthConfig: AuthConfigData = {
  allowSignups: true,
  requireEmailVerification: true,
  sessionTimeoutHours: 24,
};

const defaultSecurityConfig: SecurityConfigData = {
  ipAllowlistEnabled: false,
  ipAllowlist: "",
  auditRetentionDays: 90,
};

const defaultValidation: Record<SetupStep, boolean> = {
  welcome: true, // Always valid (just info)
  admin: false,
  organization: false,
  ai: true, // Optional step
  auth: true, // Has defaults
  security: true, // Has defaults
  complete: true, // Summary page
};

/** Setup wizard store */
export const useSetupStore = create<SetupState>((set, get) => ({
  currentStep: "welcome",
  quickStartMode: false,
  admin: defaultAdmin,
  organization: defaultOrganization,
  ai: defaultAIConfig,
  auth: defaultAuthConfig,
  security: defaultSecurityConfig,
  stepValidation: defaultValidation,
  setupTokenRequired: false,
  setupToken: "",
  isSubmitting: false,
  submitError: null,
  submitSuccess: false,

  setStep: (step) => set({ currentStep: step }),

  setQuickStart: (enabled) => set({ quickStartMode: enabled }),

  nextStep: () => {
    const { currentStep, quickStartMode } = get();
    const SKIP_IN_QUICK_START: SetupStep[] = ["ai", "auth", "security"];

    let nextIndex = SETUP_STEPS.indexOf(currentStep) + 1;
    // In quick start mode, skip optional steps
    while (
      quickStartMode &&
      nextIndex < SETUP_STEPS.length &&
      SKIP_IN_QUICK_START.includes(SETUP_STEPS[nextIndex]!)
    ) {
      nextIndex++;
    }
    if (nextIndex < SETUP_STEPS.length) {
      set({ currentStep: SETUP_STEPS[nextIndex] });
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    const currentIndex = SETUP_STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: SETUP_STEPS[currentIndex - 1] });
    }
  },

  setAdminData: (data) =>
    set((state) => ({
      admin: { ...state.admin, ...data },
    })),

  setOrganizationData: (data) =>
    set((state) => ({
      organization: { ...state.organization, ...data },
    })),

  setAIConfigData: (data) =>
    set((state) => ({
      ai: { ...state.ai, ...data },
    })),

  setAuthConfigData: (data) =>
    set((state) => ({
      auth: { ...state.auth, ...data },
    })),

  setSecurityConfigData: (data) =>
    set((state) => ({
      security: { ...state.security, ...data },
    })),

  setStepValidation: (step, valid) =>
    set((state) => ({
      stepValidation: { ...state.stepValidation, [step]: valid },
    })),

  setSubmitting: (submitting) => set({ isSubmitting: submitting }),

  setSubmitError: (error) => set({ submitError: error }),
  setSetupToken: (token, required) =>
    set((state) => ({
      setupToken: token,
      setupTokenRequired: required ?? state.setupTokenRequired,
    })),

  setSubmitSuccess: (success) => set({ submitSuccess: success }),

  reset: () =>
    set({
      currentStep: "welcome",
      admin: defaultAdmin,
      organization: defaultOrganization,
      ai: defaultAIConfig,
      auth: defaultAuthConfig,
      security: defaultSecurityConfig,
      stepValidation: defaultValidation,
      isSubmitting: false,
      submitError: null,
      submitSuccess: false,
    }),
}));

/** Request options that carry the setup token, when there is one. */
export function setupTokenHeaders(token: string) {
  return token ? { headers: { "X-Setup-Token": token } } : {};
}
