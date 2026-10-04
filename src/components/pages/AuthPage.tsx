import { AuthForm } from '../AuthForm'

export function AuthPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AuthForm />
    </div>
  )
}
