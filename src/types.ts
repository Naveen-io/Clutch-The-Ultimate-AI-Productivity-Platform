export type ProfileType = "Student" | "Freelancer" | "Professional" | "Entrepreneur";
export type ThemeType = "light" | "dark" | "system";

export interface OnboardingData {
  completed: boolean;
  profileType: ProfileType | null;
  themeType: ThemeType;
}

export interface PhaseUnit {
  phaseName: string;
  hoursRange: string;
  description: string;
}

export interface MicroTask {
  id: string;
  taskText: string;
  completed: boolean;
  phase: string;
}

export interface RescuePlan {
  projectName: string;
  trajectoryRisk: number;
  riskAssessment: string;
  immediateTriage: string[];
  recoveryPath: PhaseUnit[];
  microTasks: MicroTask[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  characterCount: number;
  lastUpdated: string; // ISO string
}

export interface ProjectTask {
  id: string;
  name: string;
  deadline: string;
  currentProgress: number; // 0-100%
  hoursRemaining: number;
  hoursPerDay: number;
  successCondition: string;
  notes: string[];
  isAtRisk: boolean;
  riskScore: number;
  riskRating: "SAFE" | "AT RISK" | "CRITICAL";
  isCompleted: boolean;
  isArchived?: boolean;
  completionDate?: string;
  createdAt?: string; // ISO string
  lastUpdated?: string; // ISO string
  quickNotes?: Note[];
  rescuePlan?: RescuePlan;
  rescuePlanUpdated?: string; // ISO string
}

export interface ChatMessage {
  sender: "user" | "clutch";
  text: string;
  timestamp: string;
}

export interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string; // ISO string
  isPinned?: boolean;
}

