-- ═══════════════════════════════════════════════════════
-- STUDYVAULT — Supabase SQL Schema (Updated for New Subjects)
-- ═══════════════════════════════════════════════════════

-- ── WIPE EXISTING TABLES ──
DROP TABLE IF EXISTS exam_scores CASCADE;
DROP TABLE IF EXISTS study_plan CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS notes CASCADE;

-- ── 1. NOTES table ─────────────────────────────────────
CREATE TABLE notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  subject     text NOT NULL CHECK (subject IN ('dsa','cn','coa','vm','os','se','ap','m1','m2','evs','other')),
  pages       int,
  file_url    text,           
  file_path   text,           
  file_name   text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── 2. EXAMS / PAPERS table ────────────────────────────
CREATE TABLE exams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  category    text NOT NULL CHECK (category IN ('mock','prev','assign')),
  subject     text,
  duration_minutes int DEFAULT 0, -- 0 means no timer
  questions   int,
  marks       int,
  difficulty  text CHECK (difficulty IN ('easy','medium','hard')),
  status      text DEFAULT 'active',  
  exam_date   timestamptz,            -- used for countdown & 5-day warning
  file_url    text,
  file_path   text,
  created_at  timestamptz DEFAULT now()
);

-- ── 3. NOTICES table ───────────────────────────────────
CREATE TABLE notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('important','resources','deadlines')),
  links       jsonb DEFAULT '[]',     
  created_at  timestamptz DEFAULT now()
);

-- ── 4. STUDY PLAN table ────────────────────────────────
CREATE TABLE study_plan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_name    text NOT NULL,          
  day_status  text DEFAULT 'upcoming' CHECK (day_status IN ('done','active','upcoming')),
  items       jsonb DEFAULT '[]',     
  week_start  date NOT NULL DEFAULT current_date,
  created_at  timestamptz DEFAULT now()
);

-- ── 5. EXAM SCORES (Submissions) table ─────────────────
CREATE TABLE exam_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id     uuid REFERENCES exams(id) ON DELETE SET NULL,
  exam_title  text,
  subject     text,
  score       int,
  max_score   int,
  time_taken_minutes int,
  attempted_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- SIMPLE RLS POLICIES
-- ═══════════════════════════════════════════════════════

ALTER TABLE notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_read"   ON notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_write"  ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "exams_read"   ON exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_write"  ON exams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "notices_read"   ON notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "notices_write"  ON notices FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "plan_read"   ON study_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_write"  ON study_plan FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "scores_read"   ON exam_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "scores_insert" ON exam_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 6. PROFILES (for persistent settings like avatars, names, and signatures)
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name text,
  avatar_url  text,
  signature_url text,
  student_id  text,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
