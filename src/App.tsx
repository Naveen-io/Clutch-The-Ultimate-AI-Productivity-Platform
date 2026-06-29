import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Play, Check, AlertTriangle, ChevronRight, Settings as SettingsIcon, LayoutDashboard, 
  HelpCircle, LogOut, Bell, User as UserIcon, Zap, TrendingUp, Timer, Plus, ArrowRight, 
  ArrowLeft, Sparkles, Loader2, Trash2, Moon, Sun, Laptop, Lightbulb, Compass, FileText, 
  CheckSquare, Inbox, ExternalLink, Calendar, RefreshCw, Lock, Mail, ShieldAlert, Home, Target, Activity, CheckCircle, Sparkle, Pencil, History, Maximize2, Minimize2
} from "lucide-react";
import { OnboardingData, ProjectTask, ProfileType, ThemeType, RescuePlan, Note, ChatMessage, SavedChat } from "./types";
import { useClutchStore } from "./store";
import { 
  auth, 
  db, 
  ProjectDoc, 
  SmartPlanDoc,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  resendVerificationEmail,
  signOut,
  FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc
} from "./lib/firebase";

// Deterministic Risk Engine Algorithm
export function getDeterministicRisk(deadlineStr: string, progress: number, hoursPerDay: number) {
  if (progress >= 100) {
    return {
      riskScore: 0,
      riskRating: "SAFE" as const,
      isAtRisk: false
    };
  }

  const now = Date.now();
  const deadline = new Date(deadlineStr).getTime();
  const diffMs = deadline - now;
  // Convert remaining milliseconds to active days
  const daysRemaining = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
  
  // Total usable work hours = days remaining * hours allocated per day
  const availableHours = daysRemaining * hoursPerDay;
  const remainingWork = 100 - progress;

  // Assume standard project takes 32 total hours, so remaining progress expects proportional attention
  const rawHoursNeeded = (remainingWork / 100) * 32;

  // Ratio of hours needed vs total available hours
  const ratio = availableHours > 0 ? rawHoursNeeded / availableHours : 10;

  let riskScore = Math.min(100, Math.max(0, Math.round(ratio * 35 + remainingWork * 0.4)));
  let riskRating: "SAFE" | "AT RISK" | "CRITICAL" = "SAFE";

  if (ratio > 1.2 || daysRemaining <= 1.5) {
    riskRating = "CRITICAL";
    riskScore = Math.max(80, riskScore);
  } else if (ratio > 0.65 || daysRemaining <= 4.0) {
    riskRating = "AT RISK";
    if (riskScore < 40) riskScore = 48;
    if (riskScore >= 80) riskScore = 79;
  } else {
    riskRating = "SAFE";
    if (riskScore >= 40) riskScore = 32;
  }

  return {
    riskScore,
    riskRating,
    isAtRisk: riskRating !== "SAFE"
  };
}

// Next Recommended Action Dynamic Resolver
export function getRecommendedAction(project: ProjectTask): string {
  if (project.isCompleted || project.currentProgress >= 100) {
    return "Mission accomplished! Archive or select another focus objective.";
  }
  if (project.rescuePlan?.microTasks) {
    const nextTask = project.rescuePlan.microTasks.find(t => !t.completed);
    if (nextTask) {
      return `Execute micro-task: "${nextTask.taskText}" under ${nextTask.phase}.`;
    }
  }
  // Safe fallbacks based on risk rating
  if (project.riskRating === "CRITICAL") {
    return "Action required: Build a Smart Plan to map achievable milestones.";
  } else if (project.riskRating === "AT RISK") {
    return "Action key: Freeze secondary design refactors and lock down essential MVP features.";
  } else {
    return "Next Step: Initiate standard focus intervals and log your completed checklist items.";
  }
}

// 15-Minute Task Quick Sprint Generator
export function generate15MinRescueBlock(project?: ProjectTask) {
  if (!project) {
    return {
      task: "Draft core section summary outline",
      goal: "Write 5 simple bullet points",
      stopping: "5 items are bulleted and clearly legible"
    };
  }

  if (project.rescuePlan?.microTasks) {
    const nextTask = project.rescuePlan.microTasks.find(t => !t.completed);
    if (nextTask) {
      return {
        task: nextTask.taskText,
        goal: "Focus 100% of your energy to resolve this high priority task.",
        stopping: "The checklist item is fully complete and checked off"
      };
    }
  }

  const keys = project.name.toLowerCase();
  if (keys.includes("roadmap") || keys.includes("resource") || keys.includes("report")) {
    return {
      task: "Diagram key roles and initiatives",
      goal: "Specify exactly 3 engineering lead pairings",
      stopping: "3 leads are documented next to their milestones"
    };
  } else if (keys.includes("hackathon") || keys.includes("submission") || keys.includes("code") || keys.includes("mvp")) {
    return {
      task: "Construct basic mock component states",
      goal: "Check mock models are written out",
      stopping: "No runtime errors occur on execution"
    };
  } else if (keys.includes("marketing") || keys.includes("synthesis") || keys.includes("ads")) {
    return {
      task: "Extract top performance percentages",
      goal: "Locate conversion stats for the main region",
      stopping: "Write 3 metrics inside a text file"
    };
  }

  return {
    task: `Deconstruct next step for "${project.name.slice(0, 30)}"`,
    goal: "Scribble down 1 core functional requirement",
    stopping: "1 small draft outline is formulated"
  };
}

// Default Placeholder Task to prevent undefined access errors when no tasks exist
const DEFAULT_PLACEHOLDER_TASK: ProjectTask = {
  id: "default-placeholder-task",
  name: "Active Milestone",
  deadline: "Today",
  currentProgress: 25,
  hoursRemaining: 8,
  hoursPerDay: 2,
  successCondition: "Demo compiles with zero errors",
  notes: ["Initialize first project parameters"],
  isAtRisk: true,
  riskScore: 65,
  riskRating: "AT RISK",
  isCompleted: false,
  quickNotes: [],
  rescuePlan: {
    projectName: "Active Milestone",
    trajectoryRisk: 65,
    riskAssessment: "Set up your main project to start tracking your progress path.",
    immediateTriage: [
      "Pause non-essential changes and focus on what's important.",
      "Identify the main steps needed to finish your work.",
      "Check off your first few tasks to build momentum."
    ],
    recoveryPath: [
      {
        phaseName: "Getting Started",
        hoursRange: "Hours 1-2",
        description: "Specify critical features and delete secondary overhead."
      },
      {
        phaseName: "Doing the Work",
        hoursRange: "Hours 2-6",
        description: "Assemble the simplest working version."
      },
      {
        phaseName: "Final Polish",
        hoursRange: "Hours 6-8",
        description: "Verify status and prepare demo materials."
      }
    ],
    microTasks: [
      { id: "def-task-1", taskText: "Click '+ Create Project' in the dashboard sidebar or mobile more menu", completed: false, phase: "Phase 1: Active" },
      { id: "def-task-2", taskText: "Specify name, deadline, and hours parameter details", completed: false, phase: "Phase 1: Active" },
      { id: "def-task-3", taskText: "Submit the recovery form to compile a custom recovery path", completed: false, phase: "Phase 1: Active" },
      { id: "def-task-4", taskText: "Complete and check off your very first task block", completed: false, phase: "Phase 2: Upcoming" }
    ]
  }
};

// Typewriter headline component for beautiful hero section
function TypewriterHeadline() {
  const words = ["deadlines.", "projects.", "assignments.", "goals.", "studies.", "dreams."];
  const [currentWordIdx, setCurrentWordIdx] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    let timer: any;
    const word = words[currentWordIdx];

    if (isDeleting) {
      timer = setTimeout(() => {
        setCurrentText(prev => prev.slice(0, -1));
        setTypingSpeed(40); // faster deleting
      }, typingSpeed);
    } else {
      timer = setTimeout(() => {
        setCurrentText(word.slice(0, currentText.length + 1));
        setTypingSpeed(90); // standard typing
      }, typingSpeed);
    }

    if (!isDeleting && currentText === word) {
      // Pause at full word
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
    } else if (isDeleting && currentText === "") {
      setIsDeleting(false);
      setCurrentWordIdx((prev) => (prev + 1) % words.length);
      setTypingSpeed(120); // brief pause before typing next
    }

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, currentWordIdx, typingSpeed]);

  return (
    <span className="inline-block text-[#F59E0B] min-w-[180px] sm:min-w-[280px] text-left">
      {currentText}
      <span className="inline-block ml-1 w-[3px] h-[0.9em] bg-[#F59E0B] translate-y-1 animate-cursor-blink" />
    </span>
  );
}

