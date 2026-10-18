import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../i18n'
import { trackEvent } from '../lib/analytics'

type Item = { id: string; name: string; category: string; color: string | null; image_url: string | null }
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

/* ---------- AI-примерка (встроено) ---------- */
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
      body: JSON.stringify({ person_image: personImage, garment_image: garmentImage, garment_description: '' }),
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
  tops: '👕', shirts: '👕', blouses: '👚', tshirts: '👕', sweaters: '🧥', hoodies: '🧥',
  jackets: '🧥', coats: '🧥', outerwear: '🧥', bottoms: '👖', pants: '👖', jeans: '👖',
  trousers: '👖', skirts: '👗', dresses: '👗', shoes: '👟', sneakers: '👟', boots: '👢',
  sandals: '👡', heels: '👠', accessories: '👜', bags: '👜', hats: '🧢', scarves: '🧣',
  belts: '👔', jewelry: '💍', other: '🧺',
}

const COLOR_HEX: Record<string, string> = {
  red: '#d95f5f', white: '#f4f1e8', black: '#33322f', blue: '#5b7fb8', navy: '#31406b',
  green: '#69a37c', yellow: '#d9bc55', pink: '#d992ac', beige: '#d8c8a8', brown: '#8f6f4d',
  gray: '#9c9c98', grey: '#9c9c98', красный: '#d95f5f', белый: '#f4f1e8', чёрный: '#33322f',
  черный: '#33322f', синий: '#5b7fb8', зелёный: '#69a37c', зеленый: '#69a37c',
  бежевый: '#d8c8a8', коричневый: '#8f6f4d', серый: '#9c9c98',
}

const DRAW_ORDER: Record<string, number> = {
  dresses: 1, skirts: 2, bottoms: 2, pants: 2, jeans: 2, trousers: 2,
  tops: 3, shirts: 3, blouses: 3, tshirts: 3, sweaters: 4, hoodies: 4,
  jackets: 5, coats: 5, outerwear: 5, shoes: 6, sneakers: 6, boots: 6,
  sandals: 6, heels: 6, hats: 7, scarves: 7, belts: 7, bags: 8, accessories: 8, jewelry: 8,
}

const MAX_LAYERS = 5
const TRYON_LIMIT = 3

