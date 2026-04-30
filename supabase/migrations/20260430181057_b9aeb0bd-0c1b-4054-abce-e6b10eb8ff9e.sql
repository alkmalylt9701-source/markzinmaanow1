ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_name_unique;
CREATE UNIQUE INDEX students_user_name_unique_idx
  ON public.students (user_id, name)
  WHERE name <> '';