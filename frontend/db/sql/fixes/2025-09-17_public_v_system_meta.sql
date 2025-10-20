BEGIN;

CREATE OR REPLACE VIEW public.public_v_system_meta
AS
SELECT
  key,
  value,
  updated_at
FROM public.system_meta
WHERE key IN ('home_limit','top3_max','news_last_updated');

ALTER VIEW public.public_v_system_meta OWNER TO postgres;

GRANT SELECT ON public.public_v_system_meta TO anon, authenticated;

COMMENT ON VIEW public.public_v_system_meta IS
'Public, read-only subset of system_meta for frontend diagnostics (Plan-B).';

COMMIT;
