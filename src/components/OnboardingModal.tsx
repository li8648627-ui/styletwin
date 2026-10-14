import { useState } from 'react'
import { useLang } from '../i18n'

const STEPS = [
  {
    icon: '📸',
    titleRu: 'Загрузите фото вещей',
    titleEn: 'Upload your clothes',
    descRu: 'AI вырежет фон и приведёт к единому виду автоматически.',
    descEn: 'AI will remove the background and unify the look automatically.',
  },
  {
    icon: '🎯',
    titleRu: 'Отметьте, куда идёте',
    titleEn: 'Tell us where you are going',
    descRu: '8 направлений: от офиса до театра. Стилист подберёт образ под событие и погоду.',
    descEn: '8 destinations: from office to theater. The stylist picks a look for the event and weather.',
  },
  {
    icon: '🧠',
    titleRu: 'Учите стилиста',
    titleEn: 'Teach the stylist',
    descRu: 'Лайки и «не нравится» — стилист запоминает ваш вкус и предлагает точнее.',
    descEn: 'Likes and "not mine" — the stylist learns your taste and suggests more precisely.',
  },
]

export function OnboardingModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLang()
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 22, 28, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 20,
          padding: '28px 22px',
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 24px 64px rgba(70, 54, 30, 0.28)',
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            margin: '0 auto 16px',
          }}
        >
          {current.icon}
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: -0.3,
            textAlign: 'center',
            color: 'var(--ink)',
            marginBottom: 8,
          }}
        >
          {lang === 'ru' ? current.titleRu : current.titleEn}
        </div>
        <div
          style={{
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: 13.5,
            lineHeight: 1.5,
            marginBottom: 20,
            minHeight: 42,
          }}
        >
          {lang === 'ru' ? current.descRu : current.descEn}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 18,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? 'var(--accent)' : 'var(--hair)',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
        <button
          className="action-btn primary"
          style={{ width: '100%', padding: 14 }}
          onClick={() => (isLast ? onClose() : setStep(step + 1))}
        >
          {isLast
            ? lang === 'ru'
              ? '✳ Начать'
              : '✳ Get started'
            : lang === 'ru'
              ? 'Далее'
              : 'Next'}
        </button>
        {step > 0 && (
          <button
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 12,
              marginTop: 10,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            onClick={onClose}
          >
            {lang === 'ru' ? 'Пропустить' : 'Skip'}
          </button>
        )}
      </div>
    </div>
  )
}