// --- LOCAL-FIRST ROBUST DATABASE & AUTH SERVICE ADAPTER ---
// This file completely isolates data management to local browser storage (localStorage).
// This eliminates external network requests to Supabase/Firebase, avoiding any "Failed to fetch" errors.

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: null }),
    resend: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
  }),
};

// --- INTERFACES & SCHEMA TYPES ---
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  createdAt: string;
  onboardingCompleted: boolean;
  profileType?: string | null;
  mainGoal?: string | null;
}

export interface ProjectDoc {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: string;
  progress: number;
  riskLevel: string; // "SAFE" | "AT RISK" | "CRITICAL"
  status: string; // "ACTIVE" | "COMPLETED" | "ARCHIVED"
  createdAt: string;
  updatedAt: string;
  hoursRemaining?: number;
  hoursPerDay?: number;
  successCondition?: string;
  notes?: string[];
  rescuePlan?: any;
}

export interface NoteDoc {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventDoc {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface SmartPlanDoc {
  id: string;
  userId: string;
  projectId: string;
  generatedPlan: any; 
  generatedAt: string;
}

export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  photoURL?: string | null;
}

// --- LOCAL STORAGE DATA ACCESS BACKUP ---
function getLocalCollection(collectionName: string): any[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(`clutch_local_${collectionName}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveLocalCollection(collectionName: string, items: any[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`clutch_local_${collectionName}`, JSON.stringify(items));
}

export function mapSupabaseUser(user: any): FirebaseUser {
  return {
    uid: user.id,
    email: user.email || null,
    displayName: user.user_metadata?.full_name || user.user_metadata?.displayName || user.email?.split("@")[0] || "Operator",
    emailVerified: !!user.email_confirmed_at,
    photoURL: user.user_metadata?.avatar_url || user.user_metadata?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || "User")}`
  };
}

// --- CUSTOM SANDBOX AUTHENTICATION CLASS ---
class SupabaseAuthAdapter {
  private listeners: ((user: FirebaseUser | null) => void)[] = [];
  public currentUser: FirebaseUser | null = null;
  public initialized: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("clutch_mock_user");
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch {
          this.setDefaultUser();
        }
      } else {
        this.setDefaultUser();
      }
    }
  }

  private setDefaultUser() {
    this.currentUser = {
      uid: "local-user",
      displayName: "Operator",
      email: "local-user@clutch.io",
      emailVerified: true,
      photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=Operator"
    };
  }

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  setCurrentUser(user: FirebaseUser | null) {
    this.currentUser = user;
    if (typeof window !== "undefined") {
      if (user) {
        localStorage.setItem("clutch_mock_user", JSON.stringify(user));
      } else {
        localStorage.removeItem("clutch_mock_user");
      }
    }
    this.listeners.forEach(l => l(user));
  }
}

export const auth = new SupabaseAuthAdapter();

export function onAuthStateChanged(authInstance: any, callback: (user: FirebaseUser | null) => void) {
  return auth.onAuthStateChanged(callback);
}

// --- AUTHENTICATION ACTIONS MOCK ---
export async function signInWithEmailAndPassword(authInstance: any, email: string, password: string): Promise<{ user: FirebaseUser }> {
  const user: FirebaseUser = {
    uid: "local-user",
    displayName: email.split("@")[0] || "Operator",
    email,
    emailVerified: true,
    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
  };
  auth.setCurrentUser(user);
  return { user };
}

export async function createUserWithEmailAndPassword(authInstance: any, email: string, password: string): Promise<{ user: FirebaseUser }> {
  const user: FirebaseUser = {
    uid: "local-user",
    displayName: email.split("@")[0] || "Operator",
    email,
    emailVerified: true,
    photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
  };
  auth.setCurrentUser(user);
  return { user };
}

export async function resendVerificationEmail(email: string): Promise<void> {
  // No-op in local sandboxed environment
}

export async function signOut(authInstance: any): Promise<void> {
  auth.setCurrentUser(null);
}

export class GoogleAuthProvider {}

export async function signInWithPopup(authInstance: any, provider: any): Promise<{ user: FirebaseUser }> {
  const user: FirebaseUser = {
    uid: "local-user",
    displayName: "Google Operator",
    email: "google-user@clutch.io",
    emailVerified: true,
    photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=GoogleUser"
  };
  auth.setCurrentUser(user);
  return { user };
}

// --- CORE LOCAL CRUD ACTIONS FOR ZUSTAND STORE ---

export async function fetchProjects(userId: string): Promise<ProjectDoc[]> {
  return getLocalCollection("projects").filter(p => p.userId === userId);
}

export async function saveProject(project: ProjectDoc): Promise<void> {
  const list = getLocalCollection("projects");
  const index = list.findIndex(p => p.id === project.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...project };
  } else {
    list.push(project);
  }
  saveLocalCollection("projects", list);
}

export async function deleteProject(projectId: string): Promise<void> {
  const list = getLocalCollection("projects");
  saveLocalCollection("projects", list.filter(p => p.id !== projectId));
  saveLocalCollection("notes", getLocalCollection("notes").filter(n => n.projectId !== projectId));
  saveLocalCollection("calendarEvents", getLocalCollection("calendarEvents").filter(e => e.projectId !== projectId));
  saveLocalCollection("smartPlans", getLocalCollection("smartPlans").filter(p => p.projectId !== projectId));
}

