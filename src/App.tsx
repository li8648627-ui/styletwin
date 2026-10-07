import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthPage } from './components/pages/AuthPage'
import { WardrobePage } from './components/WardrobePage'
import { LooksPage } from './components/LooksPage'
import { TodayPage } from './components/TodayPage'
import { TryOnPage } from './components/TryOnPage'
import { CpwCard } from './components/CpwCard'
import { useLang } from './i18n'

type Tab = 'today' | 'wardrobe' | 'tryon' | 'looks' | 'profile'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [showPro, setShowPro] = useState(false)
  const [proMsg, setProMsg] = useState('')
  const { lang, setLang, t } = useLang()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'today', icon: '🌤', label: t('tab_today') },
    { id: 'wardrobe', icon: '🗄', label: t('tab_wardrobe') },
    { id: 'tryon', icon: '👗', label: t('tab_tryon') },
    { id: 'looks', icon: '✨', label: t('tab_looks') },
    { id: 'profile', icon: '👤', label: t('tab_profile') },
  ]

  if (loading) return <div className="screen muted" style={{ padding: 24, textAlign: 'center' }}>{t('loading')}</div>
  if (!session) return <AuthPage />

  const email: string = session.user?.email ?? ''

  return (
    <div className="phone">
      <div className="statusbar"><span>9:41</span><span>📶</span></div>
      <div className="appbar">
        <div className="brand">StyleTwin<sup>®</sup></div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="badge-free">FREE</span>
          <button className="badge-free" style={{ cursor: 'pointer', borderColor: lang === 'ru' ? '#111' : undefined, fontWeight: lang === 'ru' ? 700 : 400 }} onClick={() => setLang('ru')}>RU</button>
          <button className="badge-free" style={{ cursor: 'pointer', borderColor: lang === 'en' ? '#111' : undefined, fontWeight: lang === 'en' ? 700 : 400 }} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      <main className="screen">
        {tab === 'today' && (
          <>
            <div className="weather">{t('weather')}</div>
            <div className="chips">
              <span className="chip">{t('chip_office')}</span>
              <span className="chip">{t('chip_meeting')}</span>
            </div>
            <h1 className="screen-title">{t('today_title')}</h1>
            <div className="actions">
              <button className="action-btn primary" onClick={() => setTab('tryon')}>{t('btn_tryon')}</button>
              <button className="action-btn" onClick={() => setTab('wardrobe')}>{t('btn_wardrobe')}</button>
              <button className="action-btn" onClick={() => setTab('looks')}>{t('btn_looks')}</button>
            </div>
            <TodayPage />
          </>
        )}

        {tab === 'wardrobe' && <WardrobePage />}

        {tab === 'tryon' && <TryOnPage />}

        {tab === 'looks' && <LooksPage />}

        {tab === 'profile' && (
          <>
            <h1 className="screen-title">{t('profile_title')}</h1>
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
              <span>{t('row_wardrobe')}</span><span className="muted">→</span>
            </div>
            <div className="card row" onClick={() => setShowPro(true)} style={{ cursor: 'pointer' }}>
              <span>{t('row_sub')}</span><span className="muted">FREE →</span>
            </div>
            <CpwCard />
            <div className="card row">
              <span>{t('row_settings')}</span><span className="muted">→</span>
            </div>
            <button className="action-btn" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}>{t('btn_logout')}</button>
          </>
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((tb) => (
          <button key={tb.id} className={`tab ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>
            <span className="tab-icon">{tb.icon}</span>
            <span>{tb.label}</span>
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
            <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>{t('pro_sub')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <tbody>
                <tr><td style={{ padding: '6px 0' }}>{t('pro_row1')}</td><td style={{ textAlign: 'center' }}>3</td><td style={{ textAlign: 'center', fontWeight: 700 }}>∞</td></tr>
                <tr><td style={{ padding: '6px 0' }}>{t('pro_row2')}</td><td style={{ textAlign: 'center' }}>100</td><td style={{ textAlign: 'center', fontWeight: 700 }}>∞</td></tr>
                <tr><td style={{ padding: '6px 0' }}>{t('pro_row3')}</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center', fontWeight: 700 }}>✓</td></tr>
                <tr><td style={{ padding: '6px 0' }}>{t('pro_row4')}</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center', fontWeight: 700 }}>✓</td></tr>
              </tbody>
            </table>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted" style={{ textDecoration: 'line-through' }}>$4.99 /мес</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{t('pro_deal')}</span>
            </div>
            <button
              className="action-btn primary"
              style={{ width: '100%' }}
              onClick={() => setProMsg(t('pro_msg'))}
            >
              {t('pro_btn')}
            </button>
            {proMsg && <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>{proMsg}</div>}
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setShowPro(false)}>{t('pro_later')}</button>
            </div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11 }}>{t('pro_note')}</div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>{t('pro_social')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App