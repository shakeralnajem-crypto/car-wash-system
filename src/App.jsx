import { useEffect, useState } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Services from './pages/Services'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Invoices from './pages/Invoices'
import { LanguageProvider, useTranslation } from './i18n'

const SESSION_STORAGE_KEY = 'app-session'

const ADMIN_ACCOUNT = {
  username: 'Bager',
  displayName: 'Bager',
  password: 'Linn2020',
  role: 'admin',
}

const EMPLOYEE_NAMES = [
  'Eva Karlsson',
  'Fredrik Axelsson',
  'Fredrik Ranehammar',
  'Helén Richter',
  'Helena Olsson',
  'Huni Hallsson',
  'Klas Johansson',
  'Lars Olsson',
  'Lorenz Hansen',
  'Simon Johansson',
  'Sofie Svensson',
  'Tilda Ekenstierna',
  'Ulf Nilsson',
]

const EMPLOYEE_ACCOUNTS = EMPLOYEE_NAMES.map(name => ({
  username: name,
  displayName: name,
  role: 'employee',
}))

const LOGIN_OPTIONS = [
  ADMIN_ACCOUNT,
  ...EMPLOYEE_ACCOUNTS,
]

const PAGES = [
  { id: 'dashboard', labelKey: 'nav.dashboard' },
  { id: 'services', labelKey: 'nav.services' },
  { id: 'customers', labelKey: 'nav.customers' },
  { id: 'orders', labelKey: 'nav.orders' },
  { id: 'invoices', labelKey: 'nav.invoices' },
]

function normalizeUsername(value) {
  return value.trim().toLocaleLowerCase('sv-SE')
}

function getStoredSession() {
  if (typeof window === 'undefined') return null

  try {
    const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
    const session = rawSession ? JSON.parse(rawSession) : null

    if (!session?.username || !session?.role) return null

    if (
      session.role === 'admin' &&
      normalizeUsername(session.username) === normalizeUsername(ADMIN_ACCOUNT.username)
    ) {
      return {
        username: ADMIN_ACCOUNT.username,
        displayName: ADMIN_ACCOUNT.displayName,
        role: ADMIN_ACCOUNT.role,
      }
    }

    if (session.role === 'employee') {
      const employee = EMPLOYEE_ACCOUNTS.find(
        account => normalizeUsername(account.username) === normalizeUsername(session.username)
      )

      return employee || null
    }

    return null
  } catch {
    return null
  }
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
}

function LanguageSwitcher({ language, setLanguage }) {
  return (
    <div className="lang-switcher">
      <button
        className={`btn btn-sm ${language === 'sv' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setLanguage('sv')}
        type="button"
      >
        SV
      </button>
      <button
        className={`btn btn-sm ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
        onClick={() => setLanguage('en')}
        type="button"
      >
        EN
      </button>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const { language, setLanguage, t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = event => {
    event.preventDefault()

    const normalizedUsername = normalizeUsername(username)

    if (normalizedUsername === normalizeUsername(ADMIN_ACCOUNT.username)) {
      if (password === ADMIN_ACCOUNT.password) {
        onLogin({
          username: ADMIN_ACCOUNT.username,
          displayName: ADMIN_ACCOUNT.displayName,
          role: ADMIN_ACCOUNT.role,
        })
        return
      }
    } else {
      const employee = EMPLOYEE_ACCOUNTS.find(
        account => normalizeUsername(account.username) === normalizedUsername
      )

      if (employee) {
        onLogin(employee)
        return
      }
    }

    setError(t('auth.invalidCredentials'))
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div className="nav-brand">
          <img src="/km-logo.png" alt="KM Autogroup" className="nav-brand-logo" />
          <span className="nav-brand-name">Newmanbil</span>
        </div>
        <LanguageSwitcher language={language} setLanguage={setLanguage} />
      </div>

      <div className="auth-card">
        <div className="auth-card-header">
          <h1 className="page-title">{t('auth.title')}</h1>
          <p className="page-subtitle">{t('auth.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">{t('auth.username')}</label>
            <select
              className="form-input"
              value={username}
              onChange={event => {
                setUsername(event.target.value)
                if (error) setError('')
              }}
            >
              <option value="">{t('auth.usernamePlaceholder')}</option>
              {LOGIN_OPTIONS.map(account => (
                <option key={account.username} value={account.username}>
                  {account.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={event => {
                setPassword(event.target.value)
                if (error) setError('')
              }}
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="current-password"
            />
          </div>

          <p className="auth-hint">{t('auth.employeeHint')}</p>
          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit">
            {t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}

function AppShell() {
  const [currentUser, setCurrentUser] = useState(() => getStoredSession())
  const [activePage, setActivePage] = useState(() => (
    getStoredSession()?.role === 'employee' ? 'orders' : 'dashboard'
  ))
  const { language, setLanguage, t } = useTranslation()
  const availablePages = currentUser?.role === 'employee'
    ? PAGES.filter(page => page.id === 'orders')
    : PAGES

  useEffect(() => {
    if (!currentUser) return

    if (!availablePages.some(page => page.id === activePage)) {
      setActivePage(availablePages[0]?.id || 'orders')
    }
  }, [activePage, availablePages, currentUser])

  const handleLogin = user => {
    setCurrentUser(user)
    setActivePage(user.role === 'employee' ? 'orders' : 'dashboard')

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setActivePage('dashboard')

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">
          <img src="/km-logo.png" alt="KM Autogroup" className="nav-brand-logo" />
          <span className="nav-brand-name">Newmanbil</span>
        </div>

        <div className="nav-links">
          {availablePages.map(page => (
            <button
              key={page.id}
              className={`nav-link${activePage === page.id ? ' active' : ''}`}
              onClick={() => setActivePage(page.id)}
            >
              {t(page.labelKey)}
            </button>
          ))}
        </div>

        <div className="nav-right">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
          <span className="badge badge-neutral">
            {currentUser.role === 'admin' ? t('auth.adminLabel') : t('auth.accessOrdersOnly')}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} type="button">
            {t('auth.signOut')}
          </button>
          <div className="nav-user">
            <div className="nav-user-meta">
              <span className="nav-user-name">{currentUser.displayName}</span>
              <span className="nav-user-role">
                {currentUser.role === 'admin' ? t('auth.adminLabel') : t('auth.employeeLabel')}
              </span>
            </div>
            <div className="nav-avatar">{getInitials(currentUser.displayName)}</div>
          </div>
        </div>
      </nav>

      {activePage === 'dashboard' && currentUser.role === 'admin' && <Dashboard onNavigate={setActivePage} />}
      {activePage === 'services' && currentUser.role === 'admin' && <Services />}
      {activePage === 'customers' && currentUser.role === 'admin' && <Customers />}
      {activePage === 'orders' && <Orders canManage={currentUser.role === 'admin'} />}
      {activePage === 'invoices' && currentUser.role === 'admin' && <Invoices />}
    </>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AppShell />
    </LanguageProvider>
  )
}
