
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_user_year_month ON public.documents(user_id, year, month);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_documents ON public.documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users read own documents files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own documents files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users update own documents files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own documents files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