function GarmentShape({ category }: { category: string }) {
  switch (category) {
    case 'tops': case 'shirts': case 'blouses': case 'tshirts': case 'sweaters': case 'hoodies':
      return (
        <>
          <path d="M 114 80 Q 160 72 206 80 L 200 182 Q 160 191 120 182 Z" />
          <path d="M 116 86 L 92 172 Q 89 180 96 183 Q 103 185 106 176 L 124 100 Z" />
          <path d="M 204 86 L 228 172 Q 231 180 224 183 Q 217 185 214 176 L 196 100 Z" />
        </>
      )
    case 'jackets': case 'coats': case 'outerwear':
      return (
        <>
          <path d="M 112 78 Q 160 70 208 78 L 212 226 Q 160 236 108 226 Z" />
          <path d="M 114 84 L 90 172 Q 87 180 94 183 Q 101 185 104 176 L 122 98 Z" />
          <path d="M 206 84 L 230 172 Q 233 180 226 183 Q 219 185 216 176 L 198 98 Z" />
        </>
      )
    case 'bottoms': case 'pants': case 'jeans': case 'trousers':
      return <path d="M 126 174 L 194 174 L 190 290 L 166 290 L 162 202 L 158 202 L 154 290 L 130 290 Z" />
    case 'skirts':
      return <path d="M 122 174 L 198 174 L 216 238 Q 160 250 104 238 Z" />
    case 'dresses':
      return <path d="M 114 80 Q 160 72 206 80 L 220 246 Q 160 258 100 246 Z" />
    case 'shoes': case 'sneakers': case 'sandals': case 'heels':
      return (
        <>
          <ellipse cx="141" cy="292" rx="16" ry="7" />
          <ellipse cx="179" cy="292" rx="16" ry="7" />
        </>
      )
    case 'boots':
      return (
        <>
          <path d="M 128 246 h 26 v 42 q 0 6 -6 6 h -14 q -6 0 -6 -6 Z" />
          <path d="M 166 246 h 26 v 42 q 0 6 -6 6 h -14 q -6 0 -6 -6 Z" />
        </>
      )
    case 'hats':
      return <path d="M 134 36 Q 160 10 186 36 L 186 46 Q 160 34 134 46 Z" />
    case 'scarves':
      return <path d="M 138 76 Q 160 88 182 76 L 182 92 Q 160 104 138 92 Z" />
    case 'belts':
      return <rect x="122" y="170" width="76" height="11" rx="5" />
    case 'bags': case 'accessories':
      return (
        <>
          <path d="M 200 100 L 232 168" strokeWidth="4" fill="none" stroke="#8f6f4d" />
          <rect x="222" y="166" width="34" height="40" rx="7" />
        </>
      )
    case 'jewelry':
      return <circle cx="160" cy="98" r="8" />
    default:
      return <path d="M 114 80 Q 160 72 206 80 L 200 182 Q 160 191 120 182 Z" />
  }
}

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

  /* ---------- DRAG & DROP (режим фото) ---------- */
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
    const x = Math.max(0, Math.min(80, rawX - 10))
    const y = Math.max(0, Math.min(80, rawY - 10))
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
  }, [dragging, selected])

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

  const sortedSelected = [...selected].sort(
    (a, b) => (DRAW_ORDER[a.category] ?? 9) - (DRAW_ORDER[b.category] ?? 9)
  )

  return (
    <div>
      <h1 className="screen-title">{lang === 'ru' ? 'Примерка' : 'Try-On'}</h1>
      <div className="muted mono" style={{ marginBottom: 14 }}>
        {mode === 'mannequin'
          ? lang === 'ru'
            ? 'Одежда по фигуре · 360° · слои с иконками.'
            : 'Clothing on figure · 360° · layers with icons.'
          : lang === 'ru'
            ? 'Перетаскивайте вещи по фото.'
            : 'Drag items on your photo.'}
      </div>

      <div className="actions" style={{ marginBottom: 12 }}>
        <button
          className="action-btn"
          style={{ flex: 1, background: mode === 'mannequin' ? 'var(--accent)' : 'var(--card)', color: mode === 'mannequin' ? '#fff' : 'var(--ink)' }}
          onClick={() => { setMode('mannequin'); setAiResult(null) }}
        >
          {lang === 'ru' ? 'Манекен' : 'Mannequin'}
        </button>
        <button
          className="action-btn"
          style={{ flex: 1, background: mode === 'photo' ? 'var(--accent)' : 'var(--card)', color: mode === 'photo' ? '#fff' : 'var(--ink)' }}
          onClick={() => { setMode('photo'); setAiResult(null) }}
        >
          {lang === 'ru' ? 'Моё фото' : 'My photo'}
        </button>
      </div>

      <div
        ref={previewRef}
        className="card"
        style={{ marginBottom: 14, padding: 0, position: 'relative', width: '100%', height: 320, overflow: 'hidden', cursor: mode === 'photo' && dragging ? 'grabbing' : 'default' }}
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
          /* МАНЕКЕН С 3D-ПОВОРОТОМ */
          <div style={{ position: 'absolute', inset: 0, perspective: '900px' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.6s ease',
                transformStyle: 'preserve-3d',
              }}
            >
              <svg width="100%" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', top: 0, left: 0 }}>
                <defs>
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f0ebe3" />
                    <stop offset="50%" stopColor="#f7f2ea" />
                    <stop offset="100%" stopColor="#e8e0d5" />
                  </linearGradient>
                  {sortedSelected.map((it) =>
                    it.image_url ? (
                      <pattern key={it.id} id={`pat-${it.id}`} patternUnits="objectBoundingBox" width="1" height="1">
                        <image href={it.image_url} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
                      </pattern>
                    ) : null
                  )}
                </defs>

                {/* Фигура человека */}
                <circle cx="160" cy="45" r="26" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
                <rect x="152" y="66" width="16" height="16" rx="6" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="1.5" />
                <path d="M 118 84 Q 160 76 202 84 L 196 178 Q 160 186 124 178 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 118 90 L 96 170 Q 93 178 99 181 Q 105 183 108 175 L 126 105 Z" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 202 90 L 224 170 Q 227 178 221 181 Q 215 183 212 175 L 194 105 Z" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 132 180 L 154 180 L 150 288 L 134 288 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
                <path d="M 166 180 L 188 180 L 186 288 L 170 288 Z" fill="url(#bodyGrad)" stroke="#d4c9b8" strokeWidth="2" />
                <ellipse cx="141" cy="292" rx="14" ry="6" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />
                <ellipse cx="179" cy="292" rx="14" ry="6" fill="#f0ebe3" stroke="#d4c9b8" strokeWidth="1.5" />

                {/* Детали спины: причёска с пучком + позвоночник */}
                {isBack && (
                  <>
                    <path d="M 134 34 Q 160 14 186 34 L 189 60 Q 160 72 131 60 Z" fill="#e0d2b8" stroke="#c9b899" strokeWidth="1.5" />
                    <circle cx="160" cy="22" r="9" fill="#e0d2b8" stroke="#c9b899" strokeWidth="1.5" />
                    <path d="M 160 92 L 160 168" stroke="#d4c9b8" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <path d="M 140 100 Q 148 106 140 112" stroke="#d4c9b8" strokeWidth="1.2" fill="none" />
                    <path d="M 180 100 Q 172 106 180 112" stroke="#d4c9b8" strokeWidth="1.2" fill="none" />
                  </>
                )}

                {/* Одежда по фигуре (поворачивается вместе с манекеном через wrapper) */}
                {sortedSelected.map((it) => {
                  const fill = it.image_url
                    ? `url(#pat-${it.id})`
                    : COLOR_HEX[(it.color ?? '').toLowerCase()] ?? '#d8c8a8'
                  return (
                    <g key={it.id} fill={fill} stroke="#b9a888" strokeWidth="1.5" opacity="0.95">
                      <GarmentShape category={it.category} />
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>
        ) : photo ? (
          <>
            <img src={photo} alt="My photo" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }} />
            {selected.map((it, idx) => {
              const pos = positions[it.id] ?? { x: 35, y: 25 }
              return (
                <div
                  key={it.id}
                  style={{
                    position: 'absolute',
                    top: `${pos.y}%`,
                    left: `${pos.x}%`,
                    width: '30%',
                    height: '35%',
                    zIndex: idx + 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onMouseDown={(e) => handleDragStart(it.id, e)}
                  onTouchStart={(e) => handleDragStart(it.id, e)}
                >
                  {it.image_url ? (
                    <img src={it.image_url} alt={it.name} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))', pointerEvents: 'none' }} />
                  ) : (
                    <span style={{ fontSize: 64, opacity: 0.85, pointerEvents: 'none' }}>{CATEGORY_ICON[it.category] ?? '👕'}</span>
                  )}
                </div>
              )
            })}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
            <label className="action-btn primary" style={{ cursor: 'pointer' }}>
              📷 {lang === 'ru' ? 'Загрузить фото' : 'Upload photo'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
          </div>
        )}

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
            style={{ flex: 1, fontSize: 11, padding: '6px 8px', background: view === 'front' ? 'var(--accent-soft)' : 'var(--card)', color: view === 'front' ? 'var(--accent-deep)' : 'var(--ink)', borderColor: view === 'front' ? 'var(--accent)' : 'var(--hair)' }}
            onClick={() => setView('front')}
          >
            {lang === 'ru' ? 'спереди' : 'front'}
          </button>
          <button
            className="action-btn"
            style={{ flex: 1, fontSize: 11, padding: '6px 8px', background: view === 'back' ? 'var(--accent-soft)' : 'var(--card)', color: view === 'back' ? 'var(--accent-deep)' : 'var(--ink)', borderColor: view === 'back' ? 'var(--accent)' : 'var(--hair)' }}
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
              style={{ cursor: 'pointer', background: isSelected ? 'var(--accent-soft)' : 'var(--card)', borderColor: isSelected ? 'var(--accent)' : 'var(--hair)', padding: '10px 12px', margin: 0 }}
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