// Simple heuristic-based title generator for clean user experience
function generateAutoTitle(firstMessage: string): string {
  const text = firstMessage.replace(/[^\w\s]/g, "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "New Conversation";
  
  const lower = firstMessage.toLowerCase();
  if (lower.includes("study") || lower.includes("exam") || lower.includes("class")) {
    return "Study Plan";
  }
  if (lower.includes("homework") || lower.includes("physics") || lower.includes("math") || lower.includes("assignment")) {
    return "Physics Homework";
  }
  if (lower.includes("schedule") || lower.includes("morning") || lower.includes("routine") || lower.includes("daily")) {
    return "Morning Schedule";
  }
  if (lower.includes("code") || lower.includes("bug") || lower.includes("compile") || lower.includes("javascript") || lower.includes("react")) {
    return "Code Sprint";
  }
  if (lower.includes("design") || lower.includes("logo") || lower.includes("color")) {
    return "Design Session";
  }
  
  const titleWords = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return titleWords.join(" ");
}

// Group chats by calendar date boundaries
function groupChatsByDate(chats: SavedChat[]) {
  const now = new Date();
  const todayStr = now.toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: {
    pinned: SavedChat[];
    today: SavedChat[];
    yesterday: SavedChat[];
    last7Days: SavedChat[];
    older: SavedChat[];
  } = {
    pinned: [],
    today: [],
    yesterday: [],
    last7Days: [],
    older: []
  };

  chats.forEach(chat => {
    if (chat.isPinned) {
      groups.pinned.push(chat);
      return;
    }

    const date = new Date(chat.createdAt);
    const dateStr = date.toDateString();

    if (dateStr === todayStr) {
      groups.today.push(chat);
    } else if (dateStr === yesterdayStr) {
      groups.yesterday.push(chat);
    } else if (date >= sevenDaysAgo) {
      groups.last7Days.push(chat);
    } else {
      groups.older.push(chat);
    }
  });

  return groups;
}

const generateUUID = () => {
  return "chat_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
};

// Dynamic preset tasks as base projects
const INITIAL_PROJECTS: ProjectTask[] = [];

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<"landing" | "dashboard" | "tasks" | "calendar" | "notes" | "rescue" | "execute" | "settings">("landing");

  // --- NEW CLUTCH AI FEATURE STATES & HANDLERS ---
  const [canFinishData, setCanFinishData] = useState<{
    status: string;
    hoursNeeded: number;
    sessionsNeeded: number;
    daysNeeded: number;
    explanation: string;
  } | null>(null);
  const [isCanFinishLoading, setIsCanFinishLoading] = useState(false);
  const [canFinishDeadline, setCanFinishDeadline] = useState("Tomorrow");
  const [canFinishProgress, setCanFinishProgress] = useState(30);
  const [canFinishHours, setCanFinishHours] = useState(8);
  const [canFinishError, setCanFinishError] = useState<string | null>(null);

  const [projectHealthData, setProjectHealthData] = useState<{
    status: string;
    text: string;
  } | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [projectHealthError, setProjectHealthError] = useState<string | null>(null);

  const [dailyPlan, setDailyPlan] = useState<{
    priority: string;
    session1: string;
    session2: string;
    optionalTasks: string[];
  } | null>(null);
  const [isDailyPlanLoading, setIsDailyPlanLoading] = useState(false);
  const [dailyPlanError, setDailyPlanError] = useState<string | null>(null);

  const [eodReview, setEodReview] = useState<{
    completedSummary: string;
    progressSummary: string;
    whatsNext: string;
  } | null>(null);
  const [isEodLoading, setIsEodLoading] = useState(false);
  const [showEodModal, setShowEodModal] = useState(false);
  const [eodError, setEodError] = useState<string | null>(null);

  const [projectSummary, setProjectSummary] = useState<{
    goal: string;
    status: string;
    risks: string[];
    nextSteps: string[];
  } | null>(null);
  const [isProjectSummaryLoading, setIsProjectSummaryLoading] = useState(false);
  const [showProjectSummaryModal, setShowProjectSummaryModal] = useState(false);
  const [projectSummaryError, setProjectSummaryError] = useState<string | null>(null);

  const [smartFocusData, setSmartFocusData] = useState<{
    goal: string;
    outcome: string;
    checklist: string[];
  } | null>(null);
  const [isSmartFocusLoading, setIsSmartFocusLoading] = useState(false);
  const [smartFocusError, setSmartFocusError] = useState<string | null>(null);

  const [stuckExplanation, setStuckExplanation] = useState("");

  const handleCanFinishAnalyze = async (deadlineStr: string, progressNum: number, hoursAvailable: number) => {
    setIsCanFinishLoading(true);
    setCanFinishData(null);
    setCanFinishError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "can_i_finish",
          projectName: activeTask?.name || "Active Project",
          notesContent: deadlineStr,
          tasks: progressNum,
          currentHour: hoursAvailable
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setCanFinishData({
          status: data.status || "At Risk",
          hoursNeeded: data.hoursNeeded || 14,
          sessionsNeeded: data.sessionsNeeded || 6,
          daysNeeded: data.daysNeeded || 2,
          explanation: data.explanation || "Coaching analysis ready."
        });
        addToast("✓ Trajectory analyzed");
      } else {
        setCanFinishError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setCanFinishError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsCanFinishLoading(false);
    }
  };

  const handleFetchProjectHealth = async () => {
    if (!activeTask) return;
    setIsHealthLoading(true);
    setProjectHealthError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "project_health_risk",
          projectName: activeTask.name,
          notesContent: activeTask.deadline,
          tasks: activeTask.currentProgress
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setProjectHealthData({
          status: data.status || "Needs Attention",
          text: data.text || "Focus on building stable local storage states."
        });
      } else {
        setProjectHealthError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setProjectHealthError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsHealthLoading(false);
    }
  };

  const handleBuildDailyPlan = async () => {
    setIsDailyPlanLoading(true);
    setDailyPlan(null);
    setDailyPlanError(null);
    try {
      const notesContentJoined = activeTask?.quickNotes?.map(n => n.content).join(" ") || "No notes yet";
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "build_daily_plan",
          projectName: activeTask?.name || "General Workspace",
          notesContent: notesContentJoined
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setDailyPlan({
          priority: data.priority || "Focus on core functional layouts",
          session1: data.session1 || "Draft initial component views (45 mins)",
          session2: data.session2 || "Refine local storage integration (45 mins)",
          optionalTasks: data.optionalTasks || ["Check project task list", "Clear unused code comments"]
        });
        addToast("✓ Plan ready");
      } else {
        setDailyPlanError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setDailyPlanError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsDailyPlanLoading(false);
    }
  };

  const handleEndOfDayReview = async () => {
    setIsEodLoading(true);
    setEodReview(null);
    setEodError(null);
    try {
      const completedList = activeTask?.quickNotes?.map(n => n.title).join(", ") || "Active design work";
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "end_of_day_review",
          projectName: activeTask?.name || "Active Project",
          notesContent: completedList
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setEodReview({
          completedSummary: data.completedSummary || "✓ Activities wrapped up",
          progressSummary: data.progressSummary || "Excellent work today!",
          whatsNext: data.whatsNext || "Tomorrow: complete presentation slides"
        });
        setShowEodModal(true);
        addToast("✓ Plan ready");
      } else {
        setEodError(data.message || "AI is temporarily unavailable. Please try again.");
        setShowEodModal(true);
      }
    } catch (err) {
      console.error(err);
      setEodError("AI is temporarily unavailable. Please try again.");
      setShowEodModal(true);
    } finally {
      setIsEodLoading(false);
    }
  };

  const handleProjectSummary = async () => {
    setIsProjectSummaryLoading(true);
    setProjectSummary(null);
    setProjectSummaryError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "project_summary",
          projectName: activeTask?.name || "Active Project",
          notesContent: activeTask?.successCondition || "Lightweight planning app"
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setProjectSummary({
          goal: data.goal || "Build a responsive web application",
          status: data.status || "Safe",
          risks: data.risks || ["Presentation timing risks", "Scope bloat"],
          nextSteps: data.nextSteps || ["Freeze UI assets", "Run linter verification"]
        });
        setShowProjectSummaryModal(true);
        addToast("✓ Plan ready");
      } else {
        setProjectSummaryError(data.message || "AI is temporarily unavailable. Please try again.");
        setShowProjectSummaryModal(true);
      }
    } catch (err) {
      console.error(err);
      setProjectSummaryError("AI is temporarily unavailable. Please try again.");
      setShowProjectSummaryModal(true);
    } finally {
      setIsProjectSummaryLoading(false);
    }
  };

  const handleSmartFocusPrep = async () => {
    if (!activeTask) return;
    setIsSmartFocusLoading(true);
    setSmartFocusData(null);
    setSmartFocusError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "smart_focus",
          projectName: activeTask.name
        })
      });
      const data = await resp.json();
      if (resp.ok && !data.error) {
        setSmartFocusData({
          goal: data.goal || "Define and bind standard data models",
          outcome: data.outcome || "Local components persist state reliably",
          checklist: data.checklist || [
            "Initialize state from window.localStorage",
            "Write standard click handler bindings",
            "Double-check console output on reload"
          ]
        });
        addToast("✓ Plan ready");
      } else {
        setSmartFocusError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setSmartFocusError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsSmartFocusLoading(false);
    }
  };
  
  // --- FIREBASE AUTHENTICATION & SYNC STATES ---
  const [user, setUser] = useState<FirebaseUser | null>(() => {
    const name = typeof window !== "undefined" ? localStorage.getItem("clutch_profile_name") || "Operator" : "Operator";
    const photo = typeof window !== "undefined" ? localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator" : "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
    return {
      uid: "local-user",
      displayName: name,
      email: "local-user@clutch.io",
      emailVerified: true,
      photoURL: photo
    };
  });
  const userRef = useRef<FirebaseUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [authLoading, setAuthLoading] = useState(true);
  const [privacyConsented, setPrivacyConsented] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clutch_privacy_consent_v1") === "true";
    }
    return true;
  });
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPrivacyLearnMore, setShowPrivacyLearnMore] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // --- NOTIFICATIONS PANEL STATES ---
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notifications, setNotifications] = useState<{
    id: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
  }[]>(() => {
    return [
      {
        id: "explain-how-clutch-works",
        title: "Welcome to Clutch!",
        message: "Clutch is your productivity workspace. Enter your project deadlines and steps in the Smart Plan screen to compile step-by-step checklists, then run focused 15-minute sprints to conquer procrastination.",
        timestamp: "System",
        read: false
      }
    ];
  });

  // --- DELETE WARNING WORKFLOW STATES ---
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Onboarding Persistence state
  const [onboarding, setOnboarding] = useState<OnboardingData>(() => {
    const cached = localStorage.getItem("clutch_onboarding");
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore fallback */ }
    }
    return { completed: false, profileType: null, themeType: "dark" };
  });

  // Trigger showing privacy modal on dashboard if not consented yet
  useEffect(() => {
    if (onboarding.completed && currentView === "dashboard" && !privacyConsented) {
      setShowPrivacyModal(true);
    }
  }, [onboarding.completed, currentView, privacyConsented]);

  // Active projects list
  const [projects, setProjects] = useState<ProjectTask[]>(() => {
    const cached = localStorage.getItem("clutch_projects");
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore fallback */ }
    }
    return INITIAL_PROJECTS;
  });

  // Selected Active Project for Focus mode
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id || "";
  });

  // Current focus project finder (safeguarded against undefined when projects array is empty)
  const activeTask = projects.find(p => p.id === activeProjectId) || projects[0] || DEFAULT_PLACEHOLDER_TASK;

  // Utility to parse human input time (e.g. "30 Minutes", "2.5 Hours", "90 Mins") into hours
  const parseTimeInputToHours = (input: string): number => {
    const normalized = input.toLowerCase().trim();
    if (!normalized) return 1;
    
    // Try matching numbers with minutes (e.g., "30 min", "30 minutes")
    const minMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:min|minute|minutes|m)$/);
    if (minMatch) {
      const mins = parseFloat(minMatch[1]);
      return Math.max(0.1, parseFloat((mins / 60).toFixed(2)));
    }
    
    // Try matching numbers with hours (e.g., "1.5 hours", "2 h")
    const hrMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs|h)?$/);
    if (hrMatch) {
      return Math.max(0.1, parseFloat(parseFloat(hrMatch[1]).toFixed(2)));
    }
    
    // Fallback standard float parser
    const direct = parseFloat(normalized);
    return isNaN(direct) || direct <= 0 ? 1 : direct;
  };

  // Rescue Parameter Intake State
  const [paramName, setParamName] = useState("");
  const [paramDeadline, setParamDeadline] = useState("");
  const [paramProgress, setParamProgress] = useState(30);
  const [paramHours, setParamHours] = useState(40);
  const [paramHoursInput, setParamHoursInput] = useState("40 Hours");
  const [paramNotes, setParamNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Rescue Step-by-Step Guided Intake States
  const [rescueStep, setRescueStep] = useState<number>(1);
  const [showRescueForm, setShowRescueForm] = useState<boolean>(false);
  const [hoursPreset, setHoursPreset] = useState<string>("Custom");

  // Active timer for Focus session screen
  const [timerSeconds, setTimerSeconds] = useState(1500); // Default 25 min (1500s)
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const noteSaveTimeoutRef = useRef<any>(null);

  // 15-Minute Rescue intake popup parameters
  const [showRescueTimerForm, setShowRescueTimerForm] = useState(false);
  const [rescueTaskName, setRescueTaskName] = useState("");
  const [rescueGoal, setRescueGoal] = useState("");
  const [rescueStopping, setRescueStopping] = useState("");
  const [is15MModeActive, setIs15MModeActive] = useState(false);

  // "I'm Stuck" Context bento helper card popup state
  const [showStuckModal, setShowStuckModal] = useState(false);
  const [isAiStuckLoading, setIsAiStuckLoading] = useState(false);
  const [aiStuckResult, setAiStuckResult] = useState<{ title: string; text: string; list: string[] } | null>(null);

  // Quick state notification or alert log
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"profile" | "appearance" | "preferences" | "notifications" | "data" | "about">("profile");

  // Onboarding Setup State
  const [onbStep, setOnbStep] = useState(1);
  const [onbRole, setOnbRole] = useState<ProfileType | null>(() => {
    try {
      const cached = localStorage.getItem("clutch_onboarding");
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.profileType || null;
      }
    } catch {}
    return null;
  });
  const [onbTheme, setOnbTheme] = useState<ThemeType>("dark");
  const [accentTone, setAccentTone] = useState<"orange" | "blue" | "green" | "red">(() => {
    return (localStorage.getItem("clutch_accent_tone") as any) || "orange";
  });
  const [onbGoal, setOnbGoal] = useState<string | null>(() => {
    return localStorage.getItem("clutch_profile_goal") || null;
  });

  const [onbAiPersonality, setOnbAiPersonality] = useState<string>(() => {
    return localStorage.getItem("clutch_ai_personality") || "Professional";
  });
  const [onbAiRemember, setOnbAiRemember] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("clutch_ai_remember");
      return saved ? JSON.parse(saved) : ["My name", "My goals"];
    } catch {
      return ["My name", "My goals"];
    }
  });
  const [onbAiResponseLength, setOnbAiResponseLength] = useState<string>(() => {
    return localStorage.getItem("clutch_ai_response_length") || "Balanced";
  });
  const [onbAiTone, setOnbAiTone] = useState<string>(() => {
    return localStorage.getItem("clutch_ai_tone") || "Technical";
  });

  // Customized User Profile states
  const [profileName, setProfileName] = useState(() => {
    return localStorage.getItem("clutch_profile_name") || "Operator";
  });
  const [profilePhoto, setProfilePhoto] = useState(() => {
    return localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
  });
  const [profileGoal, setProfileGoal] = useState(() => {
    return localStorage.getItem("clutch_profile_goal") || "Sustain progression speed and eliminate task starting friction to secure key deadlines.";
  });

  const [tempName, setTempName] = useState(profileName);
  const [tempPhoto, setTempPhoto] = useState(profilePhoto);
  const [tempGoal, setTempGoal] = useState(profileGoal);

  // Synchronize drafts with committed states
  useEffect(() => {
    setTempName(profileName);
    setTempPhoto(profilePhoto);
    setTempGoal(profileGoal);
  }, [profileName, profilePhoto, profileGoal]);

  // Project Creation popup state
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");

  // Profile edit modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileBioInput, setProfileBioInput] = useState("");

  // Floating AI Chatbot state with Local Organization
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("clutch_saved_chats");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clutch_active_chat_id");
    }
    return null;
  });

  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatRenameId, setChatRenameId] = useState<string | null>(null);
  const [chatRenameValue, setChatRenameValue] = useState("");
  const [showHistoryPane, setShowHistoryPane] = useState(false);
  const [isAiFullscreen, setIsAiFullscreen] = useState(false);

  const [chatMessages, setChatMessages] = useState<{sender: "user" | "clutch"; text: string; timestamp: string}[]>(() => [
    {
      sender: "clutch" as const,
      text: "Hey! I am Clutch, your focus coach. Click one of the quick prompts above, or type any custom question below and I'll help you get to the finish line!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  // Synchronize savedChats to localStorage
  useEffect(() => {
    localStorage.setItem("clutch_saved_chats", JSON.stringify(savedChats));
  }, [savedChats]);

  // Synchronize activeChatId to localStorage
  useEffect(() => {
    if (activeChatId) {
      localStorage.setItem("clutch_active_chat_id", activeChatId);
    } else {
      localStorage.removeItem("clutch_active_chat_id");
    }
  }, [activeChatId]);

  // Sync current active chat messages to state
  useEffect(() => {
    if (activeChatId) {
      const activeChat = savedChats.find(c => c.id === activeChatId);
      if (activeChat && activeChat.messages.length > 0) {
        setChatMessages(activeChat.messages);
      } else {
        setChatMessages([
          {
            sender: "clutch" as const,
            text: "Hey! I am Clutch, your focus coach. Click one of the quick prompts above, or type any custom question below and I'll help you get to the finish line!",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        ]);
      }
    } else {
      setChatMessages([
        {
          sender: "clutch" as const,
          text: "Hey! I am Clutch, your focus coach. Click one of the quick prompts above, or type any custom question below and I'll help you get to the finish line!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }
  }, [activeChatId, savedChats]);

  const [chatInput, setChatInput] = useState("");
  const [newProjDeadline, setNewProjDeadline] = useState("");
  const [newProjProgress, setNewProjProgress] = useState(0);
  const [newProjHoursPerDay, setNewProjHoursPerDay] = useState(4);
  const [newProjSuccess, setNewProjSuccess] = useState("");
  const [newProjNotesString, setNewProjNotesString] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [isGenerating15M, setIsGenerating15M] = useState(false);

  // Validation helpers & newly added state variables
  const [completedProjectToCelebrate, setCompletedProjectToCelebrate] = useState<ProjectTask | null>(null);

  const lastToastsRef = useRef<Record<string, number>>({});

  const sanitizeMessage = (msg: string): string | null => {
    if (!msg) return null;
    
    const lower = msg.toLowerCase();
    
    // Completely silence automatic spam or background sync/initial load notifications
    if (
      lower.includes("synchronized") ||
      lower.includes("synchronize") ||
      lower.includes("synced") ||
      lower.includes("authentication required") ||
      lower.includes("offline sandbox") ||
      lower.includes("telemetry") ||
      lower.includes("cloud sync") ||
      lower.includes("onboarding preferences backed up") ||
      lower.includes("welcome to clutch! calibrated") ||
      lower.includes("welcome to clutch rescue") ||
      lower.includes("sending verification email") ||
      lower.includes("verification email resent") ||
      lower.includes("starting in offline")
    ) {
      return null;
    }

    // Map errors
    if (lower.includes("fail") || lower.includes("error") || lower.includes("couldn't")) {
      return "Couldn't save changes. Try again.";
    }

    // Map exact or partial success strings to standard short user-friendly messages (3-5 words max)
    if (lower.includes("note saved") || lower.includes("note created")) return "✓ Note Saved";
    if (lower.includes("note deleted") || lower.includes("note exported") || lower.includes("dismissed successfully") || lower.includes("project dismissed")) return "✓ Changes Saved";
    if (lower.includes("plan ready") || lower.includes("plan updated") || lower.includes("recovery plan")) return "✓ Plan Updated";
    if (lower.includes("project created") || lower.includes("created active task")) return "✓ Project Created";
    if (
      lower.includes("calendar updated") || 
      lower.includes("scheduled suggested block") || 
      lower.includes("scheduled block") || 
      lower.includes("reserved focus block") || 
      lower.includes("canceled focus") ||
      lower.includes("calendar_events")
    ) {
      return "✓ Calendar Updated";
    }
    if (
      lower.includes("changes saved") || 
      lower.includes("clutch amber standard") || 
      lower.includes("warning parameters saved") || 
      lower.includes("trajectory evaluation") || 
      lower.includes("completion chime toggled") || 
      lower.includes("ambient mode saved") || 
      lower.includes("theme") || 
      lower.includes("settings reset") ||
      lower.includes("preferences backed up") ||
      lower.includes("demo dataset successfully") ||
      lower.includes("demo mode initialized")
    ) {
      return "✓ Changes Saved";
    }
    if (lower.includes("task completed") || lower.includes("spectacular resolution")) return "✓ Task Completed";
    if (lower.includes("task archived") || lower.includes("archived successfully")) return "✓ Task Archived";
    if (lower.includes("task reopened") || lower.includes("reopened and returned")) return "✓ Task Reopened";
    if (lower.includes("account created") || lower.includes("sign-up successful") || lower.includes("workspace account created")) return "✓ Account Created";
    if (lower.includes("sign-in successful") || lower.includes("signed in") || lower.includes("google sign-in successful") || lower.includes("authenticated")) return "✓ Signed In";
    if (lower.includes("logged out")) return "✓ Logged Out";

    // Clean remaining developer/telemetry terms
    let clean = msg;
    clean = clean.replace(/cockpit/gi, "workspace");
    clean = clean.replace(/telemetry/gi, "details");
    clean = clean.replace(/synchronization complete/gi, "changes saved");
    clean = clean.replace(/protocol/gi, "plan");
    clean = clean.replace(/cloud storage synchronized/gi, "everything is up to date");
    clean = clean.replace(/operational area/gi, "workspace");
    clean = clean.replace(/execution engine/gi, "timer");
    clean = clean.replace(/system initialized/gi, "workspace ready");
    clean = clean.replace(/database connected/gi, "workspace ready");
    clean = clean.replace(/AI pipeline/gi, "AI coach");
    clean = clean.replace(/orchestration/gi, "planning");

    // Max 3-5 words for success messages
    const words = clean.split(/\s+/);
    if (words.length > 5) {
      return "✓ Changes Saved";
    }

    return clean;
  };
  
  interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const sanitized = sanitizeMessage(message);
    if (!sanitized) return;

    // Deduplicate: check last 5 seconds
    const now = Date.now();
    const lastTime = lastToastsRef.current[sanitized] || 0;
    if (now - lastTime < 5000) return;
    lastToastsRef.current[sanitized] = now;

    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message: sanitized, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const [notesSearchQuery, setNotesSearchQuery] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const [calendarSubView, setCalendarSubView] = useState<"month" | "week">("month");
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  
  // Contextual AI feature states
  const [taskAiSuggestions, setTaskAiSuggestions] = useState<Record<string, string>>({});
  const [loadingTaskAi, setLoadingTaskAi] = useState<Record<string, boolean>>({});
  const [calendarAiSuggestion, setCalendarAiSuggestion] = useState<string | null>(null);
  const [loadingCalendarAi, setLoadingCalendarAi] = useState(false);
  const [noteSummary, setNoteSummary] = useState<string | null>(null);
  const [isSummarizingNote, setIsSummarizingNote] = useState(false);
  const [dashboardPriority, setDashboardPriority] = useState<string | null>(null);
  const [loadingPriority, setLoadingPriority] = useState(false);

  // Floating AI actions state
  const [showAiFabMenu, setShowAiFabMenu] = useState(false);
  const [aiFabResponse, setAiFabResponse] = useState<string | null>(null);
  const [aiFabResponseTitle, setAiFabResponseTitle] = useState<string | null>(null);
  const [isFabLoading, setIsFabLoading] = useState(false);

  // Focus breakdown state
  const [focusBreakdownSteps, setFocusBreakdownSteps] = useState<string[]>([]);
  const [isBreakingFocusTask, setIsBreakingFocusTask] = useState(false);

  const fetchTaskAiSuggestion = async (taskId: string, taskName: string) => {
    setLoadingTaskAi(prev => ({ ...prev, [taskId]: true }));
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "suggest_next_action", projectName: taskName })
      });
      const data = await resp.json();
      if (data.success && data.text) {
        setTaskAiSuggestions(prev => ({ ...prev, [taskId]: data.text }));
        addToast("✓ AI Suggestion loaded");
      }
    } catch (e) {
      console.error(e);
      addToast("Failed to fetch suggestion", "error");
    } finally {
      setLoadingTaskAi(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const fetchCalendarBestSession = async () => {
    setLoadingCalendarAi(true);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "suggest_work_session", currentHour: new Date().getHours() })
      });
      const data = await resp.json();
      if (data.success && data.text) {
        setCalendarAiSuggestion(data.text);
        addToast("✓ Optimal work session calculated");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCalendarAi(false);
    }
  };

  const fetchNoteSummary = async (noteContent: string) => {
    if (!noteContent || noteContent.trim().length < 5) {
      addToast("Type more content to summarize!", "info");
      return;
    }
    setIsSummarizingNote(true);
    setNoteSummary(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "summarize_notes", notesContent: noteContent })
      });
      const data = await resp.json();
      if (data.success && data.text) {
        setNoteSummary(data.text);
        addToast("✓ Executive notes summary completed");
      }
    } catch (e) {
      console.error(e);
      addToast("Summary generation failed", "error");
    } finally {
      setIsSummarizingNote(false);
    }
  };

  const fetchFocusBreakdown = async (taskName: string) => {
    setIsBreakingFocusTask(true);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "break_task_down", projectName: taskName })
      });
      const data = await resp.json();
      if (data.success && data.list && data.list.length > 0) {
        setFocusBreakdownSteps(data.list);
        addToast("✓ Micro-steps generated");
      } else if (data.success && data.text) {
        setFocusBreakdownSteps([data.text]);
      }
    } catch (e) {
      console.error(e);
      addToast("Task breakdown failed", "error");
    } finally {
      setIsBreakingFocusTask(false);
    }
  };

  const fetchDashboardPriority = async (taskList: any[]) => {
    if (taskList.length === 0) return;
    setLoadingPriority(true);
    try {
      const activeProjects = taskList.filter(p => !p.isCompleted && !p.isArchived);
      if (activeProjects.length === 0) {
        setDashboardPriority("Map your first active project focus to receive high-relevance priorities.");
        return;
      }
      const topProjName = activeProjects[0]?.name;
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actionType: "suggest_priority", 
          projectName: topProjName,
          tasks: activeProjects.map(p => ({ name: p.name, hoursRemaining: p.hoursRemaining }))
        })
      });
      const data = await resp.json();
      if (data.success && data.text) {
        setDashboardPriority(data.text);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPriority(false);
    }
  };

  const openEditProfileModal = () => {
    setProfileNameInput(user?.displayName || "Operator");
    setProfileBioInput(onboarding.profileType || "Professional");
    setShowEditProfileModal(true);
  };

  const saveProfileChanges = () => {
    if (!profileNameInput.trim()) {
      triggerNotification("Name cannot be empty");
      return;
    }
    const nameVal = profileNameInput.trim();
    const bioVal = profileBioInput.trim();
    
    const updatedUser = user ? { ...user, displayName: nameVal } : null;
    setUser(updatedUser);
    localStorage.setItem("clutch_profile_name", nameVal);
    
    const updatedOnboarding = { ...onboarding, profileType: bioVal };
    setOnboarding(updatedOnboarding);
    
    setShowEditProfileModal(false);
    triggerNotification("Profile details updated successfully!");
  };

  const handleSendCustomMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    setChatInput("");
    const userMsg = {
      sender: "user" as const,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    let currentChatId = activeChatId;
    let updatedChats = [...savedChats];
    let activeChat = updatedChats.find(c => c.id === currentChatId);

    if (!currentChatId || !activeChat) {
      currentChatId = generateUUID();
      const autoTitle = generateAutoTitle(text);
      activeChat = {
        id: currentChatId,
        title: autoTitle,
        messages: [userMsg],
        createdAt: new Date().toISOString(),
        isPinned: false
      };
      updatedChats = [activeChat, ...updatedChats];
      setSavedChats(updatedChats);
      setActiveChatId(currentChatId);
    } else {
      activeChat.messages = [...activeChat.messages, userMsg];
      setSavedChats(updatedChats);
    }

    setIsFabLoading(true);

    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "chat",
          customPrompt: text,
          projectName: activeTask?.name || projects[0]?.name || "Active Goal",
          notesContent: activeTask?.quickNotes?.[0]?.content || "",
          aiPersonality: onbAiPersonality,
          aiRemember: onbAiRemember,
          aiResponseLength: onbAiResponseLength,
          aiTone: onbAiTone
        })
      });
      const data = await resp.json();
      const answer = (resp.ok && data.success && !data.error) ? data.text : (data.message || "AI is temporarily unavailable. Please try again.");
      
      // Process dynamic workspace actions
      if (resp.ok && data.success && data.action) {
        const { type, projectData, noteData, calendarEventData } = data.action;
        
        if (type === "create_project" && projectData) {
          const finalDeadline = projectData.deadline || new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().slice(0, 16);
          const hoursRem = Number(projectData.hoursRemaining) || 16;
          const pName = projectData.name || "New Project";
          const successCond = projectData.successCondition || "Complete all checklist items to secure progression vector.";
          const riskData = getDeterministicRisk(finalDeadline, 0, 4);

          const targetProject: ProjectTask = {
            id: `proj-${Date.now()}`,
            name: pName,
            deadline: finalDeadline,
            currentProgress: 0,
            hoursRemaining: hoursRem,
            hoursPerDay: 4,
            successCondition: successCond,
            notes: ["Added dynamically via Clutch Assistant request."],
            isAtRisk: riskData.isAtRisk,
            riskScore: riskData.riskScore,
            riskRating: riskData.riskRating,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            quickNotes: []
          };

          setProjects(prev => [...prev, targetProject]);
          saveProjectToCloud(targetProject);
          setActiveProjectId(targetProject.id);
          setCurrentView("dashboard");
          triggerNotification(`✓ Dynamic Project "${pName}" created!`);
          addToast(`✓ Project "${pName}" added!`);
        } else if (type === "create_note" && noteData) {
          const nTitle = noteData.title || "New Notes Sheet";
          const nContent = noteData.content || "";
          const newNote: Note = {
            id: `note-${Date.now()}`,
            title: nTitle,
            content: nContent,
            characterCount: nContent.length,
            lastUpdated: new Date().toISOString()
          };

          // Fallback to create project if none exists
          let targetId = activeProjectId;
          if (!targetId && projects.length > 0) {
            targetId = projects[0].id;
          }

          if (targetId) {
            setProjects(prev => prev.map(p => {
              if (p.id === targetId) {
                const notes = p.quickNotes || [];
                return { 
                  ...p, 
                  quickNotes: [newNote, ...notes],
                  lastUpdated: new Date().toISOString()
                };
              }
              return p;
            }));

            if (user) {
              setDoc(doc(db, "notes", newNote.id), {
                id: newNote.id,
                userId: user.uid,
                projectId: targetId,
                title: newNote.title,
                content: newNote.content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }).catch(console.error);
            }

            setActiveNoteId(newNote.id);
            setCurrentView("notes");
            triggerNotification(`✓ Dynamic Note "${nTitle}" created!`);
            addToast(`✓ Note "${nTitle}" added!`);
          } else {
            addToast("Create or select an active task first to add a note!", "error");
          }
        } else if (type === "create_calendar_event" && calendarEventData) {
          const cTitle = calendarEventData.title || "Focus Block";
          const cDate = calendarEventData.date || new Date().toISOString().split("T")[0];
          const cStart = calendarEventData.startTime || "10:00";
          const cEnd = calendarEventData.endTime || "11:30";

          const [startHours, startMinutes] = cStart.split(":");
          const [endHours, endMinutes] = cEnd.split(":");

          const blockStart = new Date(cDate);
          blockStart.setHours(parseInt(startHours || "10"), parseInt(startMinutes || "0"), 0, 0);

          const blockEnd = new Date(cDate);
          blockEnd.setHours(parseInt(endHours || "11"), parseInt(endMinutes || "30"), 0, 0);

          const newEvent = {
            id: generateUUID(),
            userId: user?.uid || "anonymous",
            projectId: activeProjectId || (projects[0]?.id || ""),
            title: cTitle,
            startTime: blockStart.toISOString(),
            endTime: blockEnd.toISOString(),
            createdAt: new Date().toISOString()
          };

          setCalendarEvents(prev => [...prev, newEvent]);
          saveCalendarEventToCloud(newEvent);
          setCurrentView("calendar");

          triggerNotification(`✓ Event "${cTitle}" scheduled!`);
          addToast(`✓ Scheduled "${cTitle}" on Calendar`);
        }
      }

      const assistantMsg = {
        sender: "clutch" as const,
        text: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setSavedChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return { ...c, messages: [...c.messages, assistantMsg] };
        }
        return c;
      }));
    } catch (e) {
      console.error(e);
      const assistantMsg = {
        sender: "clutch" as const,
        text: "AI is temporarily unavailable. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setSavedChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return { ...c, messages: [...c.messages, assistantMsg] };
        }
        return c;
      }));
    } finally {
      setIsFabLoading(false);
    }
  };

  const handleAiFabAction = async (action: string, titleStr: string) => {
    setIsFabLoading(true);
    setShowAiFabMenu(true);
    
    const userMsg = {
      sender: "user" as const,
      text: `Quick Prompt: ${titleStr}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    let currentChatId = activeChatId;
    let updatedChats = [...savedChats];
    let activeChat = updatedChats.find(c => c.id === currentChatId);

    if (!currentChatId || !activeChat) {
      currentChatId = generateUUID();
      activeChat = {
        id: currentChatId,
        title: titleStr,
        messages: [userMsg],
        createdAt: new Date().toISOString(),
        isPinned: false
      };
      updatedChats = [activeChat, ...updatedChats];
      setSavedChats(updatedChats);
      setActiveChatId(currentChatId);
    } else {
      activeChat.messages = [...activeChat.messages, userMsg];
      setSavedChats(updatedChats);
    }

    try {
      let payload: any = { actionType: action };
      if (action === "suggest_next_action") {
        payload.projectName = activeTask?.name || projects[0]?.name || "Active Goal";
      } else if (action === "break_task_down") {
        payload.projectName = activeTask?.name || projects[0]?.name || "Active Goal";
      } else if (action === "suggest_work_session") {
        payload.currentHour = new Date().getHours();
      } else if (action === "summarize_notes") {
        const firstNote = activeTask?.quickNotes?.[0] || projects.find(p => p.quickNotes && p.quickNotes.length > 0)?.quickNotes?.[0];
        payload.notesContent = firstNote?.content || "No draft notes located. Create some notes under the notes tab first!";
      } else if (action === "find_blockers") {
        payload.customPrompt = `Given project "${activeTask?.name || "Active Objective"}" with ${activeTask?.hoursRemaining || 40} hours remaining, list the 3 biggest conceptual bottlenecks or risks.`;
      }

      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      
      let answerText = "";
      if (resp.ok && data.success && !data.error) {
        if (data.list && data.list.length > 0) {
          answerText = data.text ? `${data.text}\n\n` + data.list.map((item: string, i: number) => `${i+1}. ${item}`).join('\n') : data.list.map((item: string, i: number) => `${i+1}. ${item}`).join('\n');
        } else {
          answerText = data.text;
        }
      } else {
        answerText = data.message || "AI is temporarily unavailable. Please try again.";
      }

      const assistantMsg = {
        sender: "clutch" as const,
        text: answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setSavedChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return { ...c, messages: [...c.messages, assistantMsg] };
        }
        return c;
      }));
    } catch (e) {
      console.error(e);
      const assistantMsg = {
        sender: "clutch" as const,
        text: "AI is temporarily unavailable. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setSavedChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          return { ...c, messages: [...c.messages, assistantMsg] };
        }
        return c;
      }));
    } finally {
      setIsFabLoading(false);
    }
  };

  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarViewType, setCalendarViewType] = useState<"month" | "week" | "upcoming">("month");
  const [calendarEvents, setCalendarEvents] = useState<any[]>(() => {
    const cached = localStorage.getItem("clutch_calendar_events");
    if (cached) {
      try { return JSON.parse(cached); } catch { /* ignore fallback */ }
    }
    return [];
  });
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStartStr, setNewEventStartStr] = useState("09:00");
  const [newEventEndStr, setNewEventEndStr] = useState("10:00");
  const [newEventProjectId, setNewEventProjectId] = useState("");

  const saveCalendarEventToCloud = async (event: any) => {
    if (!user) return;
    try {
      const docRef = doc(db, "calendarEvents", event.id);
      await setDoc(docRef, {
        id: event.id,
        userId: user.uid,
        projectId: event.projectId || "",
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        createdAt: event.createdAt || new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Calendar event save failed:", err);
    }
  };

  const deleteCalendarEventFromCloud = async (eventId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "calendarEvents", eventId));
    } catch (err) {
      console.error("Calendar event deletion failed:", err);
    }
  };

  const [aiCalendarSuggestion, setAiCalendarSuggestion] = useState<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    text: string;
  } | null>(null);
  const [isAiScheduling, setIsAiScheduling] = useState(false);
  const [aiCalendarError, setAiCalendarError] = useState<string | null>(null);

  const getAiCalendarSuggestion = async () => {
    setIsAiScheduling(true);
    setAiCalendarSuggestion(null);
    setAiCalendarError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actionType: "ai_schedule", 
          projectName: activeTask?.name || "Active Project" 
        })
      });
      const data = await resp.json();
      if (resp.ok && (data.success || data.text) && !data.error) {
        setAiCalendarSuggestion({
          title: data.title || "AI Suggested focus session",
          date: data.date || new Date().toISOString().split('T')[0],
          startTime: data.startTime || "10:00",
          endTime: data.endTime || "12:00",
          text: data.text || "Highly recommended to start deep sprint today to prevent deadline compression."
        });
        addToast("✓ AI Suggestion Compiled!");
      } else {
        setAiCalendarError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setAiCalendarError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsAiScheduling(false);
    }
  };

  const acceptAiCalendarSuggestion = async () => {
    if (!aiCalendarSuggestion) return;
    const [startHours, startMinutes] = aiCalendarSuggestion.startTime.split(":");
    const [endHours, endMinutes] = aiCalendarSuggestion.endTime.split(":");
    
    const blockStart = new Date(aiCalendarSuggestion.date);
    blockStart.setHours(parseInt(startHours || "10"), parseInt(startMinutes || "0"), 0, 0);

    const blockEnd = new Date(aiCalendarSuggestion.date);
    blockEnd.setHours(parseInt(endHours || "12"), parseInt(endMinutes || "0"), 0, 0);

    const newEvent = {
      id: generateUUID(),
      userId: user?.uid || "anonymous",
      projectId: activeProjectId,
      title: aiCalendarSuggestion.title,
      startTime: blockStart.toISOString(),
      endTime: blockEnd.toISOString(),
      createdAt: new Date().toISOString()
    };

    setCalendarEvents(prev => [...prev, newEvent]);
    await saveCalendarEventToCloud(newEvent);
    setAiCalendarSuggestion(null);
    addToast(`✓ Scheduled suggested block: "${newEvent.title}"!`);
  };

  const [aiNoteResult, setAiNoteResult] = useState<{
    actionType: "summarize" | "tasks" | "event";
    text: string;
    list?: string[];
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [isAiNoteLoading, setIsAiNoteLoading] = useState(false);
  const [aiNoteError, setAiNoteError] = useState<string | null>(null);

  const runAiNoteAction = async (action: "summarize_notes" | "notes_to_tasks" | "notes_to_events") => {
    const activeTaskNotes = activeTask?.quickNotes || [];
    const selectedNote = activeTaskNotes.find(n => n.id === activeNoteId) || activeTaskNotes[0];

    if (!selectedNote || !selectedNote.content.trim()) {
      addToast("Please write some content first.");
      return;
    }
    setIsAiNoteLoading(true);
    setAiNoteResult(null);
    setAiNoteError(null);
    try {
      const actionMap = {
        "summarize_notes": "summarize",
        "notes_to_tasks": "tasks",
        "notes_to_events": "event"
      } as const;

      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: action,
          notesContent: selectedNote.content,
          projectName: activeTask?.name || ""
        })
      });
      const data = await resp.json();
      if (resp.ok && (data.success || data.text) && !data.error) {
        setAiNoteResult({
          actionType: actionMap[action],
          text: data.text,
          list: data.list,
          title: data.title,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime
        });
        addToast("✓ Plan Ready");
      } else {
        setAiNoteError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setAiNoteError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsAiNoteLoading(false);
    }
  };

  const importAiNotesToTasks = () => {
    if (!activeProjectId || !aiNoteResult || !aiNoteResult.list || aiNoteResult.list.length === 0) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const existingRescuePlan = p.rescuePlan || {
          projectName: p.name,
          trajectoryRisk: p.isAtRisk ? 75 : 30,
          riskAssessment: "Manually initiated plan.",
          immediateTriage: ["Focus on outstanding checklist tasks", "Perform a 15-min unblocking sprint"],
          recoveryPath: [],
          microTasks: []
        };

        const newMicroTasks = aiNoteResult.list!.map((taskText, index) => ({
          id: "mt_" + Math.random().toString(36).substring(2, 9),
          taskText: taskText,
          completed: false,
          phase: "Extracted from Notes"
        }));

        const updatedProj = {
          ...p,
          rescuePlan: {
            ...existingRescuePlan,
            microTasks: [...existingRescuePlan.microTasks, ...newMicroTasks]
          }
        };

        saveProjectToCloud(updatedProj);
        addToast(`✓ Imported ${newMicroTasks.length} tasks into project checklist!`);
        return updatedProj;
      }
      return p;
    }));

    setAiNoteResult(null);
  };

  const importAiNotesToEvent = async () => {
    if (!aiNoteResult) return;
    const [startHours, startMinutes] = (aiNoteResult.startTime || "10:00").split(":");
    const [endHours, endMinutes] = (aiNoteResult.endTime || "11:30").split(":");
    
    const blockStart = new Date(aiNoteResult.date || new Date());
    blockStart.setHours(parseInt(startHours || "10"), parseInt(startMinutes || "0"), 0, 0);

    const blockEnd = new Date(aiNoteResult.date || new Date());
    blockEnd.setHours(parseInt(endHours || "11"), parseInt(endMinutes || "30"), 0, 0);

    const newEvent = {
      id: generateUUID(),
      userId: user?.uid || "anonymous",
      projectId: activeProjectId,
      title: aiNoteResult.title || "Focus Block: From Notes",
      startTime: blockStart.toISOString(),
      endTime: blockEnd.toISOString(),
      createdAt: new Date().toISOString()
    };

    setCalendarEvents(prev => [...prev, newEvent]);
    await saveCalendarEventToCloud(newEvent);
    setAiNoteResult(null);
    addToast(`✓ Scheduled block: "${newEvent.title}"!`);
  };
  const [newEventStart, setNewEventStart] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1); d.setMinutes(0); d.setSeconds(0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [newEventEnd, setNewEventEnd] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2); d.setMinutes(0); d.setSeconds(0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [tasksActiveTab, setTasksActiveTab] = useState<"active" | "completed" | "archived">("active");

  const validateTaskInput = (name: string, deadline: string, progress: number): string | null => {
    const prunedName = name.trim();
    if (!prunedName) {
      return "Focus Objective Name cannot be empty.";
    }
    // 1. Task name too short
    if (prunedName.length < 5) {
      return "Task name should be at least 5 characters.";
    }
    // 2. Meaningless input detection
    const hasVowels = /[aeiouyAEIOUY]/i.test(prunedName);
    const consecutiveMash = /([a-z])\1{2,}/i.test(prunedName) || /(asdf|hjkl|qwerty|zxcv|sdfg|dfgh)/i.test(prunedName);
    if (!hasVowels || consecutiveMash) {
      return "Please enter a meaningful task description.";
    }
    
    // 3. Past deadline validation
    if (deadline) {
      const deadlineTime = new Date(deadline).getTime();
      if (isNaN(deadlineTime) || deadlineTime <= Date.now()) {
        return "Please choose a future deadline.";
      }
    }

    // 4. Invalid progress
    if (progress === undefined || isNaN(progress) || progress < 0 || progress > 100) {
      return "Progress must be between 0 and 100%.";
    }

    return null;
  };

  const formatRelativeTime = (isoStr: string | undefined): string => {
    if (!isoStr) return "Just now";
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `Updated ${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
      if (diffHr < 24) return `Updated ${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
      return `Updated ${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    } catch {
      return "Just now";
    }
  };

  const isMeaningfulName = (name: string): boolean => {
    return validateTaskInput(name, "", 0) !== "Please enter a meaningful task description.";
  };

  // Synchronize localStorage
  useEffect(() => {
    localStorage.setItem("clutch_onboarding", JSON.stringify(onboarding));
  }, [onboarding]);

  useEffect(() => {
    localStorage.setItem("clutch_projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem("clutch_calendar_events", JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  useEffect(() => {
    if (onboarding.completed && projects.length > 0) {
      fetchDashboardPriority(projects);
    }
  }, [projects, onboarding.completed]);

  useEffect(() => {
    if (activeTask) {
      handleFetchProjectHealth();
    } else {
      setProjectHealthData(null);
    }
  }, [activeProjectId, activeTask?.currentProgress]);

  // Listen for Auth state changes and load separate database collections
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        localStorage.removeItem("clutch_is_logged_out");
      } else {
        const isLoggedOut = localStorage.getItem("clutch_is_logged_out") === "true";
        if (isLoggedOut) {
          setUser(null);
        } else {
          // Set static local workspace user
          const name = localStorage.getItem("clutch_profile_name") || "Operator";
          const photo = localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
          const localUser = {
            uid: "local-user",
            displayName: name,
            email: "local-user@clutch.io",
            emailVerified: true,
            photoURL: photo
          };
          setUser(localUser);
        }
      }
      setAuthLoading(false);
    });

    // Boot up and check onboarding status to route views
    const cachedOnb = localStorage.getItem("clutch_onboarding");
    let onbComp = false;
    if (cachedOnb) {
      try {
        const parsed = JSON.parse(cachedOnb);
        onbComp = !!parsed.completed;
      } catch {}
    }
    
    const isLoggedOut = localStorage.getItem("clutch_is_logged_out") === "true";
    if (isLoggedOut) {
      setCurrentView("landing");
    } else if (onbComp) {
      setCurrentView("dashboard");
    } else {
      setCurrentView("landing");
    }

    return () => unsubscribe();
  }, []);

  // Sync state changes with Zustand store for Current User, Current Project, and Current Smart Plan
  useEffect(() => {
    if (user) {
      useClutchStore.getState().setUser({
        uid: user.uid,
        name: user.displayName || "Operator",
        email: user.email || "",
        photoURL: user.photoURL || "",
        createdAt: new Date().toISOString(),
        onboardingCompleted: onboarding.completed,
        profileType: onboarding.profileType,
        mainGoal: onbGoal
      });
    } else {
      useClutchStore.getState().setUser(null);
    }
  }, [user, onboarding, onbGoal]);

  useEffect(() => {
    if (activeTask && activeTask.id !== "default-placeholder-task") {
      useClutchStore.getState().setActiveProjectId(activeTask.id);
      
      const pDoc: ProjectDoc = {
        id: activeTask.id,
        userId: user?.uid || "anonymous",
        title: activeTask.name,
        description: activeTask.successCondition,
        deadline: activeTask.deadline,
        progress: activeTask.currentProgress,
        riskLevel: activeTask.riskRating,
        status: activeTask.isCompleted ? "COMPLETED" : "ACTIVE",
        createdAt: activeTask.createdAt || new Date().toISOString(),
        updatedAt: activeTask.lastUpdated || new Date().toISOString(),
        hoursRemaining: activeTask.hoursRemaining,
        hoursPerDay: activeTask.hoursPerDay,
        successCondition: activeTask.successCondition,
        notes: activeTask.notes
      };
      useClutchStore.getState().createProject(pDoc);
    }
  }, [activeProjectId, projects]);

  useEffect(() => {
    if (activeTask?.rescuePlan) {
      const planDoc: SmartPlanDoc = {
        id: `plan-${activeTask.id}`,
        userId: user?.uid || "anonymous",
        projectId: activeTask.id,
        generatedPlan: activeTask.rescuePlan,
        generatedAt: activeTask.lastUpdated || new Date().toISOString()
      };
      useClutchStore.getState().setActiveSmartPlan(planDoc);
    }
  }, [activeProjectId, projects, activeTask?.rescuePlan]);

  // Sync theme selection with system class
  useEffect(() => {
    const root = document.documentElement;
    const activeTheme = onboarding.themeType;
    if (activeTheme === "dark" || (activeTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [onboarding.themeType]);

  // Sync accent tone and save to local storage
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem("clutch_accent_tone", accentTone);

    const colors = {
      orange: {
        primary: "#F59E0B",
        hover: "#D97706",
        active: "#B45309",
        soft: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.25)"
      },
      blue: {
        primary: "#3B82F6",
        hover: "#2563EB",
        active: "#1D4ED8",
        soft: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.25)"
      },
      green: {
        primary: "#10B981",
        hover: "#059669",
        active: "#047857",
        soft: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.25)"
      },
      red: {
        primary: "#EF4444",
        hover: "#DC2626",
        active: "#B91C1C",
        soft: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.25)"
      }
    };

    const sel = colors[accentTone] || colors.orange;
    root.style.setProperty("--accent-color-val", sel.primary);
    root.style.setProperty("--accent-hover-val", sel.hover);
    root.style.setProperty("--accent-active-val", sel.active);
    root.style.setProperty("--accent-soft-bg-val", sel.soft);
    root.style.setProperty("--accent-border-val", sel.border);
  }, [accentTone]);

  // Load draft states on mount
  useEffect(() => {
    // 1. New Task Draft
    const cachedDraft = localStorage.getItem("clutch_draft_task");
    if (cachedDraft) {
      try {
        const draft = JSON.parse(cachedDraft);
        if (draft.newProjName) setNewProjName(draft.newProjName);
        if (draft.newProjDeadline) setNewProjDeadline(draft.newProjDeadline);
        if (draft.newProjProgress !== undefined) setNewProjProgress(draft.newProjProgress);
        if (draft.newProjHoursPerDay !== undefined) setNewProjHoursPerDay(draft.newProjHoursPerDay);
        if (draft.newProjSuccess) setNewProjSuccess(draft.newProjSuccess);
        if (draft.newProjNotesString) setNewProjNotesString(draft.newProjNotesString);
      } catch {}
    }

    // 2. Rescue draft
    const cachedRescueDraft = localStorage.getItem("clutch_rescue_form_draft");
    if (cachedRescueDraft) {
      try {
        const draft = JSON.parse(cachedRescueDraft);
        if (draft.paramName) setParamName(draft.paramName);
        if (draft.paramDeadline) setParamDeadline(draft.paramDeadline);
        if (draft.paramProgress !== undefined) setParamProgress(draft.paramProgress);
        if (draft.paramHours !== undefined) setParamHours(draft.paramHours);
        if (draft.paramHoursInput) setParamHoursInput(draft.paramHoursInput);
        if (draft.paramNotes) setParamNotes(draft.paramNotes);
        if (draft.rescueStep) setRescueStep(draft.rescueStep);
        if (draft.showRescueForm !== undefined) setShowRescueForm(draft.showRescueForm);
      } catch {}
    }
  }, []);

  // Save to drafts on change
  useEffect(() => {
    const draft = {
      newProjName,
      newProjDeadline,
      newProjProgress,
      newProjHoursPerDay,
      newProjSuccess,
      newProjNotesString
    };
    localStorage.setItem("clutch_draft_task", JSON.stringify(draft));
  }, [newProjName, newProjDeadline, newProjProgress, newProjHoursPerDay, newProjSuccess, newProjNotesString]);

  useEffect(() => {
    const draft = {
      paramName,
      paramDeadline,
      paramProgress,
      paramHours,
      paramHoursInput,
      paramNotes,
      rescueStep,
      showRescueForm
    };
    localStorage.setItem("clutch_rescue_form_draft", JSON.stringify(draft));
  }, [paramName, paramDeadline, paramProgress, paramHours, paramHoursInput, paramNotes, rescueStep, showRescueForm]);

  // Window unload confirmation for unsaved drafts
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isCreateDirty = newProjName.trim().length > 0;
      const isRescueDirty = paramName.trim().length > 0 && paramName !== activeTask?.name;
      if (isCreateDirty || isRescueDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Leave anyway?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [newProjName, paramName, activeTask]);

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Esc to close active overlays/dialogs
      if (e.key === "Escape") {
        setShowCreateTaskModal(false);
        setShowRescueTimerForm(false);
        setShowStuckModal(false);
        setShowAuthModal(false);
        setShowEditProfileModal(false);
        setShowProjectSummaryModal(false);
        setShowEodModal(false);
        setShowCompletionConfirm(false);
        setShowMobileMoreMenu(false);
        setShowUserMenu(false);
        setShowNotificationPanel(false);
        setShowAiFabMenu(false);
        setShowPrivacyModal(false);
        setIsAiFullscreen(false);
      }
      // 2. Ctrl/Cmd + S to save notes force trigger
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        addToast("✓ Note Saved");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Central view switcher with warning checks
  const handleViewChange = (newView: typeof currentView) => {
    if (!user && newView !== "landing") {
      localStorage.removeItem("clutch_is_logged_out");
      const name = localStorage.getItem("clutch_profile_name") || "Operator";
      const photo = localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
      const localUser = {
        uid: "local-user",
        displayName: name,
        email: "local-user@clutch.io",
        emailVerified: true,
        photoURL: photo
      };
      setUser(localUser);
    }
    const isCreateDirty = newProjName.trim().length > 0;
    const isRescueDirty = paramName.trim().length > 0 && paramName !== activeTask?.name;
    if ((currentView === "rescue" && isRescueDirty) || (showCreateTaskModal && isCreateDirty)) {
      if (!window.confirm("You have unsaved changes. Leave anyway?")) {
        return;
      }
    }
    setCurrentView(newView);
  };

  // Set default form values inside Rescue analyzer based on the currently selected active project
  useEffect(() => {
    if (activeTask) {
      setParamName(activeTask.name);
      setParamDeadline(activeTask.deadline);
      setParamProgress(activeTask.currentProgress);
      setParamHours(activeTask.hoursRemaining);
      setParamHoursInput(`${activeTask.hoursRemaining} Hours`);
      
      const rem = activeTask.hoursRemaining;
      if (rem === 0.5) {
        setHoursPreset("30 minutes");
      } else if (rem === 1) {
        setHoursPreset("1 hour");
      } else if (rem === 2) {
        setHoursPreset("2 hours");
      } else if (rem === 3) {
        setHoursPreset("3 hours");
      } else {
        setHoursPreset("Custom");
      }
    }
  }, [activeProjectId]);

  // Global Countdown timer TICK effect
  useEffect(() => {
    if (isTimerActive && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            setShowCompletionConfirm(true); // Open the custom completion confirmation overlay!
            triggerNotification("Focus Session Complete! Ready to confirm.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerActive]);

  // Quick auto-closing alerts
  const triggerNotification = (msg: string) => {
    const sanitized = sanitizeMessage(msg);
    if (!sanitized) return;

    // Deduplicate: check last 5 seconds
    const now = Date.now();
    const lastTime = lastToastsRef.current[sanitized] || 0;
    if (now - lastTime < 5000) return;
    lastToastsRef.current[sanitized] = now;

    setNotifMessage(sanitized);
    setTimeout(() => {
      setNotifMessage(null);
    }, 4500);
  };

  // Reset/Restart session timer
  const handleResetTimer = (seconds: number = 1500) => {
    setIsTimerActive(false);
    setTimerSeconds(seconds);
  };

  // Start onboarding workflow
  const startOnboarding = () => {
    setOnboarding(prev => ({ ...prev, completed: false }));
    setOnbStep(1);
    setCurrentView("landing");
  };

  // complete onboarding workflow
  const saveOnboarding = async () => {
    if (!onbRole) return;

    // Save AI personalization locally
    localStorage.setItem("clutch_ai_personality", onbAiPersonality);
    localStorage.setItem("clutch_ai_remember", JSON.stringify(onbAiRemember));
    localStorage.setItem("clutch_ai_response_length", onbAiResponseLength);
    localStorage.setItem("clutch_ai_tone", onbAiTone);

    const nextOnboarding = {
      completed: true,
      profileType: onbRole,
      themeType: onbTheme
    };
    setOnboarding(nextOnboarding);

    let activeUser = user;
    if (!activeUser) {
      localStorage.removeItem("clutch_is_logged_out");
      const name = localStorage.getItem("clutch_profile_name") || "Operator";
      const photo = localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
      activeUser = {
        uid: "local-user",
        displayName: name,
        email: "local-user@clutch.io",
        emailVerified: true,
        photoURL: photo
      };
      setUser(activeUser);
    }

    if (activeUser && activeUser.uid !== "local-user") {
      try {
        const userDocRef = doc(db, "users", activeUser.uid);
        await setDoc(userDocRef, {
          onboardingCompleted: true,
          profileType: onbRole,
          mainGoal: onbGoal,
          aiPersonality: onbAiPersonality,
          aiRemember: onbAiRemember,
          aiResponseLength: onbAiResponseLength,
          aiTone: onbAiTone,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        triggerNotification("Onboarding preferences backed up securely to cloud storage!");
      } catch (err) {
        console.error("Firestore user save failed:", err);
      }
    }

    setCurrentView("dashboard");
    triggerNotification(`Welcome to Clutch! Calibrated for ${onbRole} pressure limits.`);
  };

  // Submit parameter forms and query the workspace helper API route
  const handleAnalyzeAndRescue = async () => {
    setIsGenerating(true);
    setApiError(null);

    try {
      const resp = await fetch("/api/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: paramName,
          deadline: paramDeadline,
          currentProgress: paramProgress,
          hoursRemaining: paramHours,
          customNotes: paramNotes
        })
      });

      if (!resp.ok) {
        throw new Error(`Rescue protocol agent responded with status code ${resp.status}`);
      }

      const generatedPlan: RescuePlan = await resp.json();

      // Check if project exists, update its details, else append as a new project
      const existingIdx = projects.findIndex(p => p.name.toLowerCase().trim() === paramName.toLowerCase().trim());
      if (existingIdx !== -1) {
        const targetProj = projects[existingIdx];
        const trRisk = generatedPlan.trajectoryRisk;
        const computedRating: "SAFE" | "AT RISK" | "CRITICAL" = trRisk > 75 ? "CRITICAL" : trRisk > 40 ? "AT RISK" : "SAFE";

        const updatedProj = {
          ...targetProj,
          name: paramName,
          deadline: paramDeadline,
          currentProgress: paramProgress,
          hoursRemaining: paramHours,
          riskScore: trRisk,
          isAtRisk: computedRating !== "SAFE",
          riskRating: computedRating,
          rescuePlan: generatedPlan,
          lastUpdated: new Date().toISOString()
        };

        setProjects(prev => prev.map((p, idx) => idx === existingIdx ? updatedProj : p));
        saveProjectToCloud(updatedProj);
      } else {
        // Create new project
        const trRisk = generatedPlan.trajectoryRisk;
        const computedRating: "SAFE" | "AT RISK" | "CRITICAL" = trRisk > 75 ? "CRITICAL" : trRisk > 40 ? "AT RISK" : "SAFE";
        
        let days = Math.max(1, (new Date(paramDeadline).getTime() - Date.now()) / (1000 * 3600 * 24));
        const estimatedHoursPerDay = Math.max(1, Math.min(24, Math.round(paramHours / days)));

        const newProj: ProjectTask = {
          id: `proj-${Date.now()}`,
          name: paramName,
          deadline: paramDeadline,
          currentProgress: paramProgress,
          hoursRemaining: paramHours,
          hoursPerDay: estimatedHoursPerDay,
          successCondition: "Ensure all core micro tasks generated by AI smart plans check out green.",
          notes: paramNotes ? [paramNotes] : ["Generated through dynamic plan parameters."],
          isAtRisk: computedRating !== "SAFE",
          riskScore: trRisk,
          riskRating: computedRating,
          isCompleted: false,
          rescuePlan: generatedPlan,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        setProjects(prev => [...prev, newProj]);
        setActiveProjectId(newProj.id);
        saveProjectToCloud(newProj);
      }

      setShowRescueForm(false);
      setRescueStep(1);
      triggerNotification("Plan Ready! Created My Plan with simple instructions.");
    } catch (e: any) {
      console.error(e);
      setApiError(e?.message || "Communication with workspace intelligence failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Mark a list item completed inside the checklist of a project
  const toggleMicroTask = (projId: string, taskId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projId && p.rescuePlan) {
        const updatedTasks = p.rescuePlan.microTasks.map(t => {
          if (t.id === taskId) {
            return { ...t, completed: !t.completed };
          }
          return t;
        });

        // Calculate progress change based on checks
        const total = updatedTasks.length;
        const checked = updatedTasks.filter(u => u.completed).length;
        const progressBonus = Math.round((checked / total) * 10);
        const nextProgress = Math.min(100, p.currentProgress + progressBonus);

        const updatedProj = {
          ...p,
          currentProgress: nextProgress,
          rescuePlan: {
            ...p.rescuePlan,
            microTasks: updatedTasks
          }
        };

        saveProjectToCloud(updatedProj);
        return updatedProj;
      }
      return p;
    }));
  };

  // Add custom user project manually with validation and simulated loading state
  const handleCreateNewProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProjectFormError(null);

    // Validation 1: Project Name Empty or Too Long
    const prunedName = newProjName.trim();
    if (!prunedName) {
      setProjectFormError("Focus Objective Name cannot be empty.");
      return;
    }
    if (prunedName.length > 80) {
      setProjectFormError("Objective Name is too long (maximum 80 characters).");
      return;
    }

    // Validation 2: Hours Per Day range
    const hPerDay = Number(newProjHoursPerDay);
    if (isNaN(hPerDay) || hPerDay < 1 || hPerDay > 24) {
      setProjectFormError("Available hours per day must be between 1 and 24 hours.");
      return;
    }

    // Validation 3: Progress percentage range
    const progressVal = Number(newProjProgress);
    if (isNaN(progressVal) || progressVal < 0 || progressVal > 99) {
      setProjectFormError("Active starting progress must be a percentage between 0% and 99%.");
      return;
    }

    // Validation 4: Valid Future Deadline
    let finalDeadline = newProjDeadline;
    if (finalDeadline) {
      const deadlineTime = new Date(finalDeadline).getTime();
      if (isNaN(deadlineTime)) {
        setProjectFormError("Please select a valid deadline date and time.");
        return;
      }
      if (deadlineTime <= Date.now()) {
        setProjectFormError("Deadline must be set to a future date and time.");
        return;
      }
    } else {
      // Create fallback deadline: 4 days from now
      finalDeadline = new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString().slice(0, 16);
    }

    // Prepare active loading state
    setIsCreatingProject(true);

    // Simulate database/cloud latency path for 600ms to allow smooth visual loader spinner to register
    setTimeout(() => {
      try {
        const deadlineDate = new Date(finalDeadline);
        const daysRemaining = Math.max(0.5, (deadlineDate.getTime() - Date.now()) / (1000 * 3600 * 24));
        const hoursRemaining = Math.round(daysRemaining * hPerDay);

        // Compute deterministic metrics via high-fidelity risk algorithm
        const riskData = getDeterministicRisk(finalDeadline, progressVal, hPerDay);

        const targetProject: ProjectTask = {
          id: `proj-${Date.now()}`,
          name: prunedName,
          deadline: finalDeadline,
          currentProgress: progressVal,
          hoursRemaining: hoursRemaining,
          hoursPerDay: hPerDay,
          successCondition: newProjSuccess.trim() || "Complete all checklist items to secure progression vector.",
          notes: newProjNotesString
            ? newProjNotesString.split("\n").filter(line => line.trim().length > 0)
            : ["Custom project entry added manually."],
          isAtRisk: riskData.isAtRisk,
          riskScore: riskData.riskScore,
          riskRating: riskData.riskRating,
          isCompleted: false,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };

        setProjects(prev => [...prev, targetProject]);
        saveProjectToCloud(targetProject);
        setActiveProjectId(targetProject.id);
        setShowCreateTaskModal(false);
        triggerNotification(`Created active task "${prunedName}"!`);

        // Reset fields
        setNewProjName("");
        setNewProjDeadline("");
        setNewProjProgress(0);
        setNewProjHoursPerDay(4);
        setNewProjSuccess("");
        setNewProjNotesString("");
      } catch (err: any) {
        setProjectFormError(err?.message || "Critical failure registering the new objective sequence.");
      } finally {
        setIsCreatingProject(false);
      }
    }, 600);
  };

  // Firestore Cloud project synchronizers
  const saveProjectToCloud = async (proj: ProjectTask) => {
    if (!user) return;
    try {
      const docRef = doc(db, "projects", proj.id);
      await setDoc(docRef, {
        id: proj.id,
        userId: user.uid,
        title: proj.name,
        description: proj.successCondition || "",
        deadline: proj.deadline || "",
        progress: proj.currentProgress || 0,
        riskLevel: proj.riskRating || "SAFE",
        status: proj.isCompleted ? "COMPLETED" : proj.isArchived ? "ARCHIVED" : "ACTIVE",
        createdAt: proj.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hoursRemaining: proj.hoursRemaining || 40,
        hoursPerDay: proj.hoursPerDay || 4,
        successCondition: proj.successCondition || "",
        notes: proj.notes || []
      }, { merge: true });

      // Save plan standalone
      if (proj.rescuePlan) {
        const planId = `plan-${proj.id}`;
        const planRef = doc(db, "smartPlans", planId);
        await setDoc(planRef, {
          id: planId,
          userId: user.uid,
          projectId: proj.id,
          generatedPlan: proj.rescuePlan,
          generatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.error("Project cloud auto-save failed:", err);
    }
  };

  const deleteProjectFromCloud = async (projId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "projects", projId));
      await deleteDoc(doc(db, "smartPlans", `plan-${projId}`));
      const notesQ = query(collection(db, "notes"), where("projectId", "==", projId));
      const notesS = await getDocs(notesQ);
      notesS.forEach(async d => {
        await deleteDoc(doc(db, "notes", d.id));
      });
    } catch (err) {
      console.error("Project deletion from cloud failed:", err);
    }
  };

  // Complete work flow and display achievement trigger
  const markActiveProjComplete = (id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return;
    const completedProj = { 
      ...p, 
      isCompleted: true, 
      currentProgress: 100, 
      isAtRisk: false, 
      riskRating: "SAFE" as const, 
      riskScore: 0,
      completionDate: new Date().toLocaleDateString(),
      lastUpdated: new Date().toISOString()
    };
    setProjects(prev => prev.map(proj => proj.id === id ? completedProj : proj));
    saveProjectToCloud(completedProj);
    setCompletedProjectToCelebrate(completedProj);
    triggerNotification("Spectacular resolution! Task marked completed successfully.");
    addToast("✓ Task Completed");
  };

  const archiveProject = (id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return;
    const updated = { ...p, isArchived: true, lastUpdated: new Date().toISOString() };
    setProjects(prev => prev.map(proj => proj.id === id ? updated : proj));
    saveProjectToCloud(updated);
    triggerNotification("Task archived successfully.");
    addToast("✓ Task Archived");
  };

  const reopenProject = (id: string) => {
    const p = projects.find(proj => proj.id === id);
    if (!p) return;
    const updated = { 
      ...p, 
      isCompleted: false, 
      isArchived: false, 
      currentProgress: Math.min(99, p.currentProgress), 
      lastUpdated: new Date().toISOString() 
    };
    setProjects(prev => prev.map(proj => proj.id === id ? updated : proj));
    saveProjectToCloud(updated);
    triggerNotification("Task reopened and returned to Active status.");
    addToast("✓ Task Reopened");
  };

  // Delete Project workflow
  const handleDeleteProject = (id: string) => {
    setProjectToDelete(id);
  };

  const reseedDemoData = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const demoProjects: ProjectTask[] = [
      {
        id: "demo-project-cs101",
        name: "CS101 Term Project",
        deadline: `${tomorrowStr}T23:59:00`,
        currentProgress: 60,
        hoursRemaining: 12,
        hoursPerDay: 4,
        successCondition: "All unit tests compiled and passing on server.",
        notes: ["Implement red-black tree operations", "Verify memory leak checks using Valgrind"],
        isAtRisk: true,
        riskScore: 78,
        riskRating: "AT RISK",
        isCompleted: false,
        quickNotes: [
          {
            id: "note-cs1",
            title: "Red-Black Tree Balance Logic",
            content: "Ensure tree rotations maintain coloring invariants. Case 1: Uncle is red -> recolor parent, uncle, and grandparent. Case 2: Uncle is black (triangle) -> rotate parent. Case 3: Uncle is black (line) -> recolor parent/grandparent and rotate.",
            characterCount: 236,
            lastUpdated: new Date().toISOString()
          },
          {
            id: "note-cs2",
            title: "Valgrind Memory Leak Log",
            content: "Leaked blocks detected in destructor loop. Need to verify that tree traversal successfully releases all left and right child pointers before releasing root node reference.",
            characterCount: 168,
            lastUpdated: new Date().toISOString()
          }
        ],
        rescuePlan: {
          projectName: "CS101 Term Project",
          trajectoryRisk: 78,
          riskAssessment: "Midway through logic. Deadline compression imminent due to remaining memory leak debugging. Core functions are stable but fragile.",
          immediateTriage: [
            "Halt custom terminal UI enhancements.",
            "Fix destructor traversal first to resolve leak report.",
            "Generate static test cases for balanced insertions."
          ],
          recoveryPath: [
            { phaseName: "Memory Clean", hoursRange: "Hours 1-3", description: "Audit pointer deletions and clear leak reports." },
            { phaseName: "Edge-Case Testing", hoursRange: "Hours 4-8", description: "Validate balance invariants with 50 randomized insertions." },
            { phaseName: "Presentation Proofing", hoursRange: "Hours 9-12", description: "Document code and perform a local submission run." }
          ],
          microTasks: [
            { id: "task-cs-1", taskText: "Implement basic BST Node insertion logic", completed: true, phase: "Phase 1: Active" },
            { id: "task-cs-2", taskText: "Resolve destructor traversal memory leaks", completed: false, phase: "Phase 1: Active" },
            { id: "task-cs-3", taskText: "Draft 2-minute project code walk-through screencast", completed: false, phase: "Phase 2: Upcoming" }
          ]
        }
      },
      {
        id: "demo-project-uxportfolio",
        name: "UX Portfolio Redesign",
        deadline: `${tomorrowStr}T18:00:00`,
        currentProgress: 40,
        hoursRemaining: 18,
        hoursPerDay: 6,
        successCondition: "Sleek web portfolio loaded to production server with working contact form.",
        notes: ["Add Linear-style interaction cues", "Optimize case study image layouts"],
        isAtRisk: false,
        riskScore: 32,
        riskRating: "SAFE",
        isCompleted: false,
        quickNotes: [
          {
            id: "note-ux1",
            title: "Linear Interaction Details",
            content: "Border glow hover effect: relative absolute mask layout with radial gradient following pointer, scale-in subcard on active mouse interaction. Keep borders under 1px thickness for maximum premium feel.",
            characterCount: 198,
            lastUpdated: new Date().toISOString()
          }
        ],
        rescuePlan: {
          projectName: "UX Portfolio Redesign",
          trajectoryRisk: 32,
          riskAssessment: "The case study content is ready. Main remaining items are visual CSS polish and deploy configuration.",
          immediateTriage: [
            "Disable complex canvas animations for initial release.",
            "Assemble copy text for the checkout flow mockup case study.",
            "Configure static hosting deployment hooks."
          ],
          recoveryPath: [
            { phaseName: "Visual Cues & Typography", hoursRange: "Hours 1-6", description: "Verify contrast scores, font sizing hierarchies, and spacing consistency." },
            { phaseName: "Deploy Prep", hoursRange: "Hours 7-12", description: "Bundle static assets and verify absolute and relative routes." },
            { phaseName: "Final Review", hoursRange: "Hours 13-18", description: "Audit contact form bindings on active live preview site." }
          ],
          microTasks: [
            { id: "task-ux-1", taskText: "Write copy draft for Fintech Case Study", completed: true, phase: "Phase 1: Active" },
            { id: "task-ux-2", taskText: "Build responsive bento-grid card list", completed: false, phase: "Phase 2: Upcoming" },
            { id: "task-ux-3", taskText: "Configure custom domain and SSL certificates", completed: false, phase: "Phase 2: Upcoming" }
          ]
        }
      }
    ];

    const demoEvents = [
      {
        id: "event-demo-1",
        projectId: "demo-project-cs101",
        title: "🎯 Deep Focus: Resolve Destructor leaks (CS101)",
        startTime: `${todayStr}T14:00:00`,
        endTime: `${todayStr}T16:00:00`,
        createdAt: new Date().toISOString()
      },
      {
        id: "event-demo-2",
        projectId: "demo-project-cs101",
        title: "🧠 Code Review & Invariant Verification (CS101)",
        startTime: `${todayStr}T19:30:00`,
        endTime: `${todayStr}T21:00:00`,
        createdAt: new Date().toISOString()
      },
      {
        id: "event-demo-3",
        projectId: "demo-project-uxportfolio",
        title: "🎨 UX Refinement: Bento Layout Glow effects",
        startTime: `${tomorrowStr}T10:00:00`,
        endTime: `${tomorrowStr}T12:00:00`,
        createdAt: new Date().toISOString()
      }
    ];

    setProjects(demoProjects);
    setCalendarEvents(demoEvents);
    setActiveProjectId("demo-project-cs101");
    setOnboarding({ completed: true, profileType: "Student", themeType: "dark" });
    setCurrentView("dashboard");
    addToast("✨ Demo Mode initialized with premium sample data!");
    triggerNotification("Demo dataset successfully deployed.");
  };

  // Note actions
  const handleAddNote = () => {
    if (!activeProjectId) {
      addToast("Create or select an active task first!", "error");
      return;
    }
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: "New Note Sheet",
      content: "",
      characterCount: 0,
      lastUpdated: new Date().toISOString()
    };
    
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const notes = p.quickNotes || [];
        return { 
          ...p, 
          quickNotes: [newNote, ...notes],
          lastUpdated: new Date().toISOString()
        };
      }
      return p;
    }));

    if (user) {
      setDoc(doc(db, "notes", newNote.id), {
        id: newNote.id,
        userId: user.uid,
        projectId: activeProjectId,
        title: newNote.title,
        content: newNote.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(console.error);
    }

    setActiveNoteId(newNote.id);
    addToast("✓ Note Created");
  };

  const handleEditNote = (noteId: string, title: string, content: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const notes = (p.quickNotes || []).map(n => {
          if (n.id === noteId) {
            return {
              ...n,
              title: title.slice(0, 100),
              content: content.slice(0, 500),
              characterCount: content.length,
              lastUpdated: new Date().toISOString()
            };
          }
          return n;
        });
        return {
          ...p,
          quickNotes: notes,
          lastUpdated: new Date().toISOString()
        };
      }
      return p;
    }));

    if (noteSaveTimeoutRef.current) clearTimeout(noteSaveTimeoutRef.current);
    if (user) {
      noteSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, "notes", noteId), {
            id: noteId,
            userId: user.uid,
            projectId: activeProjectId,
            title: title.slice(0, 100),
            content: content.slice(0, 500),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log("Auto-saved note to Firestore:", noteId);
        } catch (err) {
          console.error("Firestore note auto-save failed:", err);
        }
      }, 1500);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        return {
          ...p,
          quickNotes: (p.quickNotes || []).filter(n => n.id !== noteId),
          lastUpdated: new Date().toISOString()
        };
      }
      return p;
    }));

    if (user) {
      deleteDoc(doc(db, "notes", noteId)).catch(console.error);
    }

    if (activeNoteId === noteId) {
      setActiveNoteId(null);
    }
    addToast("✓ Note Deleted");
  };

  const handleExportNote = (note: Note) => {
    const element = document.createElement("a");
    const file = new Blob([`Title: ${note.title}\nLast Updated: ${note.lastUpdated}\n\nContents:\n${note.content}`], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.toLowerCase().replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addToast("✓ Note Exported");
  };

  const handleExportPlan = (task: ProjectTask) => {
    if (!task || !task.rescuePlan) {
      addToast("Generate a Smart Plan first!", "error");
      return;
    }
    const plan = task.rescuePlan;
    const content = `# Smart Plan: ${plan.projectName}\n` +
      `Risk Assessment: ${plan.riskAssessment}\n` +
      `Current Progress: ${task.currentProgress}%\n` +
      `Time Remaining: ${task.hoursRemaining} hours\n\n` +
      `## Immediate Triage Items:\n` +
      plan.immediateTriage.map(item => `- ${item}`).join('\n') +
      `\n\n## Actionable Path Timeline:\n` +
      plan.recoveryPath.map((ph, idx) => `Phase ${idx+1}: ${ph.phaseName} (${ph.hoursRange})\nDescription: ${ph.description}`).join('\n\n') +
      `\n\n## Scheduled Tasks:\n` +
      plan.microTasks.map(m => `- [${m.completed ? 'x' : ' '}] (${m.phase}) ${m.taskText}`).join('\n');

    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${plan.projectName.toLowerCase().replace(/\s+/g, "_")}_smart_plan.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addToast("✓ Smart Plan Exported");
  };

  // 15 Minute micro rescue triggers
  const start15MinRescueSession = () => {
    if (!rescueTaskName.trim()) return;
    setIs15MModeActive(true);
    setTimerSeconds(900); // 15 Min is 900s
    setIsTimerActive(true);
    setShowRescueTimerForm(false);
    setCurrentView("execute");
    triggerNotification(`15-Minute Sprint initiated: "${rescueTaskName}"! Let's build momentum!`);
  };

  const [microRescueError, setMicroRescueError] = useState<string | null>(null);

  // Async model loader for 15-Minute Sprints
  const open15MinModal = async () => {
    setShowRescueTimerForm(true);
    setIsGenerating15M(true);
    setMicroRescueError(null);
    setRescueTaskName("");
    setRescueGoal("");
    setRescueStopping("");
    try {
      // Fetch bespoke suggestions from the AI engine
      const resp = await fetch("/api/micro-rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: activeTask?.name || "General workplace progress",
          successCondition: activeTask?.successCondition || "Resolve urgent bottleneck"
        })
      });
      const data = await resp.json();
      if (resp.ok && data.task && data.goal && data.stopping && !data.error) {
        setRescueTaskName(data.task);
        setRescueGoal(data.goal);
        setRescueStopping(data.stopping);
      } else {
        setMicroRescueError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (e) {
      console.error("AI 15-Minute suggestion failed:", e);
      setMicroRescueError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsGenerating15M(false);
    }
  };

  // Stuck choices triggers and launches micro workouts
  const triggerStuckAction = (microTaskGoal: string, goalDesc: string) => {
    setShowStuckModal(false);
    setRescueTaskName(microTaskGoal);
    setRescueGoal(goalDesc);
    setRescueStopping("15 Minute session wraps up nicely.");
    setIs15MModeActive(true);
    setTimerSeconds(900);
    setIsTimerActive(true);
    setCurrentView("execute");
    triggerNotification(`Unblocking momentum with micro objective: "${microTaskGoal}"!`);
  };

  const [aiStuckError, setAiStuckError] = useState<string | null>(null);

  const handleGetStuckDiagnostics = async () => {
    setIsAiStuckLoading(true);
    setAiStuckResult(null);
    setAiStuckError(null);
    try {
      const resp = await fetch("/api/ai-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "stuck_suggest",
          projectName: activeTask?.name || "Active Project",
          currentProgress: activeTask?.currentProgress || 0
        })
      });
      const data = await resp.json();
      if (resp.ok && (data.success || data.title || data.text) && !data.error) {
        setAiStuckResult({
          title: data.title || "Create skeleton outline structure",
          text: data.text || "Underlying Blocker: Overthinking details too early. Psychological perfectionism.",
          list: data.list && data.list.length > 0 ? data.list : [
            "Open your code editor workspace",
            "Set a physical timer for exactly 3 minutes",
            "Write down 3 imperfect, messy lines of code or draft text"
          ]
        });
        addToast("✨ AI Breakthrough diagnostics compiled!");
      } else {
        setAiStuckError(data.message || "AI is temporarily unavailable. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setAiStuckError("AI is temporarily unavailable. Please try again.");
    } finally {
      setIsAiStuckLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  // Format deadlines nicely
  const formatDeadlineDate = (dateStr: string) => {
    if (!dateStr) return "Coming Up";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  // Calculate days remaining fallback
  const getDaysLeft = (dateStr: string) => {
    if (!dateStr) return "4 Days Left";
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      const days = Math.round(diff / (1000 * 3600 * 24));
      return days > 0 ? `${days} Days Left` : days === 0 ? "Due Today" : "Past Due";
    } catch {
      return "4 Days Left";
    }
  };

  return (
    <div id="clutch-host-root" className="min-h-screen transition-all duration-300 antialiased flex flex-col md:flex-row bg-background text-on-surface relative overflow-x-hidden">
      
      {/* Premium subtle background glow & micro-particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] bg-[#6366F1]/3 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-[#F59E0B]/2 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "15s" }} />
        
        {/* Soft radial glow behind landing/hero area */}
        {currentView === "landing" && (
          <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[400px] bg-gradient-to-b from-[#F59E0B]/6 to-transparent rounded-full blur-[100px] opacity-80" />
        )}

        {/* Faint floating particles */}
        <div className="absolute inset-0 opacity-[0.15]">
          <div className="absolute top-[15%] left-[20%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: "6s" }} />
          <div className="absolute top-[45%] left-[80%] w-1 h-1 bg-[#F59E0B] rounded-full animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="absolute top-[75%] left-[15%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: "10s" }} />
          <div className="absolute top-[30%] left-[60%] w-1 h-1 bg-[#6366F1] rounded-full animate-pulse" style={{ animationDuration: "5s" }} />
          <div className="absolute top-[85%] left-[70%] w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDuration: "7s" }} />
        </div>
      </div>
      
      {/* Toast Notification Top Bar */}
      <AnimatePresence>
        {notifMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#F59E0B] text-bg-dark font-extrabold shadow-2xl px-5 py-3 rounded-2xl sm:rounded-full flex items-center gap-2.5 text-center w-[90%] max-w-sm sm:w-auto text-xs sm:text-sm"
          >
            <Sparkles className="w-5 h-5 shrink-0" />
            <span className="font-sans text-sm">{notifMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT NAVIGATION COLUMN (DESKTOP) - Solid fixed breathable width */}
      <motion.nav 
        id="side-nav-rail"
        initial={{ x: -240, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 180 }}
        className="hidden md:flex flex-col bg-surface-container font-sans text-xs h-screen w-60 border-r border-outline-variant/15 fixed left-0 top-0 z-40 overflow-hidden shadow-xl"
      >
        {/* Logo / Header */}
        <div className="flex items-center h-20 px-6 shrink-0 relative mt-2 mb-1">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 border border-outline-variant/15 select-none pointer-events-none shadow-md">
            <img 
              src="/Assets/Logo.png" 
              alt="Logo" 
              className="w-9 h-9 object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="ml-3.5 overflow-hidden whitespace-nowrap">
            <h1 className="font-display font-black text-lg tracking-tight text-[#F59E0B] leading-none">Clutch</h1>
            <p className="text-[9px] uppercase font-bold text-on-surface-variant block mt-0.5 tracking-wider">Smart Plan</p>
          </div>
        </div>
        <div className="h-px bg-outline-variant/10 w-full shrink-0" />
        
        {/* Navigation Section Label */}
        <div className="px-5 py-3.5 text-left">
          <span className="text-[9px] uppercase tracking-widest font-black text-on-surface-variant/60 font-mono">Workspace Cockpit</span>
        </div>

        {/* Primary Navigation Elements */}
        {onboarding.completed ? (
          <div className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto scrollbar-none text-left">
            
            {/* Dashboard Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("dashboard"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "dashboard" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "dashboard" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Home className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Dashboard</span>
            </motion.button>

            {/* Projects Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("tasks"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "tasks" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "tasks" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <CheckSquare className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Projects</span>
            </motion.button>

            {/* Calendar Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("calendar"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "calendar" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "calendar" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Calendar className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Calendar</span>
            </motion.button>

            {/* Notes Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("notes"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "notes" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "notes" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <FileText className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Notes</span>
            </motion.button>

            {/* Focus Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("execute"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "execute" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "execute" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Target className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Focus</span>
            </motion.button>

            {/* Recovery Plan Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("rescue"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "rescue" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "rescue" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Compass className="w-4 h-4 shrink-0 text-[#F59E0B] relative z-10" />
              <span className="font-semibold text-xs relative z-10">Recovery Plan</span>
            </motion.button>

            {/* Settings Link */}
            <motion.button 
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { handleViewChange("settings"); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border relative ${
                currentView === "settings" 
                  ? "text-[#F59E0B] font-bold border-[#F59E0B]/20" 
                  : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-variant/20"
              }`}
            >
              {currentView === "settings" && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute inset-0 bg-[#F59E0B]/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <SettingsIcon className="w-4 h-4 shrink-0 relative z-10" />
              <span className="font-semibold text-xs relative z-10">Settings</span>
            </motion.button>
          </div>
        ) : (
          <div className="flex-1 py-4 flex flex-col gap-1 px-3">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant select-none opacity-60">
              <Compass className="w-4 h-4 shrink-0 animate-pulse text-[#F59E0B]" />
              <span className="font-semibold text-xs">Setup Mode</span>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="h-px bg-outline-variant/10 w-full shrink-0" />
        
        <div className="py-3 flex flex-col gap-1.5 px-3 bg-surface-container-low/20 shrink-0">
          {onboarding.completed && (
            <>
              {/* Profile Card */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-container-high/40 hover:bg-surface-container-high border border-outline-variant/10 transition-all text-left group"
              >
                <div 
                  onClick={() => { handleViewChange("settings"); }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center shrink-0">
                    <UserIcon className="w-3.5 h-3.5 text-[#6366F1]" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-bold text-[11px] text-white truncate group-hover:text-[#F59E0B] transition-colors">{user?.displayName || "Operator"}</h4>
                    <p className="text-[9px] text-on-surface-variant truncate -mt-0.5 font-sans">
                      {onboarding.profileType || "Professional"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditProfileModal();
                  }}
                  className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-white transition-colors"
                  title="Edit Profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </motion.div>

              {/* 15m Sprint Action */}
              <motion.button 
                whileHover={{ scale: 1.03, boxShadow: "0 4px 12px rgba(245, 158, 11, 0.15)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { open15MinModal(); }}
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl transition-all text-center border border-[#F59E0B]/20 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-[11px]"
                title="Start 15m Sprint"
              >
                <Timer className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <span>15m Sprint</span>
              </motion.button>
            </>
          )}
        </div>
      </motion.nav>

      {/* MOBILE BOTTOM NAVIGATION - EXACTLY 5 ITEMS */}
      {onboarding.completed && (
        <nav 
          id="mobile-nav-bar"
          className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container/95 backdrop-blur-md border-t border-outline-variant/15 z-40 px-1 py-1 flex justify-around items-center h-16 shadow-xl gap-1"
        >
          {/* Home (Dashboard) */}
          <button 
            onClick={() => { handleViewChange("dashboard"); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] ${currentView === "dashboard" ? "text-[#F59E0B]" : "text-[#A0AEC0] hover:text-white"}`}
          >
            <Home className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 font-bold font-sans">Home</span>
          </button>

          {/* Projects */}
          <button 
            onClick={() => { handleViewChange("tasks"); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] ${currentView === "tasks" ? "text-[#F59E0B]" : "text-[#A0AEC0] hover:text-white"}`}
          >
            <CheckSquare className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 font-bold font-sans">Projects</span>
          </button>

          {/* Calendar */}
          <button 
            onClick={() => { handleViewChange("calendar"); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] ${currentView === "calendar" ? "text-[#F59E0B]" : "text-[#A0AEC0] hover:text-white"}`}
          >
            <Calendar className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 font-bold font-sans">Calendar</span>
          </button>

          {/* Focus */}
          <button 
            onClick={() => { handleViewChange("execute"); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] ${currentView === "execute" ? "text-[#F59E0B]" : "text-[#A0AEC0] hover:text-white"}`}
          >
            <Target className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 font-bold font-sans">Focus</span>
          </button>

          {/* More Popover Switch */}
          <button 
            onClick={() => { setShowMobileMoreMenu(true); }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] ${showMobileMoreMenu ? "text-[#F59E0B]" : "text-[#A0AEC0] hover:text-white"}`}
          >
            <Plus className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 font-bold font-sans">More</span>
          </button>
        </nav>
      )}

      {/* MOBILE MORE DRAWER SHEET */}
      <AnimatePresence>
        {showMobileMoreMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMoreMenu(false)}
              className="md:hidden fixed inset-0 bg-black/80 z-40"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-high border-t border-outline-variant/20 rounded-t-3xl z-50 p-6 flex flex-col gap-4 text-left shadow-2xl max-h-[80vh] overflow-y-auto font-sans"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center p-0.5">
                    <img src="/Assets/Logo.png" className="w-5 h-5 object-contain" alt="Logo" />
                  </div>
                  <span className="font-display font-black text-white text-sm uppercase tracking-wider">More Options</span>
                </div>
                <button 
                  onClick={() => setShowMobileMoreMenu(false)}
                  className="p-1 rounded-full bg-surface-container hover:bg-surface-container-low text-on-surface-variant hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => { handleViewChange("notes"); setShowMobileMoreMenu(false); }}
                  className="p-4 rounded-2xl bg-surface-container hover:bg-[#F59E0B]/5 border border-outline-variant/10 flex flex-col items-start gap-2 text-left transition-all active:scale-98"
                >
                  <div className="p-2 bg-[#F59E0B]/10 rounded-xl text-[#F59E0B]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-white text-xs">Notes</span>
                  <span className="text-[10px] text-on-surface-variant leading-none">Draft ideas & summaries</span>
                </button>

                <button 
                  onClick={() => { handleViewChange("rescue"); setShowMobileMoreMenu(false); }}
                  className="p-4 rounded-2xl bg-surface-container hover:bg-[#F59E0B]/5 border border-outline-variant/10 flex flex-col items-start gap-2 text-left transition-all active:scale-98"
                >
                  <div className="p-2 bg-[#F59E0B]/10 rounded-xl text-[#F59E0B]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-white text-xs">Recovery Plan</span>
                  <span className="text-[10px] text-on-surface-variant leading-none">AI recovery planner</span>
                </button>

                <button 
                  onClick={() => { handleViewChange("settings"); setShowMobileMoreMenu(false); }}
                  className="p-4 rounded-2xl bg-surface-container hover:bg-[#6366F1]/5 border border-outline-variant/10 flex flex-col items-start gap-2 text-left transition-all active:scale-98"
                >
                  <div className="p-2 bg-[#6366F1]/10 rounded-xl text-[#6366F1]">
                    <SettingsIcon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-white text-xs">Settings</span>
                  <span className="text-[10px] text-on-surface-variant leading-none">Configurations & auth</span>
                </button>

                <button 
                  onClick={() => { startOnboarding(); setShowMobileMoreMenu(false); }}
                  className="p-4 rounded-2xl bg-surface-container hover:bg-danger/5 border border-outline-variant/10 flex flex-col items-start gap-2 text-left transition-all active:scale-98"
                >
                  <div className="p-2 bg-danger/10 rounded-xl text-danger">
                    <RefreshCw className="w-5 h-5 animate-pulse" />
                  </div>
                  <span className="font-bold text-white text-xs">Reset Profile</span>
                  <span className="text-[10px] text-on-surface-variant leading-none">Redo onboarding</span>
                </button>
              </div>

              <div className="mt-4 p-3 rounded-2xl bg-surface-container border border-outline-variant/15 flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-[#6366F1]" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-white leading-tight">{user?.email ? user.email.split("@")[0] : "Clutch Pilot"}</h5>
                    <p className="text-[10px] text-on-surface-variant leading-tight">{onboarding.profileType || "Professional"}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { open15MinModal(); setShowMobileMoreMenu(false); }}
                  className="px-3.5 py-1.5 bg-[#F59E0B] text-bg-dark font-sans font-black text-[10px] rounded-full uppercase tracking-wider"
                >
                  15m Sprint
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN LAYOUT CANVAS */}
      <div className="flex-1 flex flex-col md:pl-60 min-h-screen pb-20 md:pb-6">
        
        {/* HEADER TOP BAR */}
        <motion.header 
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          style={{
            backdropFilter: scrollY > 15 ? "blur(16px)" : "blur(0px)",
            backgroundColor: scrollY > 15 ? "rgba(19, 19, 21, 0.85)" : "rgba(19, 19, 21, 0)",
            borderBottom: scrollY > 15 ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0)"
          }}
          className="h-20 flex justify-between items-center px-6 md:px-12 sticky top-0 z-30 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="md:hidden w-11 h-11 rounded-xl bg-pure-white flex items-center justify-center overflow-hidden border border-outline-variant/20 select-none pointer-events-none shadow-sm p-1 shrink-0">
              <img 
                src="/Assets/Logo.png" 
                alt="Clutch Logo" 
                className="w-9 h-9 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Task Switcher Dropdown */}
            {onboarding.completed && projects.length > 0 ? (
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider leading-none">Active Focus Monitor</span>
                <select
                  value={activeProjectId}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    setActiveProjectId(targetId);
                    const matchedProj = projects.find(proj => proj.id === targetId);
                    if (matchedProj) {
                      addToast(`✓ Focus Switched: "${matchedProj.name}"`);
                    }
                  }}
                  className="bg-surface-container border border-outline-variant/40 rounded-xl px-2.5 py-1 mt-0.5 text-xs text-[#F59E0B] uppercase font-bold tracking-tight focus:border-[#F59E0B] outline-none cursor-pointer max-w-[150px] sm:max-w-[280px]"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-surface text-white">
                      {proj.name} ({proj.currentProgress}%) {proj.isCompleted ? " (COMPLETED)" : proj.isArchived ? " (ARCHIVED)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="hidden md:block">
                <span className="text-sm font-sans uppercase font-black text-on-surface-variant/80 tracking-widest block">Workspace</span>
                <span className="text-xs font-sans text-[#F59E0B] font-bold block -mt-1">Active Project Tracker</span>
              </div>
            )}
          </div>

          {/* Quick Action Control Panel */}
          <div className="flex items-center gap-4">
            
            {/* Notification panel wrapper */}
            <div className="relative">
              <button 
                onClick={() => { setShowNotificationPanel(prev => !prev); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all relative ${
                  showNotificationPanel 
                    ? "bg-[#F59E0B] text-bg-dark" 
                    : "bg-surface-container-high hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30"
                }`}
              >
                <Bell className="w-5 h-5" />
                {notifications.some(n => !n.read) && (
                  <>
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger animate-ping"></span>
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger"></span>
                  </>
                )}
              </button>

              {/* DROPDOWN NOTIFICATION PANEL POPUP */}
              <AnimatePresence>
                {showNotificationPanel && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-80 sm:w-96 bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2">
                      <span className="text-xs uppercase font-bold text-[#F59E0B] tracking-wider">Workspace Logs & Alerts</span>
                      <button 
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }}
                        className="text-[10px] text-on-surface-variant hover:text-white underline transition-all"
                      >
                        Mark all read
                      </button>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-on-surface-variant py-4 text-center">No messages in monitoring station.</p>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            style={{ borderLeftColor: notif.read ? "transparent" : "#F59E0B" }}
                            className={`p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low transition-colors ${notif.read ? "opacity-70" : "border-l-4 border-l-[#F59E0B]"}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="text-xs font-bold text-white leading-normal">{notif.title}</h4>
                              <span className="text-[9px] uppercase font-mono text-on-surface-variant shrink-0">{notif.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-[#c5c6cd] mt-2 leading-relaxed text-left">{notif.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-outline-variant/10">
                      <button 
                        onClick={() => { setShowNotificationPanel(false); }}
                        className="text-xs bg-[#F59E0B] text-bg-dark font-sans px-4 py-1.5 rounded-full font-bold hover:scale-[1.01] transition-transform"
                      >
                        Dismiss Menu
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile sync management wrapper */}
            <div className="relative">
              <button 
                onClick={() => {
                  if (user) {
                    setShowUserMenu(prev => !prev);
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                  user 
                    ? "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]" 
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/40 hover:bg-surface-container-high"
                }`}
                title={user ? `Profile: ${user.email}` : "Sign In with Firebase"}
              >
                {user ? (
                  <span className="text-xs font-black uppercase tracking-tight">{user.email?.slice(0, 2) || "U"}</span>
                ) : (
                  <UserIcon className="w-5 h-5 scale-95" />
                )}
              </button>

              {/* DROPDOWN USER MENU POPUP */}
              <AnimatePresence>
                {showUserMenu && user && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-12 w-64 bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3 text-left"
                  >
                    <div className="border-b border-[#303035] pb-2">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">Logged In Account</span>
                      <span className="text-xs font-bold text-white block truncate">{user.email}</span>
                      <span className="text-[9px] text-success font-mono mt-1 block flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-success shrink-0" /> Cloud Sync Active
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button 
                        onClick={() => {
                          signOut(auth).then(() => {
                            localStorage.setItem("clutch_is_logged_out", "true");
                            setUser(null);
                            setOnboarding(prev => ({ ...prev, completed: false }));
                            setShowUserMenu(false);
                            setCurrentView("landing");
                            triggerNotification("Logged out of session.");
                          });
                        }}
                        className="w-full text-xs bg-danger/10 text-danger hover:bg-danger hover:text-bg-dark font-sans py-2 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Disconnect Sync
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {onboarding.completed && (
              <button 
                onClick={() => { setShowCreateTaskModal(true); }}
                className="hidden lg:flex items-center gap-2 px-5 py-2 rounded-full bg-[#F59E0B] text-bg-dark font-sans text-sm font-bold shadow-md hover:opacity-90 active:scale-98 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Mission
              </button>
            )}
          </div>
        </motion.header>

        {/* CONTAINER CONTENT ROUTING */}
        <main className="flex-1 p-6 md:p-12 pt-2 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            
            {/* VIEW: ONBOARDING SETUP */}
            {!onboarding.completed && currentView === "onboarding" && (
              <motion.section 
                key="onboarding"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col items-center justify-center py-10 w-full"
              >
                {/* Stepper Header */}
                <div className="w-full max-w-md flex items-center justify-between mb-12 relative z-10 px-4">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-outline-variant/30 -z-10 rounded-full"></div>
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#F59E0B] -z-10 rounded-full transition-all duration-500 ease-in-out" 
                    style={{ width: `${((onbStep - 1) / 3) * 100}%` }}
                  ></div>
                  
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex flex-col items-center gap-1">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        step < onbStep 
                          ? "bg-[#F59E0B] text-bg-dark font-black" 
                          : step === onbStep 
                          ? "bg-surface-container-high border border-[#F59E0B] text-white font-bold ring-4 ring-[#F59E0B]/20" 
                          : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/30"
                      }`}>
                        {step < onbStep ? <Check className="w-5 h-5 stroke-[3]" /> : step}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Step 1: Who are you? */}
                {onbStep === 1 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14 w-full max-w-5xl px-4 text-left"
                  >
                    {/* Hero Illustration: Top on Mobile, Right on Desktop */}
                    <div className="w-full lg:w-[35%] flex justify-center lg:order-last shrink-0 select-none pointer-events-none mb-4 lg:mb-0">
                      <img 
                        src="/Assets/onboarding-path.png" 
                        alt="Tactical Deadline Navigation" 
                        className="w-full max-w-[140px] lg:max-w-[200px] h-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Onboarding content */}
                    <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
                      {/* Brand Logo Entry */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-pure-white flex items-center justify-center border border-outline-variant/15 select-none pointer-events-none shadow-md p-1">
                          <img src="/Assets/Logo.png" alt="Clutch Logo" className="w-9 h-9 object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <span className="font-display font-black text-[#F59E0B] tracking-tight uppercase leading-none block text-sm">Clutch</span>
                          <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider block mt-0.5">Smart Workspace</span>
                        </div>
                      </div>

                      <h1 className="font-display font-medium text-4xl text-on-surface mb-3 tracking-tight">Who are you?</h1>
                      <p className="font-sans text-on-surface-variant max-w-md mb-8">Select your primary role so we can calibrate Clutch to your specific workload and deadline pressures.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        {[
                          { title: "Student", desc: "Assignments, exams, and thesis management.", icon: "🎓" },
                          { title: "Freelancer", desc: "Client projects, tracking, and independent work.", icon: "💻" },
                          { title: "Professional", desc: "Corporate deadlines, team deliverables, and reports.", icon: "💼" },
                          { title: "Entrepreneur", desc: "Startups, multi-domain chaos, and product launches.", icon: "🚀" }
                        ].map((item) => (
                          <button 
                            key={item.title}
                            onClick={() => { setOnbRole(item.title as ProfileType); }}
                            className={`role-card flex flex-col items-start gap-2 p-6 rounded-2xl border transition-all text-left group hover:bg-surface-container-low ${
                              onbRole === item.title 
                                ? "border-[#F59E0B] bg-surface-container-high shadow-lg" 
                                : "border-outline-variant/30 bg-surface-container"
                            }`}
                          >
                            <span className="text-3xl mb-1">{item.icon}</span>
                            <h3 className="font-display font-bold text-lg text-on-surface group-hover:text-[#F59E0B] transition-colors">{item.title}</h3>
                            <p className="text-sm text-on-surface-variant -mt-1 leading-normal">{item.desc}</p>
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-end lg:justify-start w-full mt-8">
                        <button 
                          onClick={() => { if (onbRole) setOnbStep(2); }}
                          disabled={!onbRole}
                          className={`px-8 py-3 rounded-full font-bold font-sans transition-all flex items-center gap-2 ${
                            onbRole 
                              ? "bg-[#F59E0B] text-bg-dark hover:opacity-90 active:scale-95" 
                              : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
                          }`}
                        >
                          Continue
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: What is your main goal? */}
                {onbStep === 2 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center w-full max-w-2xl text-center"
                  >
                    <h1 className="font-display font-medium text-4xl text-on-surface mb-3 tracking-tight text-white">What is your main goal?</h1>
                    <p className="font-sans text-on-surface-variant max-w-md mb-8">Choose your prime directive so Clutch can calibrate risk score warning thresholds appropriately.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                      {[
                        { title: "Meet Deadlines", desc: "Submit all deliverables and milestones precisely on time.", icon: "🎯" },
                        { title: "Stay Organized", desc: "Keep task calendars, micro checklists, and work logs in perfect sync.", icon: "📅" },
                        { title: "Finish Projects", desc: "Defeat procrastination with tactical hourly checkpoints.", icon: "⚡" }
                      ].map((item) => (
                        <button 
                          key={item.title}
                          onClick={() => { setOnbGoal(item.title); }}
                          className={`flex flex-col items-start gap-3 p-6 rounded-2xl border transition-all text-left group hover:bg-surface-container-low ${
                            onbGoal === item.title 
                              ? "border-[#F59E0B] bg-surface-container-high shadow-lg" 
                              : "border-outline-variant/30 bg-surface-container"
                          }`}
                        >
                          <span className="text-3xl mb-1">{item.icon}</span>
                          <h3 className="font-display font-bold text-lg text-on-surface group-hover:text-[#F59E0B] transition-colors">{item.title}</h3>
                          <p className="text-sm text-on-surface-variant leading-normal -mt-1">{item.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-between w-full mt-10">
                      <button 
                        onClick={() => { setOnbStep(1); }}
                        className="px-6 py-3 rounded-full border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => { if (onbGoal) setOnbStep(3); }}
                        disabled={!onbGoal}
                        className={`px-8 py-3 rounded-full font-bold font-sans transition-all flex items-center gap-2 ${
                          onbGoal 
                            ? "bg-[#F59E0B] text-bg-dark hover:opacity-90 active:scale-95" 
                            : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
                        }`}
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: AI Personalization */}
                {onbStep === 3 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center w-full max-w-4xl text-center px-4"
                  >
                    <h1 className="font-display font-medium text-4xl text-on-surface mb-3 tracking-tight text-white">Calibrate your AI Assistant</h1>
                    <p className="font-sans text-on-surface-variant max-w-2xl mb-8">
                      Customize how Clutch Assistant communicates and aligns with your working style using multiple-choice options.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
                      {/* personality */}
                      <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🤖</span>
                          <h3 className="font-display font-bold text-base text-white">AI Personality <span className="text-xs text-on-surface-variant font-normal">(Single Select)</span></h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {["Professional", "Friendly", "Creative", "Teacher", "Coding Expert", "Funny"].map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setOnbAiPersonality(p)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-sans font-bold border transition-all cursor-pointer ${
                                onbAiPersonality === p
                                  ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/10"
                                  : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* tone */}
                      <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📣</span>
                          <h3 className="font-display font-bold text-base text-white">Assistant Tone <span className="text-xs text-on-surface-variant font-normal">(Single Select)</span></h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {["Formal", "Casual", "Friendly", "Technical"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setOnbAiTone(t)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-sans font-bold border transition-all cursor-pointer ${
                                onbAiTone === t
                                  ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/10"
                                  : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* length */}
                      <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📏</span>
                          <h3 className="font-display font-bold text-base text-white">Response Length <span className="text-xs text-on-surface-variant font-normal">(Single Select)</span></h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {["Short", "Balanced", "Detailed"].map((l) => (
                            <button
                              key={l}
                              type="button"
                              onClick={() => setOnbAiResponseLength(l)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-sans font-bold border transition-all cursor-pointer ${
                                onbAiResponseLength === l
                                  ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/10"
                                  : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant"
                              }`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* remember */}
                      <div className="bg-surface-container border border-outline-variant/30 p-6 rounded-2xl flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🧠</span>
                          <h3 className="font-display font-bold text-base text-white">What should AI remember? <span className="text-xs text-on-surface-variant font-normal">(Multi-select)</span></h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {["My name", "My goals", "My projects", "My hobbies", "My study subjects", "My preferred coding languages", "My writing style", "Nothing"].map((r) => {
                            const isSelected = onbAiRemember.includes(r);
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  if (r === "Nothing") {
                                    setOnbAiRemember(["Nothing"]);
                                  } else {
                                    let next = onbAiRemember.filter(item => item !== "Nothing");
                                    if (isSelected) {
                                      next = next.filter(item => item !== r);
                                      if (next.length === 0) next = ["Nothing"];
                                    } else {
                                      next.push(r);
                                    }
                                    setOnbAiRemember(next);
                                  }
                                }}
                                className={`px-3.5 py-2 rounded-xl text-xs font-sans font-bold border transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B] shadow-sm shadow-[#F59E0B]/10"
                                    : "border-outline-variant/20 bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant"
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between w-full mt-10">
                      <button 
                        onClick={() => { setOnbStep(2); }}
                        className="px-6 py-3 rounded-full border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors font-sans"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => { setOnbStep(4); }}
                        className="px-8 py-3 rounded-full bg-[#F59E0B] text-bg-dark font-bold font-sans hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Success Confirmation */}
                {onbStep === 4 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center w-full max-w-lg text-center"
                  >
                    <div className="relative w-32 h-32 mb-8">
                      <div className="absolute inset-0 bg-[#F59E0B]/20 rounded-full animate-ping"></div>
                      <div className="w-24 h-24 bg-[#F59E0B] rounded-full flex items-center justify-center shadow-lg relative z-10 mx-auto mt-4">
                        <Check className="w-12 h-12 text-bg-dark stroke-[3]" />
                      </div>
                    </div>

                    <h1 className="font-display font-black text-5xl text-on-surface tracking-tighter mb-2 text-white">You're all set.</h1>
                    <p className="font-sans text-on-surface-variant max-w-md mx-auto mb-8">Your local Clutch workspace is calibrated. Your workspace is ready to keep you on schedule.</p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                      <button 
                        onClick={() => { setOnbStep(3); }}
                        className="px-6 py-3 rounded-full border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors font-sans text-sm font-bold"
                      >
                        Adjust AI settings
                      </button>
                      <button 
                        onClick={() => { saveOnboarding(); }}
                        className="px-10 py-4 rounded-full bg-[#F59E0B] text-bg-dark font-sans font-black text-lg shadow-lg hover:scale-105 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        Enter Workspace
                        <ArrowRight className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.section>
            )}

            {/* VIEW: HERO LANDING PAGE */}
            {currentView === "landing" && (
              <motion.section 
                key="landing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full font-sans max-w-5xl mx-auto py-4 px-4 sm:px-6 flex flex-col gap-12"
              >
                {/* Hero Section */}
                {/* Hero Section */}
                <div className="text-center flex flex-col items-center gap-5 max-w-2xl mx-auto pt-6 pb-2">
                  {/* Premium Brand Badge */}
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 120 }}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F59E0B]/10 to-amber-500/10 border border-[#F59E0B]/20 rounded-full px-4 py-1.5 text-[11px] font-semibold text-[#F59E0B] tracking-wide uppercase select-none hover:shadow-md hover:shadow-[#F59E0B]/5 duration-300"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Simple Productivity Workspace
                  </motion.div>

                  <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 120, delay: 0.15 }}
                    className="font-display font-black text-4xl sm:text-5xl text-white tracking-tight leading-[1.2] max-w-xl min-h-[96px] sm:min-h-[120px] flex flex-wrap justify-center gap-x-2"
                  >
                    <span>Never fall behind on your</span>
                    <TypewriterHeadline />
                  </motion.h1>
                  
                  <motion.p 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 120, delay: 0.3 }}
                    className="font-sans text-sm sm:text-base text-on-surface-variant max-w-md leading-relaxed"
                  >
                    Clutch is a lightweight workspace designed to beat procrastination, split overwhelming projects into action steps, and keep you on track.
                  </motion.p>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 120, delay: 0.45 }}
                    className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full sm:w-auto mt-2"
                  >
                    <button 
                      onClick={() => { 
                        let activeUser = user;
                        if (!activeUser) {
                          localStorage.removeItem("clutch_is_logged_out");
                          const name = localStorage.getItem("clutch_profile_name") || "Operator";
                          const photo = localStorage.getItem("clutch_profile_photo") || "https://api.dicebear.com/7.x/initials/svg?seed=Operator";
                          activeUser = {
                            uid: "local-user",
                            displayName: name,
                            email: "local-user@clutch.io",
                            emailVerified: true,
                            photoURL: photo
                          };
                          setUser(activeUser);
                        }
                        if (onboarding.completed) {
                          setCurrentView("dashboard");
                        } else {
                          setCurrentView("onboarding");
                          setOnbStep(1);
                        }
                      }}
                      className="px-8 py-3 bg-[#F59E0B] hover:bg-[#F59E0B]/95 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-[#F59E0B]/15 text-bg-dark font-sans font-black text-xs uppercase tracking-wider rounded-full shadow-lg active:scale-95 transition-all w-full sm:w-auto cursor-pointer duration-200"
                    >
                      {user && onboarding.completed ? "Go to Dashboard" : "Enter Workspace"}
                    </button>
                    {!user && (
                      <button 
                        onClick={() => { 
                          setIsSignUp(false);
                          setShowAuthModal(true);
                        }}
                        className="px-8 py-3 bg-[#2b2d31] hover:bg-[#3f4248] hover:translate-y-[-2px] hover:shadow-lg hover:shadow-white/5 text-white border border-[#3f4248] font-sans font-bold text-xs uppercase tracking-wider rounded-full active:scale-95 transition-all w-full sm:w-auto cursor-pointer duration-200"
                      >
                        Login to Workspace
                      </button>
                    )}
                  </motion.div>
                </div>

                {/* 3 Key Features Section */}
                <motion.div 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.12,
                        delayChildren: 0.55
                      }
                    }
                  }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
                >
                  {/* Feature 1: Smart Plan */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 22, stiffness: 150 } }
                    }}
                    className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 relative overflow-hidden group hover:border-[#F59E0B]/30 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-[#F59E0B]/5 active:scale-[0.99] transition-all duration-300 text-left flex flex-col justify-between h-full min-h-[250px]"
                  >
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] group-hover:rotate-6 duration-300">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-[#F59E0B] duration-300">Smart Plan</h3>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        Instantly break down overwhelming milestones into realistic, step-by-step focus blocks tailored to your day.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="bg-[#2b2d31]/50 p-3 rounded-xl border border-outline-variant/10 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                          <Loader2 className="w-3 h-3 text-[#F59E0B] animate-spin" />
                          <span>Splitting project scope...</span>
                        </div>
                        <div className="w-full bg-[#1e1f22] h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#F59E0B] h-full w-[65%]" />
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Feature 2: 15m Focus */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 22, stiffness: 150 } }
                    }}
                    className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 relative overflow-hidden group hover:border-[#F59E0B]/30 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-[#F59E0B]/5 active:scale-[0.99] transition-all duration-300 text-left flex flex-col justify-between h-full min-h-[250px]"
                  >
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] group-hover:rotate-6 duration-300">
                        <Timer className="w-5 h-5" />
                      </div>
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-[#F59E0B] duration-300">15m Focus</h3>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        Beat starting friction. Commit to just 15 minutes of uninterrupted focus to get the momentum you need.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="border border-[#F59E0B]/20 bg-[#F59E0B]/5 rounded-xl py-3 text-center">
                        <span className="font-display font-black text-2xl text-[#F59E0B]">15:00</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Feature 3: Visual Progress */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 22, stiffness: 150 } }
                    }}
                    className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 relative overflow-hidden group hover:border-[#F59E0B]/30 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-[#F59E0B]/5 active:scale-[0.99] transition-all duration-300 text-left flex flex-col justify-between h-full min-h-[250px]"
                  >
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] group-hover:rotate-6 duration-300">
                        <Zap className="w-5 h-5" />
                      </div>
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-[#F59E0B] duration-300">Visual Progress</h3>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        A distraction-free dashboard that tracks your tasks visually, keeping you focused on one simple check at a time.
                      </p>
                    </div>
                    <div className="mt-4 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-[#F59E0B] bg-[#F59E0B]/5 px-2.5 py-1.5 rounded-lg border border-[#F59E0B]/10">
                        <Check className="w-3.5 h-3.5 shrink-0" /> First milestone complete
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant bg-[#2b2d31]/50 px-2.5 py-1.5 rounded-lg border border-outline-variant/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/40 shrink-0" /> Remaining timeline secure
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Premium Footer */}
                <footer className="w-full border-t border-[#2b2d31]/60 pt-10 pb-6 mt-12 text-center select-none flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-on-surface-variant/60 font-sans max-w-5xl mx-auto w-full px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-[#F59E0B] tracking-wide uppercase text-sm">CLUTCH</span>
                      <span className="text-[10px] bg-surface-container border border-outline-variant/30 px-2 py-0.5 rounded text-on-surface-variant">Local Workspace</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-on-surface-variant/75 font-semibold">
                      <button onClick={() => { setShowPrivacyModal(true); }} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
                      <span className="text-outline-variant/30 hidden sm:inline">•</span>
                      <button onClick={() => { setShowPrivacyModal(true); }} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
                      <span className="text-outline-variant/30 hidden sm:inline">•</span>
                      <span className="text-on-surface-variant/50">100% Client-Side Sandbox</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-on-surface-variant/40 font-mono mt-2">
                    © {new Date().getFullYear()} Clutch. All rights reserved. Operating in secure offline-first memory.
                  </div>
                </footer>
              </motion.section>
            )}

            {/* VIEW: DASHBOARD PANEL */}
            {onboarding.completed && currentView === "dashboard" && (
              <motion.section 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6 font-sans"
              >
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3 pb-2 border-b border-outline-variant/10">
                  <div>
                    <h2 className="font-display font-black text-3xl text-white">Dashboard</h2>
                    <p className="text-xs text-on-surface-variant -mt-1 font-sans">Track. Focus. Finish.</p>
                  </div>
                  <button 
                    onClick={() => { open15MinModal(); }}
                    className="sm:w-auto bg-surface-container border border-outline-variant/30 hover:border-[#F59E0B]/30 px-5 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 text-on-surface"
                  >
                    <Timer className="w-3.5 h-3.5 text-[#F59E0B]" />
                    15m Sprint
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column (8/12 blocks): High Content Priority (Active Project and catalog) */}
                  <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                    
                    {/* Active Focus Card */}
                    {activeTask ? (
                      <>
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 relative overflow-hidden group shadow-md text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                          <Sparkles className="w-24 h-24 text-[#F59E0B]" />
                        </div>
                        <div className="relative z-10 flex flex-col gap-4">
                          
                          {/* Badges / Header details */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {activeTask.riskRating === "CRITICAL" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-danger/15 text-danger border border-danger/35">
                                  <AlertTriangle className="w-3 h-3" />
                                  NEEDS ATTENTION (Score: {activeTask.riskScore})
                                </span>
                              ) : activeTask.riskRating === "AT RISK" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/35">
                                  <AlertTriangle className="w-3 h-3" />
                                  AT RISK (Score: {activeTask.riskScore})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/35">
                                  <Check className="w-3 h-3" />
                                  SAFE PROJECTION (Score: {activeTask.riskScore})
                                </span>
                              )}

                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-medium">
                                <Calendar className="w-3 h-3" />
                                {getDaysLeft(activeTask.deadline)}
                              </span>

                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-mono">
                                {activeTask.hoursPerDay}h/day
                              </span>
                            </div>

                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => { setCurrentView("execute"); }}
                                className="px-3 py-1.5 bg-[#F59E0B] text-bg-dark font-display font-black text-[10px] uppercase rounded-full shadow-md hover:opacity-90 active:scale-95 transition-all"
                              >
                                Execute &rarr;
                              </button>
                            </div>
                          </div>

                          {/* Title and details */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Active Project Objective</span>
                            <h3 className="font-display font-medium text-2xl text-on-surface leading-tight">{activeTask.name}</h3>
                            <p className="text-on-surface-variant text-xs leading-relaxed line-clamp-2">{activeTask.successCondition}</p>
                          </div>

                          {/* Progress Tracker */}
                          <div className="space-y-1.5 pt-2 border-t border-outline-variant/10">
                            <div className="flex justify-between text-xs text-on-surface-variant">
                              <span className="font-mono text-[10px]">Current Progress Metric</span>
                              <span className="text-on-surface font-bold">{activeTask.currentProgress}% Ready</span>
                            </div>
                            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden border border-outline-variant/10 flex">
                              <div 
                                className="bg-[#F59E0B] h-full rounded-full transition-all duration-700 relative overflow-hidden"
                                style={{ width: `${activeTask.currentProgress}%` }}
                              >
                                <div className="absolute inset-0 bg-white/10 w-full animate-shimmer" />
                              </div>
                            </div>
                          </div>

                          {/* Next Recommended Action Panel */}
                          <div className="p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/30 flex items-start gap-2 text-left">
                            <Zap className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 shrink-0 animate-pulse" />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#F59E0B]">Next Task Directive</span>
                              <p className="text-xs text-on-surface font-medium leading-relaxed">{getRecommendedAction(activeTask)}</p>
                            </div>
                          </div>

                          {/* Primary Action Button */}
                          <div className="pt-1 flex gap-2">
                            <button 
                              onClick={() => { setCurrentView("execute"); }}
                              className="flex-1 px-4 py-2.5 bg-[#F59E0B] text-bg-dark text-xs font-black rounded-full shadow-lg hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-bg-dark text-bg-dark" />
                              <span>LAUNCH FOCUS SESSION</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => { setCurrentView("rescue"); }}
                              className="px-4 py-2.5 border border-outline-variant/30 hover:border-[#F59E0B] text-on-surface text-xs font-bold rounded-full hover:bg-surface-container-low transition-all"
                            >
                              Recovery Plan
                            </button>
                          </div>

                        </div>
                      </div>

                      {/* AI Suggestions Card */}
                      <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-4 flex flex-col gap-3 text-left">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                          <h4 className="font-display font-bold text-sm text-white">AI Focus Suggestion</h4>
                        </div>
                        
                        {aiCalendarError ? (
                          <div className="p-3 bg-danger/5 border border-danger/20 rounded-xl space-y-2">
                            <p className="text-xs text-danger leading-relaxed text-center">{aiCalendarError}</p>
                            <button
                              onClick={getAiCalendarSuggestion}
                              className="w-full py-1.5 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-[10px] rounded-xl border border-[#F59E0B]/20 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Retry Suggestion
                            </button>
                          </div>
                        ) : !aiCalendarSuggestion ? (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10">
                            <p className="text-xs text-on-surface-variant leading-relaxed">Let Clutch analyze your deadline and recommend an optimized calendar block for today.</p>
                            <button
                              onClick={getAiCalendarSuggestion}
                              className="shrink-0 px-3.5 py-1.5 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-[11px] rounded-xl border border-[#F59E0B]/20 transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Generate Suggestion</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl space-y-3 relative overflow-hidden">
                            <div className="space-y-1 text-left">
                              <h4 className="font-bold text-xs text-white uppercase tracking-tight">{aiCalendarSuggestion.title}</h4>
                              <div className="flex flex-wrap gap-x-3 text-[10px] font-mono text-on-surface-variant">
                                <span>📅 {aiCalendarSuggestion.date}</span>
                                <span>🕒 {aiCalendarSuggestion.startTime} - {aiCalendarSuggestion.endTime}</span>
                              </div>
                              <p className="text-xs text-on-surface-variant leading-relaxed mt-1 font-sans italic">"{aiCalendarSuggestion.text}"</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={acceptAiCalendarSuggestion}
                                className="px-3 py-1.5 bg-[#F59E0B] text-bg-dark font-sans font-bold text-[10px] uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Add to Calendar
                              </button>
                              <button
                                onClick={() => setAiCalendarSuggestion(null)}
                                className="px-3 py-1.5 border border-outline-variant/30 text-on-surface-variant hover:text-white font-sans font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-surface-container-low transition-all cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* NEW: TRAJECTORY HEALTH & CAN I FINISH DIAGNOSTICS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Project Health & Risk Widget */}
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 flex flex-col gap-4 text-left relative overflow-hidden">
                          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-[#F59E0B]" />
                              <h4 className="font-display font-bold text-sm text-white">Project Health</h4>
                            </div>
                            {isHealthLoading ? (
                              <span className="text-[10px] text-on-surface-variant animate-pulse uppercase tracking-widest font-mono">Analyzing...</span>
                            ) : (
                              <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-mono">Live Diagnosis</span>
                            )}
                          </div>

                          {projectHealthError ? (
                            <div className="text-center py-4 text-xs text-danger font-sans bg-danger/5 border border-danger/20 p-3 rounded-xl">
                              {projectHealthError}
                            </div>
                          ) : projectHealthData ? (
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center gap-2">
                                {projectHealthData.status === "Safe" ? (
                                  <div className="px-2.5 py-1 bg-success/10 border border-success/30 rounded-lg text-xs font-bold text-success flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Safe Projection</span>
                                  </div>
                                ) : projectHealthData.status === "Needs Attention" || projectHealthData.status === "At Risk" ? (
                                  <div className="px-2.5 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg text-xs font-bold text-[#F59E0B] flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                    <span>Needs Attention</span>
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-1 bg-danger/10 border border-danger/30 rounded-lg text-xs font-bold text-danger flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                    <span>Critical Trajectory</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-on-surface font-sans leading-relaxed">
                                {projectHealthData.text}
                              </p>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-xs text-on-surface-variant font-sans">
                              {isHealthLoading ? "Compiling health signals..." : "No health signals compiled yet."}
                            </div>
                          )}
                        </div>

                        {/* Can I Still Finish? Widget */}
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-5 flex flex-col gap-4 text-left relative overflow-hidden">
                          <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-[#6366F1]" />
                              <h4 className="font-display font-bold text-sm text-white">Can I Still Finish?</h4>
                            </div>
                            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-mono">Trajectory Coach</span>
                          </div>

                          {canFinishError ? (
                            <div className="space-y-3">
                              <p className="text-xs text-danger leading-relaxed font-sans bg-danger/5 border border-danger/20 p-3 rounded-xl text-center">
                                {canFinishError}
                              </p>
                              <button
                                onClick={() => handleCanFinishAnalyze(canFinishDeadline, canFinishProgress, canFinishHours)}
                                className="w-full py-2 bg-[#6366F1] text-white font-sans font-extrabold text-[11px] rounded-xl uppercase tracking-wider text-center cursor-pointer"
                              >
                                Retry Trajectory Analysis
                              </button>
                            </div>
                          ) : !canFinishData ? (
                            <div className="space-y-3">
                              <p className="text-[11px] text-on-surface-variant leading-relaxed font-sans">
                                Evaluate your trajectory based on active progress, remaining available working hours, and deadline pressure.
                              </p>
                              
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono tracking-wider text-on-surface-variant block">Hours Available</label>
                                  <input 
                                    type="number" 
                                    value={canFinishHours}
                                    onChange={(e) => setCanFinishHours(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full bg-surface-container-high border border-outline-variant/20 text-white rounded-xl text-xs p-2 text-center outline-none font-mono"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono tracking-wider text-on-surface-variant block">Progress %</label>
                                  <input 
                                    type="number" 
                                    value={canFinishProgress}
                                    onChange={(e) => setCanFinishProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="w-full bg-surface-container-high border border-outline-variant/20 text-white rounded-xl text-xs p-2 text-center outline-none font-mono"
                                  />
                                </div>
                              </div>

                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleCanFinishAnalyze(activeTask?.deadline || "Tomorrow", canFinishProgress, canFinishHours)}
                                disabled={isCanFinishLoading}
                                className="w-full py-2 bg-[#6366F1] hover:bg-[#6366F1]/90 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md"
                              >
                                {isCanFinishLoading ? "Analyzing..." : "Analyze Trajectory"}
                              </motion.button>
                            </div>
                          ) : (
                            <div className="space-y-3 font-sans">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-on-surface-variant font-sans">Project Status:</span>
                                <span className={`text-xs font-black uppercase ${
                                  canFinishData.status === "Likely" || canFinishData.status === "Safe" ? "text-success" : canFinishData.status === "At Risk" ? "text-[#F59E0B]" : "text-danger"
                                }`}>
                                  {canFinishData.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 bg-surface-container-high/30 p-2.5 rounded-xl border border-outline-variant/10 text-center font-mono">
                                <div>
                                  <span className="text-[8px] uppercase tracking-wider text-on-surface-variant block font-sans">Hrs Needed</span>
                                  <span className="text-xs font-bold text-white">{canFinishData.hoursNeeded}h</span>
                                </div>
                                <div>
                                  <span className="text-[8px] uppercase tracking-wider text-on-surface-variant block font-sans">Sessions</span>
                                  <span className="text-xs font-bold text-white">{canFinishData.sessionsNeeded}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] uppercase tracking-wider text-on-surface-variant block font-sans">Days Left</span>
                                  <span className="text-xs font-bold text-white">{canFinishData.daysNeeded}d</span>
                                </div>
                              </div>
                              <p className="text-[11px] text-on-surface-variant italic leading-relaxed text-left">
                                "{canFinishData.explanation}"
                              </p>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setCanFinishData(null)}
                                className="w-full py-1.5 border border-outline-variant/20 text-on-surface-variant hover:text-white text-xs rounded-lg font-bold transition-all hover:bg-surface-container-high cursor-pointer"
                              >
                                Reset Analysis
                              </motion.button>
                            </div>
                          )}
                        </div>

                      </div>
                    </>
                  ) : (
                      <div className="bg-surface-container border border-outline-variant/15 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#F59E0B] to-[#6366F1]" />
                        <div className="w-14 h-14 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] mb-2 animate-bounce">
                          <Plus className="w-6 h-6 text-[#F59E0B]" />
                        </div>
                        <div className="text-center space-y-1.5 max-w-sm">
                          <h4 className="font-display font-black text-white text-lg">Create Your First Project</h4>
                          <p className="text-xs text-on-surface-variant font-sans leading-relaxed text-center">
                            No active projects yet. Start a project and Clutch will help you stay on track.
                          </p>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setShowCreateTaskModal(true); }}
                          className="mt-2 px-6 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-black text-xs rounded-full uppercase tracking-wider text-center transition-all shadow-md"
                        >
                          [ Create Project ]
                        </motion.button>
                      </div>
                    )}

                    {/* Dashboard Objectives Catalog */}
                    <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-display font-bold text-base text-white">Focus Objectives Catalog</h3>
                         <motion.button 
                           whileHover={{ scale: 1.05 }}
                           whileTap={{ scale: 0.95 }}
                           onClick={() => { setShowCreateTaskModal(true); }}
                           className="px-3 py-1 rounded-full border border-outline-variant/30 hover:border-[#F59E0B] text-[10px] font-bold transition-all flex items-center gap-1 text-on-surface-variant hover:text-[#F59E0B]"
                         >
                           <Plus className="w-3 h-3" />
                           Add Project
                         </motion.button>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {projects.map((proj) => (
                          <motion.div 
                            layout
                            whileHover={{ scale: 1.01, borderColor: "rgba(245, 158, 11, 0.45)" }}
                            key={proj.id} 
                            className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                              proj.id === activeProjectId 
                                ? "border-[#F59E0B]/50 bg-surface-container-high/60" 
                                : "border-outline-variant/10 bg-surface-container-low"
                            }`}
                          >
                            <div className="space-y-0.5 flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-1.5">
                                {proj.isCompleted ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success/15 text-success">Finished</span>
                                ) : proj.isAtRisk ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-danger/15 text-danger">At Risk</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-info/15 text-info">Ongoing</span>
                                )}
                                <span className="text-[10px] text-on-surface-variant font-medium">{formatDeadlineDate(proj.deadline)}</span>
                              </div>
                              <h4 className="font-display font-bold text-on-surface text-sm leading-tight truncate">{proj.name}</h4>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] text-on-surface-variant leading-none">Progress</span>
                                <span className="text-xs font-bold text-[#F59E0B]">{proj.currentProgress}%</span>
                              </div>

                              <div className="flex gap-1.5">
                                <button 
                                  onClick={() => { setActiveProjectId(proj.id); triggerNotification(`Active monitoring switched: "${proj.name}"`); }}
                                  className="px-3 py-1.5 border border-outline-variant/30 hover:border-[#F59E0B] hover:text-[#F59E0B] rounded-full text-[10px] font-bold transition-colors text-on-surface-variant"
                                >
                                  Highlight
                                </button>
                                <button 
                                  onClick={() => { handleDeleteProject(proj.id); }}
                                  className="p-1.5 hover:text-danger rounded text-on-surface-variant hover:bg-danger/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column (4/12 blocks): Secondary actions, future projection */}
                  <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">

                    {/* NEW: TODAY'S AI PLAN WIDGET */}
                    <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-4 flex flex-col gap-3.5 text-left">
                      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                          <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">Today's AI Plan</h3>
                        </div>
                        {isDailyPlanLoading ? (
                          <span className="text-[8px] text-[#F59E0B] font-mono animate-pulse uppercase font-bold">Planning...</span>
                        ) : (
                          <span className="text-[8px] text-on-surface-variant font-mono uppercase font-bold">Dynamic Plan</span>
                        )}
                      </div>

                      {dailyPlanError ? (
                        <div className="space-y-3">
                          <p className="text-xs text-danger leading-relaxed font-sans bg-danger/5 border border-danger/20 p-3 rounded-xl text-center">
                            {dailyPlanError}
                          </p>
                          <button
                            onClick={handleBuildDailyPlan}
                            disabled={isDailyPlanLoading}
                            className="w-full py-2 bg-[#F59E0B] text-bg-dark font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkle className="w-3.5 h-3.5 fill-bg-dark text-bg-dark" />
                            <span>Retry Today's Plan</span>
                          </button>
                        </div>
                      ) : !dailyPlan ? (
                        <div className="space-y-3">
                          <p className="text-xs text-on-surface-variant leading-relaxed font-sans">
                            Formulate a highly focused tactical roadmap for today based on your active notes, checklist, and deadlines.
                          </p>
                          <button
                            onClick={handleBuildDailyPlan}
                            disabled={isDailyPlanLoading}
                            className="w-full py-2 bg-[#F59E0B] text-bg-dark font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkle className="w-3.5 h-3.5 fill-bg-dark text-bg-dark" />
                            <span>Build Today's Plan</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 font-sans">
                          {/* Priority Banner */}
                          <div className="p-3 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/25 text-white">
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-[#F59E0B] block mb-0.5">Primary Priority:</span>
                            <span className="text-xs font-bold leading-normal">{dailyPlan.priority}</span>
                          </div>

                          {/* Focus Sessions */}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 bg-surface-container-high/40 p-2.5 rounded-xl border border-outline-variant/10">
                              <span className="text-[9px] font-mono text-[#F59E0B] font-extrabold bg-[#F59E0B]/10 w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">S1</span>
                              <div className="space-y-0.5">
                                <span className="text-[8px] font-mono uppercase tracking-wider text-on-surface-variant block font-bold">Session 1</span>
                                <span className="text-xs text-white leading-normal font-medium">{dailyPlan.session1}</span>
                              </div>
                            </div>

                            <div className="flex items-start gap-2 bg-surface-container-high/40 p-2.5 rounded-xl border border-outline-variant/10">
                              <span className="text-[9px] font-mono text-[#6366F1] font-extrabold bg-[#6366F1]/10 w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 mt-0.5">S2</span>
                              <div className="space-y-0.5">
                                <span className="text-[8px] font-mono uppercase tracking-wider text-on-surface-variant block font-bold">Session 2</span>
                                <span className="text-xs text-white leading-normal font-medium">{dailyPlan.session2}</span>
                              </div>
                            </div>
                          </div>

                          {/* Optional Tasks */}
                          {dailyPlan.optionalTasks && dailyPlan.optionalTasks.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-outline-variant/5">
                              <span className="text-[8px] uppercase tracking-wider font-extrabold text-on-surface-variant block">Suggested Next Tasks:</span>
                              <div className="flex flex-col gap-1">
                                {dailyPlan.optionalTasks.map((t, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                                    <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant shrink-0" />
                                    <span>{t}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => setDailyPlan(null)}
                            className="w-full py-1 text-[10px] uppercase font-mono tracking-wider text-on-surface-variant hover:text-white transition-all text-center"
                          >
                            [ Reset Plan ]
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Quick Tools Header */}
                    <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-3.5 flex flex-col gap-2.5">
                      <h3 className="font-display font-bold text-[11px] text-on-surface-variant uppercase tracking-wider text-left">Quick Actions</h3>
                      <div className="grid grid-cols-1 gap-2">
                        
                        {/* Option 1: Recovery Plan */}
                        <button 
                          onClick={() => { setCurrentView("rescue"); }}
                          className="bg-[#F59E0B] hover:opacity-95 text-bg-dark rounded-xl p-2.5 flex items-center justify-between transition-all text-left font-sans cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-bg-dark shrink-0">
                              <Sparkles className="w-3.5 h-3.5 text-bg-dark shrink-0" />
                            </div>
                            <div>
                              <h4 className="font-display font-black text-xs uppercase leading-none">Recovery Plan</h4>
                              <p className="text-[8px] text-bg-dark/75 font-bold mt-0.5">Build a custom timeline</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-bg-dark shrink-0" />
                        </button>

                        {/* Option 2: Focus Session (continue working) */}
                        <button 
                          onClick={() => { setCurrentView("execute"); }}
                          className="bg-surface-container-high hover:bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 flex items-center justify-between transition-all text-left font-sans cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface shrink-0">
                              <Play className="w-3 fill-on-surface text-on-surface" />
                            </div>
                            <div>
                              <h4 className="font-display font-bold text-xs text-on-surface leading-none">Focus Session</h4>
                              <p className="text-[8px] text-on-surface-variant font-medium mt-0.5">Resume 15-minute timer</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                        </button>

                        {/* Option 3: 15 Mins Quick sprint */}
                        <button 
                          onClick={() => { open15MinModal(); }}
                          className="bg-surface-container-high hover:bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 flex items-center justify-between transition-all text-left font-sans cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface shrink-0">
                              <Timer className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="font-display font-bold text-xs text-on-surface leading-none">Quick 15-Min Sprint</h4>
                              <p className="text-[8px] text-on-surface-variant font-medium mt-0.5">Slam through friction</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                        </button>

                        {/* Option 4: Explain My Project (AI Summary) */}
                        <button 
                          onClick={handleProjectSummary}
                          disabled={isProjectSummaryLoading}
                          className="bg-surface-container-high hover:bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 flex items-center justify-between transition-all text-left font-sans cursor-pointer disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface shrink-0">
                              <Compass className="w-3.5 h-3.5 text-[#F59E0B]" />
                            </div>
                            <div>
                              <h4 className="font-display font-bold text-xs text-on-surface leading-none">
                                {isProjectSummaryLoading ? "Summarizing..." : "Explain My Project"}
                              </h4>
                              <p className="text-[8px] text-on-surface-variant font-medium mt-0.5">Instant AI overview & risks</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                        </button>

                        {/* Option 5: Review Today (End of Day Review) */}
                        <button 
                          onClick={handleEndOfDayReview}
                          disabled={isEodLoading}
                          className="bg-surface-container-high hover:bg-surface-container border border-outline-variant/30 rounded-xl p-2.5 flex items-center justify-between transition-all text-left font-sans cursor-pointer disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface shrink-0">
                              <CheckCircle className="w-3.5 h-3.5 text-[#6366F1]" />
                            </div>
                            <div>
                              <h4 className="font-display font-bold text-xs text-on-surface leading-none">
                                {isEodLoading ? "Reviewing..." : "Review Today"}
                              </h4>
                              <p className="text-[8px] text-on-surface-variant font-medium mt-0.5">End of day progression report</p>
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                        </button>

                      </div>
                    </div>

                    {/* Compact Dashboard Calendar Widget */}
                    {(() => {
                      const now = new Date();
                      const currentYr = now.getFullYear();
                      const currentMth = now.getMonth();
                      const currentDay = now.getDate();
                      const monthNames = [
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"
                      ];
                      const daysInMonth = new Date(currentYr, currentMth + 1, 0).getDate();
                      const firstDayIndex = new Date(currentYr, currentMth, 1).getDay();

                      const daysArray = [];
                      for (let i = 0; i < firstDayIndex; i++) {
                        daysArray.push(null);
                      }
                      for (let d = 1; d <= daysInMonth; d++) {
                        daysArray.push(d);
                      }

                      return (
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-3.5 flex flex-col gap-2.5 text-left font-sans shadow-md">
                          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-1.5">
                            <h3 className="font-display font-bold text-[10px] text-white uppercase tracking-wider flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#F59E0B]" />
                              <span>{monthNames[currentMth]} {currentYr}</span>
                            </h3>
                            <span className="text-[8px] bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#6366F1] px-1.5 py-0.5 rounded-full font-bold">
                              Day {currentDay}
                            </span>
                          </div>

                          {/* Days of week headers */}
                          <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-bold text-on-surface-variant uppercase tracking-wider">
                            {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                              <div key={idx} className="h-4 flex items-center justify-center">{d}</div>
                            ))}
                          </div>

                          {/* Days grid */}
                          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                            {daysArray.map((dayNum, idx) => {
                              if (dayNum === null) {
                                  return <div key={`empty-${idx}`} className="h-5" />;
                              }
                              const isToday = dayNum === currentDay;
                              return (
                                <div 
                                  key={`day-${dayNum}`} 
                                  className={`h-5 w-5 mx-auto flex items-center justify-center rounded-md font-medium transition-all ${
                                    isToday 
                                      ? "bg-[#F59E0B] text-bg-dark font-black shadow shadow-[#F59E0B]/20 scale-105" 
                                      : "hover:bg-surface-variant/20 text-on-surface-variant hover:text-white"
                                  }`}
                                >
                                  {dayNum}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Upcoming Focus Session Widget */}
                    {(() => {
                      const upcoming = calendarEvents
                        .filter(e => e.startTime && new Date(e.startTime) >= new Date())
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                      const nextEvent = upcoming[0];

                      return (
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-3.5 flex flex-col gap-2 text-left font-sans">
                          <h3 className="font-display font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">Upcoming Focus Session</h3>
                          {nextEvent ? (
                            <div className="p-2.5 rounded-xl bg-surface-container-high/40 border border-outline-variant/10 flex flex-col gap-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-xs text-white truncate">{nextEvent.title}</h4>
                                <span className="text-[8px] uppercase tracking-wider font-mono text-[#F59E0B] font-bold shrink-0">NEXT</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                                <Calendar className="w-3 h-3 text-[#F59E0B]" />
                                <span>{new Date(nextEvent.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                <span>•</span>
                                <span>{new Date(nextEvent.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 text-center flex flex-col gap-1.5 items-center justify-center py-4">
                              <p className="text-[10px] text-on-surface-variant font-medium">No upcoming focus sessions</p>
                              <button 
                                onClick={() => { setCurrentView("calendar"); }}
                                className="px-2.5 py-1 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/20 rounded-lg text-[9px] font-bold transition-all"
                              >
                                Schedule Focus
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Recent Notes Widget */}
                    {(() => {
                      const notes = activeTask?.quickNotes || [];
                      const topNotes = notes.slice(0, 2);

                      return (
                        <div className="bg-surface-container border border-outline-variant/20 rounded-2xl p-3.5 flex flex-col gap-2 text-left font-sans">
                          <h3 className="font-display font-bold text-[11px] text-on-surface-variant uppercase tracking-wider">Recent Project Notes</h3>
                          {topNotes.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {topNotes.map(note => (
                                <div 
                                  key={note.id} 
                                  onClick={() => { setCurrentView("notes"); }}
                                  className="p-2 bg-surface-container-high/30 hover:bg-surface-container-high/60 border border-outline-variant/10 rounded-xl cursor-pointer transition-colors"
                                >
                                  <h4 className="font-bold text-xs text-white truncate">{note.title || "Untitled Note"}</h4>
                                  <p className="text-[10px] text-on-surface-variant line-clamp-1 mt-0.5 font-sans leading-normal">{note.content || "Empty content..."}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/10 text-center flex flex-col gap-1.5 items-center justify-center py-4">
                              <p className="text-[10px] text-on-surface-variant font-medium">No recent project notes</p>
                              <button 
                                onClick={() => { setCurrentView("notes"); }}
                                className="px-2.5 py-1 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/20 rounded-lg text-[9px] font-bold transition-all"
                              >
                                Take Notes
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  </div>

                </div>

              </motion.section>
            )}

            {/* VIEW: NOTES */}
            {onboarding.completed && currentView === "notes" && (() => {
              const activeTaskNotes = activeTask?.quickNotes || [];
              const filteredNotes = activeTaskNotes.filter(n => 
                n.title.toLowerCase().includes(notesSearchQuery.toLowerCase()) ||
                n.content.toLowerCase().includes(notesSearchQuery.toLowerCase())
              );
              const selectedNote = activeTaskNotes.find(n => n.id === activeNoteId) || activeTaskNotes[0];
              
              return (
                <motion.section
                  key="notes"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="w-full max-w-5xl mx-auto py-6 px-4 md:px-8 font-sans"
                >
                  <div className="flex flex-col md:flex-row items-stretch gap-6 h-[calc(100vh-180px)] min-h-[520px]">
                    {/* Sidebar notes list */}
                    <div className="w-full md:w-80 bg-surface-container border border-outline-variant/20 rounded-3xl p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display font-bold text-lg text-white">Quick Notes</h2>
                        <button 
                          onClick={handleAddNote}
                          className="p-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] rounded-xl transition-all"
                          title="Create New Note"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <input 
                        type="text"
                        value={notesSearchQuery}
                        onChange={(e) => setNotesSearchQuery(e.target.value)}
                        placeholder="Search notes..."
                        className="w-full bg-surface-container-high border border-outline-variant/30 text-white rounded-xl text-xs p-3 focus:border-[#F59E0B] outline-none font-sans"
                      />

                      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                        {activeTaskNotes.length === 0 ? (
                          <div className="text-center py-12 text-on-surface-variant text-xs font-sans leading-relaxed">
                            No notes yet. Capture ideas before you forget them.
                          </div>
                        ) : filteredNotes.length === 0 ? (
                          <div className="text-center py-12 text-on-surface-variant text-xs font-sans">
                            No matching notes found.
                          </div>
                        ) : (
                          filteredNotes.map((note) => {
                            const isActive = selectedNote && note.id === selectedNote.id;
                            const snippet = note.content.slice(0, 50) + (note.content.length > 50 ? "..." : "");
                            return (
                              <div 
                                key={note.id}
                                onClick={() => setActiveNoteId(note.id)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                                  isActive 
                                    ? "bg-[#F59E0B]/10 border-[#F59E0B]" 
                                    : "bg-surface-container-high/40 border-outline-variant/20 hover:border-outline-variant/50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h3 className="font-bold text-xs text-white truncate w-11/12">{note.title || "Untitled Note"}</h3>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                                    className="text-on-surface-variant hover:text-danger p-1 rounded hover:bg-danger/10 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-[11px] text-[#A0AEC0] line-clamp-2 h-8 leading-tight mb-2">
                                  {snippet || <span className="italic opacity-60">No content yet...</span>}
                                </p>
                                <div className="flex justify-between items-center text-[9px] text-on-surface-variant/85 font-mono">
                                  <span>{note.content.length}/500 chars</span>
                                  <span>{formatRelativeTime(note.lastUpdated)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Note editor workspace */}
                    <div className="flex-1 bg-surface-container border border-outline-variant/20 rounded-3xl p-6 flex flex-col gap-4 text-left">
                      {selectedNote ? (
                        <>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-4">
                            <div className="text-left">
                              <span className="text-[10px] font-mono text-on-surface-variant/80 uppercase tracking-widest block font-sans">Note Editor Active Workspace</span>
                              <span className="text-xs text-[#A0AEC0] font-bold block mt-0.5">
                                Associated Task: <span className="text-[#F59E0B] font-extrabold">{activeTask?.name}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleExportNote(selectedNote)}
                                className="px-3.5 py-1.5 bg-surface-container-high/60 border border-outline-variant/20 rounded-full text-xs font-bold text-white hover:border-[#F59E0B] flex items-center gap-1.5 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Export Note</span>
                              </button>
                              <span className="text-[9px] text-[#A0AEC0] border-b border-dashed border-[#A0AEC0] uppercase font-mono" title="PDF capability planned">
                                PDF Planned
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4 flex-1 flex flex-col">
                            <input 
                              type="text"
                              value={selectedNote.title}
                              onChange={(e) => handleEditNote(selectedNote.id, e.target.value, selectedNote.content)}
                              placeholder="Note Title"
                              className="w-full bg-transparent text-xl font-display font-black text-white outline-none placeholder:text-on-surface-variant/30 text-left"
                            />

                            <div className="h-44 flex flex-col relative shrink-0">
                              <textarea
                                value={selectedNote.content}
                                onChange={(e) => handleEditNote(selectedNote.id, selectedNote.title, e.target.value)}
                                placeholder="Capture ideas, reminders, quick links, research notes, and thoughts before you forget them..."
                                className="w-full flex-grow bg-surface-container-high/40 border border-outline-variant/20 rounded-2xl p-4 text-sm text-white placeholder:text-on-surface-variant/40 outline-none resize-none focus:border-[#F59E0B]/60 transition-all font-sans leading-relaxed text-left"
                                maxLength={500}
                              />
                              
                              <div className="absolute bottom-3 right-4 flex items-center gap-2.5 bg-surface-container/80 backdrop-blur px-2.5 py-1 rounded-lg">
                                <span className={`text-[10px] font-mono font-bold ${selectedNote.content.length >= 450 ? 'text-danger' : 'text-on-surface-variant'}`}>
                                  {selectedNote.content.length} / 500 chars
                                </span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 border border-success/30 text-success font-mono font-bold uppercase tracking-wider scale-95">
                                  Saved
                                </span>
                              </div>
                            </div>

                            {/* AI Notes Assistant Action Bar */}
                            <div className="flex flex-wrap items-center gap-2 border-t border-b border-outline-variant/10 py-3 shrink-0">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-1.5 mr-2">
                                <Sparkles className="w-3 h-3 text-[#F59E0B] fill-[#F59E0B]/10" />
                                AI Notes Assistant:
                              </span>
                              
                              <button
                                onClick={() => runAiNoteAction("summarize_notes")}
                                disabled={isAiNoteLoading}
                                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/15 text-[10px] font-bold text-white transition-all flex items-center gap-1"
                              >
                                Summarize
                              </button>
                              
                              <button
                                onClick={() => runAiNoteAction("notes_to_tasks")}
                                disabled={isAiNoteLoading}
                                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/15 text-[10px] font-bold text-white transition-all flex items-center gap-1"
                              >
                                Turn Into Tasks
                              </button>
                              
                              <button
                                onClick={() => runAiNoteAction("notes_to_events")}
                                disabled={isAiNoteLoading}
                                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/15 text-[10px] font-bold text-white transition-all flex items-center gap-1"
                              >
                                Plan Calendar Block
                              </button>
                            </div>

                            {/* AI Processing & Output Space */}
                            <div className="flex-1 min-h-0 overflow-y-auto">
                              {isAiNoteLoading && (
                                <div className="p-6 bg-surface-container-low/40 rounded-2xl border border-dashed border-[#F59E0B]/20 flex flex-col items-center justify-center gap-3 py-12 animate-pulse text-center">
                                  <Loader2 className="w-6 h-6 text-[#F59E0B] animate-spin" />
                                  <span className="text-xs text-on-surface-variant font-mono uppercase tracking-widest font-bold">Sparking Clutch AI Engine...</span>
                                </div>
                              )}

                              {aiNoteError && (
                                <div className="p-4 bg-danger/10 border border-danger/25 rounded-2xl text-danger text-sm text-center mb-4 leading-normal font-sans">
                                  {aiNoteError}
                                </div>
                              )}

                              {!isAiNoteLoading && aiNoteResult && (
                                <div className="p-5 bg-bg-dark/40 border border-[#F59E0B]/30 rounded-2xl space-y-3.5 relative overflow-hidden shadow-[0_0_12px_rgba(245,158,11,0.04)] animate-fade-in text-left">
                                  <div className="absolute top-0 right-0 w-20 h-20 bg-[#F59E0B]/5 rounded-full blur-2xl pointer-events-none" />
                                  
                                  <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2 relative">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]/10" />
                                      <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-white">
                                        {aiNoteResult.actionType === "summarize" && "Executive Summary"}
                                        {aiNoteResult.actionType === "tasks" && "Extracted Checklist Tasks"}
                                        {aiNoteResult.actionType === "event" && "Suggested Focus Schedule block"}
                                      </span>
                                    </div>
                                    <button 
                                      onClick={() => setAiNoteResult(null)}
                                      className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant hover:text-white transition-colors"
                                    >
                                      Dismiss
                                    </button>
                                  </div>

                                  <div className="text-xs text-on-surface-variant leading-relaxed font-sans space-y-2">
                                    <p className="font-medium text-white">{aiNoteResult.text}</p>
                                    
                                    {/* Checklist Tasks Render */}
                                    {aiNoteResult.actionType === "tasks" && aiNoteResult.list && aiNoteResult.list.length > 0 && (
                                      <div className="space-y-1.5 pt-2">
                                        {aiNoteResult.list.map((taskText, index) => (
                                          <div key={index} className="flex items-start gap-2 bg-surface-container-high/40 p-2 rounded-xl border border-outline-variant/10 text-white">
                                            <span className="text-[9px] font-mono text-[#F59E0B] font-bold bg-[#F59E0B]/10 px-1.5 py-0.5 rounded">Action {index + 1}</span>
                                            <span className="text-[11px] leading-tight pt-0.5">{taskText}</span>
                                          </div>
                                        ))}

                                        {!activeProjectId ? (
                                          <p className="text-[9px] text-[#F59E0B] italic pt-1 text-center">Select or associate a project in your left side dashboard to enable 1-Click Checklist Import.</p>
                                        ) : (
                                          <button
                                            onClick={importAiNotesToTasks}
                                            className="w-full h-8 mt-3 rounded-xl bg-[#F59E0B] text-bg-dark font-sans font-bold text-[10px] uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                          >
                                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                            Import Extracted Tasks to Project Checklist (1-Click)
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Focus Event Render */}
                                    {aiNoteResult.actionType === "event" && (
                                      <div className="pt-2 space-y-3">
                                        <div className="bg-bg-dark/80 border border-outline-variant/15 p-3 rounded-xl space-y-1">
                                          <p className="font-bold text-xs text-white">{aiNoteResult.title || "Focus block"}</p>
                                          <div className="flex flex-wrap gap-x-3 text-[10px] font-mono text-on-surface-variant">
                                            <span>📅 {aiNoteResult.date || "Today"}</span>
                                            <span>🕒 {aiNoteResult.startTime || "10:00"} - {aiNoteResult.endTime || "11:30"}</span>
                                          </div>
                                        </div>

                                        <button
                                          onClick={importAiNotesToEvent}
                                          className="w-full h-8 rounded-xl bg-[#F59E0B] text-bg-dark font-sans font-bold text-[10px] uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                        >
                                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                          Reserve Suggested Slot in Calendar (1-Click)
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!isAiNoteLoading && !aiNoteResult && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant/40 font-sans text-xs">
                                  <span>Select an AI Note Action above to trigger contextual intelligence extraction.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-surface-container-low/40 rounded-2xl border border-dashed border-outline-variant/15">
                          <FileText className="w-12 h-12 text-on-surface-variant/30 mb-3" />
                          <h3 className="font-display font-medium text-white text-base mb-1">No note selected</h3>
                          <p className="text-xs text-on-surface-variant max-w-xs mb-4 leading-relaxed font-sans">
                            Create a quick note and specify key bookmarks or ideas to persist them.
                          </p>
                          <button
                            onClick={handleAddNote}
                            className="px-5 py-2 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full text-xs hover:opacity-90 active:scale-95 transition-all"
                          >
                            Create Note
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.section>
              );
            })()}

            {/* VIEW: SMART CALENDAR */}
            {onboarding.completed && currentView === "calendar" && (() => {
              const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
              const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
              const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

              const calendarCells: { date: Date | null; dayNum: number | "" }[] = [];
              for (let i = 0; i < firstDayIndex; i++) {
                calendarCells.push({ date: null, dayNum: "" });
              }
              for (let d = 1; d <= daysInMonth; d++) {
                calendarCells.push({ date: new Date(calendarYear, calendarMonth, d), dayNum: d });
              }

              const getDeadlinesForDate = (date: Date) => {
                return projects.filter(p => !p.isArchived && p.deadline && new Date(p.deadline).toDateString() === date.toDateString());
              };

              const currentMonthName = monthNames[calendarMonth];

              const handlePrevMonth = () => {
                if (calendarMonth === 0) {
                  setCalendarMonth(11);
                  setCalendarYear(y => y - 1);
                } else {
                  setCalendarMonth(m => m - 1);
                }
              };

              const handleNextMonth = () => {
                if (calendarMonth === 11) {
                  setCalendarMonth(0);
                  setCalendarYear(y => y + 1);
                } else {
                  setCalendarMonth(m => m + 1);
                }
              };

              const startOfWeek = new Date(selectedDate);
              const day = startOfWeek.getDay(); // 0 is Sunday
              startOfWeek.setDate(startOfWeek.getDate() - day);
              
              const weekDaysList = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startOfWeek);
                d.setDate(d.getDate() + i);
                return d;
              });

              return (
                <motion.section
                  key="calendar"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="w-full max-w-5xl mx-auto py-6 px-4 md:px-8 font-sans text-left"
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-outline-variant/15">
                      <div>
                        <h2 className="font-display font-black text-2xl text-white">Smart Calendar</h2>
                        <p className="text-xs text-on-surface-variant -mt-0.5">Visualize your master plan, focus sessions, and active deadlines.</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* View Type Toggle */}
                        <div className="flex bg-surface-container-high/60 p-1 rounded-xl border border-outline-variant/15 mr-2">
                          {(["month", "week", "upcoming"] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setCalendarViewType(type)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${
                                calendarViewType === type ? "bg-[#F59E0B] text-bg-dark" : "text-on-surface-variant hover:text-white"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        {calendarViewType === "month" && (
                          <div className="flex items-center gap-3 bg-surface-container px-4 py-2 rounded-2xl border border-outline-variant/20">
                            <button onClick={handlePrevMonth} className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-surface-container-high transition-colors">
                              <ArrowLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-white min-w-28 text-center uppercase tracking-wider font-mono">
                              {currentMonthName} {calendarYear}
                            </span>
                            <button onClick={handleNextMonth} className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-surface-container-high transition-colors">
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
                      <div className="lg:col-span-8 bg-surface-container border border-outline-variant/25 rounded-3xl p-5 md:p-6">
                        
                        {/* MONTH VIEW */}
                        {calendarViewType === "month" && (
                          <>
                            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-3 text-center border-b border-outline-variant/10 pb-2">
                              {weekDays.map(wk => (
                                <span key={wk} className="text-[10px] font-mono uppercase font-black text-on-surface-variant tracking-wider">
                                  {wk}
                                </span>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 md:gap-2">
                              {calendarCells.map((cell, idx) => {
                                const isToday = cell.date && cell.date.toDateString() === new Date().toDateString();
                                const isSelected = cell.date && cell.date.toDateString() === selectedDate.toDateString();
                                const cellDeadlines = cell.date ? getDeadlinesForDate(cell.date) : [];
                                const cellEvents = cell.date 
                                  ? calendarEvents.filter(e => e.startTime && new Date(e.startTime).toDateString() === cell.date?.toDateString()) 
                                  : [];
                                
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (cell.date) {
                                        setSelectedDate(cell.date);
                                      }
                                    }}
                                    className={`min-h-16 md:min-h-24 p-1.5 rounded-2xl border flex flex-col justify-start relative transition-colors ${
                                      !cell.date 
                                        ? "bg-transparent border-transparent cursor-default" 
                                        : isSelected
                                        ? "bg-[#F59E0B]/10 border-[#F59E0B] ring-2 ring-[#F59E0B]/25 cursor-pointer"
                                        : isToday
                                        ? "bg-[#F59E0B]/5 border-[#F59E0B]/50 shadow-[0_0_8px_rgba(245,158,11,0.15)] cursor-pointer"
                                        : "bg-surface-container-low/40 border-outline-variant/15 hover:border-outline-variant/40 cursor-pointer"
                                    }`}
                                  >
                                    {cell.date && (
                                      <>
                                        <span className={`text-[10px] font-bold font-mono pl-0.5 ${isSelected ? "text-[#F59E0B]" : isToday ? "text-[#F59E0B]" : "text-[#A0AEC0]"}`}>
                                          {cell.dayNum}
                                        </span>
      
                                        <div className="mt-1 space-y-1 flex-1 overflow-y-auto no-scrollbar">
                                          {cellDeadlines.map((p) => {
                                            const isAtRisk = p.isAtRisk && !p.isCompleted;
                                            return (
                                              <div
                                                key={p.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveProjectId(p.id);
                                                  triggerNotification(`✓ Active Task Focused: "${p.name}"`);
                                                }}
                                                className={`text-[7px] md:text-[9px] px-1 py-0.5 rounded border font-sans truncate cursor-pointer uppercase ${
                                                  p.isCompleted 
                                                    ? "bg-success/5 border-success/30 text-success line-through opacity-80" 
                                                    : isAtRisk
                                                    ? "bg-danger/10 border-danger/30 text-danger" 
                                                    : "bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]"
                                                }`}
                                                title={p.name}
                                              >
                                                {p.name}
                                              </div>
                                            );
                                          })}

                                          {cellEvents.map((evt) => (
                                            <div
                                              key={evt.id}
                                              className="text-[7px] md:text-[8px] px-1 py-0.5 rounded border font-mono truncate uppercase bg-blue-500/10 border-blue-500/30 text-blue-400"
                                              title={evt.title}
                                            >
                                              🕒 {evt.title}
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* WEEK VIEW */}
                        {calendarViewType === "week" && (
                          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                            {weekDaysList.map((dayDate) => {
                              const isToday = dayDate.toDateString() === new Date().toDateString();
                              const isSelected = dayDate.toDateString() === selectedDate.toDateString();
                              const cellDeadlines = getDeadlinesForDate(dayDate);
                              const cellEvents = calendarEvents.filter(e => e.startTime && new Date(e.startTime).toDateString() === dayDate.toDateString());

                              return (
                                <div
                                  key={dayDate.toISOString()}
                                  onClick={() => setSelectedDate(dayDate)}
                                  className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all min-h-[180px] cursor-pointer ${
                                    isSelected 
                                      ? "bg-[#F59E0B]/10 border-[#F59E0B] ring-2 ring-[#F59E0B]/25"
                                      : isToday
                                      ? "bg-[#F59E0B]/5 border-[#F59E0B]/50 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                                      : "bg-surface-container-low/40 border-outline-variant/15 hover:border-outline-variant/40"
                                  }`}
                                >
                                  <div className="border-b border-outline-variant/10 pb-1 text-center">
                                    <span className="text-[10px] font-mono text-on-surface-variant block uppercase">{weekDays[dayDate.getDay()]}</span>
                                    <span className={`text-sm font-bold font-mono ${isToday || isSelected ? 'text-[#F59E0B]' : 'text-white'}`}>{dayDate.getDate()}</span>
                                  </div>

                                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[140px] no-scrollbar">
                                    {cellDeadlines.map(p => (
                                      <div key={p.id} className="text-[8px] md:text-[9px] p-1 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] font-medium truncate uppercase" title={p.name}>
                                        🚨 {p.name}
                                      </div>
                                    ))}
                                    {cellEvents.map(evt => (
                                      <div key={evt.id} className="text-[8px] p-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono truncate uppercase" title={evt.title}>
                                        🕒 {evt.title}
                                      </div>
                                    ))}
                                    {cellDeadlines.length === 0 && cellEvents.length === 0 && (
                                      <div className="h-full flex items-center justify-center text-[8px] text-on-surface-variant/40 italic">Clean Slate</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* UPCOMING VIEW */}
                        {calendarViewType === "upcoming" && (
                          <div className="space-y-4">
                            <h3 className="font-display font-medium text-white text-sm mb-3">Chronological Master Agenda</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Deadlines Column */}
                              <div className="space-y-2.5">
                                <h4 className="text-[10px] font-bold text-on-surface-variant uppercase font-mono tracking-wider border-b border-outline-variant/10 pb-1.5">Upcoming Deadlines</h4>
                                {projects.filter(p => !p.isArchived && p.deadline && new Date(p.deadline) >= new Date()).length === 0 ? (
                                  <p className="text-xs text-on-surface-variant italic py-3 text-center">No upcoming project deadlines.</p>
                                ) : (
                                  projects
                                    .filter(p => !p.isArchived && p.deadline && new Date(p.deadline) >= new Date())
                                    .sort((a,b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                                    .map(p => {
                                      const diff = Math.ceil((new Date(p.deadline!).getTime() - Date.now()) / (1000*3600*24));
                                      return (
                                        <div key={p.id} className="p-3 bg-surface-container-high/40 border border-outline-variant/15 rounded-2xl flex justify-between items-center gap-3 hover:border-outline-variant/30 transition-all">
                                          <div className="min-w-0">
                                            <p className="font-bold text-xs text-white truncate">{p.name}</p>
                                            <span className="text-[9px] font-mono text-on-surface-variant">{new Date(p.deadline!).toLocaleString()}</span>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-mono font-bold uppercase shrink-0 ${
                                            p.riskRating === "CRITICAL" ? "bg-danger/20 text-danger" : p.riskRating === "AT RISK" ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-success/20 text-success"
                                          }`}>
                                            {diff <= 0 ? "Overdue" : `in ${diff}d`}
                                          </span>
                                        </div>
                                      );
                                    })
                                )}
                              </div>

                              {/* Work blocks Column */}
                              <div className="space-y-2.5">
                                <h4 className="text-[10px] font-bold text-on-surface-variant uppercase font-mono tracking-wider border-b border-outline-variant/10 pb-1.5">Scheduled Work Blocks</h4>
                                {calendarEvents.filter(e => e.startTime && new Date(e.startTime) >= new Date()).length === 0 ? (
                                  <p className="text-xs text-on-surface-variant italic py-3 text-center">No upcoming focus blocks.</p>
                                ) : (
                                  calendarEvents
                                    .filter(e => e.startTime && new Date(e.startTime) >= new Date())
                                    .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                    .map(e => {
                                      const start = new Date(e.startTime);
                                      return (
                                        <div key={e.id} className="p-3 bg-surface-container-high/40 border border-outline-variant/15 rounded-2xl flex justify-between items-center gap-3 hover:border-outline-variant/30 transition-all">
                                          <div className="min-w-0">
                                            <p className="font-bold text-xs text-white truncate">{e.title}</p>
                                            <span className="text-[9px] font-mono text-blue-400">{start.toLocaleString()}</span>
                                          </div>
                                          <span className="text-[9px] font-mono text-on-surface-variant uppercase bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                                            Work
                                          </span>
                                        </div>
                                      );
                                    })
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-4 flex flex-col gap-5 text-left">
                        {/* Selected Date Events List */}
                        <div className="bg-surface-container border border-outline-variant/25 rounded-3xl p-5">
                          <h3 className="font-display font-medium text-white text-sm mb-1">Schedule Blocks</h3>
                          <p className="text-[10px] text-on-surface-variant mb-4 uppercase tracking-wider font-mono font-bold">
                            Agenda for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>

                          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                            {(() => {
                              const dayEvents = calendarEvents.filter(e => {
                                if (!e.startTime) return false;
                                return new Date(e.startTime).toDateString() === selectedDate.toDateString();
                              });

                              if (dayEvents.length === 0) {
                                return (
                                  <div className="text-center py-6">
                                    <p className="text-xs text-on-surface-variant font-sans">No focus blocks reserved for this date.</p>
                                    <span className="text-[9px] text-[#F59E0B]/50 font-mono block mt-1">Use the reservation panel below to book slots.</span>
                                  </div>
                                );
                              }

                              return dayEvents.map(e => {
                                const startStr = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const endStr = e.endTime ? new Date(e.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
                                return (
                                  <div key={e.id} className="p-3 rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-xs text-white truncate">{e.title}</h4>
                                      <span className="text-[10px] font-mono text-blue-400">
                                        🕒 {startStr} {endStr ? ` - ${endStr}` : ""}
                                      </span>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                        setCalendarEvents(prev => prev.filter(x => x.id !== e.id));
                                        await deleteCalendarEventFromCloud(e.id);
                                        triggerNotification("Canceled focus schedule block.");
                                      }}
                                      className="text-on-surface-variant hover:text-danger p-1 rounded-lg hover:bg-surface-container-high shrink-0 transition-all"
                                      title="Cancel Schedule Block"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* AI Smart Scheduler */}
                        <div className="bg-surface-container border border-[#F59E0B]/30 rounded-3xl p-5 relative overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.07)]">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/5 rounded-full blur-2xl" />
                          
                          <div className="flex items-center gap-2 mb-2 relative">
                            <Sparkles className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]/10" />
                            <h3 className="font-display font-medium text-white text-sm">AI Smart Scheduler</h3>
                          </div>

                          {!activeProjectId ? (
                            <div className="py-2">
                              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                                Select or create an active project first to trigger AI trajectory analysis.
                              </p>
                            </div>
                          ) : aiCalendarError ? (
                            <div className="space-y-3 relative">
                              <p className="text-[10px] text-danger leading-relaxed bg-danger/5 border border-danger/20 p-2.5 rounded-2xl text-center">
                                {aiCalendarError}
                              </p>
                              <button
                                onClick={getAiCalendarSuggestion}
                                className="w-full h-8 rounded-xl bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                              >
                                Retry Smart Schedule
                              </button>
                            </div>
                          ) : !aiCalendarSuggestion ? (
                            <div className="space-y-3 relative">
                              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                                Let Clutch AI analyze your active project's remaining hours, current progress, risk levels, and compile an optimal deep work schedule slot today.
                              </p>
                              <button
                                onClick={getAiCalendarSuggestion}
                                disabled={isAiScheduling}
                                className="w-full h-8 rounded-xl bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                              >
                                {isAiScheduling ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Analyzing Trajectory...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    Calculate Focus Session
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3 relative animate-fade-in text-left">
                              <div className="bg-bg-dark/60 p-2.5 rounded-2xl border border-outline-variant/15 space-y-1.5">
                                <h4 className="font-bold text-[11px] text-white uppercase tracking-tight">{aiCalendarSuggestion.title}</h4>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-on-surface-variant font-bold">
                                  <span>📅 {aiCalendarSuggestion.date}</span>
                                  <span>🕒 {aiCalendarSuggestion.startTime} - {aiCalendarSuggestion.endTime}</span>
                                </div>
                                <p className="text-[9px] text-on-surface-variant leading-normal italic pt-1 border-t border-outline-variant/10">
                                  "{aiCalendarSuggestion.text}"
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={acceptAiCalendarSuggestion}
                                  className="h-8 rounded-xl bg-[#F59E0B] text-bg-dark font-bold text-[10px] uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setAiCalendarSuggestion(null)}
                                  className="h-8 rounded-xl bg-surface-container-high text-on-surface-variant font-bold text-[10px] uppercase tracking-wider hover:text-white transition-all"
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Reserve Focus Block Form */}
                        <div className="bg-surface-container border border-outline-variant/25 rounded-3xl p-5">
                          <h3 className="font-display font-medium text-white text-sm mb-1">Reserve Focus Block</h3>
                          <p className="text-[10px] text-on-surface-variant mb-4">Book deep-work sessions to secure your focus vector.</p>

                          <form 
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!newEventTitle.trim()) return;

                              const [startHours, startMinutes] = newEventStartStr.split(":");
                              const [endHours, endMinutes] = newEventEndStr.split(":");

                              const blockStart = new Date(selectedDate);
                              blockStart.setHours(parseInt(startHours || "9"), parseInt(startMinutes || "0"), 0, 0);

                              const blockEnd = new Date(selectedDate);
                              blockEnd.setHours(parseInt(endHours || "10"), parseInt(endMinutes || "0"), 0, 0);

                              const newEvent = {
                                id: generateUUID(),
                                userId: user?.uid || "anonymous",
                                projectId: newEventProjectId,
                                title: newEventTitle.trim(),
                                startTime: blockStart.toISOString(),
                                endTime: blockEnd.toISOString(),
                                createdAt: new Date().toISOString()
                              };

                              setCalendarEvents(prev => [...prev, newEvent]);
                              await saveCalendarEventToCloud(newEvent);

                              setNewEventTitle("");
                              triggerNotification(`✓ Reserved focus block "${newEvent.title}"!`);
                            }}
                            className="space-y-4"
                          >
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant pl-0.5">Session Title</label>
                              <input 
                                type="text"
                                required
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                placeholder="Deep Work: UI Redesign"
                                className="w-full h-9 px-3 rounded-xl bg-bg-dark border border-outline-variant/20 text-white placeholder-on-surface-variant/40 focus:border-[#F59E0B] outline-none text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant pl-0.5">Start Time</label>
                                <input 
                                  type="time"
                                  required
                                  value={newEventStartStr}
                                  onChange={(e) => setNewEventStartStr(e.target.value)}
                                  className="w-full h-9 px-3 rounded-xl bg-bg-dark border border-outline-variant/20 text-white focus:border-[#F59E0B] outline-none text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant pl-0.5">End Time</label>
                                <input 
                                  type="time"
                                  required
                                  value={newEventEndStr}
                                  onChange={(e) => setNewEventEndStr(e.target.value)}
                                  className="w-full h-9 px-3 rounded-xl bg-bg-dark border border-outline-variant/20 text-white focus:border-[#F59E0B] outline-none text-xs"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-mono uppercase tracking-wider text-on-surface-variant pl-0.5">Related Project</label>
                              <select
                                value={newEventProjectId}
                                onChange={(e) => setNewEventProjectId(e.target.value)}
                                className="w-full h-9 px-3 rounded-xl bg-bg-dark border border-outline-variant/20 text-white focus:border-[#F59E0B] outline-none text-xs"
                              >
                                <option value="">No linked project</option>
                                {projects.filter(p => !p.isArchived).map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>

                            <button 
                              type="submit"
                              className="w-full h-9 rounded-xl bg-[#F59E0B] hover:opacity-90 active:scale-95 text-bg-dark font-sans font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              Reserve Deep Session
                            </button>
                          </form>
                        </div>

                        {/* Milestone Agenda */}
                        <div className="bg-surface-container border border-outline-variant/25 rounded-3xl p-5">
                          <h3 className="font-display font-medium text-white text-sm mb-3">Milestone Agenda</h3>
                          
                          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                            {projects.filter(p => !p.isArchived).length === 0 ? (
                              <p className="text-xs text-on-surface-variant text-center py-6 font-sans">No deadlines scheduled.</p>
                            ) : (
                              projects.filter(p => !p.isArchived).map((p) => {
                                const diffDays = p.deadline 
                                  ? Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 3600 * 24))
                                  : 0;
                                
                                return (
                                  <div 
                                    key={p.id}
                                    onClick={() => {
                                      setActiveProjectId(p.id);
                                      triggerNotification(`Focused task: "${p.name}"`);
                                    }}
                                    className={`p-3 rounded-2xl border transition-all text-left cursor-pointer flex flex-col gap-1.5 ${
                                      p.id === activeProjectId 
                                        ? "bg-[#F59E0B]/10 border-[#F59E0B]" 
                                        : "bg-surface-container-high/40 border-outline-variant/20 hover:border-outline-variant/40"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="text-[10px] font-mono text-on-surface-variant uppercase font-bold tracking-tight">
                                        {p.isCompleted ? "Completed" : diffDays <= 0 ? "Overdue" : `Due in ${diffDays} days`}
                                      </span>
                                      <span className={`w-2 h-2 rounded-full ${p.isCompleted ? "bg-success" : p.isAtRisk ? "bg-danger animate-pulse" : "bg-[#F59E0B]"}`} />
                                    </div>
                                    <h4 className="font-bold text-xs text-white line-clamp-1">{p.name}</h4>
                                    <span className="text-[9px] font-mono text-on-surface-variant/90 leading-none">
                                      {p.deadline ? new Date(p.deadline).toLocaleString() : "No hard deadline set"}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              );
            })()}

            {/* VIEW: TASKS MANAGEMENT REGISTER */}
            {onboarding.completed && currentView === "tasks" && (
              <motion.section
                key="tasks"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full max-w-5xl mx-auto py-6 px-4 md:px-8 font-sans text-left"
              >
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-outline-variant/15">
                    <div>
                      <h2 className="font-display font-black text-2xl text-white">Focus Objectives Registry</h2>
                      <p className="text-xs text-on-surface-variant -mt-0.5">Maintain, switch, archive, or review your focus milestones timeline.</p>
                    </div>
                    
                    <button
                      onClick={() => setShowCreateTaskModal(true)}
                      className="px-5 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full text-xs uppercase tracking-wider flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Task</span>
                    </button>
                  </div>

                  {/* Tabs list selectors */}
                  <div className="flex border-b border-outline-variant/10 gap-1.5">
                    {(["active", "completed", "archived"] as const).map((tab) => {
                      const count = projects.filter(p => {
                        if (tab === "active") return !p.isCompleted && !p.isArchived;
                        if (tab === "completed") return p.isCompleted && !p.isArchived;
                        return p.isArchived;
                      }).length;
                      
                      return (
                        <button
                          key={tab}
                          onClick={() => setTasksActiveTab(tab)}
                          className={`px-5 py-3 text-xs uppercase font-extrabold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                            tasksActiveTab === tab 
                              ? "border-[#F59E0B] text-white" 
                              : "border-transparent text-on-surface-variant hover:text-white"
                          }`}
                        >
                          <span className="capitalize">{tab}</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-surface-container-high text-[9px] font-mono">
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Tasks listing container */}
                  <div className="space-y-3.5">
                    {projects.filter(p => {
                      if (tasksActiveTab === "active") return !p.isCompleted && !p.isArchived;
                      if (tasksActiveTab === "completed") return p.isCompleted && !p.isArchived;
                      return p.isArchived;
                    }).length === 0 ? (
                      <div className="py-20 text-center bg-surface-container/35 rounded-3xl border border-dashed border-outline-variant/15 p-8 flex flex-col items-center justify-center gap-3">
                        <Inbox className="w-12 h-12 text-on-surface-variant/30" />
                        <h3 className="font-display font-medium text-white text-base mb-1">No tasks in this category</h3>
                        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed font-sans">
                          {tasksActiveTab === "active" 
                            ? "🎉 All caught up! Create a new task whenever you are ready to focus." 
                            : tasksActiveTab === "completed" 
                            ? "Finish active tasks to see them completed in your history logs." 
                            : "Archive outdated tasks to clear your focus workspace view."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {projects.filter(p => {
                          if (tasksActiveTab === "active") return !p.isCompleted && !p.isArchived;
                          if (tasksActiveTab === "completed") return p.isCompleted && !p.isArchived;
                          return p.isArchived;
                        }).map((p) => {
                          const isCurrentlyActive = p.id === activeProjectId;
                          // Use Amber for active tasks or at-risk tasks, Indigo for others
                          const accentColor = isCurrentlyActive || p.isAtRisk ? "#F59E0B" : "#6366F1";
                          const accentBorderClass = isCurrentlyActive 
                            ? "border-[#F59E0B] shadow-lg shadow-[#F59E0B]/5 bg-[#F59E0B]/5" 
                            : "border-outline-variant/15 hover:border-[#6366F1]/50 bg-surface-container hover:bg-surface-container-high/40 shadow-sm transition-all duration-300";

                          return (
                            <div
                              key={p.id}
                              className={`rounded-3xl border flex flex-col justify-between p-5 min-h-[240px] relative overflow-hidden group ${accentBorderClass}`}
                            >
                              {/* Top Border Accent Line representing identity */}
                              <div 
                                className="absolute top-0 left-0 right-0 h-1"
                                style={{ backgroundColor: accentColor }}
                              />

                              <div className="space-y-4">
                                {/* Card Header Status Indicators */}
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono font-bold">
                                  <span className="text-on-surface-variant flex items-center gap-1 shrink-0">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {p.deadline ? new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "No Deadline"}
                                  </span>
                                  
                                  <div className="flex gap-1">
                                    {p.isCompleted ? (
                                      <span className="px-2 py-0.5 rounded-full bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/20">Completed</span>
                                    ) : p.isAtRisk ? (
                                      <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20 animate-pulse">At Risk</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-[#6366F1]/10 text-[#6366F1]/80 border border-[#6366F1]/15 font-sans">Stable</span>
                                    )}

                                    {isCurrentlyActive && (
                                      <span className="px-2 py-0.5 rounded-full bg-[#F59E0B] text-bg-dark font-black uppercase tracking-tight font-sans">Active</span>
                                    )}
                                  </div>
                                </div>

                                {/* Task Name Header */}
                                <div className="space-y-1">
                                  <h3 className="font-display font-bold text-white text-lg tracking-tight leading-tight line-clamp-2" title={p.name}>
                                    {p.name}
                                  </h3>
                                  <p className="text-[11px] font-mono text-on-surface-variant flex items-center gap-1.5">
                                    <span>Allocated: <strong className="text-white font-sans">{p.hoursPerDay}h/day</strong></span>
                                    {p.completionDate && (
                                      <>
                                        <span>•</span>
                                        <span>Done: <strong className="text-[#6366F1] font-sans">{p.completionDate}</strong></span>
                                      </>
                                    )}
                                  </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-[10px] font-mono text-on-surface-variant">
                                    <span>Milestones Completed</span>
                                    <span className="font-bold text-white">{p.currentProgress}%</span>
                                  </div>
                                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden border border-outline-variant/10 relative">
                                    <div 
                                      className="h-full rounded-full transition-all duration-500" 
                                      style={{ 
                                        width: `${p.currentProgress}%`,
                                        backgroundColor: accentColor 
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Card Actions Footer Row */}
                              <div className="flex items-center gap-2 pt-4 mt-4 border-t border-outline-variant/10 justify-end w-full">
                                {!isCurrentlyActive && !p.isArchived && (
                                  <button
                                    onClick={() => {
                                      setActiveProjectId(p.id);
                                      addToast(`✓ Active Focus: "${p.name}"`);
                                    }}
                                    className="px-3.5 py-1.5 bg-surface-container-high hover:bg-surface-container-low hover:text-white border border-outline-variant/20 hover:border-[#6366F1] rounded-full text-[11px] font-bold text-on-surface-variant transition-all shrink-0"
                                  >
                                    Focus
                                  </button>
                                )}

                                {!p.isCompleted && (
                                  <button
                                    onClick={() => markActiveProjComplete(p.id)}
                                    className="px-3.5 py-1.5 bg-[#F59E0B] text-bg-dark font-sans font-extrabold rounded-full text-[11px] hover:opacity-90 transition-all shrink-0 shadow-sm"
                                  >
                                    Complete
                                  </button>
                                )}

                                {!p.isArchived ? (
                                  <button
                                    onClick={() => archiveProject(p.id)}
                                    className="px-3.5 py-1.5 border border-outline-variant/20 hover:border-[#A0AEC0] text-on-surface-variant hover:text-white rounded-full text-[11px] font-medium transition-all shrink-0"
                                    title="Archive from registry"
                                  >
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => reopenProject(p.id)}
                                    className="px-3.5 py-1.5 border border-[#F59E0B]/30 hover:border-[#F59E0B] text-[#F59E0B] rounded-full text-[11px] font-bold transition-all shrink-0"
                                  >
                                    Reopen Focus
                                  </button>
                                )}

                                <button
                                  onClick={() => handleDeleteProject(p.id)}
                                  className="p-1.5 border border-danger/15 hover:bg-danger/10 text-danger/70 hover:text-danger rounded-full transition-all shrink-0 flex items-center justify-center ml-auto"
                                  title="Delete task permanently"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {/* VIEW: PARAMETERS INTAKE & GENERATOR PLANS */}
            {onboarding.completed && currentView === "rescue" && (
              <motion.section 
                key="rescue"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6 font-sans w-full max-w-4xl mx-auto"
              >
                {apiError && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-2xl text-danger text-sm text-center">
                    {apiError}
                  </div>
                )}

                {isGenerating ? (
                  /* CLEAN LOADING STATE WITH A CALM, SUPPORTIVE HEADLINE AND Light PULSING ANIMATION */
                  <div className="w-full max-w-2xl mx-auto bg-surface-container border border-outline-variant/20 rounded-3xl p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[450px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#F59E0B]/5 via-transparent to-transparent opacity-60 animate-pulse" />
                    
                    <div className="relative mb-8 flex items-center justify-center">
                      <div className="absolute w-24 h-24 rounded-full border border-[#F59E0B]/20 animate-ping" />
                      <div className="absolute w-16 h-16 rounded-full border border-[#F59E0B]/40 animate-pulse" />
                      <div className="w-12 h-12 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                        <Loader2 className="w-6 h-6 animate-spin text-[#F59E0B]" />
                      </div>
                    </div>

                    <div className="space-y-2 relative z-10">
                      <h3 className="font-display font-black text-3xl text-white tracking-tight leading-snug">Building your smart plan...</h3>
                      <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">Finding the fastest realistic path to your deadline.</p>
                    </div>
                  </div>
                ) : (!activeTask?.rescuePlan || showRescueForm) ? (
                  /* GUIDED CONVERSATIONAL ONBOARDING FLOW CARD */
                  <form 
                    onSubmit={(e) => { e.preventDefault(); handleAnalyzeAndRescue(); }}
                    className="w-full max-w-lg mx-auto bg-surface-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-xl relative"
                  >
                    {/* Progress Indicator Component at top */}
                    <div className="flex flex-col items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-on-surface-variant/80 font-mono uppercase tracking-wider">Step {rescueStep} of 5</span>
                      </div>
                      <div className="flex items-center gap-1.5 w-full max-w-xs mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-container-high relative">
                            <div 
                              className="absolute left-0 top-0 bottom-0 bg-[#F59E0B] transition-all duration-300" 
                              style={{ width: rescueStep >= s ? "100%" : "0%" }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step 1: Task Identifier / What are you trying to finish? */}
                    {rescueStep === 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2">
                          <h3 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">What are you trying to finish?</h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">Give your task a clear name. It keeps your focus locked on the end goal.</p>
                        </div>

                        <div className="space-y-4">
                          <input 
                            type="text" 
                            value={paramName} 
                            onChange={(e) => setParamName(e.target.value)} 
                            placeholder="e.g. Hackathon Project"
                            className="w-full text-center bg-surface-container-high border-2 border-outline-variant/30 rounded-2xl px-5 py-4 text-lg text-white focus:border-[#F59E0B] placeholder:text-on-surface-variant/30 outline-none transition-all font-sans"
                            required
                          />

                          <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto pt-2">
                            {["Hackathon Project", "Math Assignment", "Client Website", "Science Report"].map((ex) => (
                              <button
                                key={ex}
                                type="button"
                                onClick={() => setParamName(ex)}
                                className="px-3.5 py-1.5 bg-surface-container-high/60 border border-outline-variant/20 rounded-full text-xs text-on-surface-variant hover:text-white hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/5 transition-all"
                              >
                                {ex}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                          <div />
                          <button
                            type="button"
                            disabled={!paramName.trim()}
                            onClick={() => setRescueStep(2)}
                            className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full hover:opacity-90 active:scale-98 transition-all text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <span>Next Step</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Deadline date & time */}
                    {rescueStep === 2 && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2">
                          <h3 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">When is the deadline?</h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">Set the date and time. Usually when the submission closes.</p>
                        </div>

                        <div className="space-y-4">
                          <input 
                            type="datetime-local" 
                            value={paramDeadline} 
                            onChange={(e) => setParamDeadline(e.target.value)} 
                            className="w-full text-center bg-surface-container-high border-2 border-outline-variant/30 rounded-2xl px-5 py-4 text-base sm:text-lg text-white focus:border-[#F59E0B] outline-none transition-all cursor-pointer font-sans"
                            required
                          />
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                          <button
                            type="button"
                            onClick={() => setRescueStep(1)}
                            className="px-5 py-2 border border-outline-variant/30 hover:text-white rounded-full text-xs font-bold text-on-surface-variant transition-all active:scale-95"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            disabled={!paramDeadline}
                            onClick={() => setRescueStep(3)}
                            className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full hover:opacity-90 active:scale-98 transition-all text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
                          >
                            <span>Next Step</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Current Progress Bounds Slider */}
                    {rescueStep === 3 && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2">
                          <h3 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">How much is already done?</h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">Be completely honest. Accurate assessments help Clutch model a highly realistic recovery path.</p>
                        </div>

                        <div className="space-y-6 pt-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-display font-black text-6xl text-[#F59E0B] tracking-tight leading-none animate-pulse">
                              {paramProgress}%
                            </span>
                            <span className="text-[10px] text-on-surface-variant/90 block mt-2 uppercase tracking-widest font-bold">Progress So Far</span>
                          </div>

                          <div className="space-y-2 max-w-md mx-auto">
                            <input 
                              type="range" 
                              min="0" 
                              max="99" 
                              value={paramProgress} 
                              onChange={(e) => setParamProgress(Number(e.target.value))} 
                              className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-[#F59E0B]"
                            />
                            <div className="flex justify-between text-[10px] text-on-surface-variant/70 font-mono">
                              <span>0% (Just starting)</span>
                              <span>50% (Halfway)</span>
                              <span>99% (Almost done)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                          <button
                            type="button"
                            onClick={() => setRescueStep(2)}
                            className="px-5 py-2 border border-outline-variant/30 hover:text-white rounded-full text-xs font-bold text-on-surface-variant transition-all active:scale-95"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => setRescueStep(4)}
                            className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full hover:opacity-90 active:scale-98 transition-all text-xs sm:text-sm flex items-center gap-1.5"
                          >
                            <span>Next Step</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: Available Time (Replaces Usable Hours Remaining) */}
                    {rescueStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2">
                          <h3 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">How much time do you realistically have?</h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">This represents your available time to commit before the deadline.</p>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 w-full max-w-md mx-auto">
                            {[
                              { label: "30 minutes", value: 0.5 },
                              { label: "1 hour", value: 1.0 },
                              { label: "2 hours", value: 2.0 },
                              { label: "3 hours", value: 3.0 }
                            ].map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => {
                                  setHoursPreset(item.label);
                                  setParamHours(item.value);
                                  setParamHoursInput(item.label);
                                }}
                                className={`p-4 rounded-xl font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                                  hoursPreset === item.label
                                    ? "bg-[#F59E0B]/10 border-[#F59E0B] text-white"
                                    : "bg-surface-container-high/40 border-outline-variant/30 text-on-surface-variant hover:border-[#F59E0B]/40 hover:bg-surface-container-high"
                                }`}
                              >
                                <span className="text-white text-sm">{item.label}</span>
                                <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">{item.value} hour{item.value !== 1 ? 's' : ''}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setHoursPreset("Custom");
                              }}
                              className={`col-span-2 p-3.5 rounded-xl font-bold border transition-all text-center flex items-center justify-center gap-2 ${
                                hoursPreset === "Custom"
                                  ? "bg-[#F59E0B]/10 border-[#F59E0B] text-white"
                                  : "bg-surface-container-high/40 border-outline-variant/30 text-on-surface-variant hover:border-[#F59E0B]/40 hover:bg-surface-container-high"
                              }`}
                            >
                              <span>Custom Available Time</span>
                            </button>
                          </div>

                          {hoursPreset === "Custom" && (
                            <motion.div 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full max-w-md mx-auto pt-1 space-y-2"
                            >
                              <input 
                                type="text" 
                                value={paramHoursInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParamHoursInput(val);
                                  const parsed = parseTimeInputToHours(val);
                                  setParamHours(parsed);
                                }}
                                placeholder="e.g. 5 Hours, 90 mins, 4h"
                                className="w-full text-center bg-surface-container-high border border-outline-variant/50 text-white font-sans text-xs sm:text-sm p-3.5 rounded-xl focus:border-[#F59E0B]"
                                required
                              />
                              <p className="text-[10px] text-on-surface-variant text-center">
                                Flexible parse: <span className="text-[#F59E0B] font-bold font-mono">{paramHours} hr{paramHours !== 1 ? 's' : ''}</span> total.
                              </p>
                            </motion.div>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                          <button
                            type="button"
                            onClick={() => setRescueStep(3)}
                            className="px-5 py-2 border border-outline-variant/30 hover:text-white rounded-full text-xs font-bold text-on-surface-variant transition-all active:scale-95"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => setRescueStep(5)}
                            className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-bold rounded-full hover:opacity-90 active:scale-98 transition-all text-xs sm:text-sm flex items-center gap-1.5"
                          >
                            <span>Next Step</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 5: Notes & Barriers (Optional. Anything slowing you down?) */}
                    {rescueStep === 5 && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                      >
                        <div className="text-center space-y-2">
                          <h3 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">Anything slowing you down?</h3>
                          <p className="text-xs sm:text-sm text-on-surface-variant max-w-sm mx-auto">Optional. Tell us about procrastination blockers, motivation issues, or minor hurdles.</p>
                        </div>

                        <div className="space-y-4">
                          <textarea 
                            value={paramNotes} 
                            onChange={(e) => setParamNotes(e.target.value)} 
                            placeholder="Procrastinating, stuck looking at templates, low energy, not sure where to start..." 
                            className="w-full bg-surface-container-high border-2 border-outline-variant/30 rounded-2xl px-4 py-3.5 text-xs sm:text-sm text-white focus:border-[#F59E0B] placeholder:text-on-surface-variant/30 outline-none h-28 resize-none transition-all font-sans"
                          />

                          <div className="flex flex-wrap justify-center gap-1.5">
                            {[
                              "I keep procrastinating",
                              "I don't know where to start",
                              "Too many tasks/features",
                              "Low motivation/fatigue"
                            ].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (!paramNotes.includes(tag)) {
                                    setParamNotes(prev => prev ? `${prev}. ${tag}` : tag);
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-surface-container-high border border-outline-variant/20 hover:border-[#F59E0B] rounded-full text-[10px] text-on-surface-variant transition-all font-medium"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-outline-variant/10">
                          <button
                            type="button"
                            onClick={() => setRescueStep(4)}
                            className="px-5 py-2 border border-outline-variant/30 hover:text-white rounded-full text-xs font-bold text-on-surface-variant transition-all active:scale-95"
                          >
                            Back
                          </button>
                          <button
                            type="submit"
                            className="px-7 py-3 bg-[#F59E0B] text-bg-dark font-sans font-black rounded-full hover:scale-[1.02] active:scale-98 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4 text-bg-dark shrink-0" />
                            <span>Build My Plan</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </form>
                ) : (
                  /* DEDICATED RESCUE REPORT VIEW (SEPARATE INTERFACE FROM THE FORM ENTIRELY) */
                  <div className="space-y-6 flex flex-col items-center w-full">
                    
                    {/* Horizontal Header Profile with smaller/side-of-box elegant image integration to keep things balanced */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-gradient-to-br from-surface-container to-surface-container-low border border-outline-variant/20 rounded-3xl p-6 md:p-8 w-full">
                      <div className="md:col-span-8 space-y-4 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-[#F59E0B] uppercase tracking-widest font-mono">Plan Ready</span>
                          <span className="text-on-surface-variant font-mono text-[10px]">&bull;</span>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Progress Tracking On</span>
                        </div>
                        
                        <h2 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
                          {activeTask.rescuePlan.projectName}
                        </h2>

                        {/* Deadline Status rendering */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {activeTask.riskRating === "CRITICAL" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-danger/10 text-danger border border-danger/30 uppercase tracking-wider">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              Deadline Status: Critical
                            </span>
                          ) : activeTask.riskRating === "AT RISK" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 uppercase tracking-wider">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              Deadline Status: Needs Attention
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-success/30 uppercase tracking-wider">
                              <Check className="w-4 h-4 shrink-0" />
                              Deadline Status: Safe
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container-high border border-outline-variant/10 rounded-full text-xs text-on-surface-variant font-mono whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-on-surface-variant" />
                            {getDaysLeft(activeTask.deadline)}
                          </span>

                          <button
                            type="button"
                            onClick={() => { setShowRescueForm(true); setRescueStep(1); }}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-outline-variant/35 hover:border-[#F59E0B]/50 hover:text-white transition-colors duration-200 text-xs text-on-surface-variant font-medium rounded-full bg-surface-container/30"
                          >
                            <SettingsIcon className="w-3 h-3 text-[#F59E0B]" />
                            Adjust Parameters
                          </button>
                        </div>

                        <p className="text-xs sm:text-sm font-sans text-on-surface-variant leading-relaxed pt-2 border-t border-outline-variant/15 italic">
                          🚀 "{activeTask.rescuePlan.riskAssessment}"
                        </p>
                      </div>

                      {/* Integrated scaled down image styled as a supportive side illustration inside the header card */}
                      <div className="md:col-span-4 flex justify-center md:justify-end select-none pointer-events-none pr-2">
                        <img 
                          src="/Assets/rescue-mode.png" 
                          alt="Rescue Mode Illustration" 
                          className="w-full max-w-[125px] md:max-w-[155px] h-auto object-contain drop-shadow-xl"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>

                    {/* Bento Grid layout for Report Metadata items */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
                      
                      {/* 1. Success Chance Card (Trajectory risk translation) */}
                      <div className="md:col-span-4 bg-surface-container border border-outline-variant/20 rounded-3xl p-6 text-left flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs text-[#c5c6cd] uppercase tracking-widest font-bold mb-1">Chance Of Finishing</h4>
                          <p className="text-[10px] text-on-surface-variant">Estimated outcome likelihood rate</p>
                        </div>
                        <div className="my-5 flex items-baseline gap-1.5">
                          <span className="font-display font-black text-5xl text-[#F59E0B] leading-none">
                            {Math.max(10, 100 - activeTask.rescuePlan.trajectoryRisk)}%
                          </span>
                          <span className="text-[10px] sm:text-xs font-semibold text-on-surface-variant">
                            {Math.max(10, 100 - activeTask.rescuePlan.trajectoryRisk) >= 70 ? "Likely to finish" : "Needs High Focus"}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden border border-outline-variant/10">
                          <div 
                            className="bg-[#F59E0B] h-full rounded-full transition-all duration-700" 
                            style={{ width: `${Math.max(10, 100 - activeTask.rescuePlan.trajectoryRisk)}%` }}
                          />
                        </div>
                      </div>

                      {/* 2. Next Best Step Card (MOST VISIBLE CARD, HIGHLIGHTED FOR THE USER INSIDE THE REPORT ROW!) */}
                      <div className="md:col-span-5 bg-gradient-to-br from-surface-container-high to-surface-container border-2 border-[#F59E0B]/40 rounded-3xl p-6 text-left shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
                          <Zap className="w-20 h-20 text-[#F59E0B] fill-[#F59E0B]" />
                        </div>
                        
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap className="w-4.5 h-4.5 text-[#F59E0B] fill-[#F59E0B] animate-pulse" />
                          <h4 className="text-xs text-[#F59E0B] uppercase tracking-widest font-black">Next Best Step</h4>
                        </div>
                        
                        <span className="inline-flex items-center gap-1.5 text-[9px] text-white/90 font-mono bg-[#F59E0B]/10 px-2 rounded-full mb-3.5 border border-[#F59E0B]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                          Execute Immediately
                        </span>

                        <p className="font-display font-bold text-base sm:text-lg text-white leading-snug mb-1">
                          {activeTask.rescuePlan.immediateTriage[0]}
                        </p>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          Start on this single action item right away to break stagnation and unlock momentum.
                        </p>
                      </div>

                      {/* 3. Backup Plan Card */}
                      <div className="md:col-span-3 bg-surface-container border border-outline-variant/20 rounded-3xl p-6 text-left flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs text-[#c5c6cd] uppercase tracking-widest font-bold mb-2">Backup Plan</h4>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            If you run behind or hit roadblocks, immediately transition into a minimalist happy-path scope. Eliminate nice-to-fancies.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-outline-variant/10 text-[10px] text-[#F59E0B] font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Always keep moving forward</span>
                        </div>
                      </div>

                    </div>

                    {/* Timeline Plan Phases & checklists */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full">
                      
                      {/* Left: Your Plan (Timeline phases) */}
                      <div className="md:col-span-5 bg-surface-container border border-outline-variant/20 rounded-3xl p-6 relative">
                        <h4 className="text-xs text-white uppercase tracking-widest font-bold mb-5 border-b border-outline-variant/10 pb-2 flex items-center gap-2">
                          <Compass className="w-4 h-4 text-[#F59E0B]" />
                          Your Plan
                        </h4>
                        
                        <div className="relative pl-6 border-l border-outline-variant/30 space-y-6 flex flex-col h-full pb-4">
                          {activeTask.rescuePlan.recoveryPath.map((pathItem, idx) => (
                            <div key={idx} className="relative text-left">
                              <div className="absolute -left-[30px] top-[3px] w-4.5 h-4.5 rounded-full bg-[#F59E0B] ring-4 ring-[#F59E0B]/10 z-10 flex items-center justify-center text-[10px] font-black text-bg-dark font-sans">
                                {idx + 1}
                              </div>
                              <h5 className="text-sm font-bold text-white">{pathItem.phaseName}</h5>
                              <span className="text-[9px] uppercase font-mono tracking-wider text-[#F59E0B] font-bold block mt-0.5">{pathItem.hoursRange}</span>
                              <p className="text-xs text-on-surface-variant mt-1.5 leading-normal">{pathItem.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Urgent Priority Checklist */}
                      <div className="md:col-span-7 bg-surface-container border border-outline-variant/20 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-5 border-b border-outline-variant/10 pb-2">
                          <h4 className="text-xs text-white uppercase tracking-widest font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                            What To Do First
                          </h4>
                          <span className="bg-[#F59E0B]/10 text-[9px] text-[#F59E0B] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#F59E0B]/20">
                            Progress Tracking On
                          </span>
                        </div>

                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {activeTask.rescuePlan.microTasks.map((t) => (
                            <label 
                              key={t.id}
                              className={`flex items-start gap-3 p-3 rounded-xl hover:bg-surface-container-high/60 transition-colors cursor-pointer group text-left ${
                                t.completed ? "opacity-55 bg-surface-container-low/40" : "bg-surface-container-high/30"
                              }`}
                            >
                              <input 
                                type="checkbox"
                                checked={t.completed}
                                onChange={() => { toggleMicroTask(activeTask.id, t.id); }}
                                className="w-4 h-4 rounded border-outline-variant/40 bg-surface-container text-[#F59E0B] focus:ring-[#F59E0B] cursor-pointer mt-0.5 shrink-0"
                              />
                              <div className="text-xs flex-1 min-w-0">
                                <span className={`text-[#f0f0f5] font-sans font-medium transition-all block text-xs ${t.completed ? "line-through text-on-surface-variant decoration-[#F59E0B]" : ""}`}>
                                  {t.taskText}
                                </span>
                                <span className="text-[9px] text-on-surface-variant/70 block uppercase tracking-wider font-bold mt-0.5">{t.phase}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Primary start session CTA card */}
                    <div className="w-full bg-surface-container border border-outline-variant/20 p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                      <div className="space-y-1 text-center sm:text-left">
                        <h3 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                          Ready to start focusing?
                        </h3>
                        <p className="text-xs text-on-surface-variant">Your checklist is ready in your focus workspace. Start a sprint to make immediate progress.</p>
                      </div>
                      <button 
                        onClick={() => { setCurrentView("execute"); }}
                        className="w-full sm:w-auto px-8 py-3.5 bg-[#F59E0B] text-bg-dark font-sans font-black rounded-full hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                      >
                        <Play className="w-4 h-4 fill-bg-dark text-bg-dark" />
                        <span>Start Focus Session &rarr;</span>
                      </button>
                    </div>

                  </div>
                )}
              </motion.section>
            )}

            {/* VIEW: EXECUTE FOCUS RUNNER (TIMER / WORKPLACE) */}
            {onboarding.completed && currentView === "execute" && (
              <motion.section 
                key="execute"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-6 font-sans w-full"
              >
                <div className="w-full max-w-2xl">
                  {/* Mode Banner Indicator */}
                  {is15MModeActive ? (
                    <div className="mb-6 bg-info/10 border border-info/30 p-4 rounded-2xl flex items-center justify-between text-info">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Timer className="w-5 h-5 text-info animate-spin" />
                        <span>Running 15-Minute Micro Focus Block</span>
                      </div>
                      <button 
                        onClick={() => { setIs15MModeActive(false); handleResetTimer(1500); triggerNotification("Switched back to standard focus task intervals"); }}
                        className="text-xs underline font-bold uppercase hover:opacity-85"
                      >
                        Exit Block
                      </button>
                    </div>
                  ) : null}



                  {/* Main Focus card */}
                  <div className="bg-surface-container border border-outline-variant/20 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6">
                    
                    {/* CUSTOM COMPLETION CONFIRMATION OVERLAY */}
                    {showCompletionConfirm && (
                      <div className="absolute inset-0 bg-surface-container-lowest/98 backdrop-blur-lg z-30 flex flex-col items-center justify-center p-6 text-center animate-fade-in text-sans">
                        <div className="w-14 h-14 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center mb-4 text-[#F59E0B] animate-bounce">
                          <Check className="w-6 h-6 text-[#F59E0B]" />
                        </div>
                        <h3 className="font-display font-black text-xl text-white mb-2 uppercase tracking-wide">Focus Block Complete</h3>
                        <p className="text-xs text-on-surface-variant max-w-sm mb-6 leading-relaxed">
                          Exceptional discipline! Did you successfully finish this active focus objective interval?
                        </p>
                        <div className="flex gap-3 w-full max-w-xs justify-center mx-auto">
                          <button 
                            type="button"
                            onClick={() => {
                              setShowCompletionConfirm(false);
                              if (is15MModeActive) {
                                setIs15MModeActive(false);
                                triggerNotification("15-Minute focus block marked complete.");
                              } else {
                                markActiveProjComplete(activeTask.id);
                              }
                              handleResetTimer(1500);
                            }}
                            className="flex-1 bg-[#F59E0B] text-bg-dark font-sans font-black py-3 rounded-full text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
                          >
                            Complete
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              setShowCompletionConfirm(false);
                              handleResetTimer(is15MModeActive ? 900 : 1500);
                              triggerNotification("Interval reset. Keep pushing forward!");
                            }}
                            className="flex-1 border border-outline-variant/40 hover:border-white text-white font-sans font-bold py-3 rounded-full text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                          >
                            No/Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Glow top line decoration */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F59E0B]/30 to-transparent"></div>
                    
                    {/* Header containing name and elapsed countdown */}
                    <header className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase tracking-widest font-black text-[#F59E0B] flex items-center gap-1.5">
                          <span className="w-2, h-2 rounded bg-[#F59E0B] animate-ping shrink-0" style={{ width: "8px", height: "8px" }}></span>
                          Active Task Scope
                        </span>

                        {/* Counting numbers bubble widget */}
                        <div className="flex items-center gap-2 bg-surface-container-high hover:bg-surface-container px-4 py-1.5 rounded-full border border-outline-variant/35 text-[#F59E0B] font-display font-medium text-lg">
                          <Timer className="w-4 h-4 shrink-0" />
                          <span>{formatTime(timerSeconds)}</span>
                        </div>
                      </div>

                      <h2 className="font-display font-bold text-3xl tracking-tight text-white mt-1">
                        {is15MModeActive ? rescueTaskName : activeTask.name}
                      </h2>
                    </header>

                    <div className="h-px bg-outline-variant/10 w-full" />

                    {/* Operational parameters descriptions */}
                    <div className="space-y-4">
                      
                      {/* Estimated Duration block */}
                      <div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Estimated Remaining Work Duration</span>
                        <p className="text-sm font-medium text-white flex items-center gap-2">
                          <Timer className="w-4.5 h-4.5 text-[#F59E0B]" />
                          {is15MModeActive ? "15 Minutes (Active micro unblocking sprint)" : `${activeTask.hoursRemaining} hours remaining total`}
                        </p>
                      </div>

                      {/* Success block */}
                      <div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Success Condition Checklist</span>
                        <p className="text-sm font-medium text-white leading-relaxed">
                          {is15MModeActive ? (rescueGoal || "Focus fully on completion loops during this temporary interval.") : activeTask.successCondition}
                        </p>
                      </div>

                      {/* Stopping Condition block */}
                      {is15MModeActive && rescueStopping && (
                        <div>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1">Stopping Condition Rule</span>
                          <p className="text-sm text-info leading-relaxed">{rescueStopping}</p>
                        </div>
                      )}

                      {/* Quick notes loops */}
                      {!is15MModeActive && activeTask.notes && activeTask.notes.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block mb-1.5">Contextual references</span>
                          <ul className="space-y-1.5">
                            {activeTask.notes.map((note, index) => (
                              <li key={index} className="text-xs text-[#c5c6cd] flex items-start gap-2">
                                <span className="text-[#F59E0B] mt-1 shrink-0">▸</span>
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>

                    {/* Focus Session Actions dashboard */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      {isTimerActive ? (
                        <button 
                          onClick={() => { setIsTimerActive(false); }}
                          className="flex-1 px-6 py-3 border border-[#F59E0B]/40 hover:border-[#F59E0B] text-white font-sans font-bold rounded-full transition-all flex items-center justify-center gap-2"
                        >
                          <Timer className="w-4 h-4 text-[#F59E0B]" />
                          Pause Timer
                        </button>
                      ) : (
                        <button 
                          onClick={() => { setIsTimerActive(true); }}
                          className="flex-1 bg-[#F59E0B] text-bg-dark font-sans font-black py-3.5 px-6 rounded-full flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all outline-none"
                        >
                          <Play className="w-4 h-4 text-bg-dark fill-bg-dark" />
                          Start Working
                        </button>
                      )}

                      {!is15MModeActive && (
                        <button 
                          onClick={() => { setShowCompletionConfirm(true); }}
                          className="flex-1 py-3 px-6 border border-outline-variant/30 hover:border-[#F59E0B] hover:text-[#F59E0B] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 text-on-surface-variant"
                        >
                          <Check className="w-4 h-4 text-success" />
                          Mark Complete
                        </button>
                      )}

                      <button 
                        onClick={() => { handleResetTimer(is15MModeActive ? 900 : 1500); }}
                        className="px-4 py-3 border border-outline-variant/30 hover:bg-surface-container text-xs hover:text-white rounded-full transition-all text-on-surface-variant"
                        title="Reset countdown back to baseline start"
                      >
                        Reset Interval
                      </button>
                    </div>

                  </div>

                  {/* EMERGENCY STUCK HELPER BUTTON TRIGGER */}
                  <div className="mt-8 flex justify-center">
                    <button 
                      onClick={() => { setShowStuckModal(true); }}
                      className="px-8 py-3 bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-[#131315] hover:border-danger font-sans text-sm font-black rounded-full flex items-center gap-2 transition-all shadow-lg shadow-danger/5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      I'm Stuck !
                    </button>
                  </div>

                </div>
              </motion.section>
            )}

            {onboarding.completed && currentView === "settings" && (
              <motion.section 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6 font-sans text-left max-w-6xl mx-auto pb-24"
              >
                <div>
                  <h2 className="font-display font-black text-3xl text-white">Settings</h2>
                  <p className="text-xs text-on-surface-variant -mt-0.5">Customize your profile, adjust visual preferences, and manage your account data.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#1e1f22] border border-[#2b2d31] rounded-3xl p-6 min-h-[500px]">
                  {/* Left Column: Sidebar Tabs */}
                  <div className="col-span-1 flex flex-col gap-1 border-r border-[#2b2d31] pr-4 md:pr-6 h-full">
                    <button
                      onClick={() => setSettingsTab("profile")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "profile" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <UserIcon className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      My Profile
                    </button>

                    <button
                      onClick={() => setSettingsTab("appearance")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "appearance" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <Sun className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      Appearance &amp; Theme
                    </button>
 
                    <button
                      onClick={() => setSettingsTab("preferences")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "preferences" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <Target className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      Preferences
                    </button>

                    <button
                      onClick={() => setSettingsTab("notifications")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "notifications" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <Bell className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      Alerts &amp; Notifications
                    </button>

                    <button
                      onClick={() => setSettingsTab("data")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "data" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <RefreshCw className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      App Data
                    </button>

                    <button
                      onClick={() => setSettingsTab("about")}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        settingsTab === "about" 
                          ? "bg-[#2b2d31] text-white border-l-2 border-[#F59E0B]" 
                          : "text-on-surface-variant hover:bg-[#2b2d31] hover:text-white"
                      }`}
                    >
                      <HelpCircle className="w-4 h-4 shrink-0 text-on-surface-variant" />
                      About
                    </button>
                  </div>

                  {/* Right Column: Tab Contents */}
                  <div className="col-span-1 md:col-span-3 pl-0 md:pl-2 flex flex-col gap-5 justify-between">
                    <AnimatePresence mode="wait">
                      {settingsTab === "profile" && (
                        <motion.div
                          key="profile"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-6"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">My Profile</h4>
                            <p className="text-[11px] text-on-surface-variant">Update your avatar, public name, and core productivity goal.</p>
                          </div>

                          {/* Discord-style profile card live preview */}
                          <div className="bg-[#2b2d31] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/10 max-w-xl">
                            {/* Banner */}
                            <div className="h-20 bg-gradient-to-r from-[#F59E0B]/80 to-amber-600 relative">
                              <span className="absolute top-2 right-3 text-[9px] font-bold text-black/60 uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">Live Preview</span>
                            </div>
                            
                            {/* Photo and Badge Row */}
                            <div className="px-5 pb-5 relative text-left">
                              <div className="absolute -top-10 left-4 w-18 h-18 rounded-full border-4 border-[#2b2d31] bg-[#1e1f22] overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
                                {tempPhoto ? (
                                  <img src={tempPhoto} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-xs font-black text-white/40">U</span>
                                )}
                              </div>

                              <div className="pt-10 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-black text-base text-white">{tempName || "Operator"}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] font-mono rounded-md font-bold uppercase tracking-wider">MEMBER</span>
                                </div>
                                <span className="text-[10px] text-on-surface-variant font-mono">@{user?.email ? user.email.split("@")[0] : "user"}</span>
                              </div>

                              <div className="mt-4 border-t border-outline-variant/10 pt-3">
                                <span className="text-[9px] uppercase font-bold text-on-surface-variant/80 tracking-wider">Goal / Bio</span>
                                <p className="text-xs text-white leading-relaxed mt-1 bg-[#1e1f22] p-3 rounded-xl border border-outline-variant/5">
                                  {tempGoal || "Not configured yet. Add a focus mission or deadline priority."}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Profile Fields editing form */}
                          <div className="bg-[#2b2d31] rounded-2xl p-5 space-y-4 max-w-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block text-left">Display Name</label>
                                <input 
                                  type="text" 
                                  value={tempName} 
                                  onChange={(e) => setTempName(e.target.value)} 
                                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-4 py-2 text-xs text-white focus:border-[#F59E0B] outline-none transition-all"
                                  placeholder="Enter name..."
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block text-left">Avatar Image URL</label>
                                <input 
                                  type="text" 
                                  value={tempPhoto} 
                                  onChange={(e) => setTempPhoto(e.target.value)} 
                                  className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-4 py-2 text-xs text-white focus:border-[#F59E0B] outline-none transition-all"
                                  placeholder="Enter photo URL..."
                                />
                              </div>
                            </div>

                            {/* Preset Avatar Picker Row */}
                            <div className="space-y-1.5 text-left pt-1">
                              <span className="text-[9px] text-on-surface-variant uppercase tracking-wider font-bold">Quick Preset Avatars</span>
                              <div className="flex flex-wrap gap-2.5">
                                {[
                                  { name: "Adventurer", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Clutch" },
                                  { name: "Robot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Noodle" },
                                  { name: "Artistic", url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Sasha" },
                                  { name: "Casual", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Casey" },
                                  { name: "Pixel", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel" }
                                ].map((av) => (
                                  <button
                                    key={av.name}
                                    type="button"
                                    onClick={() => setTempPhoto(av.url)}
                                    className={`relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${
                                      tempPhoto === av.url ? "border-[#F59E0B] ring-2 ring-[#F59E0B]/20" : "border-transparent opacity-70 hover:opacity-100"
                                    }`}
                                    title={av.name}
                                  >
                                    <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-1 pt-1">
                              <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block text-left">Goal &amp; Bio</label>
                              <textarea 
                                rows={2}
                                value={tempGoal} 
                                onChange={(e) => setTempGoal(e.target.value)} 
                                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-4 py-2 text-xs text-white focus:border-[#F59E0B] outline-none transition-all resize-none"
                                placeholder="Edit your bio or personal goal statement..."
                              />
                            </div>

                            <div className="pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                              <button 
                                onClick={() => {
                                  if (!tempName.trim()) {
                                    triggerNotification("Name cannot be empty");
                                    return;
                                  }
                                  setProfileName(tempName);
                                  setProfilePhoto(tempPhoto);
                                  setProfileGoal(tempGoal);
                                  localStorage.setItem("clutch_profile_name", tempName);
                                  localStorage.setItem("clutch_profile_photo", tempPhoto);
                                  localStorage.setItem("clutch_profile_goal", tempGoal || "");
                                  triggerNotification("✓ Profile changes saved successfully!");
                                }}
                                className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark rounded-xl text-xs font-bold font-sans hover:opacity-95 transition-all cursor-pointer shadow-md"
                              >
                                Save Profile Changes
                              </button>
                              <div className="text-[11px] text-on-surface-variant font-sans flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5 text-success" /> Account Sync Active
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {settingsTab === "appearance" && (
                        <motion.div
                          key="appearance"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-5"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">Appearance &amp; Theme</h4>
                            <p className="text-[11px] text-on-surface-variant">Adjust your primary visual theme and screen appearance.</p>
                          </div>

                          <div className="bg-[#2b2d31] rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                              <div>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block text-left">Theme Style</span>
                                <span className="text-white font-bold capitalize block text-sm mt-0.5">{onboarding.themeType}</span>
                              </div>
                              <div className="flex bg-[#1e1f22] rounded-full p-1 border border-outline-variant/15">
                                {(["light", "dark", "system"] as ThemeType[]).map((t) => (
                                  <button 
                                    key={t}
                                    onClick={() => { setOnboarding(prev => ({ ...prev, themeType: t })); triggerNotification(`Switched theme to ${t}`); }}
                                    className={`px-3.5 py-1 rounded-full text-[10px] font-bold transition-all capitalize cursor-pointer ${
                                      onboarding.themeType === t ? "bg-[#F59E0B] text-bg-dark" : "text-on-surface-variant hover:text-white"
                                    }`}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <div>
                                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block text-left">Accent Theme Tone</span>
                                <span className="text-white font-bold block text-xs mt-0.5 capitalize">{accentTone} Accent Theme</span>
                              </div>
                              <div className="flex items-center gap-2 bg-[#1e1f22] p-1.5 rounded-full border border-outline-variant/20">
                                <span 
                                  className={`w-5 h-5 rounded-full bg-[#F59E0B] cursor-pointer transition-all ${accentTone === "orange" ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-100"}`} 
                                  onClick={() => { setAccentTone("orange"); triggerNotification("Switched to Orange Accent Theme"); }} 
                                  title="Orange Theme"
                                />
                                <span 
                                  className={`w-5 h-5 rounded-full bg-[#3B82F6] cursor-pointer transition-all ${accentTone === "blue" ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-100"}`} 
                                  onClick={() => { setAccentTone("blue"); triggerNotification("Switched to Blue Accent Theme"); }} 
                                  title="Blue Theme"
                                />
                                <span 
                                  className={`w-5 h-5 rounded-full bg-[#10B981] cursor-pointer transition-all ${accentTone === "green" ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-100"}`} 
                                  onClick={() => { setAccentTone("green"); triggerNotification("Switched to Green Accent Theme"); }} 
                                  title="Green Theme"
                                />
                                <span 
                                  className={`w-5 h-5 rounded-full bg-[#EF4444] cursor-pointer transition-all ${accentTone === "red" ? "ring-2 ring-white scale-110" : "opacity-50 hover:opacity-100"}`} 
                                  onClick={() => { setAccentTone("red"); triggerNotification("Switched to Red Accent Theme"); }} 
                                  title="Red Theme"
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {settingsTab === "preferences" && (
                        <motion.div
                          key="preferences"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-5 text-left"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">Preferences (Onboarding Qs)</h4>
                            <p className="text-[11px] text-on-surface-variant">Update your core onboarding selections, profile role, goals, and AI Assistant personalization style.</p>
                          </div>

                          <div className="bg-[#2b2d31] border border-outline-variant/10 rounded-2xl p-5 space-y-6">
                            {/* Role / Profile Type Selection */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">Primary Workload Calibration (Role)</label>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { value: "Student", label: "Student 🎓", desc: "Assignments, exams, & studies" },
                                  { value: "Freelancer", label: "Freelancer 💻", desc: "Client projects & tracking" },
                                  { value: "Professional", label: "Professional 💼", desc: "Corporate deadlines & team" },
                                  { value: "Entrepreneur", label: "Entrepreneur 🚀", desc: "Startups & product launches" }
                                ].map((roleOpt) => (
                                  <button
                                    key={roleOpt.value}
                                    type="button"
                                    onClick={() => {
                                      setOnbRole(roleOpt.value as ProfileType);
                                    }}
                                    className={`p-3 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                                      onbRole === roleOpt.value
                                        ? "border-[#F59E0B] bg-[#F59E0B]/10 text-white shadow-sm"
                                        : "border-[#1e1f22] bg-[#1e1f22]/50 text-on-surface-variant hover:bg-[#1e1f22]"
                                    }`}
                                  >
                                    <div className="font-bold text-white">{roleOpt.label}</div>
                                    <div className="text-[10px] text-on-surface-variant mt-0.5 leading-tight">{roleOpt.desc}</div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Core Focus Goal */}
                            <div className="space-y-2">
                              <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">Core Workspace Mission Goal</label>
                              <input
                                type="text"
                                value={onbGoal || ""}
                                onChange={(e) => setOnbGoal(e.target.value)}
                                className="w-full bg-[#1e1f22] border border-[#2b2d31] rounded-xl px-4 py-3 text-xs text-white focus:border-[#F59E0B] outline-none transition-all"
                                placeholder="e.g. Master React and secure my frontend engineer role before September"
                              />
                            </div>

                            {/* AI Personality & Tone */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-outline-variant/10">
                              <div className="space-y-2">
                                <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">AI Assistant Personality</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {["Professional", "Friendly", "Creative", "Teacher", "Coding Expert", "Funny"].map((pers) => (
                                    <button
                                      key={pers}
                                      type="button"
                                      onClick={() => setOnbAiPersonality(pers)}
                                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                        onbAiPersonality === pers
                                          ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                                          : "border-outline-variant/10 bg-[#1e1f22] text-on-surface-variant"
                                      }`}
                                    >
                                      {pers}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">Conversation Tone</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {["Formal", "Casual", "Friendly", "Technical"].map((toneOpt) => (
                                    <button
                                      key={toneOpt}
                                      type="button"
                                      onClick={() => setOnbAiTone(toneOpt)}
                                      className={`py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                        onbAiTone === toneOpt
                                          ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                                          : "border-outline-variant/10 bg-[#1e1f22] text-on-surface-variant"
                                      }`}
                                    >
                                      {toneOpt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Response Length & What AI remembers */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
                              <div className="space-y-2">
                                <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">Response Length Target</label>
                                <div className="flex gap-2">
                                  {["Short", "Balanced", "Detailed"].map((lenOpt) => (
                                    <button
                                      key={lenOpt}
                                      type="button"
                                      onClick={() => setOnbAiResponseLength(lenOpt)}
                                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                        onbAiResponseLength === lenOpt
                                          ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                                          : "border-outline-variant/10 bg-[#1e1f22] text-on-surface-variant"
                                      }`}
                                    >
                                      {lenOpt}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-extrabold block">What AI remembers about you</label>
                                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                                  {["My name", "My goals", "My projects", "My hobbies", "My study subjects", "My preferred coding languages", "My writing style", "Nothing"].map((remOpt) => {
                                    const isSel = onbAiRemember.includes(remOpt);
                                    return (
                                      <button
                                        key={remOpt}
                                        type="button"
                                        onClick={() => {
                                          if (remOpt === "Nothing") {
                                            setOnbAiRemember(["Nothing"]);
                                          } else {
                                            let next = onbAiRemember.filter(it => it !== "Nothing");
                                            if (isSel) {
                                              next = next.filter(it => it !== remOpt);
                                              if (next.length === 0) next = ["Nothing"];
                                            } else {
                                              next.push(remOpt);
                                            }
                                            setOnbAiRemember(next);
                                          }
                                        }}
                                        className={`px-2 py-1.5 rounded-md text-[9px] font-bold border transition-all cursor-pointer ${
                                          isSel
                                            ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                                            : "border-outline-variant/10 bg-[#1e1f22] text-on-surface-variant"
                                        }`}
                                      >
                                        {remOpt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Save Preferences Button */}
                            <div className="pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                              <button
                                onClick={async () => {
                                  // 1. Update onboarding profileType
                                  const updatedOnboarding = {
                                    ...onboarding,
                                    profileType: onbRole,
                                  };
                                  setOnboarding(updatedOnboarding);
                                  localStorage.setItem("clutch_onboarding", JSON.stringify(updatedOnboarding));

                                  // 2. Save focus goal
                                  localStorage.setItem("clutch_profile_goal", onbGoal || "");

                                  // 3. Save AI personalization settings
                                  localStorage.setItem("clutch_ai_personality", onbAiPersonality);
                                  localStorage.setItem("clutch_ai_remember", JSON.stringify(onbAiRemember));
                                  localStorage.setItem("clutch_ai_response_length", onbAiResponseLength);
                                  localStorage.setItem("clutch_ai_tone", onbAiTone);

                                  // 4. Sync with Firebase if available
                                  if (user) {
                                    try {
                                      await setDoc(doc(db, "users", user.uid), {
                                        onboardingCompleted: true,
                                        profileType: onbRole,
                                        mainGoal: onbGoal,
                                        aiPersonality: onbAiPersonality,
                                        aiRemember: onbAiRemember,
                                        aiResponseLength: onbAiResponseLength,
                                        aiTone: onbAiTone,
                                        updatedAt: new Date().toISOString()
                                      }, { merge: true });
                                    } catch (err) {
                                      console.error("Firestore preferences sync failed:", err);
                                    }
                                  }

                                  triggerNotification("✓ Calibration preferences updated and synchronized!");
                                }}
                                className="px-6 py-2.5 bg-[#F59E0B] text-bg-dark rounded-xl text-xs font-bold font-sans hover:opacity-95 transition-all cursor-pointer shadow-md"
                              >
                                Save Calibration Preferences
                              </button>
                              <div className="text-[10px] font-mono text-on-surface-variant">
                                Calibration Status: READY
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {settingsTab === "notifications" && (
                        <motion.div
                          key="notifications"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-5"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">Alerts &amp; Notifications</h4>
                            <p className="text-[11px] text-on-surface-variant">Configure your alerts and ambient sound preferences.</p>
                          </div>

                          <div className="bg-[#2b2d31] rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-[#1e1f22] pb-3">
                              <div>
                                <h5 className="text-xs font-bold text-white">Deadline Alerts</h5>
                                <p className="text-[10px] text-on-surface-variant font-sans">Notify me if milestones are approaching too fast.</p>
                              </div>
                              <button onClick={() => addToast("✓ Deadline alerts enabled")} className="text-[#F59E0B] text-[10px] font-mono font-bold uppercase hover:underline">ENABLED</button>
                            </div>

                            <div className="flex items-center justify-between border-b border-[#1e1f22] pb-3">
                              <div>
                                <h5 className="text-xs font-bold text-white">Smart Progress Alerts</h5>
                                <p className="text-[10px] text-on-surface-variant font-sans">Highlight tasks that need focus to prevent falling behind.</p>
                              </div>
                              <button onClick={() => addToast("✓ Smart progress alerts enabled")} className="text-[#F59E0B] text-[10px] font-mono font-bold uppercase hover:underline">ENABLED</button>
                            </div>

                            <div className="flex items-center justify-between border-b border-[#1e1f22] pb-3">
                              <div>
                                <h5 className="text-xs font-bold text-white">Timer Completion Sound</h5>
                                <p className="text-[10px] text-on-surface-variant font-sans">Play a soft sound when a sprint finishes.</p>
                              </div>
                              <button onClick={() => addToast("✓ Timer completion sound enabled")} className="text-on-surface-variant text-[10px] font-mono font-bold uppercase hover:underline">MUTED</button>
                            </div>

                            <div className="flex items-center justify-between">
                              <div>
                                <h5 className="text-xs font-bold text-white">Focus Mode Notifications</h5>
                                <p className="text-[10px] text-on-surface-variant font-sans">Hide notifications when focusing on a task.</p>
                              </div>
                              <button onClick={() => addToast("✓ Focus mode notifications muted")} className="text-[#F59E0B] text-[10px] font-mono font-bold uppercase hover:underline">ENABLED</button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {settingsTab === "data" && (
                        <motion.div
                          key="data"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-5"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">App Data</h4>
                            <p className="text-[11px] text-on-surface-variant">Load starter packages or wipe local workspace records.</p>
                          </div>

                          <div className="bg-[#2b2d31] border border-outline-variant/10 rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-3 text-left">
                              <Sparkles className="w-5 h-5 text-[#F59E0B] mt-0.5 shrink-0" />
                              <div>
                                <h5 className="text-xs font-bold text-white">Load Sample Productivity Data</h5>
                                <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                                  Instantly load Clutch with clean, realistic sample projects, checklists, and calendar blockages to see the workspace in action.
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-end pt-1">
                              <button 
                                onClick={reseedDemoData}
                                className="px-5 py-2 bg-[#F59E0B] hover:opacity-95 text-bg-dark rounded-full text-[10px] uppercase font-black transition-all shadow-md cursor-pointer"
                              >
                                Load Sample Data
                              </button>
                            </div>
                          </div>

                          <div className="bg-[#2b2d31] rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                              <div className="text-left">
                                <span className="text-xs font-bold text-white block">Wipe All Data</span>
                                <span className="text-[10px] text-on-surface-variant block mt-0.5">Delete all local projects, notes, checklists, and calendars. This action cannot be undone.</span>
                              </div>
                              <button 
                                onClick={() => { 
                                  if (confirm("Reset Clutch application back to factory templates? All custom checklists will be wiped.")) {
                                    localStorage.removeItem("clutch_projects");
                                    localStorage.removeItem("clutch_onboarding");
                                    localStorage.removeItem("clutch_calendar_events");
                                    setProjects(INITIAL_PROJECTS);
                                    setCalendarEvents([]);
                                    setOnboarding({ completed: false, profileType: null, themeType: "dark" });
                                    triggerNotification("All dashboard settings reset back to target baseline.");
                                    setCurrentView("landing");
                                  }
                                }}
                                className="px-5 py-2 border border-danger/30 text-danger hover:bg-danger/15 rounded-full text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer shrink-0"
                              >
                                Wipe All Workspace Data
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {settingsTab === "about" && (
                        <motion.div
                          key="about"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="space-y-4"
                        >
                          <div>
                            <h4 className="font-display font-bold text-lg text-white">About</h4>
                            <p className="text-[11px] text-on-surface-variant">Application details.</p>
                          </div>

                          <div className="bg-[#2b2d31] rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-4">
                              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
                                <Zap className="w-5 h-5 fill-[#F59E0B]" />
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-white">Clutch Workspace</h5>
                                <span className="text-[10px] font-mono text-[#F59E0B]">v2.5</span>
                              </div>
                            </div>

                            <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                              Clutch is a productivity workspace designed to keep you on schedule. By breaking down projects into clear, actionable steps, it eliminates procrastination and helps you secure important deadlines.
                            </p>

                            <div className="grid grid-cols-2 gap-4 pt-2 text-left">
                              <div className="bg-[#1e1f22] p-3 rounded-xl border border-outline-variant/5">
                                <span className="text-[9px] font-mono text-on-surface-variant uppercase block">AI Engine</span>
                                <span className="text-xs font-bold text-white mt-0.5 block">Llama 3.3 Engine</span>
                              </div>
                              <div className="bg-[#1e1f22] p-3 rounded-xl border border-outline-variant/5">
                                <span className="text-[9px] font-mono text-on-surface-variant uppercase block">Progress Analysis</span>
                                <span className="text-xs font-bold text-[#F59E0B] mt-0.5 block">Linear Ratio Forecast</span>
                              </div>
                              <div className="bg-[#1e1f22] p-3 rounded-xl border border-outline-variant/5">
                                <span className="text-[9px] font-mono text-on-surface-variant uppercase block">Database</span>
                                <span className="text-xs font-bold text-white mt-0.5 block">Local-First Sandbox</span>
                              </div>
                              <div className="bg-[#1e1f22] p-3 rounded-xl border border-outline-variant/5">
                                <span className="text-[9px] font-mono text-on-surface-variant uppercase block">Target</span>
                                <span className="text-xs font-bold text-success mt-0.5 block">Hackathon Final Submission</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bottom Status Row */}
                    <div className="pt-4 border-t border-outline-variant/10 text-center flex items-center justify-between text-[10px] text-on-surface-variant">
                      <span>Clutch Workplace • Secure Sandbox</span>
                      <span className="font-mono text-[#F59E0B]">COMPLETED TURNS SAFE</span>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* MODAL OVERLAY: 15-MINUTE DYNAMIC TIMER SETUP */}
      <AnimatePresence>
        {showRescueTimerForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-[24px] shadow-2xl w-full max-w-[500px] p-6 md:p-8 relative flex flex-col gap-6"
            >
              {/* Close command */}
              <button 
                onClick={() => { setShowRescueTimerForm(false); }}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex flex-col gap-2">
                <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-full flex items-center justify-center mb-1">
                  <Timer className="w-6 h-6 text-[#F59E0B]" />
                </div>
                <h2 className="font-display font-medium text-2xl text-white">15 Minute Sprint</h2>
                <p className="text-xs text-on-surface-variant">Overcome the friction of starting. Commit to just 15 minutes of quiet focus to build momentum.</p>
              </div>

              {/* form inputs */}
              {isGenerating15M ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 animate-pulse">
                  <Loader2 className="w-8 h-8 text-[#F59E0B] animate-spin" />
                  <span className="text-xs text-[#F59E0B] font-mono font-bold uppercase tracking-widest">Generating Bespoke Sprint...</span>
                </div>
              ) : microRescueError ? (
                <div className="py-6 flex flex-col items-center justify-center gap-3">
                  <p className="text-xs text-danger bg-danger/5 border border-danger/20 p-4 rounded-xl text-center leading-relaxed">
                    {microRescueError}
                  </p>
                  <button
                    onClick={open15MinModal}
                    className="px-4 py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] rounded-xl text-xs font-bold transition-all"
                  >
                    Retry Generation
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant" htmlFor="task_name">What is the exact task?</label>
                    <input 
                      id="task_name"
                      type="text" 
                      value={rescueTaskName}
                      onChange={(e) => setRescueTaskName(e.target.value)}
                      placeholder="e.g. Draft introduction paragraph"
                      className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3.5 rounded-xl focus:border-[#F59E0B]"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant" htmlFor="task_goal">Measurable Goal</label>
                    <input 
                      id="task_goal"
                      type="text" 
                      value={rescueGoal}
                      onChange={(e) => setRescueGoal(e.target.value)}
                      placeholder="e.g. 150 words"
                      className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3.5 rounded-xl focus:border-[#F59E0B]"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant" htmlFor="task_stop">Stopping Condition</label>
                    <input 
                      id="task_stop"
                      type="text" 
                      value={rescueStopping}
                      onChange={(e) => setRescueStopping(e.target.value)}
                      placeholder="e.g. The intro flows well"
                      className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3.5 rounded-xl focus:border-[#F59E0B]"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Action commands */}
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={start15MinRescueSession}
                  disabled={!rescueTaskName.trim()}
                  className="w-full bg-[#F59E0B] text-bg-dark font-sans font-black py-3.5 rounded-full flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 active:scale-98 transition-all"
                >
                  <Play className="w-4 h-4 text-bg-dark fill-bg-dark" />
                  Start Timer
                </button>
                <button 
                  onClick={() => { setShowRescueTimerForm(false); }}
                  className="w-full bg-transparent text-on-surface-variant font-medium text-xs py-3 rounded-full hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: PROJECT SUMMARY (EXPLAIN MY PROJECT) */}
      <AnimatePresence>
        {showProjectSummaryModal && projectSummary && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant/40 rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 relative flex flex-col gap-5 text-left font-sans my-8"
            >
              <button 
                onClick={() => { setShowProjectSummaryModal(false); }}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 border-b border-outline-variant/15 pb-4">
                <div className="w-10 h-10 bg-[#F59E0B]/10 text-[#F59E0B] rounded-full flex items-center justify-center shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-white">AI Project Summary</h3>
                  <p className="text-[11px] text-on-surface-variant">Instant scope definition, risk factor assessment, and immediate next steps.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Core Goal */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant block font-mono">Core Project Objective</span>
                  <p className="text-sm text-white leading-relaxed font-medium bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                    {projectSummary.goal}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Risks */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#F59E0B] block font-mono">Risk Assessment</span>
                    <div className="flex flex-col gap-2 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                      {projectSummary.risks.map((risk, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs text-on-surface leading-relaxed">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5 animate-pulse" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Next Steps */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#6366F1] block font-mono">Immediate Next Steps</span>
                    <div className="flex flex-col gap-2 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                      {projectSummary.nextSteps.map((step, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs text-on-surface leading-relaxed">
                          <CheckCircle className="w-3.5 h-3.5 text-[#6366F1] shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant/10 flex justify-end">
                <button 
                  onClick={() => setShowProjectSummaryModal(false)}
                  className="px-6 py-2.5 bg-surface-container-high hover:bg-surface-container text-white text-xs font-bold rounded-full border border-outline-variant/20 transition-all cursor-pointer"
                >
                  Close Summary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: END OF DAY REVIEW */}
      <AnimatePresence>
        {showEodModal && eodReview && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant/40 rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 relative flex flex-col gap-5 text-left font-sans my-8"
            >
              <button 
                onClick={() => { setShowEodModal(false); }}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 border-b border-outline-variant/15 pb-4">
                <div className="w-10 h-10 bg-[#6366F1]/10 text-[#6366F1] rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-white">End of Day Review</h3>
                  <p className="text-[11px] text-on-surface-variant">Your automated tactical progress audit and forward projection outline.</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Completed Summary */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-success block font-mono">Tasks Completed Today</span>
                  <p className="text-sm text-white leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10 font-medium">
                    {eodReview.completedSummary}
                  </p>
                </div>

                {/* Progress Summary */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant block font-mono">Tactical Progression Audit</span>
                  <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10">
                    {eodReview.progressSummary}
                  </p>
                </div>

                {/* What's Next */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#F59E0B] block font-mono">Tomorrow's Tactical Directives</span>
                  <p className="text-sm text-white leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/10 font-medium">
                    {eodReview.whatsNext}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant/10 flex justify-end">
                <button 
                  onClick={() => setShowEodModal(false)}
                  className="px-6 py-2.5 bg-surface-container-high hover:bg-surface-container text-white text-xs font-bold rounded-full border border-outline-variant/20 transition-all cursor-pointer"
                >
                  Close Review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: STUCK CONTEXT HELPER SELECTOR */}
      <AnimatePresence>
        {showStuckModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant/50 rounded-2xl shadow-2xl w-full max-w-3xl p-6 md:p-10 relative flex flex-col gap-8"
            >
              <button 
                onClick={() => { setShowStuckModal(false); }}
                className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="text-center flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-[#F59E0B]/10 text-[#F59E0B] rounded-full flex items-center justify-center mb-2">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="font-display font-medium text-3xl text-white">Stuck on your objective?</h3>
                <p className="text-sm text-on-surface-variant max-w-md">Momentum is key. Let's step back and tackle one micro-level piece to get your progression engine flowing again.</p>
              </div>

              {/* Stuck card options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Outline */}
                <button 
                  onClick={() => { triggerStuckAction("Create Skeleton Outline Structure", "Outline 3 primary headings and 3 bullet points each"); }}
                  className="group flex flex-col items-center justify-center p-6 rounded-2xl border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high transition-all hover:border-[#F59E0B]/30 hover:-translate-y-1 text-center gap-4 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-surface-container-high group-hover:bg-[#F59E0B]/10 flex items-center justify-center transition-colors">
                    <FileText className="w-6 h-6 text-on-surface-variant group-hover:text-[#F59E0B] transition-colors" />
                  </div>
                  <div>
                    <h5 className="font-display font-bold text-lg text-white mb-0.5">Create Outline</h5>
                    <p className="text-[11px] text-on-surface-variant">Assemble baseline framework headings</p>
                  </div>
                </button>

                {/* Intro sentences */}
                <button 
                  onClick={() => { triggerStuckAction("Draft Introduction Fragment", "Write exactly 3 simple sentences of draft introductory content"); }}
                  className="group flex flex-col items-center justify-center p-6 rounded-2xl border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high transition-all hover:border-[#F59E0B]/30 hover:-translate-y-1 text-center gap-4 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-surface-container-high group-hover:bg-[#F59E0B]/10 flex items-center justify-center transition-colors">
                    <Inbox className="w-6 h-6 text-on-surface-variant group-hover:text-[#F59E0B] transition-colors" />
                  </div>
                  <div>
                    <h5 className="font-display font-bold text-lg text-white mb-0.5">Write Intro</h5>
                    <p className="text-[11px] text-on-surface-variant">Just 3 sentences to trigger starting</p>
                  </div>
                </button>

                {/* List key points */}
                <button 
                  onClick={() => { triggerStuckAction("List Primary Key Elements", "Brainstorm and write down exactly 5 single-sentence bullet points"); }}
                  className="group flex flex-col items-center justify-center p-6 rounded-2xl border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high transition-all hover:border-[#F59E0B]/30 hover:-translate-y-1 text-center gap-4 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-surface-container-high group-hover:bg-[#F59E0B]/10 flex items-center justify-center transition-colors">
                    <Lightbulb className="w-6 h-6 text-on-surface-variant group-hover:text-[#F59E0B] transition-colors" />
                  </div>
                  <div>
                    <h5 className="font-display font-bold text-lg text-white mb-0.5">List 5 Points</h5>
                    <p className="text-[11px] text-on-surface-variant">Rapid structural brainstorming</p>
                  </div>
                </button>

              </div>

              {/* Dynamic AI Breakthrough Diagnostics Area */}
              <div className="border-t border-outline-variant/10 pt-6">
                {aiStuckError ? (
                  <div className="bg-danger/5 border border-danger/20 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-3">
                    <p className="text-xs text-danger font-sans leading-normal">
                      {aiStuckError}
                    </p>
                    <button 
                      onClick={handleGetStuckDiagnostics}
                      className="px-5 py-2 bg-[#6366F1] hover:bg-[#6366F1]/90 text-white rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      Retry Diagnostics Compilation
                    </button>
                  </div>
                ) : !aiStuckResult && !isAiStuckLoading ? (
                  <div className="bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-3">
                    <Sparkles className="w-6 h-6 text-[#6366F1] animate-pulse" />
                    <div>
                      <h4 className="font-display font-bold text-sm text-white">Need a customized, psychological breakthrough?</h4>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-lg mx-auto">
                        Clutch AI will analyze your active project "{activeTask?.name || "Active Project"}" and diagnose your exact starting friction, outlining a personalized micro-step.
                      </p>
                    </div>
                    <button 
                      onClick={handleGetStuckDiagnostics}
                      className="px-5 py-2 bg-[#6366F1] hover:bg-[#6366F1]/90 text-white rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Compile AI Breakthrough Diagnostics
                    </button>
                  </div>
                ) : isAiStuckLoading ? (
                  <div className="bg-surface-container-high/40 border border-dashed border-[#6366F1]/30 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3 animate-pulse">
                    <Loader2 className="w-6 h-6 text-[#6366F1] animate-spin" />
                    <span className="text-xs text-on-surface-variant font-mono uppercase tracking-widest font-bold">Consulting behavioral specialist & compiling diagnostics...</span>
                  </div>
                ) : (
                  <div className="bg-surface-container border border-[#6366F1]/30 rounded-2xl p-5 space-y-4 relative overflow-hidden animate-fade-in text-left">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#6366F1]/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#6366F1]" />
                        <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#6366F1]">AI Breakthrough Diagnostic Readout</span>
                      </div>
                      <button 
                        onClick={() => setAiStuckResult(null)}
                        className="text-[9px] font-mono uppercase text-on-surface-variant hover:text-white"
                      >
                        Reset Diagnostic
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        {/* Blocker */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-danger font-bold block">Psychological Blocker Identified:</span>
                          <p className="text-xs text-on-surface font-medium leading-relaxed bg-danger/5 border border-danger/20 p-3 rounded-xl">
                            {aiStuckResult.text}
                          </p>
                        </div>

                        {/* Next Smallest Step */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-success font-bold block">Immediate Next Smallest Step:</span>
                          <p className="text-sm text-white font-bold leading-normal bg-success/5 border border-success/20 p-3 rounded-xl">
                            {aiStuckResult.title}
                          </p>
                        </div>
                      </div>

                      {/* Quick Recovery Actions */}
                      <div className="space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-[#6366F1] font-bold block">Quick Recovery Actions:</span>
                          <div className="space-y-1.5">
                            {aiStuckResult.list.map((stepText, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-surface-container-high/50 p-2.5 rounded-xl border border-outline-variant/10 text-white">
                                <span className="text-[10px] font-mono text-[#6366F1] font-extrabold bg-[#6366F1]/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                <span className="text-xs leading-normal">{stepText}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button 
                          onClick={() => { triggerStuckAction(aiStuckResult.title, aiStuckResult.list[0]); }}
                          className="w-full py-2.5 bg-[#F59E0B] text-bg-dark font-sans font-black text-xs rounded-full uppercase tracking-wider text-center active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 mt-3 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-bg-dark text-bg-dark" />
                          Launch 15m Sprint with this Action
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Return to task dismissal */}
              <div className="flex justify-center mt-2">
                <button 
                  onClick={() => { setShowStuckModal(false); }}
                  className="px-6 py-2 rounded-full text-on-surface-variant hover:text-white text-xs font-bold transition-all border border-transparent hover:border-outline-variant/30 cursor-pointer"
                >
                  I'm okay, return to main workplace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: EDIT PROFILE DETAILS (NAME & BIO) */}
      <AnimatePresence>
        {showEditProfileModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant/35 rounded-3xl shadow-2xl w-full max-w-md p-6 relative"
            >
              <button 
                onClick={() => { setShowEditProfileModal(false); }}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-[#6366F1]/10 border border-[#6366F1]/20 rounded-xl">
                  <UserIcon className="w-5 h-5 text-[#6366F1]" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-white">Edit Profile</h2>
                  <p className="text-[10px] text-on-surface-variant">Update your operator details below.</p>
                </div>
              </div>

              <div className="space-y-4 mt-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant" htmlFor="profile_name">Operator Name</label>
                  <input 
                    type="text"
                    id="profile_name"
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3.5 py-2 text-xs text-white placeholder-on-surface-variant/40 focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-mono font-bold tracking-wider text-on-surface-variant" htmlFor="profile_bio">Bio / Role (e.g. Designer, Student)</label>
                  <input 
                    type="text"
                    id="profile_bio"
                    value={profileBioInput}
                    onChange={(e) => setProfileBioInput(e.target.value)}
                    placeholder="e.g. Student"
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3.5 py-2 text-xs text-white placeholder-on-surface-variant/40 focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/10">
                  <button 
                    type="button"
                    onClick={() => { setShowEditProfileModal(false); }}
                    className="px-4 py-2 rounded-xl text-on-surface-variant hover:text-white text-xs font-bold transition-all hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={saveProfileChanges}
                    className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#6366F1]/90 text-white text-xs font-bold transition-all hover:scale-[1.01]"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: CREATE DYNAMIC ACTIVE MISSION OBJECTIVE FORM */}
      <AnimatePresence>
        {showCreateTaskModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-[24px] shadow-2xl w-full max-w-xl p-6 md:p-8 relative"
            >
              <button 
                onClick={() => { setShowCreateTaskModal(false); }}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-white transition-colors p-2 rounded-full hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="font-display font-bold text-2xl text-white mb-1">Add Active focus objective</h2>
              <p className="text-xs text-on-surface-variant mb-6">Manually configure a task mission monitoring sequence.</p>

              <form onSubmit={handleCreateNewProjectSubmit} className="space-y-4">
                
                {/* Visual form validation alert badge banner */}
                {projectFormError && (
                  <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                    <span>{projectFormError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Objective Name</label>
                  <input 
                    type="text" 
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="e.g. Q3 Roadmap Synthesis"
                    className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B]"
                    disabled={isCreatingProject}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Hard Deadline</label>
                    <input 
                      type="datetime-local" 
                      value={newProjDeadline}
                      onChange={(e) => setNewProjDeadline(e.target.value)}
                      className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B]"
                      disabled={isCreatingProject}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Available Hours Per Day</label>
                    <input 
                      type="number" 
                      value={newProjHoursPerDay}
                      onChange={(e) => setNewProjHoursPerDay(Number(e.target.value))}
                      className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B]"
                      min="1"
                      max="24"
                      disabled={isCreatingProject}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Active progress start %</label>
                  <input 
                    type="number" 
                    value={newProjProgress}
                    onChange={(e) => setNewProjProgress(Number(e.target.value))}
                    className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B]"
                    min="0"
                    max="99"
                    disabled={isCreatingProject}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Success Condition checklist goal</label>
                  <input 
                    type="text" 
                    value={newProjSuccess}
                    onChange={(e) => setNewProjSuccess(e.target.value)}
                    placeholder="e.g. Complete markdown document generated with leads"
                    className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B]"
                    disabled={isCreatingProject}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">Contextual notes (one per line)</label>
                  <textarea 
                    value={newProjNotesString}
                    onChange={(e) => setNewProjNotesString(e.target.value)}
                    placeholder="Reference files in Obsidian&#10;Focus strictly on human assets"
                    className="w-full bg-surface-container-high border border-outline-variant/50 text-white font-sans text-sm p-3 rounded-xl focus:border-[#F59E0B] h-20 resize-none"
                    disabled={isCreatingProject}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button 
                    type="submit"
                    disabled={isCreatingProject}
                    className="flex-1 bg-[#F59E0B] text-bg-dark font-sans font-bold py-3 rounded-full hover:opacity-90 active:scale-98 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingProject ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-bg-dark" />
                        <span>Calibrating parameters...</span>
                      </>
                    ) : (
                      <span>Add Mission Objective</span>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowCreateTaskModal(false); }}
                    disabled={isCreatingProject}
                    className="px-6 py-3 border border-outline-variant/30 text-on-surface-variant hover:text-white rounded-full text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: FIREBASE COMPREHENSIVE AUTH ENTRIES */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-surface border border-outline-variant rounded-[24px] shadow-2xl w-full max-w-[420px] p-6 md:p-8 relative flex flex-col gap-6"
            >
              <button 
                onClick={() => { setShowAuthModal(false); setAuthError(null); }}
                className="absolute top-4 right-4 text-on-surface-variant hover:text-white p-1 hover:bg-surface-container rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-full flex items-center justify-center text-[#F59E0B] mx-auto mb-2 border border-[#F59E0B]/20">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-2xl text-white">
                  {isSignUp ? "Create Clutch Profile" : "Cloud Sync Authentication"}
                </h3>
                <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                  {isSignUp 
                    ? "Establish secure credentials to back up project checkpoints and tracking logs to the database." 
                    : "Access synchronized smart plans and focus timers across all devices."}
                </p>
              </div>

              {authError && (
                authError === "OAuth redirect initiated" ? (
                  <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-2xl text-primary text-xs text-left font-semibold flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    <span>OAuth redirect initiated. Redirecting to Google Secure Authentication...</span>
                  </div>
                ) : (
                  <div className="p-3.5 bg-danger/10 border border-danger/30 rounded-2xl text-danger text-xs text-left font-semibold space-y-2 animate-pulse">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-danger shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                    {(authError.toLowerCase().includes("email not confirmed") || authError.toLowerCase().includes("email_not_confirmed")) && authEmail && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            triggerNotification("Sending verification email...");
                            await resendVerificationEmail(authEmail);
                            triggerNotification("Verification email resent successfully! Check your inbox.");
                          } catch (err: any) {
                            triggerNotification(`Resend failed: ${err.message}`);
                          }
                        }}
                        className="mt-1 px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger text-[10px] font-bold rounded-lg border border-danger/30 transition-all cursor-pointer block"
                      >
                        Resend Verification Link
                      </button>
                    )}
                  </div>
                )
              )}

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthError(null);
                  setAuthSubmitting(true);
                  try {
                    if (isSignUp) {
                      await createUserWithEmailAndPassword(auth, authEmail, authPassword);
                      triggerNotification("Account created! Cloud synchronizer configured.");
                    } else {
                      await signInWithEmailAndPassword(auth, authEmail, authPassword);
                      triggerNotification("Sign-in successful. Ingesting checkpoints.");
                    }
                    setShowAuthModal(false);
                    setAuthEmail("");
                    setAuthPassword("");
                  } catch (err: any) {
                    console.error("Auth process error:", err);
                    setAuthError(err?.message || "Authentication transaction failed");
                  } finally {
                    setAuthSubmitting(false);
                  }
                }}
                className="space-y-4 text-left"
              >
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant flex items-center gap-1.5" htmlFor="auth_email">
                    <Mail className="w-3.5 h-3.5 text-[#F59E0B]" /> Email Address
                  </label>
                  <input 
                    id="auth_email"
                    type="email" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full bg-surface-container border border-outline-variant/50 text-white font-sans text-sm p-3.5 rounded-xl focus:border-[#F59E0B] outline-none"
                    required
                    disabled={authSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant flex items-center gap-1.5" htmlFor="auth_pass">
                    <Lock className="w-3.5 h-3.5 text-[#F59E0B]" /> Access Password
                  </label>
                  <input 
                    id="auth_pass"
                    type="password" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container border border-outline-variant/50 text-white font-sans text-sm p-3.5 rounded-xl focus:border-[#F59E0B] outline-none"
                    required
                    minLength={6}
                    disabled={authSubmitting}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-3.5 bg-[#F59E0B] hover:opacity-90 active:scale-98 text-bg-dark font-sans font-black rounded-full text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {authSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-bg-dark" />
                      <span>Authenticating Client...</span>
                    </>
                  ) : (
                    <span>{isSignUp ? "Create Secure Account" : "Secure Sign In"}</span>
                  )}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-outline-variant/20"></div>
                <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-on-surface-variant/40">or connect via</span>
                <div className="flex-grow border-t border-outline-variant/20"></div>
              </div>

              <button 
                disabled={authSubmitting}
                onClick={async () => {
                  setAuthError(null);
                  setAuthSubmitting(true);
                  try {
                    const googleProvider = new GoogleAuthProvider();
                    await signInWithPopup(auth, googleProvider);
                    triggerNotification("Google Sign-In successful!");
                    setShowAuthModal(false);
                  } catch (err: any) {
                    console.error(err);
                    setAuthError(err?.message || "Google Single Sign-On failed");
                  } finally {
                    setAuthSubmitting(false);
                  }
                }}
                className="w-full h-11 rounded-xl border border-outline-variant/30 hover:bg-surface-container-low text-white text-sm font-sans flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
              >
                {authSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                ) : (
                  <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.62-1.07-1.39-1.21-2.22z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>{authSubmitting ? "Connecting..." : "Connect with Google"}</span>
              </button>

              <div className="text-center border-t border-outline-variant/10 pt-4">
                <button 
                  onClick={() => { setIsSignUp(prev => !prev); setAuthError(null); }}
                  className="text-xs text-[#F59E0B] hover:underline font-medium transition-all"
                >
                  {isSignUp ? "Already have an account? Sign In" : "New to Clutch? Create Account"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL OVERLAY: PROJECT DELETE TASK WARNING */}
      <AnimatePresence>
        {projectToDelete && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-surface border border-outline-variant rounded-[24px] shadow-2xl w-full max-w-[420px] p-6 relative flex flex-col gap-5 text-center"
            >
              <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center text-danger mx-auto border border-danger/20">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="font-display font-bold text-xl text-white">Dismiss Mission Checkpoint?</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  You are about to delete <span className="font-semibold text-white">"{projects.find(p => p.id === projectToDelete)?.name || "this project"}"</span>. This will destroy all calibrated hourly milestones, trajectory risk ratings, and custom-generated checklists immediately. This action is irreversible.
                </p>
              </div>

              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => {
                    if (projectToDelete) {
                      // Perform actual deletion workflow
                      const id = projectToDelete;
                      const updated = projects.filter(p => p.id !== id);
                      setProjects(updated);
                      deleteProjectFromCloud(id);
                      if (activeProjectId === id) {
                        if (updated.length > 0) {
                          setActiveProjectId(updated[0].id);
                        } else {
                          setActiveProjectId("");
                        }
                      }
                      triggerNotification("Project dismissed successfully.");
                      setProjectToDelete(null);
                    }
                  }}
                  className="flex-1 py-3 bg-danger text-[#131315] hover:opacity-90 active:scale-95 font-sans font-extrabold rounded-full text-xs transition-all"
                >
                  Yes, Permanently Delete
                </button>
                <button 
                  onClick={() => { setProjectToDelete(null); }}
                  className="flex-1 py-3 border border-outline-variant/30 hover:bg-surface-container text-white rounded-full text-xs font-bold transition-all"
                >
                  Dismiss warning
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SYSTEM RENDERING (Top right on desktop, bottom on mobile) */}
      <div 
        id="toast-notification-dock" 
        className="fixed z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4 md:p-0 bottom-4 right-4 sm:bottom-auto sm:top-14 sm:right-6"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`p-3.5 rounded-2xl shadow-xl font-bold text-xs flex items-center justify-between gap-3 pointer-events-auto w-full border ${
                t.type === "error" 
                  ? "bg-danger/20 border-danger text-danger backdrop-blur-md" 
                  : t.type === "info"
                  ? "bg-info/25 border-info text-info backdrop-blur-md"
                  : "bg-success/20 border-success text-success backdrop-blur-md"
              }`}
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-success" />
                <span className="font-sans leading-snug">{t.message}</span>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-on-surface-variant hover:text-white p-1 rounded transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MODAL OVERLAY: PRIVACY POLICY & LOCAL STORAGE CONSENT */}
      <AnimatePresence>
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-[#1e1f22] border border-[#2b2d31] rounded-[32px] shadow-2xl w-full max-w-[460px] p-8 relative flex flex-col gap-6 text-left overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-[#F59E0B] to-amber-600" />
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-xl flex items-center justify-center text-[#F59E0B] border border-[#F59E0B]/10">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-white leading-tight uppercase tracking-tight">Privacy & Data Storage</h3>
                  <p className="text-[10px] text-on-surface-variant/80 font-mono tracking-wider">SECURE LOCAL WORKSPACE DEPLOYMENT</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-on-surface-variant leading-relaxed">
                <p>
                  Your workspace is saved securely on this device using your browser's local storage. This includes your tasks, notes, schedules and chat history so you can continue where you left off.
                </p>
                <p>
                  Your AI requests are processed securely. Your personal data is never sold or used for advertising.
                </p>
                <p>
                  You can clear your browser data at any time to remove everything stored on this device.
                </p>

                <AnimatePresence>
                  {showPrivacyLearnMore && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden text-[11px] text-on-surface-variant/80 space-y-2.5 border-t border-outline-variant/10 pt-3.5 mt-1"
                    >
                      <p>
                        <strong>Local Storage Sandbox:</strong> Clutch saves all user configurations, projects, and custom milestones inside the client-side local database sandbox. This prevents telemetry leaking or external collection of your planning documents.
                      </p>
                      <p>
                        <strong>Workspace Intel:</strong> Any generative planning requests utilize standard, transient API relays that analyze metrics on-demand without keeping persistent records of your queries on external servers.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 mt-2">
                <button 
                  onClick={() => {
                    localStorage.setItem("clutch_privacy_consent_v1", "true");
                    setPrivacyConsented(true);
                    setShowPrivacyModal(false);
                    addToast("✓ Secure local workspace activated");
                  }}
                  className="flex-1 py-3 bg-[#F59E0B] text-bg-dark hover:translate-y-[-2px] active:scale-95 font-sans font-black text-xs uppercase tracking-wider rounded-full transition-all text-center flex items-center justify-center gap-1.5 font-bold shadow-md hover:shadow-lg hover:shadow-[#F59E0B]/10 cursor-pointer"
                >
                  Continue
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPrivacyLearnMore(!showPrivacyLearnMore)}
                  className="py-3 px-5 border border-outline-variant/30 text-on-surface-variant hover:text-white hover:bg-surface-container-low hover:translate-y-[-2px] active:scale-95 font-sans font-bold text-xs uppercase tracking-wider rounded-full transition-all text-center cursor-pointer"
                >
                  {showPrivacyLearnMore ? "Hide" : "Learn More"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLETED CELEBRATION MODAL OVERLAY */}
      <AnimatePresence>
        {completedProjectToCelebrate && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-outline-variant/40 rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success via-[#F59E0B] to-success animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-success/15 border-2 border-success flex items-center justify-center mx-auto mb-6 text-success animate-bounce">
                <Check className="w-8 h-8 text-success" />
              </div>

              <h2 className="font-display font-black text-2xl text-white mb-2 tracking-tight uppercase">✓ Task Completed!</h2>
              <p className="text-sm text-on-surface-variant mb-6 font-sans">
                Great work! You successfully finished: <span className="text-[#F59E0B] font-bold">"{completedProjectToCelebrate.name}"</span>. Keep building up your momentum!
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setCompletedProjectToCelebrate(null);
                    setShowCreateTaskModal(true);
                  }}
                  className="flex-1 bg-[#F59E0B] text-bg-dark font-sans font-bold py-3 px-4 rounded-full text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all text-center"
                >
                  Start New Task
                </button>
                <button
                  onClick={() => {
                    setCompletedProjectToCelebrate(null);
                    handleViewChange("tasks");
                  }}
                  className="flex-1 border border-outline-variant/35 hover:border-white text-white font-sans font-bold py-3 px-4 rounded-full text-xs uppercase tracking-wider active:scale-95 transition-all text-center"
                >
                  Completed Tasks
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* FLOATING AI ASSISTANT (FAB) */}
      {onboarding.completed && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-40 font-sans">
          <div className="relative">
            <AnimatePresence>
              {showAiFabMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 15 }}
                  layout
                  className={`bg-surface-container-high border border-outline-variant/35 shadow-2xl flex flex-col gap-3.5 text-left font-sans overflow-hidden transition-all duration-300 ${
                    isAiFullscreen 
                      ? "fixed inset-0 z-[100] w-screen h-screen rounded-none p-6 md:p-8" 
                      : `absolute bottom-18 right-0 ${
                          showHistoryPane ? "w-[90vw] sm:w-[600px] left-auto right-0" : "w-80 sm:w-96"
                        } rounded-3xl p-4 h-[500px] sm:h-[460px]`
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-outline-variant/10 pb-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowHistoryPane(prev => !prev)}
                        className={`p-1.5 rounded-xl transition-all ${
                          showHistoryPane ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-surface-container hover:bg-surface-container-low text-on-surface-variant hover:text-white"
                        }`}
                        title="Toggle Chat History"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setIsAiFullscreen(prev => !prev)}
                        className={`p-1.5 rounded-xl transition-all ${
                          isAiFullscreen ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-surface-container hover:bg-surface-container-low text-on-surface-variant hover:text-white"
                        }`}
                        title={isAiFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                      >
                        {isAiFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>

                      <span className="font-display font-black text-xs text-white uppercase tracking-wider truncate max-w-[120px] sm:max-w-[200px]">
                        {activeChatId ? savedChats.find(c => c.id === activeChatId)?.title || "Active Chat" : "Clutch Assistant"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setActiveChatId(null);
                          setShowHistoryPane(false);
                          addToast("✓ Started a new chat session.");
                        }}
                        className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-low text-[#F59E0B] hover:text-white transition-all text-xs flex items-center gap-1 font-bold"
                        title="New Chat"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[9px] uppercase tracking-wider">New</span>
                      </button>
                      <button 
                        onClick={() => { setShowAiFabMenu(false); setIsAiFullscreen(false); }}
                        className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-low text-on-surface-variant hover:text-white transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex overflow-hidden gap-4 min-h-0 relative">
                    {/* LEFT PANE: HISTORY SIDEBAR */}
                    {showHistoryPane && (
                      <div className="w-full sm:w-[220px] shrink-0 border-r border-outline-variant/10 pr-3 flex flex-col gap-3.5 h-full overflow-hidden select-none">
                        {/* Search Bar */}
                        <div className="relative flex-shrink-0">
                          <input
                            type="text"
                            placeholder="Search chats..."
                            value={chatSearchQuery}
                            onChange={(e) => setChatSearchQuery(e.target.value)}
                            className="w-full bg-surface border border-outline-variant/35 rounded-xl pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-on-surface-variant/50 focus:outline-none focus:border-[#F59E0B]"
                          />
                          <History className="w-3.5 h-3.5 text-on-surface-variant/60 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Chats Grouped Scroll Area */}
                        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-3 pb-2 text-[11px]">
                          {(() => {
                            const filtered = savedChats.filter(chat => 
                              chat.title.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
                              chat.messages.some(m => m.text.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                            );

                            if (filtered.length === 0) {
                              return (
                                <div className="text-center text-on-surface-variant/40 py-8 italic font-sans">
                                  No saved chats found
                                </div>
                              );
                            }

                            const groups = groupChatsByDate(filtered);

                            const renderGroupList = (groupTitle: string, chatList: SavedChat[]) => {
                              if (chatList.length === 0) return null;
                              return (
                                <div className="space-y-1">
                                  <span className="text-[9px] uppercase font-bold text-on-surface-variant/50 tracking-widest block px-1">{groupTitle}</span>
                                  {chatList.map(chat => {
                                    const isActive = chat.id === activeChatId;
                                    const isRenaming = chat.id === chatRenameId;

                                    return (
                                      <div
                                        key={chat.id}
                                        className={`group/item flex items-center justify-between rounded-xl px-2 py-1 transition-all text-left border ${
                                          isActive 
                                            ? "bg-[#F59E0B]/10 border-[#F59E0B]/20 text-white" 
                                            : "border-transparent text-on-surface-variant hover:text-white hover:bg-surface-container/40"
                                        }`}
                                      >
                                        <div 
                                          onClick={() => {
                                            setActiveChatId(chat.id);
                                            // On mobile, automatically close history view on chat selection
                                            if (window.innerWidth < 640) {
                                              setShowHistoryPane(false);
                                            }
                                          }}
                                          className="flex-1 min-w-0 pr-1 cursor-pointer flex items-center gap-1.5 py-1"
                                        >
                                          {chat.isPinned ? (
                                            <Sparkle className="w-3 h-3 text-[#F59E0B] shrink-0" />
                                          ) : (
                                            <FileText className="w-3 h-3 text-on-surface-variant/60 group-hover/item:text-white shrink-0" />
                                          )}
                                          
                                          {isRenaming ? (
                                            <input
                                              type="text"
                                              value={chatRenameValue}
                                              onChange={(e) => setChatRenameValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  if (chatRenameValue.trim()) {
                                                    setSavedChats(prev => prev.map(c => c.id === chat.id ? { ...c, title: chatRenameValue.trim() } : c));
                                                    setChatRenameId(null);
                                                    addToast("✓ Chat renamed");
                                                  }
                                                } else if (e.key === "Escape") {
                                                  setChatRenameId(null);
                                                }
                                              }}
                                              autoFocus
                                              className="bg-surface border border-[#F59E0B] text-white text-[11px] px-1 rounded outline-none w-full"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          ) : (
                                            <span className="truncate block font-sans font-semibold leading-none">{chat.title}</span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                          {isRenaming ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (chatRenameValue.trim()) {
                                                  setSavedChats(prev => prev.map(c => c.id === chat.id ? { ...c, title: chatRenameValue.trim() } : c));
                                                  setChatRenameId(null);
                                                  addToast("✓ Chat renamed");
                                                }
                                              }}
                                              className="p-0.5 hover:text-[#F59E0B] transition-colors"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSavedChats(prev => prev.map(c => c.id === chat.id ? { ...c, isPinned: !c.isPinned } : c));
                                                }}
                                                className="p-0.5 hover:text-[#F59E0B] transition-colors"
                                                title={chat.isPinned ? "Unpin Chat" : "Pin Chat"}
                                              >
                                                <Sparkle className={`w-3 h-3 ${chat.isPinned ? "text-[#F59E0B]" : "text-on-surface-variant"}`} />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setChatRenameId(chat.id);
                                                  setChatRenameValue(chat.title);
                                                }}
                                                className="p-0.5 hover:text-white transition-colors"
                                                title="Rename Chat"
                                              >
                                                <Pencil className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (window.confirm(`Are you sure you want to delete this chat: "${chat.title}"?`)) {
                                                    setSavedChats(prev => prev.filter(c => c.id !== chat.id));
                                                    if (activeChatId === chat.id) {
                                                      setActiveChatId(null);
                                                    }
                                                    addToast("✓ Chat deleted");
                                                  }
                                                }}
                                                className="p-0.5 hover:text-danger transition-colors"
                                                title="Delete Chat"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            };

                            return (
                              <div className="space-y-4">
                                {renderGroupList("Pinned", groups.pinned)}
                                {renderGroupList("Today", groups.today)}
                                {renderGroupList("Yesterday", groups.yesterday)}
                                {renderGroupList("Last 7 Days", groups.last7Days)}
                                {renderGroupList("Older", groups.older)}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* RIGHT PANE (OR MAIN CONTENT AREA): ACTIVE CONVERSATION */}
                    {(!showHistoryPane || window.innerWidth >= 640) && (
                      <div className="flex-1 flex flex-col gap-3.5 min-h-0">
                        {/* AI Quick Prompt Chips */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0 select-none">
                          <span className="text-[9px] uppercase font-bold text-on-surface-variant/75 tracking-wider font-mono">Quick Focus Prompts</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => handleAiFabAction("suggest_next_action", "Next High-Value Action")}
                              className="px-2.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/15 text-left transition-all active:scale-98 text-[11px] font-bold text-white hover:bg-[#F59E0B]/5"
                            >
                              What next?
                            </button>

                            <button
                              onClick={() => handleAiFabAction("break_task_down", "Task Actionable Milestones")}
                              className="px-2.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/15 text-left transition-all active:scale-98 text-[11px] font-bold text-white hover:bg-[#F59E0B]/5"
                            >
                              Break current task
                            </button>

                            <button
                              onClick={() => handleAiFabAction("find_blockers", "Identified Project Risks")}
                              className="px-2.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/15 text-left transition-all active:scale-98 text-[11px] font-bold text-white hover:bg-[#F59E0B]/5"
                            >
                              Spot bottlenecks
                            </button>

                            <button
                              onClick={() => handleAiFabAction("suggest_work_session", "Optimized Focus Window")}
                              className="px-2.5 py-1.5 rounded-xl bg-surface-container border border-outline-variant/15 text-left transition-all active:scale-98 text-[11px] font-bold text-white hover:bg-[#F59E0B]/5"
                            >
                              When to focus?
                            </button>
                          </div>
                        </div>

                        {/* Conversation Window */}
                        <div className="flex-1 p-3.5 rounded-2xl bg-surface-container border border-outline-variant/15 overflow-y-auto flex flex-col gap-3 scrollbar-none min-h-0">
                          {chatMessages.map((msg, idx) => (
                            <div 
                              key={idx} 
                              className={`flex flex-col max-w-[85%] ${
                                msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                              }`}
                            >
                              <span className="text-[9px] text-on-surface-variant/60 font-mono mb-0.5 select-none">
                                {msg.sender === "user" ? "You" : "Clutch Assistant"} • {msg.timestamp}
                              </span>
                              <div 
                                className={`px-3 py-2 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap font-medium shadow-sm ${
                                  msg.sender === "user" 
                                    ? "bg-[#6366F1] text-white rounded-tr-none" 
                                    : "bg-surface-container-high border border-outline-variant/25 text-white rounded-tl-none"
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          ))}
                          {isFabLoading && (
                            <div className="self-start flex flex-col items-start max-w-[85%]">
                              <span className="text-[9px] text-on-surface-variant/60 font-mono mb-0.5 select-none">Clutch Assistant is thinking...</span>
                              <div className="px-3.5 py-2 rounded-2xl text-[11px] bg-surface-container-high border border-outline-variant/20 text-[#F59E0B] rounded-tl-none animate-pulse flex items-center gap-1.5 font-bold">
                                <Loader2 className="w-3 h-3 animate-spin text-[#F59E0B]" />
                                Formulating strategy...
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Custom Message Input Form */}
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSendCustomMessage();
                          }}
                          className="flex gap-1.5 items-center flex-shrink-0 relative group"
                        >
                          <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendCustomMessage();
                              }
                            }}
                            placeholder="Ask Clutch anything..."
                            disabled={isFabLoading}
                            rows={1}
                            style={{ resize: "none" }}
                            className="flex-1 bg-surface border border-outline-variant/30 rounded-2xl px-3.5 py-2.5 pr-12 text-xs text-white placeholder-on-surface-variant/60 focus:outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B]/20 transition-all duration-200 disabled:opacity-50 scrollbar-none max-h-24 font-medium"
                          />
                          <button
                            type="submit"
                            disabled={isFabLoading || !chatInput.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-bg-dark rounded-xl active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-all flex items-center justify-center shrink-0 shadow-md"
                          >
                            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Float FAB Button */}
            <button
              onClick={() => {
                const willOpen = !showAiFabMenu;
                setShowAiFabMenu(willOpen);
                if (!willOpen) setIsAiFullscreen(false);
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all cursor-pointer active:scale-95 border ${
                showAiFabMenu 
                  ? "bg-white text-bg-dark border-white rotate-90" 
                  : "bg-gradient-to-tr from-[#F59E0B] to-amber-600 text-[#131315] border-[#F59E0B] hover:scale-105 shadow-[#F59E0B]/15"
              }`}
              title="Clutch Assistant"
            >
              {showAiFabMenu ? (
                <X className="w-6 h-6 text-[#131315]" />
              ) : (
                <Sparkles className="w-6 h-6 text-[#131315] animate-pulse" />
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
