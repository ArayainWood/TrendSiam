-- RLS ต้องถูก enable ไว้ก่อน (คุณทำแล้ว)
ALTER TABLE IF EXISTS public.stats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_meta  ENABLE ROW LEVEL SECURITY;

-- ===== Stats policies =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can read stats'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can read stats"
             ON public.stats FOR SELECT TO service_role USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can insert stats'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can insert stats"
             ON public.stats FOR INSERT TO service_role WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stats' AND policyname='sr can update stats'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can update stats"
             ON public.stats FOR UPDATE TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ===== system_meta policies =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can read system_meta'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can read system_meta"
             ON public.system_meta FOR SELECT TO service_role USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can insert system_meta'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can insert system_meta"
             ON public.system_meta FOR INSERT TO service_role WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='system_meta' AND policyname='sr can update system_meta'
  ) THEN
    EXECUTE 'CREATE POLICY "sr can update system_meta"
             ON public.system_meta FOR UPDATE TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
