ALTER TABLE public.students
ADD CONSTRAINT students_user_name_unique UNIQUE (user_id, name);