import { supabase } from './supabase'

export async function getAuthenticatedAdmin() {
  if (!supabase) throw new Error('AUTH_REQUIRED')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user) throw new Error('AUTH_REQUIRED')

  const { data: profile, error: roleError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (roleError || profile?.role !== 'admin') throw new Error('ADMIN_REQUIRED')

  return userData.user
}
