import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthPage } from './components/pages/AuthPage'
import { WardrobePage } from './components/WardrobePage'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('today')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка...</div>
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <header style={{ padding: '16px', background: 'white', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>StyleTwin</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '12px', background: 'white', cursor: 'pointer' }}
        >
          Выход
        </button>
      </header>

      <main style={{ flex: 1, padding: '16px' }}>
        {tab === 'today' && <h2>Что надеть сегодня? 👗</h2>}
        {tab === 'wardrobe' && <WardrobePage />}
        {tab === 'looks' && <h2>Мои образы</h2>}
        {tab === 'profile' && <h2>Профиль: {session.user.email}</h2>}
      </main>

      <nav style={{ background: 'white', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', padding: '12px 0' }}>
        {['today', 'wardrobe', 'looks', 'profile'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ background: 'none', border: 'none', color: tab === t ? '#d946ef' : '#888', fontWeight: tab === t ? 'bold' : 'normal', fontSize: '14px', cursor: 'pointer' }}
          >
            {t === 'today' ? 'Сегодня' : t === 'wardrobe' ? 'Шкаф' : t === 'looks' ? 'Образы' : 'Профиль'}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App