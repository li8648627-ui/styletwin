import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'ru' | 'en'

const DICT = {
  ru: {
    loading: 'Загрузка...',
    tab_today: 'Сегодня',
    tab_wardrobe: 'Шкаф',
    tab_tryon: 'Примерка',
    tab_looks: 'Образы',
    tab_profile: 'Профиль',
    weather: '✳ 18° · дождь',
    chip_office: 'офис',
    chip_meeting: 'встреча 14:00',
    today_title: 'Что надеть сегодня',
    btn_tryon: '✳ AI-примерка',
    btn_wardrobe: '＋ Гардероб',
    btn_looks: '❐ Мои образы',
    profile_title: 'Профиль',
    row_wardrobe: 'Гардероб',
    row_sub: 'Подписка',
    row_settings: 'Настройки',
    btn_logout: 'Выйти',
    pro_sub: 'Стилист без лимитов',
    pro_row1: 'Примерки в месяц',
    pro_row2: 'Вещей в гардеробе',
    pro_row3: 'Обучаемый AI',
    pro_row4: 'Аналитика CPW',
    pro_deal: '−50% · ВЫГОДНЕЕ $2.49 /мес',
    pro_btn: '✳ Оформить за $2.49/мес',
    pro_later: 'Позже',
    pro_note: 'Отмена в любой момент · Возврат 7 дней',
    pro_social: '✳ 4.9 · 12 000+ образов собрано',
    pro_msg: 'Платежи подключим на следующей итерации. Пока PRO — это красиво!',
  },
  en: {
    loading: 'Loading...',
    tab_today: 'Today',
    tab_wardrobe: 'Wardrobe',
    tab_tryon: 'Try-On',
    tab_looks: 'Looks',
    tab_profile: 'Profile',
    weather: '✳ 18° · rain',
    chip_office: 'office',
    chip_meeting: 'meeting 2:00 PM',
    today_title: 'What to wear today',
    btn_tryon: '✳ AI Try-On',
    btn_wardrobe: '＋ Wardrobe',
    btn_looks: '❐ My Looks',
    profile_title: 'Profile',
    row_wardrobe: 'Wardrobe',
    row_sub: 'Subscription',
    row_settings: 'Settings',
    btn_logout: 'Log Out',
    pro_sub: 'Stylist without limits',
    pro_row1: 'Try-ons per month',
    pro_row2: 'Items in wardrobe',
    pro_row3: 'Learning AI',
    pro_row4: 'CPW Analytics',
    pro_deal: '−50% · BETTER $2.49 /mo',
    pro_btn: '✳ Get for $2.49/mo',
    pro_later: 'Later',
    pro_note: 'Cancel anytime · 7-day refund',
    pro_social: '✳ 4.9 · 12 000+ looks created',
    pro_msg: 'Payments coming in the next iteration. For now PRO is just beautiful!',
  },
}

export type TKey = keyof typeof DICT.ru

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }

const LangContext = createContext<Ctx>({ lang: 'ru', setLang: () => {}, t: (k) => DICT.ru[k] })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('st_lang') === 'en' ? 'en' : 'ru'
  )
  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('st_lang', l)
  }
  const t = (k: TKey) => DICT[lang][k]
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}