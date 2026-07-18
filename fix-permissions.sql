-- Corrige "permission denied for table applications".
-- Ejecutar en: Supabase → proyecto ktgwgalfekpqlannrjrh → SQL Editor → Run.

-- El scraper usa la llave service_role (backend), se le da acceso completo.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.applications_id_seq TO service_role;

-- Bloquea el acceso con la llave pública (anon): RLS activado sin políticas.
-- service_role no se ve afectado porque omite RLS.
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
