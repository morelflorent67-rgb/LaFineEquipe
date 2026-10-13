import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.LFE_DATA_BACKEND !== 'supabase' || !url || !key) return NextResponse.next();
  return updateSupabaseSession(request, url, key);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|brand/|maps/|textures/|dev-fixtures/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
