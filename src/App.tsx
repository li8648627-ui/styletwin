import { useState } from 'react'

function App() {
  const [tab, setTab] = useState('today')

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      <header style={{ padding: '16px', background: 'white', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>StyleTwin</h1>
        <button style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '12px', background: 'white' }}>RU / EN</button>
      </header>

      <main style={{ flex: 1, padding: '16px' }}>
        {tab === 'today' && <h2>Что надеть сегодня? 👗</h2>}
        {tab === 'wardrobe' && <h2>Мой гардероб (22 вещи)</h2>}
        {tab === 'looks' && <h2>Мои образы</h2>}
        {tab === 'profile' && <h2>Профиль: Анна К.</h2>}
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