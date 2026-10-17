import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '',
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

export function TryOnPage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item[]>([])
  const [view, setView] = useState<'front' | 'back'>('front')
  const [tryonCount, setTryonCount] = useState(0)
  const [message, setMessage] = useState('')
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
      })
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('usage')
          .select('tryons_this_month, month_start')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: usage }) => {
            if (usage) {
              const now = new Date()
              const monthStart = new Date(usage.month_start)
              const isNewMonth =
                now.getMonth() !== monthStart.getMonth() ||
                now.getFullYear() !== monthStart.getFullYear()
              setTryonCount(isNewMonth ? 0 : usage.tryons_this_month)
            }
          })
      }
    })
  }, [])

  const toggleItem = (it: Item) => {
    setSelected((prev) => {
      const exists = prev.find((x) => x.id === it.id)
      if (exists) return prev.filter((x) => x.id !== it.id)
      if (prev.length >= MAX_LAYERS) return prev
      return [...prev, it]
    })
    setCompleted(false)
  }

  const tryOn = async () => {
    if (selected.length === 0) {
      setMessage(lang === 'ru' ? 'Выберите хотя бы одну вещь' : 'Select at least one item')
      return
    }
    if (tryonCount >= TRYON_LIMIT) {
      onShowPro('tryon_limit')
      return
    }
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError

      const { data: usageData } = await supabase
        .from('usage')
        .select('id, tryons_this_month, month_start')
        .eq('user_id', userData.user.id)
        .single()

      const now = new Date()
      const monthStart = usageData?.month_start ? new Date(usageData.month_start) : new Date(now.getFullYear(), now.getMonth(), 1)
      const isNewMonth =
        now.getMonth() !== monthStart.getMonth() ||
        now.getFullYear() !== monthStart.getFullYear()

      if (isNewMonth || !usageData) {
        await supabase.from('usage').upsert({
          user_id: userData.user.id,
          tryons_this_month: 1,
          month_start: now.toISOString(),
        })
        setTryonCount(1)
      } else {
        await supabase
          .from('usage')
          .update({ tryons_this_month: usageData.tryons_this_month + 1 })
          .eq('id', usageData.id)
        setTryonCount(usageData.tryons_this_month + 1)
      }

      await trackEvent('first_tryon', { layers: selected.length })
      setCompleted(true)
      setMessage(
        lang === 'ru'
          ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
          : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT})`
      )
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  const completeness = Math.round((selected.length / MAX_LAYERS) * 100)

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {lang === 'ru'
          ? 'Одежда по фигуре · 360° · слои с иконками.'
          : 'Clothing on figure · 360° · layers with icons.'}
      </div>

      {/* Переключатель вида спереди/сзади */}
      <div className="actions" style={{ marginBottom: 14 }}>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: view === 'front' ? 'var(--accent)' : 'var(--card)',
            color: view === 'front' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setView('front')
            setCompleted(false)
          }}
        >
          {lang === 'ru' ? 'спереди' : 'front'}
        </button>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: view === 'back' ? 'var(--accent)' : 'var(--card)',
            color: view === 'back' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setView('back')
            setCompleted(false)
          }}
        >
          {lang === 'ru' ? 'сзади' : 'back'}
        </button>
      </div>

      {/* Область предпросмотра с манекеном и плитками */}
      <div className="card" style={{ marginBottom: 14 }}>
        {completed ? (
          <div>
            <div className="row" style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 700 }}>
                {lang === 'ru' ? '✳ Образ готов' : '✳ Look ready'}
              </span>
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: `conic-gradient(var(--accent) ${completeness}%, #ece4d4 0)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, color: 'var(--accent-deep)' }}>
                  {selected.length}/{MAX_LAYERS}
                </span>
              </span>
            </div>
            <div className="muted mono" style={{ marginBottom: 10, fontSize: 11 }}>
              {lang === 'ru' ? 'смотри спереди и сзади' : 'view front and back'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selected.map((it) => (
                <div key={it.id} className="tile" style={{ width: 72, height: 72 }}>
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 28 }}>{CATEGORY_ICON[it.category] ?? ''}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            {/* SVG-манекен вместо эмодзи */}
            <div style={{ marginBottom: 16 }}>
              <svg width="120" height="160" viewBox="0 0 120 160" style={{ margin: '0 auto' }}>
                {view === 'front' ? (
                  <>
                    <circle cx="60" cy="20" r="12" fill="var(--object)" stroke="var(--line)" strokeWidth="1.5" />
                    <path d="M 35 45 Q 60 40 85 45 L 90 140 Q 60 145 30 140 Z" fill="var(--object)" stroke="var(--line)" strokeWidth="1.5" />
                    <path d="M 35 50 L 20 90 M 85 50 L 100 90" stroke="var(--line)" strokeWidth="1.5" fill="none" />
                  </>
                ) : (
                  <>
                    <circle cx="60" cy="20" r="12" fill="var(--object)" stroke="var(--line)" strokeWidth="1.5" />
                    <path d="M 40 45 Q 60 42 80 45 L 85 140 Q 60 143 35 140 Z" fill="var(--object)" stroke="var(--line)" strokeWidth="1.5" />
                    <path d="M 40 50 L 25 90 M 80 50 L 95 90" stroke="var(--line)" strokeWidth="1.5" fill="none" />
                  </>
                )}
              </svg>
            </div>
            <div className="muted mono" style={{ fontSize: 11 }}>
              {selected.length === 0
                ? lang === 'ru'
                  ? 'Выберите вещи ниже'
                  : 'Select items below'
                : lang === 'ru'
                  ? `${selected.length} из ${MAX_LAYERS} выбрано`
                  : `${selected.length} of ${MAX_LAYERS} selected`}
            </div>
          </div>
        )}
      </div>

      {/* Счётчик слоёв */}
      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>
          {lang === 'ru' ? ' Примерочная' : '✳ Fitting room'}
        </span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>

      {/* Список вещей для выбора */}
      <div className="muted mono" style={{ marginBottom: 8 }}>
        {lang === 'ru' ? 'Отметьте слои (до 5):' : 'Select layers (up to 5):'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it) => {
          const isSelected = selected.some((x) => x.id === it.id)
          return (
            <div
              key={it.id}
              className="card row"
              style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--hair)',
                padding: '10px 12px',
              }}
              onClick={() => toggleItem(it)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 20 }}>
                  {it.image_url ? (
                    <img src={it.image_url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    CATEGORY_ICON[it.category] ?? ''
                  )}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {it.name}
                  {it.color && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {it.color}</span>}
                </span>
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={{ pointerEvents: 'none', width: 18, height: 18, accentColor: 'var(--accent)' }}
              />
            </div>
          )
        })}
      </div>

      <button
        className="action-btn primary"
        style={{ width: '100%' }}
        onClick={tryOn}
        disabled={selected.length === 0}
      >
        ✳ {lang === 'ru' ? 'Примерить' : 'Try on'}
      </button>

      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}