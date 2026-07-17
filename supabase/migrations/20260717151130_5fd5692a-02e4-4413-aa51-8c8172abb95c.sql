GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hifz_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.year_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_monthly_bonuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_annual_bonuses TO authenticated;

GRANT ALL ON public.students TO service_role;
GRANT ALL ON public.hifz_history TO service_role;
GRANT ALL ON public.year_data TO service_role;
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.teacher_monthly_bonuses TO service_role;
GRANT ALL ON public.teacher_annual_bonuses TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.students_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.students_id_seq TO service_role;