CREATE TABLE public.teacher_year_active (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, teacher_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_year_active TO authenticated;
GRANT ALL ON public.teacher_year_active TO service_role;
ALTER TABLE public.teacher_year_active ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_teacher_year_active ON public.teacher_year_active
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_teacher_year_active_user_year ON public.teacher_year_active(user_id, year);