export async function fetchNotes(userId: string, projectId: string): Promise<NoteDoc[]> {
  return getLocalCollection("notes").filter(n => n.userId === userId && n.projectId === projectId);
}

export async function saveNote(note: NoteDoc): Promise<void> {
  const list = getLocalCollection("notes");
  const index = list.findIndex(n => n.id === note.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...note };
  } else {
    list.push(note);
  }
  saveLocalCollection("notes", list);
}

export async function deleteNote(noteId: string): Promise<void> {
  const list = getLocalCollection("notes");
  saveLocalCollection("notes", list.filter(n => n.id !== noteId));
}

export async function fetchCalendarEvents(userId: string, projectId: string): Promise<CalendarEventDoc[]> {
  return getLocalCollection("calendarEvents").filter(e => e.userId === userId && e.projectId === projectId);
}

export async function saveCalendarEvent(event: CalendarEventDoc): Promise<void> {
  const list = getLocalCollection("calendarEvents");
  const index = list.findIndex(e => e.id === event.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...event };
  } else {
    list.push(event);
  }
  saveLocalCollection("calendarEvents", list);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const list = getLocalCollection("calendarEvents");
  saveLocalCollection("calendarEvents", list.filter(e => e.id !== eventId));
}

export async function fetchSmartPlan(userId: string, projectId: string): Promise<SmartPlanDoc | null> {
  return getLocalCollection("smartPlans").find(p => p.userId === userId && p.projectId === projectId) || null;
}

export async function saveSmartPlan(plan: SmartPlanDoc): Promise<void> {
  const list = getLocalCollection("smartPlans");
  const index = list.findIndex(p => p.id === plan.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...plan };
  } else {
    list.push(plan);
  }
  saveLocalCollection("smartPlans", list);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  return getLocalCollection("users").find(u => u.uid === uid) || null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const list = getLocalCollection("users");
  const index = list.findIndex(u => u.uid === profile.uid);
  if (index >= 0) {
    list[index] = { ...list[index], ...profile };
  } else {
    list.push(profile);
  }
  saveLocalCollection("users", list);
}

// --- FIRESTORE DUMMY ENGINE DEFINITIONS ---
export const db = { name: "LocalDatabase" };

export interface DocumentReference {
  collectionName: string;
  id: string;
}

export function doc(database: any, collectionName: string, id: string): DocumentReference {
  return { collectionName, id };
}

export interface CollectionReference {
  collectionName: string;
}

export function collection(database: any, collectionName: string): CollectionReference {
  return { collectionName };
}

export interface Query {
  collectionName: string;
  whereClauses: { field: string; op: string; value: any }[];
}

export function query(collectionRef: CollectionReference, ...constraints: any[]): Query {
  const whereClauses = constraints.filter(c => c && c.type === "where").map(c => c.clause);
  return {
    collectionName: collectionRef.collectionName,
    whereClauses
  };
}

export function where(field: string, op: string, value: any) {
  return {
    type: "where",
    clause: { field, op, value }
  };
}

export interface DocumentSnapshot {
  id: string;
  exists: () => boolean;
  data: () => any;
}

export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  const list = getLocalCollection(docRef.collectionName);
  const idKey = docRef.collectionName === "users" ? "uid" : "id";
  const found = list.find((item: any) => item[idKey] === docRef.id);
  return {
    id: docRef.id,
    exists: () => !!found,
    data: () => found || null
  };
}

export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }): Promise<void> {
  const list = getLocalCollection(docRef.collectionName);
  const idKey = docRef.collectionName === "users" ? "uid" : "id";
  const index = list.findIndex((item: any) => item[idKey] === docRef.id);
  
  let camelCaseData = { ...data };
  if (docRef.collectionName !== "users") {
    camelCaseData.id = docRef.id;
  } else {
    camelCaseData.uid = docRef.id;
  }
  
  if (index >= 0) {
    if (options?.merge) {
      list[index] = { ...list[index], ...camelCaseData };
    } else {
      list[index] = camelCaseData;
    }
  } else {
    list.push(camelCaseData);
  }
  saveLocalCollection(docRef.collectionName, list);
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const list = getLocalCollection(docRef.collectionName);
  const idKey = docRef.collectionName === "users" ? "uid" : "id";
  const filtered = list.filter((item: any) => item[idKey] !== docRef.id);
  saveLocalCollection(docRef.collectionName, filtered);
}

export interface QuerySnapshot {
  docs: DocumentSnapshot[];
  forEach: (callback: (doc: DocumentSnapshot) => void) => void;
  size: number;
  empty: boolean;
}

export async function getDocs(q: Query | CollectionReference): Promise<QuerySnapshot> {
  const collectionName = (q as any).collectionName;
  let list = getLocalCollection(collectionName);
  
  if (q && "whereClauses" in q) {
    (q as any).whereClauses.forEach((clause: any) => {
      list = list.filter((item: any) => {
        const itemVal = item[clause.field];
        if (clause.op === "==") {
          return itemVal === clause.value;
        }
        return true;
      });
    });
  }
  
  const docs = list.map((item: any) => {
    const idKey = collectionName === "users" ? "uid" : "id";
    return {
      id: item[idKey],
      exists: () => true,
      data: () => item
    };
  });
  
  return {
    docs,
    forEach: (callback) => docs.forEach(callback),
    size: docs.length,
    empty: docs.length === 0
  };
}

export function onSnapshot(docRef: DocumentReference, callback: (snapshot: DocumentSnapshot) => void) {
  getDoc(docRef).then(callback);
  return () => {};
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
