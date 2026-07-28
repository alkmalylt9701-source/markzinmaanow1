CREATE TABLE public.teacher_monthly_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year text NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, year, month)
);

ALTER TABLE public.teacher_monthly_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_monthly_bonuses" ON public.teacher_monthly_bonuses
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.teacher_annual_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  year text NOT NULL,
  cash_amount numeric NOT NULL DEFAULT 0,
  in_kind_description text,
  in_kind_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, year)
);

ALTER TABLE public.teacher_annual_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_annual_bonuses" ON public.teacher_annual_bonuses
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_monthly_bonus_teacher ON public.teacher_monthly_bonuses(teacher_id, year);
CREATE INDEX idx_annual_bonus_teacher ON public.teacher_annual_bonuses(teacher_id, year);