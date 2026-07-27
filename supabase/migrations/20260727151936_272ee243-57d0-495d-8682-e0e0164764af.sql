
-- 1) Beneficiaries (orphans / needy families / best family)
CREATE TABLE public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('orphan','needy','best_family')),
  name text NOT NULL,
  guardian text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;
GRANT ALL ON public.beneficiaries TO service_role;
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_beneficiaries ON public.beneficiaries FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Honorariums (yearly gifts to teachers/students/orphans/families)
CREATE TABLE public.honorariums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  recipient_kind text NOT NULL CHECK (recipient_kind IN ('teacher','student','orphan','needy','best_family','other')),
  recipient_ref_id text,
  recipient_name text NOT NULL,
  cash_amount numeric NOT NULL DEFAULT 0,
  in_kind_description text,
  in_kind_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.honorariums TO authenticated;
GRANT ALL ON public.honorariums TO service_role;
ALTER TABLE public.honorariums ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_honorariums ON public.honorariums FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX honorariums_user_year_kind_idx ON public.honorariums(user_id, year, recipient_kind);

-- 3) Ceremony expenses
CREATE TABLE public.ceremony_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  item text NOT NULL,
  category text,
  cash_amount numeric NOT NULL DEFAULT 0,
  in_kind_description text,
  in_kind_value numeric NOT NULL DEFAULT 0,
  supplier text,
  receipt_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceremony_expenses TO authenticated;
GRANT ALL ON public.ceremony_expenses TO service_role;
ALTER TABLE public.ceremony_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_ceremony_expenses ON public.ceremony_expenses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ceremony_expenses_user_year_idx ON public.ceremony_expenses(user_id, year);

-- 4) Sponsors (permanent record)
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sponsor_type text NOT NULL DEFAULT 'individual' CHECK (sponsor_type IN ('individual','company')),
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_sponsors ON public.sponsors FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Sponsor contributions per year
CREATE TABLE public.sponsor_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  year text NOT NULL,
  cash_amount numeric NOT NULL DEFAULT 0,
  in_kind_description text,
  in_kind_value numeric NOT NULL DEFAULT 0,
  sponsorship_areas text[] NOT NULL DEFAULT '{}',
  receipt_path text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsor_contributions TO authenticated;
GRANT ALL ON public.sponsor_contributions TO service_role;
ALTER TABLE public.sponsor_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_sponsor_contributions ON public.sponsor_contributions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sponsor_contrib_user_year_idx ON public.sponsor_contributions(user_id, year);

-- 6) Certificate templates
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cert_type text NOT NULL CHECK (cert_type IN ('completion','excellence','participation','teacher_participation')),
  year text,
  label text NOT NULL,
  file_path text NOT NULL,
  name_x numeric NOT NULL DEFAULT 300,
  name_y numeric NOT NULL DEFAULT 400,
  font_size numeric NOT NULL DEFAULT 32,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_cert_templates ON public.certificate_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7) Issued certificates log
CREATE TABLE public.certificates_issued (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year text NOT NULL,
  cert_type text NOT NULL CHECK (cert_type IN ('completion','excellence','participation','teacher_participation')),
  recipient_name text NOT NULL,
  template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates_issued TO authenticated;
GRANT ALL ON public.certificates_issued TO service_role;
ALTER TABLE public.certificates_issued ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_certs_issued ON public.certificates_issued FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX certs_issued_user_year_idx ON public.certificates_issued(user_id, year);
