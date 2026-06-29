import { create } from "zustand";
import { 
  UserProfile, 
  ProjectDoc, 
  NoteDoc, 
  CalendarEventDoc, 
  SmartPlanDoc,
  fetchProjects,
  fetchNotes,
  fetchCalendarEvents,
  fetchSmartPlan,
  saveProject,
  saveNote,
  saveCalendarEvent,
  saveSmartPlan,
  deleteProject,
  deleteNote,
  deleteCalendarEvent
} from "./lib/firebase";

interface ClutchStore {
  // State
  user: UserProfile | null;
  projects: ProjectDoc[];
  activeProjectId: string | null;
  activeSmartPlan: SmartPlanDoc | null;
  notes: NoteDoc[];
  calendarEvents: CalendarEventDoc[];
  loading: boolean;
  error: string | null;

  // Setters/Simple Mutations
  setUser: (user: UserProfile | null) => void;
  setProjects: (projects: ProjectDoc[]) => void;
  setActiveProjectId: (id: string | null) => void;
  setActiveSmartPlan: (plan: SmartPlanDoc | null) => void;
  setNotes: (notes: NoteDoc[]) => void;
  setCalendarEvents: (events: CalendarEventDoc[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Orchestration / Async Actions
  loadAllData: (userId: string) => Promise<void>;
  loadActiveProjectDetails: (userId: string, projectId: string) => Promise<void>;
  
  // Projects Actions
  createProject: (project: ProjectDoc) => Promise<void>;
  updateProject: (project: ProjectDoc) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;

  // Notes Actions
  createNote: (note: NoteDoc) => Promise<void>;
  updateNote: (note: NoteDoc) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;

  // Calendar Events Actions
  createCalendarEvent: (event: CalendarEventDoc) => Promise<void>;
  removeCalendarEvent: (eventId: string) => Promise<void>;

  // Smart Plan Actions
  createOrUpdateSmartPlan: (plan: SmartPlanDoc) => Promise<void>;
}

export const useClutchStore = create<ClutchStore>((set, get) => ({
  user: null,
  projects: [],
  activeProjectId: null,
  activeSmartPlan: null,
  notes: [],
  calendarEvents: [],
  loading: false,
  error: null,

  setUser: (user) => set({ user }),
  setProjects: (projects) => set({ projects }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setActiveSmartPlan: (activeSmartPlan) => set({ activeSmartPlan }),
  setNotes: (notes) => set({ notes }),
  setCalendarEvents: (calendarEvents) => set({ calendarEvents }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  loadAllData: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const projects = await fetchProjects(userId);
      set({ projects });
      
      if (projects.length > 0) {
        // Default to first project if none is active or active is not in the list
        const currentActiveId = get().activeProjectId;
        const exists = projects.some(p => p.id === currentActiveId);
        const activeId = exists ? currentActiveId : projects[0].id;
        set({ activeProjectId: activeId });
        
        if (activeId) {
          await get().loadActiveProjectDetails(userId, activeId);
        }
      } else {
        set({ activeProjectId: null, activeSmartPlan: null, notes: [], calendarEvents: [] });
      }
    } catch (err: any) {
      console.error("Error loading all data:", err);
      set({ error: "Unable to load your projects. Please try again." });
    } finally {
      set({ loading: false });
    }
  },

  loadActiveProjectDetails: async (userId: string, projectId: string) => {
    try {
      const [notes, calendarEvents, smartPlan] = await Promise.all([
        fetchNotes(userId, projectId),
        fetchCalendarEvents(userId, projectId),
        fetchSmartPlan(userId, projectId)
      ]);
      set({ notes, calendarEvents, activeSmartPlan: smartPlan });
    } catch (err) {
      console.error("Error loading active project details:", err);
      set({ error: "Unable to load project details completely. Please refresh." });
    }
  },

  createProject: async (project: ProjectDoc) => {
    try {
      await saveProject(project);
      set((state) => ({
        projects: [project, ...state.projects],
        activeProjectId: project.id,
        notes: [],
        calendarEvents: [],
        activeSmartPlan: null
      }));
    } catch (err) {
      console.error("Error saving project:", err);
      throw new Error("Unable to save project. Please check your connection.");
    }
  },

  updateProject: async (project: ProjectDoc) => {
    try {
      await saveProject(project);
      set((state) => ({
        projects: state.projects.map((p) => p.id === project.id ? project : p)
      }));
    } catch (err) {
      console.error("Error updating project:", err);
      throw new Error("Unable to auto-save project edits.");
    }
  },

  removeProject: async (projectId: string) => {
    try {
      await deleteProject(projectId);
      set((state) => {
        const remaining = state.projects.filter((p) => p.id !== projectId);
        const nextActiveId = remaining.length > 0 ? remaining[0].id : null;
        return {
          projects: remaining,
          activeProjectId: nextActiveId
        };
      });
      const currentUser = get().user;
      const nextActiveId = get().activeProjectId;
      if (currentUser && nextActiveId) {
        await get().loadActiveProjectDetails(currentUser.uid, nextActiveId);
      } else {
        set({ notes: [], calendarEvents: [], activeSmartPlan: null });
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      throw new Error("Unable to delete project.");
    }
  },

  createNote: async (note: NoteDoc) => {
    try {
      await saveNote(note);
      set((state) => ({
        notes: [note, ...state.notes]
      }));
    } catch (err) {
      console.error("Error saving note:", err);
      throw new Error("Unable to save note.");
    }
  },

  updateNote: async (note: NoteDoc) => {
    try {
      await saveNote(note);
      set((state) => ({
        notes: state.notes.map((n) => n.id === note.id ? note : n)
      }));
    } catch (err) {
      console.error("Error updating note:", err);
      throw new Error("Unable to auto-save note content.");
    }
  },

  removeNote: async (noteId: string) => {
    try {
      await deleteNote(noteId);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId)
      }));
    } catch (err) {
      console.error("Error deleting note:", err);
      throw new Error("Unable to delete note.");
    }
  },

  createCalendarEvent: async (event: CalendarEventDoc) => {
    try {
      await saveCalendarEvent(event);
      set((state) => ({
        calendarEvents: [...state.calendarEvents, event]
      }));
    } catch (err) {
      console.error("Error saving calendar event:", err);
      throw new Error("Unable to schedule event.");
    }
  },

  removeCalendarEvent: async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId);
      set((state) => ({
        calendarEvents: state.calendarEvents.filter((e) => e.id !== eventId)
      }));
    } catch (err) {
      console.error("Error deleting calendar event:", err);
      throw new Error("Unable to remove calendar event.");
    }
  },

  createOrUpdateSmartPlan: async (plan: SmartPlanDoc) => {
    try {
      await saveSmartPlan(plan);
      set({ activeSmartPlan: plan });
    } catch (err) {
      console.error("Error saving smart plan:", err);
      throw new Error("Unable to save generated smart plan.");
    }
  }
}));
