import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

/* ---------- AI-примерка (встроено, без внешних файлов) ---------- */
const FAL_API_KEY = (import.meta as any).env?.VITE_FAL_API_KEY

interface TryOnResult {
  success: boolean
  imageUrl?: string
  error?: string
}

async function virtualTryOn(personImage: string, garmentImage: string): Promise<TryOnResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'API ключ Fal.ai не настроен. Добавьте VITE_FAL_API_KEY в .env' }
  }
  try {
    const response = await fetch('https://fal.run/fal-ai/idm-vton', {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        person_image: personImage,
        garment_image: garmentImage,
        garment_description: '',
      }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }
    const data = await response.json()
    const imageUrl = data.output?.image?.url || data.image?.url
    if (!imageUrl) throw new Error('AI не вернул изображение')
    return { success: true, imageUrl }
  } catch (error: any) {
    console.error('Virtual try-on error:', error)
    return { success: false, error: error.message || 'Ошибка AI-примерки' }
  }
}

const CATEGORY_ICON: Record<string, string> = {
  tops: '👕',
  shirts: '👕',
  blouses: '👚',
  tshirts: '👕',
  sweaters: '🧥',
  hoodies: '🧥',
  jackets: '🧥',
  coats: '🧥',
  outerwear: '🧥',
  bottoms: '👖',
  pants: '👖',
  jeans: '👖',
  trousers: '👖',
  skirts: '👗',
  dresses: '👗',
  shoes: '👟',
  sneakers: '👟',
  boots: '👢',
  sandals: '👡',
  heels: '👠',
  accessories: '👜',
  bags: '👜',
  hats: '🧢',
  scarves: '🧣',
  belts: '👔',
  jewelry: '💍',
  other: '🧺',
}

