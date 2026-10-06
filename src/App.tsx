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
      <div className="statusbar"><span>9:41</span><span>📶 </span></div>
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
            <div className="card row">
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
    </div>
  )
}

export default App