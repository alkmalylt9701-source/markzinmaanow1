-- مزامنة أعوام الحفظ السابقة في hifz_history من year_data لتمكين الحساب التراكمي
INSERT INTO public.hifz_history (user_id, student_id, year_key, value)
SELECT user_id, student_id, 'h' || year AS year_key,
       COALESCE(NULLIF(parts, ''), '0') AS value
FROM public.year_data
WHERE COALESCE(NULLIF(parts, ''), '0') <> '0'
ON CONFLICT (student_id, year_key) DO UPDATE
SET value = EXCLUDED.value
WHERE public.hifz_history.value IS NULL
   OR public.hifz_history.value = ''
   OR public.hifz_history.value = '0';