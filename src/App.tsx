import { useState, useEffect, type ReactNode } from 'react'
import './App.css'
import { useLang } from './i18n'
import { supabase } from './lib/supabase'
import { TodayPage } from './components/TodayPage'
import { WardrobePage } from './components/WardrobePage'
import { TryOnPage } from './components/TryOnPage'
import { LooksPage } from './components/LooksPage'
import { OnboardingModal } from './components/OnboardingModal'

type Tab = 'today' | 'wardrobe' | 'tryon' | 'looks' | 'profile'
type ProReason = 'tryon_limit' | 'wardrobe_limit' | 'week_limit' | null

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const TABS: { id: Tab; ru: string; en: string; icon: ReactNode }[] = [
  {
    id: 'today',
    ru: 'Сегодня',
    en: 'Today',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
      </svg>
    ),
  },
  {
    id: 'wardrobe',
    ru: 'Шкаф',
    en: 'Wardrobe',
    icon: (
      <svg {...iconProps}>
        <path d="M12 8.2a2.3 2.3 0 1 0-2.3-2.3" />
        <path d="M12 8.2 20 13.6a1 1 0 0 1-.6 1.8H4.6a1 1 0 0 1-.6-1.8L12 8.2Z" />
      </svg>
    ),
  },
  {
    id: 'tryon',
    ru: 'Примерка',
    en: 'Try-On',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6-5.6-1.9 5.6-1.9L12 3.5Z" />
      </svg>
    ),
  },
  {
    id: 'looks',
    ru: 'Образы',
    en: 'Looks',
    icon: (
      <svg {...iconProps}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'profile',
    ru: 'Профиль',
    en: 'Profile',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 19.5c1.6-3.8 4.6-5.3 7-5.3s5.4 1.5 7 5.3" />
      </svg>
    ),
  },
]

function Brand() {
  return (
    <span className="brand">
      Style<span style={{ color: 'var(--accent)' }}>Twin</span>
      <sup>®</sup>
    </span>
  )
}

