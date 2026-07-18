-- Tablas para el profiler y el webhook de aceptación de perfiles.
-- Ejecutar en: Supabase → SQL Editor → Run.
-- (No modifica la tabla applications, que ya existe.)

CREATE TABLE IF NOT EXISTS profile_suggestions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT,
  keywords TEXT[],
  description TEXT,
  confidence NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS active_profiles (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT UNIQUE,
  added_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permisos para la llave service_role (la que usa el scraper y el webhook).
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profile_suggestions, public.active_profiles
  TO service_role;

-- Necesario para los id BIGSERIAL: sin esto, los INSERT fallan igual que
-- pasó con la tabla applications ("permission denied").
GRANT USAGE, SELECT ON SEQUENCE
  public.profile_suggestions_id_seq, public.active_profiles_id_seq
  TO service_role;

-- Bloquea el acceso con la llave pública (anon); service_role omite RLS.
ALTER TABLE public.profile_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_profiles ENABLE ROW LEVEL SECURITY;
