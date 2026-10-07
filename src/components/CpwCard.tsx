import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Item = { id: string; name: string; price: number | null; wears: number }

export function CpwCard() {
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
      <div style={{ fontWeight: 700, marginBottom: 6 }}>📊 Аналитика CPW</div>
      {rows.length === 0 ? (
        <div className="muted">
          Укажите цену вещи через «✏️ Редактировать» и нажимайте «👗 +1 выход», когда надеваете её, — здесь появится стоимость одного выхода.
        </div>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 6 }}>
            Потрачено: {totalSpent.toLocaleString('ru-RU')} · Выходов: {totalWears}
          </div>
          {rows.slice(0, 3).map((r) => (
            <div className="row" key={r.id} style={{ padding: '4px 0' }}>
              <span style={{ fontSize: 13 }}>{r.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(r.cpw)} / выход</span>
            </div>
          ))}
          <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
            Чем меньше стоимость выхода, тем выгоднее вещь. В PRO — полная аналитика.
          </div>
        </>
      )}
    </div>
  )
}