const LAYER_CONFIG: Record<string, { top: string; left: string; width: string; height: string; emojiSize: number }> = {
  tops: { top: '28%', left: '22%', width: '56%', height: '32%', emojiSize: 80 },
  shirts: { top: '28%', left: '22%', width: '56%', height: '32%', emojiSize: 80 },
  blouses: { top: '28%', left: '22%', width: '56%', height: '32%', emojiSize: 80 },
  tshirts: { top: '28%', left: '22%', width: '56%', height: '32%', emojiSize: 80 },
  sweaters: { top: '26%', left: '20%', width: '60%', height: '36%', emojiSize: 90 },
  hoodies: { top: '24%', left: '20%', width: '60%', height: '38%', emojiSize: 90 },
  jackets: { top: '22%', left: '18%', width: '64%', height: '42%', emojiSize: 100 },
  coats: { top: '20%', left: '18%', width: '64%', height: '48%', emojiSize: 110 },
  outerwear: { top: '20%', left: '18%', width: '64%', height: '48%', emojiSize: 110 },
  bottoms: { top: '55%', left: '25%', width: '50%', height: '42%', emojiSize: 90 },
  pants: { top: '55%', left: '25%', width: '50%', height: '42%', emojiSize: 90 },
  jeans: { top: '55%', left: '25%', width: '50%', height: '42%', emojiSize: 90 },
  trousers: { top: '55%', left: '25%', width: '50%', height: '42%', emojiSize: 90 },
  skirts: { top: '55%', left: '22%', width: '56%', height: '35%', emojiSize: 85 },
  dresses: { top: '25%', left: '20%', width: '60%', height: '65%', emojiSize: 120 },
  shoes: { top: '88%', left: '25%', width: '50%', height: '12%', emojiSize: 50 },
  sneakers: { top: '88%', left: '25%', width: '50%', height: '12%', emojiSize: 50 },
  boots: { top: '80%', left: '25%', width: '50%', height: '20%', emojiSize: 60 },
  sandals: { top: '90%', left: '25%', width: '50%', height: '10%', emojiSize: 45 },
  heels: { top: '88%', left: '25%', width: '50%', height: '12%', emojiSize: 50 },
  accessories: { top: '60%', left: '65%', width: '25%', height: '25%', emojiSize: 60 },
  bags: { top: '60%', left: '65%', width: '25%', height: '25%', emojiSize: 60 },
  hats: { top: '5%', left: '30%', width: '40%', height: '15%', emojiSize: 55 },
  scarves: { top: '22%', left: '25%', width: '50%', height: '15%', emojiSize: 60 },
  belts: { top: '52%', left: '25%', width: '50%', height: '8%', emojiSize: 40 },
  jewelry: { top: '20%', left: '35%', width: '30%', height: '12%', emojiSize: 50 },
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

export function TryOnPage({ onShowPro }: { onShowPro: (reason: ProReason) => void }) {
  const { lang } = useLang()
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item[]>([])
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [mode, setMode] = useState<'mannequin' | 'photo'>('mannequin')
  const [view, setView] = useState<'front' | 'back'>('front')
  const [photo, setPhoto] = useState<string | null>(null)
  const [tryonCount, setTryonCount] = useState(0)
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const isBack = view === 'back'

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
      if (exists) {
        setPositions((prevPos) => {
          const newPos = { ...prevPos }
          delete newPos[it.id]
          return newPos
        })
        return prev.filter((x) => x.id !== it.id)
      }
      if (prev.length >= MAX_LAYERS) return prev
      return [...prev, it]
    })
    setAiResult(null)
  }

  /* ---------- DRAG & DROP с учётом поворота ---------- */
  const handleDragStart = (itemId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setDragging(itemId)
  }

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const rawX = ((clientX - rect.left) / rect.width) * 100
    const rawY = ((clientY - rect.top) / rect.height) * 100

    const it = selected.find((s) => s.id === dragging)
    const config = LAYER_CONFIG[it?.category ?? 'tops'] ?? LAYER_CONFIG['tops']
    const w = parseFloat(config.width)
    const h = parseFloat(config.height)

    let x = isBack ? 100 - rawX - w / 2 : rawX - w / 2
    let y = rawY - h / 2
    x = Math.max(0, Math.min(100 - w, x))
    y = Math.max(0, Math.min(100 - h, y))

    setPositions((prev) => ({ ...prev, [dragging]: { x, y } }))
  }

  const handleDragEnd = () => setDragging(null)

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [dragging, isBack, selected])

  /* ---------- Счётчик примерок ---------- */
  const bumpCounter = async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { data: usageData } = await supabase
      .from('usage')
      .select('id, tryons_this_month, month_start')
      .eq('user_id', userData.user.id)
      .single()
    const now = new Date()
    const monthStart = usageData?.month_start
      ? new Date(usageData.month_start)
      : new Date(now.getFullYear(), now.getMonth(), 1)
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
  }

  /* ---------- Примерка: AI для фото, CSS для манекена ---------- */
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

    if (mode === 'photo' && photo) {
      const garment = selected.find((s) => s.image_url)
      if (garment) {
        setIsProcessing(true)
        setAiResult(null)
        const res = await virtualTryOn(photo, garment.image_url!)
        setIsProcessing(false)
        if (res.success && res.imageUrl) {
          setAiResult(res.imageUrl)
          await bumpCounter()
          await trackEvent('first_tryon', { layers: selected.length, ai: true })
          setMessage(
            lang === 'ru'
              ? `✳ AI-примерка готова! (${tryonCount + 1}/${TRYON_LIMIT})`
              : `✳ AI try-on ready! (${tryonCount + 1}/${TRYON_LIMIT})`
          )
          return
        }
        setMessage(`❌ ${res.error ?? (lang === 'ru' ? 'Ошибка AI' : 'AI error')}`)
        return
      }
    }

    await bumpCounter()
    await trackEvent('first_tryon', { layers: selected.length, ai: false })
    setMessage(
      lang === 'ru'
        ? `✳ Образ готов! (${tryonCount + 1}/${TRYON_LIMIT})`
        : `✳ Look ready! (${tryonCount + 1}/${TRYON_LIMIT})`
    )
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(reader.result as string)
      setMode('photo')
      setAiResult(null)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {lang === 'ru'
          ? 'Перетаскивайте вещи · они поворачиваются с манекеном.'
          : 'Drag items · they rotate with the mannequin.'}
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: mode === 'mannequin' ? 'var(--accent)' : 'var(--card)',
            color: mode === 'mannequin' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setMode('mannequin')
            setAiResult(null)
          }}
        >
          {lang === 'ru' ? 'Манекен' : 'Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{
            flex: 1,
            background: mode === 'photo' ? 'var(--accent)' : 'var(--card)',
            color: mode === 'photo' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => {
            setMode('photo')
            setAiResult(null)
          }}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      <div
        ref={previewRef}
        className="card"
        style={{
          marginBottom: 14,
          padding: 0,
          position: 'relative',
          width: '100%',
          height: 320,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'default',
        }}
      >
        {isProcessing ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', zIndex: 100 }}>
            <div style={{ width: 48, height: 48, border: '4px solid var(--hair)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div className="muted mono" style={{ marginTop: 16, fontSize: 13 }}>
              {lang === 'ru' ? 'AI надевает одежду...' : 'AI is dressing you...'}
            </div>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : aiResult ? (
          <img src={aiResult} alt="AI try-on" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : mode === 'mannequin' ? (
          <svg width="100%" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
            <defs>
              <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f0ebe3" />
                <stop offset="50%" stopColor="#f7f2ea" />
                <stop offset="100%" stopColor="#e8e0d5" />
              </linearGradient>
              <filter id="shadow3d">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.12" />
              </filter>
            </defs>
            {view === 'front' ? (
              <>
                <circle cx="160" cy="50" r="28" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 110 100 Q 160 90 210 100 L 225 280 Q 160 295 95 280 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 110 110 L 80 190 Q 75 200 80 205 Q 87 210 93 195 L 115 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 210 110 L 240 190 Q 245 200 240 205 Q 233 210 227 195 L 205 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
              </>
            ) : (
              <>
                <circle cx="160" cy="50" r="28" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 115 100 Q 160 95 205 100 L 220 280 Q 160 292 100 280 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" filter="url(#shadow3d)" />
                <path d="M 115 110 L 85 190 Q 80 200 85 205 Q 92 210 98 195 L 118 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 205 110 L 235 190 Q 240 200 235 205 Q 228 210 222 195 L 202 130" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
              </>
            )}
          </svg>
        ) : photo ? (
          <img src={photo} alt="My photo" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
            <label className="action-btn primary" style={{ cursor: 'pointer' }}>
              📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          </div>
        )}

        {!aiResult &&
          selected.map((it, idx) => {
            const config = LAYER_CONFIG[it.category] ?? LAYER_CONFIG['tops']
            const w = parseFloat(config.width)
            const pos = positions[it.id] ?? { x: parseFloat(config.left), y: parseFloat(config.top) }
            const left = isBack ? 100 - pos.x - w : pos.x
            return (
              <div
                key={it.id}
                style={{
                  position: 'absolute',
                  top: `${pos.y}%`,
                  left: `${left}%`,
                  width: config.width,
                  height: config.height,
                  zIndex: dragging === it.id ? 100 : idx + 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'grab',
                  userSelect: 'none',
                  touchAction: 'none',
                  transform: isBack ? 'scaleX(-1)' : 'none',
                }}
                onMouseDown={(e) => handleDragStart(it.id, e)}
                onTouchStart={(e) => handleDragStart(it.id, e)}
              >
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))', pointerEvents: 'none' }}
                  />
                ) : (
                  <span style={{ fontSize: config.emojiSize, opacity: 0.85, lineHeight: 1, pointerEvents: 'none' }}>
                    {CATEGORY_ICON[it.category] ?? '👕'}
                  </span>
                )}
              </div>
            )
          })}

        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div className="muted mono" style={{ fontSize: 11, background: 'rgba(255,255,255,0.9)', padding: '4px 12px', borderRadius: 12, display: 'inline-block' }}>
            {aiResult
              ? lang === 'ru' ? 'AI-примерка' : 'AI try-on'
              : selected.length === 0
                ? lang === 'ru' ? 'Выберите вещи ниже' : 'Select items below'
                : `${selected.length} из ${MAX_LAYERS} выбрано`}
          </div>
        </div>
      </div>

      {aiResult && (
        <button className="action-btn" style={{ width: '100%', marginBottom: 12 }} onClick={() => setAiResult(null)}>
          {lang === 'ru' ? '🔄 Попробовать другую вещь' : '🔄 Try another item'}
        </button>
      )}

      {mode === 'mannequin' && !aiResult && (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button
            className="action-btn"
            style={{
              flex: 1,
              fontSize: 11,
              padding: '6px 8px',
              background: view === 'front' ? 'var(--accent-soft)' : 'var(--card)',
              color: view === 'front' ? 'var(--accent-deep)' : 'var(--ink)',
              borderColor: view === 'front' ? 'var(--accent)' : 'var(--hair)',
            }}
            onClick={() => setView('front')}
          >
            {lang === 'ru' ? 'спереди' : 'front'}
          </button>
          <button
            className="action-btn"
            style={{
              flex: 1,
              fontSize: 11,
              padding: '6px 8px',
              background: view === 'back' ? 'var(--accent-soft)' : 'var(--card)',
              color: view === 'back' ? 'var(--accent-deep)' : 'var(--ink)',
              borderColor: view === 'back' ? 'var(--accent)' : 'var(--hair)',
            }}
            onClick={() => setView('back')}
          >
            {lang === 'ru' ? 'сзади' : 'back'}
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700 }}>{lang === 'ru' ? '✳ Примерочная' : '✳ Fitting room'}</span>
        <span className="muted mono">
          {selected.length} / {MAX_LAYERS} {lang === 'ru' ? 'слоёв' : 'layers'}
        </span>
      </div>
      <div className="muted mono" style={{ marginBottom: 8 }}>
        {lang === 'ru' ? 'Отметьте слои (до 5):' : 'Select layers (up to 5):'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {items.map((it) => {
          const isSelected = selected.some((x) => x.id === it.id)
          const icon = CATEGORY_ICON[it.category] ?? '🧺'
          return (
            <div
              key={it.id}
              className="card row"
              style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-soft)' : 'var(--card)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--hair)',
                padding: '10px 12px',
                margin: 0,
              }}
              onClick={() => toggleItem(it)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                {it.image_url ? (
                  <img src={it.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--hair)' }} />
                ) : (
                  <span style={{ fontSize: 24, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
                )}
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {it.name}
                  {it.color && <span style={{ color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>· {it.color}</span>}
                </span>
              </span>
              <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ pointerEvents: 'none', width: 18, height: 18, accentColor: 'var(--accent)' }} />
            </div>
          )
        })}
      </div>

      <button className="action-btn primary" style={{ width: '100%' }} onClick={tryOn} disabled={selected.length === 0 || isProcessing}>
        {isProcessing
          ? lang === 'ru' ? '⏳ AI работает...' : '⏳ AI processing...'
          : `✳ ${lang === 'ru' ? 'Примерить' : 'Try on'}`}
      </button>

      {message && <div className="card muted" style={{ marginTop: 12 }}>{message}</div>}
    </div>
  )
}