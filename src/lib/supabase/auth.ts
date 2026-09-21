import { getSupabaseBrowser } from './client';

export async function signInWithEmail(email: string, redirectTo: string) {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowser();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}
