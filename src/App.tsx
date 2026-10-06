import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthPage } from './components/pages/AuthPage'
import { WardrobePage } from './components/WardrobePage'

type Tab = 'today' | 'wardrobe' | 'tryon' | 'looks' | 'profile'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '🌤', label: 'Сегодня' },
  { id: 'wardrobe', icon: '🗄', label: 'Шкаф' },
  { id: 'tryon', icon: '👗', label: 'Примерка' },
  { id: 'looks', icon: '✨', label: 'Образы' },
  { id: 'profile', icon: '👤', label: 'Профиль' },
]

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [showPro, setShowPro] = useState(false)
  const [proMsg, setProMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="screen muted" style={{ padding: 24, textAlign: 'center' }}>Загрузка...</div>
  if (!session) return <AuthPage />

  const email: string = session.user?.email ?? ''

  return (
    <div className="phone">
      <div className="statusbar"><span>9:41</span><span>📶</span></div>
      <div className="appbar">
        <div className="brand">StyleTwin<sup>®</sup></div>
        <span className="badge-free">FREE</span>
      </div>

      <main className="screen">
        {tab === 'today' && (
          <>
            <div className="weather">✳ 18° · дождь</div>
            <div className="chips">
              <span className="chip">офис</span>
              <span className="chip">встреча 14:00</span>
            </div>
            <h1 className="screen-title">Что надеть сегодня</h1>
            <div className="actions">
              <button className="action-btn primary" onClick={() => setTab('tryon')}>✳ AI-примерка</button>
              <button className="action-btn" onClick={() => setTab('wardrobe')}>＋ Гардероб</button>
              <button className="action-btn" onClick={() => setTab('looks')}>❐ Мои образы</button>
            </div>
            <div className="card muted">Сегодня AI подберёт образ из вашего шкафа. Скоро!</div>
          </>
        )}

        {tab === 'wardrobe' && <WardrobePage />}

        {tab === 'tryon' && (
          <>
            <h1 className="screen-title">Примерка</h1>
            <div className="muted" style={{ marginBottom: 12 }}>Одежда по фигуре · 360° · слои с иконками.</div>
            <div className="card row">
              <span>спереди</span>
              <span className="muted">сзади</span>
            </div>
            <div className="card row">
              <span>✳ Образ готов</span>
              <span className="muted">0 / 5 слоёв</span>
            </div>
            <button className="action-btn primary" style={{ width: '100%' }}>✳ Примерить</button>
          </>
        )}

        {tab === 'looks' && (
          <>
            <h1 className="screen-title">Мои образы</h1>
            <div className="card muted">Здесь появятся собранные образы.</div>
          </>
        )}

        {tab === 'profile' && (
          <>
            <h1 className="screen-title">Профиль</h1>
            <div className="card row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Анна К.</div>
                  <div className="muted">{email}</div>
                </div>
              </div>
            </div>
            <div className="card row" onClick={() => setTab('wardrobe')} style={{ cursor: 'pointer' }}>
              <span>Гардероб</span><span className="muted">→</span>
            </div>
            <div className="card row" onClick={() => setShowPro(true)} style={{ cursor: 'pointer' }}>
              <span>Подписка</span><span className="muted">FREE →</span>
            </div>
            <div className="card row">
              <span>Настройки</span><span className="muted">→</span>
            </div>
            <button className="action-btn" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}>Выйти</button>
          </>
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {showPro && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={() => setShowPro(false)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 340, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>
              Style Twin <span style={{ color: 'var(--accent)' }}>PRO</span>
            </div>
            <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>Стилист без лимитов</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <tbody>
                <tr><td style={{ padding: '6px 0' }}>Примерки в месяц</td><td style={{ textAlign: 'center' }}>3</td><td style={{ textAlign: 'center', fontWeight: 700 }}>∞</td></tr>
                <tr><td style={{ padding: '6px 0' }}>Вещей в гардеробе</td><td style={{ textAlign: 'center' }}>100</td><td style={{ textAlign: 'center', fontWeight: 700 }}>∞</td></tr>
                <tr><td style={{ padding: '6px 0' }}>Обучаемый AI</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center', fontWeight: 700 }}>✓</td></tr>
                <tr><td style={{ padding: '6px 0' }}>Аналитика CPW</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center', fontWeight: 700 }}>✓</td></tr>
              </tbody>
            </table>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ textDecoration: 'line-through' }}>$4.99 /мес</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>−50% · ВЫГОДНЕЕ $2.49 /мес</span>
            </div>
            <button
              className="action-btn primary"
              style={{ width: '100%' }}
              onClick={() => setProMsg('Платежи подключим на следующей итерации. Пока PRO — это красиво!')}
            >
              ✳ Оформить за $2.49/мес
            </button>
            {proMsg && <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>{proMsg}</div>}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setShowPro(false)}>Позже</button>
            </div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11 }}>Отмена в любой момент · Возврат 7 дней</div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>✳ 4.9 · 12 000+ образов собрано</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App