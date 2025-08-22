/**
 * Database health check endpoint
 * 
 * Tests Supabase connectivity using service role
 */

import { createSupabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supa = createSupabaseServer();
    const { error } = await supa.from('pg_tables').select('tablename').limit(1); // cheap call
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e:any) {
    return Response.json({ ok: false, reason: e?.message ?? 'unknown' }, { status: 500 });
  }
}