-- ============================================================================
-- SUPABASE POSTGRESQL DATABASE SCHEMA & SECURITY POLICIES
-- Project: Clutch Cockpit (https://tpfbqjrcsiwpgkbcbwgt.supabase.co)
-- ============================================================================

-- Enable UUID Extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Stores user account status, profiles, onboarding telemetry, and metrics
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  profile_type TEXT,
  main_goal TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROJECTS TABLE
-- Stores the user's projects with progress, risk analysis, and rescue buffers
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  risk_level TEXT DEFAULT 'SAFE' CHECK (risk_level IN ('SAFE', 'AT RISK', 'CRITICAL')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  hours_remaining INTEGER DEFAULT 0,
  hours_per_day INTEGER DEFAULT 0,
  success_condition TEXT,
  notes TEXT[] DEFAULT '{}',
  rescue_plan JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on projects for faster querying
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);

-- 3. NOTES TABLE
-- Stores project specific notes, quick observations, and triage actions
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);

-- 4. CALENDAR EVENTS TABLE
-- Stores schedule details, calendars, work sprints, and critical intervals
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON public.calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);

-- 5. SMART PLANS TABLE
-- Stores AI-generated detailed rescue plans, trajectories, and microtask triage checklists
CREATE TABLE IF NOT EXISTS public.smart_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_plan JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_plans_project_id ON public.smart_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_smart_plans_user_id ON public.smart_plans(user_id);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure players can ONLY access, create, update, or destroy their own records
-- ============================================================================

-- Enable RLS on all 5 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_plans ENABLE ROW LEVEL SECURITY;

-- --- Profiles Security Policies ---
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- --- Projects Security Policies ---
CREATE POLICY "Users can query their own projects" 
  ON public.projects FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
  ON public.projects FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
  ON public.projects FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
  ON public.projects FOR DELETE 
  USING (auth.uid() = user_id);

-- --- Notes Security Policies ---
CREATE POLICY "Users can query their own notes" 
  ON public.notes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" 
  ON public.notes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
  ON public.notes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
  ON public.notes FOR DELETE 
  USING (auth.uid() = user_id);

-- --- Calendar Events Security Policies ---
CREATE POLICY "Users can query their own calendar events" 
  ON public.calendar_events FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events" 
  ON public.calendar_events FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" 
  ON public.calendar_events FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events" 
  ON public.calendar_events FOR DELETE 
  USING (auth.uid() = user_id);

-- --- Smart Plans Security Policies ---
CREATE POLICY "Users can query their own smart plans" 
  ON public.smart_plans FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own smart plans" 
  ON public.smart_plans FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart plans" 
  ON public.smart_plans FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smart plans" 
  ON public.smart_plans FOR DELETE 
  USING (auth.uid() = user_id);


-- ============================================================================
-- AUTO PROFILE CREATION ON SIGN-UP TRIGGER
-- Intercepts Supabase Auth user signups and creates matching public.profiles rows
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    avatar_url, 
    onboarding_completed, 
    created_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'displayName', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'photoURL', 'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(new.email, 'User')),
    FALSE,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create/Recreate trigger to link Auth Users with Profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
