import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  bottoms: '👖',
  dresses: '👗',
  shoes: '👟',
  accessories: '👜',
  other: '🧺',
}

const COLOR_HEX: Record<string, string> = {
  white: '#f5f5f5', 'белый': '#f5f5f5',
  black: '#1f1f1f', 'чёрный': '#1f1f1f', 'черный': '#1f1f1f',
  blue: '#3b82f6', 'синий': '#3b82f6', 'голубой': '#7dd3fc',
  red: '#ef4444', 'красный': '#ef4444',
  brown: '#8b5a2b', 'коричневый': '#8b5a2b',
  green: '#22c55e', 'зелёный': '#22c55e', 'зеленый': '#22c55e',
  yellow: '#eab308', 'жёлтый': '#eab308', 'желтый': '#eab308',
  pink: '#ec4899', 'розовый': '#ec4899',
  gray: '#9ca3af', 'серый': '#9ca3af',
  beige: '#d6c7a1', 'бежевый': '#d6c7a1',
  navy: '#1e3a8a',
}

const colorHex = (c: string | null) => COLOR_HEX[(c ?? '').toLowerCase().trim()] ?? '#b9b9b9'

const MAX_LAYERS = 5

const PHOTO_PLACEMENT: Record<string, { top: number; height: number }> = {
  tops: { top: 16, height: 40 },
  dresses: { top: 14, height: 62 },
  bottoms: { top: 46, height: 46 },
  shoes: { top: 86, height: 12 },
  accessories: { top: 38, height: 26 },
}

