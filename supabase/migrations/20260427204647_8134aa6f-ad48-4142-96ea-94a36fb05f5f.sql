
-- جدول الطالبات
CREATE TABLE public.students (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_user_idx ON public.students(user_id);

-- جدول تاريخ الحفظ السابق
CREATE TABLE public.hifz_history (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  PRIMARY KEY (student_id, year_key)
);
CREATE INDEX hifz_history_user_idx ON public.hifz_history(user_id);

-- بيانات السنة لكل طالبة
CREATE TABLE public.year_data (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  base_hifz TEXT NOT NULL DEFAULT '0',
  total_hifz TEXT NOT NULL DEFAULT '0',
  parts TEXT NOT NULL DEFAULT '',
  annual TEXT NOT NULL DEFAULT '',
  recitation TEXT NOT NULL DEFAULT '',
  memorization TEXT NOT NULL DEFAULT '',
  total TEXT NOT NULL DEFAULT '0',
  grade TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '0',
  status_prize TEXT NOT NULL DEFAULT '',
  rank TEXT NOT NULL DEFAULT '-',
  teacher TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (student_id, year)
);
CREATE INDEX year_data_user_idx ON public.year_data(user_id);

-- إعدادات المستخدمة
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_year TEXT NOT NULL DEFAULT '1447'
);

-- تفعيل RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- سياسات RLS: كل مستخدمة ترى وتعدل بياناتها فقط
CREATE POLICY "own_students" ON public.students FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_history" ON public.hifz_history FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_year_data" ON public.year_data FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
