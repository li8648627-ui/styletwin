import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../i18n'

export function AuthPage() {
  const { t } = useLang()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage(t('auth_ok_reg'))
        setIsLogin(true)
      }
    } catch (err: any) {
      setMessage(`${t('auth_err')} ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="phone">
      <main className="screen" style={{ paddingTop: 48 }}>
        <div className="card" style={{ padding: 20 }}>
          <h1 className="screen-title" style={{ textAlign: 'center' }}>
            {isLogin ? t('auth_title_login') : t('auth_title_reg')}
          </h1>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder={t('auth_email')}
              required
              style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder={t('auth_pass')}
              required
              style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6 }}
            />
            <button type="submit" disabled={busy} className="action-btn primary" style={{ width: '100%' }}>
              {isLogin ? t('auth_btn_login') : t('auth_btn_reg')}
            </button>
          </form>
          {message && <div className="muted" style={{ marginTop: 10, textAlign: 'center' }}>{message}</div>}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}
              onClick={() => {
                setIsLogin(!isLogin)
                setMessage('')
              }}
            >
              {isLogin ? t('auth_to_reg') : t('auth_to_login')}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
