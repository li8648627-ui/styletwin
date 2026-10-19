import { supabase } from './supabase'

export type ActivationEvent =
  | 'first_item_uploaded'
  | 'first_look_saved'
  | 'first_like'
  | 'first_tryon'
  | 'first_share'
  | 'week_generated'

export async function trackEvent(event: ActivationEvent, metadata: Record<string, any> = {}) {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) return

    const { data: existing } = await supabase
      .from('activation_events')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('event', event)
      .limit(1)
      .maybeSingle()

    if (existing) return

    await supabase.from('activation_events').insert({
      user_id: user.user.id,
      event,
      metadata,
    })
  } catch (err) {
    console.error('trackEvent error:', err)
  }
}

export async function getActivationStats() {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user?.user) return null

    const { data } = await supabase
      .from('activation_events')
      .select('event, created_at')
      .eq('user_id', user.user.id)

    if (!data) return null

    const stats: Record<string, { count: number; first_at: string | null }> = {}
    data.forEach((row) => {
      if (!stats[row.event]) stats[row.event] = { count: 0, first_at: null }
      stats[row.event].count++
      if (!stats[row.event].first_at || row.created_at < stats[row.event].first_at!) {
        stats[row.event].first_at = row.created_at
      }
    })
    return stats
  } catch (err) {
    console.error('getActivationStats error:', err)
    return null
  }
}