function Mannequin({ layers, angle }: { layers: Item[]; angle: number }) {
  const front = Math.cos((angle * Math.PI) / 180) >= 0
  const byCat = (c: string) => layers.find((i) => i.category === c)
  const top = byCat('tops')
  const bottom = byCat('bottoms')
  const dress = byCat('dresses')
  const shoes = byCat('shoes')
  const acc = byCat('accessories')
  const skin = '#d9c1a3'
  const base = '#cfcfcf'

  return (
    <div style={{ display: 'flex', justifyContent: 'center', perspective: 800 }}>
      <div style={{ transform: `rotateY(${angle}deg)`, transition: 'transform 0.1s linear' }}>
        <svg width="220" height="340" viewBox="0 0 220 340">
          <circle cx="110" cy="38" r="20" fill={skin} />
          {front ? (
            <>
              <circle cx="103" cy="36" r="2" fill="#333" />
              <circle cx="117" cy="36" r="2" fill="#333" />
            </>
          ) : (
            <path d="M90,32 A20,20 0 0,1 130,32 L130,44 A20,20 0 0,1 90,44 Z" fill="#6b4f2f" />
          )}
          <rect x="104" y="56" width="12" height="10" fill={skin} />
          <path d="M78,66 L62,138 L72,142 L86,82 Z" fill={skin} />
          <path d="M142,66 L158,138 L148,142 L134,82 Z" fill={skin} />
          <path d="M78,66 L142,66 L136,152 L84,152 Z" fill={base} />
          <rect x="92" y="152" width="14" height="146" fill={base} />
          <rect x="114" y="152" width="14" height="146" fill={base} />
          {bottom && (
            <path d="M84,150 L136,150 L132,298 L116,298 L112,200 L108,200 L104,298 L88,298 Z" fill={colorHex(bottom.color)} stroke="#00000022" />
          )}
          {top && (
            <>
              <path d="M76,64 L144,64 L140,154 L80,154 Z" fill={colorHex(top.color)} stroke="#00000022" />
              <path d="M76,64 L62,120 L72,124 L84,82 Z" fill={colorHex(top.color)} />
              <path d="M144,64 L158,120 L148,124 L136,82 Z" fill={colorHex(top.color)} />
            </>
          )}
          {dress && (
            <path d="M76,64 L144,64 L150,112 L162,224 L58,224 L70,112 Z" fill={colorHex(dress.color)} stroke="#00000022" />
          )}
          {shoes && (
            <>
              <ellipse cx="99" cy="306" rx="15" ry="8" fill={colorHex(shoes.color)} />
              <ellipse cx="121" cy="306" rx="15" ry="8" fill={colorHex(shoes.color)} />
            </>
          )}
          {acc && (
            <>
              <line x1="138" y1="70" x2="152" y2="150" stroke={colorHex(acc.color)} strokeWidth="4" />
              <rect x="142" y="150" width="28" height="24" rx="5" fill={colorHex(acc.color)} stroke="#00000022" />
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

export function TryOnPage() {
  const { t, lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [angle, setAngle] = useState(0)
  const [tried, setTried] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'mannequin' | 'photo'>('mannequin')
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [offsetY, setOffsetY] = useState(0)
  const drag = useRef<{ x: number; a: number } | null>(null)

  useEffect(() => {
    supabase
      .from('wardrobe_items')
      .select('id, name, category, color, image_url')
      .then(({ data, error }) => {
        if (!error && data) setItems(data)
        setLoading(false)
      })
  }, [])

  const toggle = (id: string) => {
    setTried(false)
    setMessage('')
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_LAYERS ? prev : [...prev, id]
    )
  }

  const layerItems = selected
    .map((id) => items.find((i) => i.id === id))
    .filter((x): x is Item => Boolean(x))

  const photoLayers = layerItems.filter((i) => i.image_url)
  const front = Math.cos((angle * Math.PI) / 180) >= 0

  const onPhotoFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setUserPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  const saveLook = async () => {
    setMessage('')
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) throw userError
      const { error } = await supabase.from('looks').insert({
        user_id: userData.user.id,
        name: `${t('look_name_tryon')}${layerItems.map((i) => i.name).join(' + ')}`,
        item_ids: selected,
      })
      if (error) throw error
      setMessage(t('tryon_saved'))
    } catch (err: any) {
      setMessage(`❌ ${err.message}`)
    }
  }

  if (loading) return <div className="muted" style={{ padding: 16 }}>{t('tryon_loading')}</div>

  return (
    <div>
      <h1 className="screen-title">{t('tryon_title')}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>{t('tryon_sub')}</div>

      <div className="row" style={{ marginBottom: 8 }}>
        <button
          className="action-btn"
          style={{ background: mode === 'mannequin' ? '#111' : '#fff', color: mode === 'mannequin' ? '#fff' : '#111' }}
          onClick={() => setMode('mannequin')}
        >
          {lang === 'ru' ? '🧍 Манекен' : '🧍 Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{ background: mode === 'photo' ? '#111' : '#fff', color: mode === 'photo' ? '#fff' : '#111' }}
          onClick={() => setMode('photo')}
        >
          {lang === 'ru' ? '📸 Моё фото' : '📸 My photo'}
        </button>
      </div>

      <div className="card">
        {mode === 'mannequin' ? (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <button
                className="action-btn"
                style={{ background: front ? '#111' : '#fff', color: front ? '#fff' : '#111' }}
                onClick={() => setAngle(0)}
              >
                {t('tryon_front')}
              </button>
              <button
                className="action-btn"
                style={{ background: !front ? '#111' : '#fff', color: !front ? '#fff' : '#111' }}
                onClick={() => setAngle(180)}
              >
                {t('tryon_back')}
              </button>
            </div>
            <div
              style={{ touchAction: 'none', cursor: 'grab', minHeight: 340 }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { x: e.clientX, a: angle }
              }}
              onPointerMove={(e) => {
                if (drag.current) {
                  setAngle(((drag.current.a + (e.clientX - drag.current.x) * 0.6) % 360 + 360) % 360)
                }
              }}
              onPointerUp={() => {
                drag.current = null
              }}
            >
              <Mannequin layers={layerItems} angle={angle} />
            </div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
              {lang === 'ru' ? '↔ потяните манекен, чтобы повернуть' : '↔ drag the mannequin to rotate'}
            </div>
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(angle)}
              onChange={(e) => setAngle(Number(e.target.value))}
              style={{ width: '100%', marginTop: 6 }}
            />
          </>
        ) : (
          <>
            {!userPhoto ? (
              <label className="action-btn" style={{ width: '100%', textAlign: 'center', cursor: 'pointer' }}>
                {lang === 'ru' ? '📸 Загрузить своё фото (в полный рост)' : '📸 Upload your photo (full body)'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => onPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <>
                <div style={{ position: 'relative', height: 400, background: '#fafafa', borderRadius: 12, overflow: 'hidden' }}>
                  <img
                    src={userPhoto}
                    alt="me"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {photoLayers.map((it) => {
                    const p = PHOTO_PLACEMENT[it.category] ?? { top: 30, height: 40 }
                    return (
                      <img
                        key={it.id}
                        src={it.image_url!}
                        alt={it.name}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: `calc(${p.top}% + ${offsetY}px)`,
                          height: `${p.height * scale}%`,
                          transform: 'translateX(-50%)',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                        }}
                      />
                    )
                  })}
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  {lang === 'ru' ? 'Подгоните посадку ползунками:' : 'Adjust the fit with sliders:'}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 11 }}>{lang === 'ru' ? 'Размер' : 'Size'}</span>
                  <input type="range" min={0.5} max={1.6} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <span className="muted" style={{ fontSize: 11 }}>{lang === 'ru' ? 'Высота' : 'Height'}</span>
                  <input type="range" min={-80} max={80} value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} style={{ flex: 1 }} />
                </div>
                <button className="action-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setUserPhoto(null)}>
                  {lang === 'ru' ? 'Убрать фото' : 'Remove photo'}
                </button>
                {photoLayers.length === 0 && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                    {lang === 'ru'
                      ? 'Отметьте вещи с фотографиями (например, Сумку) — они наденутся поверх фото.'
                      : 'Pick items with photos (e.g., the bag) — they will be layered over your photo.'}
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <span>{tried ? t('tryon_ready') : t('tryon_room')}</span>
          <span className="muted">{selected.length} / {MAX_LAYERS} {t('tryon_layers')}</span>
        </div>
        {tried && <div className="muted" style={{ textAlign: 'center', marginTop: 4 }}>{t('tryon_see')}</div>}
      </div>

      <div className="muted" style={{ margin: '8px 0' }}>{t('tryon_pick')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {items.map((item) => (
          <label key={item.id} className="card row" style={{ marginBottom: 0, padding: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>
              {CATEGORY_ICON[item.category] ?? '🧺'} {item.name}
              {item.color ? ` · ${item.color}` : ''}
            </span>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
          </label>
        ))}
      </div>

      <button className="action-btn primary" style={{ width: '100%' }} disabled={selected.length === 0} onClick={() => setTried(true)}>
        {t('tryon_btn')}
      </button>
      {tried && (
        <button className="action-btn" style={{ width: '100%', marginTop: 8 }} onClick={saveLook}>
          {t('tryon_save')}
        </button>
      )}
      {message && <div className="card muted" style={{ marginTop: 8 }}>{message}</div>}
    </div>
  )
}