function AuthScreen({ onDone }: { onDone: () => void }) {
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetSent, setResetSent] = useState(false)

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

  const forgot = async () => {
    setError('')
    if (!email) {
      setError(lang === 'ru' ? 'Введите email, на который регистрировались' : 'Enter your registration email')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setResetSent(true)
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
        <Brand />
        <span className="badge-free">FREE</span>
      </div>
      <div className="screen">
        <h1 className="screen-title">{lang === 'ru' ? 'Вход' : 'Sign in'}</h1>
        <div className="muted" style={{ marginTop: -6, marginBottom: 14 }}>
          {lang === 'ru'
            ? 'AI-стилист, который учится на вашем вкусе.'
            : 'AI stylist that learns your taste.'}
        </div>
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
          <button
            className="muted mono"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, width: '100%', marginTop: 10 }}
            onClick={forgot}
          >
            {resetSent
              ? lang === 'ru'
                ? '📧 Ссылка отправлена — проверьте почту'
                : '📧 Link sent — check your email'
              : lang === 'ru'
                ? 'Забыли пароль?'
                : 'Forgot password?'}
          </button>
        </div>
        <div className="muted mono" style={{ textAlign: 'center', fontSize: 11, marginTop: 14 }}>
          ✳ 4.9 · {lang === 'ru' ? '12 000+ образов собрано' : '12,000+ looks created'}
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
  const [proReason, setProReason] = useState<ProReason>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [settingsMessage, setSettingsMessage] = useState('')

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

  const triggerPro = (reason: ProReason) => {
    setProReason(reason)
    setShowPro(true)
  }

  const getProTitle = () => {
    if (!proReason) return 'Style Twin PRO'
    const titles: Record<NonNullable<ProReason>, { ru: string; en: string }> = {
      tryon_limit: { ru: 'Примерки закончились', en: 'Try-ons exhausted' },
      wardrobe_limit: { ru: 'Гардероб полон', en: 'Wardrobe is full' },
      week_limit: { ru: 'Нужно больше вещей', en: 'Need more items' },
    }
    return lang === 'ru' ? titles[proReason].ru : titles[proReason].en
  }

  const getProSubtitle = () => {
    if (!proReason) return lang === 'ru' ? 'Стилист без лимитов' : 'Stylist without limits'
    const subs: Record<NonNullable<ProReason>, { ru: string; en: string }> = {
      tryon_limit: { ru: 'Разблокируйте безлимитные примерки', en: 'Unlock unlimited try-ons' },
      wardrobe_limit: { ru: 'Разблокируйте безлимитный гардероб', en: 'Unlock unlimited wardrobe' },
      week_limit: { ru: 'Разблокируйте «Неделю образов»', en: 'Unlock "Week of looks"' },
    }
    return lang === 'ru' ? subs[proReason].ru : subs[proReason].en
  }

  const changePassword = async () => {
    setSettingsMessage('')
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setSettingsMessage(lang === 'ru' ? '✅ Пароль обновлён' : '✅ Password updated')
      setNewPassword('')
    } catch (e: any) {
      setSettingsMessage(`❌ ${e.message}`)
    }
  }

  const deleteAccount = async () => {
    const confirmMsg = lang === 'ru'
      ? 'Удалить аккаунт? Это действие нельзя отменить.'
      : 'Delete account? This action cannot be undone.'
    if (!window.confirm(confirmMsg)) return

    setSettingsMessage('')
    try {
      await supabase.auth.signOut()
      setSettingsMessage(lang === 'ru' ? ' Аккаунт деактивирован' : '🗑 Account deactivated')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e: any) {
      setSettingsMessage(`❌ ${e.message}`)
    }
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
        <Brand />
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
        {tab === 'wardrobe' && <WardrobePage onShowPro={triggerPro} />}
        {tab === 'tryon' && <TryOnPage onShowPro={triggerPro} />}
        {tab === 'looks' && <LooksPage onShowPro={triggerPro} />}
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
            <div className="card row" style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)}>
              <span style={{ fontWeight: 600 }}>{lang === 'ru' ? 'Настройки' : 'Settings'}</span>
              <span className="muted">→</span>
            </div>
            <div className="card row" style={{ cursor: 'pointer' }} onClick={() => setTab('wardrobe')}>
              <span style={{ fontWeight: 600 }}>{lang === 'ru' ? 'Гардероб' : 'Wardrobe'}</span>
              <span className="muted">→</span>
            </div>
            <div className="card row" style={{ cursor: 'pointer' }} onClick={() => triggerPro(null)}>
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

      {/* PRO модалка */}
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
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>{getProTitle()}</div>
            <div className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
              {getProSubtitle()}
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
                alert(lang === 'ru' ? '💳 Тестовые платежи подключим следующей итерацией' : '💳 Test payments coming next iteration')
              }
            >
              ✳ {lang === 'ru' ? 'Оформить за $2.49/мес' : 'Get for $2.49/mo'}
            </button>
            <button
              className="action-btn"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => {
                setShowPro(false)
                setProReason(null)
              }}
            >
              {lang === 'ru' ? 'Позже' : 'Later'}
            </button>
            <div className="muted" style={{ textAlign: 'center', fontSize: 11, marginTop: 8 }}>
              {lang === 'ru' ? 'Отмена в любой момент · Возврат 7 дней' : 'Cancel anytime · 7-day refund'}
            </div>
          </div>
        </div>
      )}

      {/* Настройки модалка */}
      {showSettings && (
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
          onClick={() => setShowSettings(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 360, width: '100%', padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>{lang === 'ru' ? 'Настройки' : 'Settings'}</span>
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', fontWeight: 700 }}
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            <div className="muted mono" style={{ fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {lang === 'ru' ? 'Язык' : 'Language'}
            </div>
            <div className="actions" style={{ marginBottom: 16 }}>
              <button
                className="action-btn"
                style={{
                  flex: 1,
                  background: lang === 'ru' ? 'var(--accent)' : 'var(--card)',
                  color: lang === 'ru' ? '#fff' : 'var(--ink)',
                }}
                onClick={() => setLang('ru')}
              >
                RU
              </button>
              <button
                className="action-btn"
                style={{
                  flex: 1,
                  background: lang === 'en' ? 'var(--accent)' : 'var(--card)',
                  color: lang === 'en' ? '#fff' : 'var(--ink)',
                }}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>

            <div className="muted mono" style={{ fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {lang === 'ru' ? 'Город для погоды' : 'City for weather'}
            </div>
            <input
              value={city}
              onChange={(e) => setCityAndSave(e.target.value)}
              style={{ width: '100%', marginBottom: 16 }}
              placeholder={lang === 'ru' ? 'Санкт-Петербург' : 'Saint Petersburg'}
            />

            <div className="muted mono" style={{ fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
              {lang === 'ru' ? 'Смена пароля' : 'Change password'}
            </div>
            <input
              type="password"
              placeholder={lang === 'ru' ? 'Новый пароль' : 'New password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <button
              className="action-btn"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={changePassword}
              disabled={!newPassword || newPassword.length < 6}
            >
              {lang === 'ru' ? 'Обновить пароль' : 'Update password'}
            </button>

            <button
              className="muted mono"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                width: '100%',
                textAlign: 'center',
                color: 'var(--danger)',
              }}
              onClick={deleteAccount}
            >
              {lang === 'ru' ? 'Удалить аккаунт' : 'Delete account'}
            </button>

            {settingsMessage && (
              <div className="muted" style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
                {settingsMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}
    </div>
  )
}
