import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'

type Item = { id: string; name: string; price: number | null; wears: number }

export function CpwCard() {
  const { lang, t } = useLang()
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    supabase.from('wardrobe_items').select('id, name, price, wears').then(({ data, error }) => {
      if (!error && data) setItems(data)
    })
  }, [])

  const rows = items
    .filter((i) => i.price != null && i.wears > 0)
    .map((i) => ({ ...i, cpw: (i.price as number) / i.wears }))
    .sort((a, b) => a.cpw - b.cpw)

  const totalSpent = items.reduce((s, i) => s + (i.price ?? 0), 0)
  const totalWears = items.reduce((s, i) => s + i.wears, 0)

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('cpw_title')}</div>
      {rows.length === 0 ? (
        <div className="muted">{t('cpw_hint')}</div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 6 }}>
            {t('cpw_spent')} {totalSpent.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')} · {t('cpw_wears')} {totalWears}
          </div>
          {rows.slice(0, 3).map((r) => (
            <div className="row" key={r.id} style={{ padding: '4px 0' }}>
              <span style={{ fontSize: 13 }}>{r.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(r.cpw)} {t('cpw_per')}</span>
            </div>
          ))}
          <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>{t('cpw_note')}</div>
        </>
      )}
    </div>
  )
}