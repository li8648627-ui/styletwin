import { useState, useEffect } from 'react'
import './App.css'
import { useLang } from './i18n'
import { supabase } from './lib/supabase'
import { TodayPage } from './components/TodayPage'
import { WardrobePage } from './components/WardrobePage'
import { TryOnPage } from './components/TryOnPage'
import { LooksPage } from './components/LooksPage'
import { OnboardingModal } from './components/OnboardingModal'

type Tab = 'today' | 'wardrobe' | 'tryon' | 'looks' | 'profile'

const TABS: { id: Tab; ru: string; en: string; icon: string }[] = [
  { id: 'today', ru: 'Сегодня', en: 'Today', icon: '🌤' },
  { id: 'wardrobe', ru: 'Шкаф', en: 'Wardrobe', icon: '🚪' },
  { id: 'tryon', ru: 'Примерка', en: 'Try-On', icon: '👗' },
  { id: 'looks', ru: 'Образы', en: 'Looks', icon: '✨' },
  { id: 'profile', ru: 'Профиль', en: 'Profile', icon: '👤' },
]

function AuthScreen({ onDone }: { onDone: () => void }) {
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phone">
      <div className="statusbar">
        <span>9:41</span>
        <span>📶</span>
      </div>
      <div className="appbar">
        <span className="brand">Style<sup>®</sup>Twin</span>
        <span className="badge-free">FREE</span>
      </div>
      <div className="screen">
        <h1 className="screen-title">{lang === 'ru' ? 'Вход' : 'Sign in'}</h1>
        <div className="card">
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === 'Enter') submit()
            }}
            style={{ width: '100%', marginBottom: 10 }}
          />
          {error && (
            <div className="muted" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>
          )}
          <button className="action-btn primary" style={{ width: '100%' }} disabled={busy} onClick={submit}>
            {mode === 'login' ? (lang === 'ru' ? 'Войти' : 'Sign in') : (lang === 'ru' ? 'Создать аккаунт' : 'Create account')}
          </button>
          <button
            className="action-btn"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login'
              ? lang === 'ru'
                ? 'Нет аккаунта? Зарегистрироваться'
                : 'No account? Register'
              : lang === 'ru'
                ? 'Уже есть аккаунт? Войти'
                : 'Have account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { lang, setLang } = useLang()
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [city, setCity] = useState<string>(() => localStorage.getItem('st_city') ?? 'Санкт-Петербург')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPro, setShowPro] = useState(false)
  const [proMsg, setProMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user && !localStorage.getItem('st_onboarded_v1')) setShowOnboarding(true)
  }, [user])

  const closeOnboarding = () => {
    localStorage.setItem('st_onboarded_v1', '1')
    setShowOnboarding(false)
  }

  const setCityAndSave = (c: string) => {
    setCity(c)
    localStorage.setItem('st_city', c)
  }

  if (!ready) {
    return (
      <div className="phone">
        <div className="card muted">…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        onDone={() => supabase.auth.getUser().then(({ data }) => setUser(data.user))}
      />
    )
  }

  const initials = (user.email ?? '??').slice(0, 2).toUpperCase()

  return (
    <div className="phone">
      <div className="statusbar">
        <span>9:41</span>
        <span>📶</span>
      </div>
      <div className="appbar">
        <span className="brand">Style<sup>®</sup>Twin</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="badge-free">FREE</span>
          <button
            className="badge-free"
            style={{ cursor: 'pointer', borderColor: lang === 'ru' ? '#111' : undefined }}
            onClick={() => setLang('ru')}
          >
            RU
          </button>
          <button
            className="badge-free"
            style={{ cursor: 'pointer', borderColor: lang === 'en' ? '#111' : undefined }}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </div>
      <div className="screen">
        {tab === 'today' && <TodayPage city={city} onNavigate={(t) => setTab(t)} />}
        {tab === 'wardrobe' && <WardrobePage />}
        {tab === 'tryon' && <TryOnPage />}
        {tab === 'looks' && <LooksPage />}
        {tab === 'profile' && (
          <div>
            <h1 className="screen-title">{lang === 'ru' ? 'Профиль' : 'Profile'}</h1>
            <div className="card">
              <div className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--ink)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{user.email}</div>
                    <div className="muted" style={{ fontSize: 12 }}>FREE</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="muted" style={{ marginBottom: 6 }}>
                {lang === 'ru' ? 'Город для погоды' : 'City for weather'}
              </div>
              <input value={city} onChange={(e) => setCityAndSave(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="card row" style={{ cursor: 'pointer' }} onClick={() => setTab('wardrobe')}>
              <span style={{ fontWeight: 600 }}>{lang === 'ru' ? 'Гардероб' : 'Wardrobe'}</span>
              <span className="muted">→</span>
            </div>
            <div className="card row" style={{ cursor: 'pointer' }} onClick={() => setShowPro(true)}>
              <span style={{ fontWeight: 600 }}>{lang === 'ru' ? 'Подписка' : 'Subscription'}</span>
              <span className="muted">FREE →</span>
            </div>
            <button
              className="action-btn"
              style={{ width: '100%' }}
              onClick={async () => {
                await supabase.auth.signOut()
              }}
            >
              {lang === 'ru' ? 'Выйти' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
      <div className="tabbar">
        {TABS.map((tb) => (
          <button key={tb.id} className={'tab' + (tab === tb.id ? ' active' : '')} onClick={() => setTab(tb.id)}>
            <span className="tab-icon">{tb.icon}</span>
            <span>{lang === 'ru' ? tb.ru : tb.en}</span>
          </button>
        ))}
      </div>
      {showPro && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,22,28,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
            padding: 20,
          }}
        >
          <div className="card" style={{ maxWidth: 360, width: '100%' }}>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>Style Twin PRO</div>
            <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
              {lang === 'ru' ? 'Стилист без лимитов' : 'Stylist without limits'}
            </div>
            <table style={{ width: '100%', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td>{lang === 'ru' ? 'Примерки в месяц' : 'Try-ons / month'}</td>
                  <td style={{ textAlign: 'right' }}>3</td>
                  <td style={{ textAlign: 'right' }}>∞</td>
                </tr>
                <tr>
                  <td>{lang === 'ru' ? 'Вещей в гардеробе' : 'Wardrobe items'}</td>
                  <td style={{ textAlign: 'right' }}>100</td>
                  <td style={{ textAlign: 'right' }}>∞</td>
                </tr>
                <tr>
                  <td>{lang === 'ru' ? 'Обучаемый AI' : 'Learnable AI'}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>✓</td>
                </tr>
                <tr>
                  <td>{lang === 'ru' ? 'Аналитика CPW' : 'CPW analytics'}</td>
                  <td style={{ textAlign: 'right' }}>—</td>
                  <td style={{ textAlign: 'right' }}>✓</td>
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign: 'center', margin: '10px 0' }}>
              <span className="muted" style={{ textDecoration: 'line-through' }}>$4.99 /{lang === 'ru' ? 'мес' : 'mo'}</span>{' '}
              <strong>−50% · {lang === 'ru' ? 'ВЫГОДНЕЕ' : 'BETTER'} $2.49 /{lang === 'ru' ? 'мес' : 'mo'}</strong>
            </div>
            <button
              className="action-btn primary"
              style={{ width: '100%' }}
              onClick={() =>
                setProMsg(
                  lang === 'ru'
                    ? '💳 Тестовые платежи подключим следующей итерацией'
                    : '💳 Test payments coming next iteration'
                )
              }
            >
              ✳ {lang === 'ru' ? 'Оформить за $2.49/мес' : 'Get for $2.49/mo'}
            </button>
            {proMsg && (
              <div className="muted" style={{ textAlign: 'center', marginTop: 8 }}>{proMsg}</div>
            )}
            <button
              className="action-btn"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                setShowPro(false)
                setProMsg('')
              }}
            >
              {lang === 'ru' ? 'Позже' : 'Later'}
            </button>
          </div>
        </div>
      )}
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
    </div>
  )
}