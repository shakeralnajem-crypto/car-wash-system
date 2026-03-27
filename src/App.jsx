import { useEffect, useRef, useState } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Services from './pages/Services'
import Customers from './pages/Customers'
import Orders from './pages/Orders'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import { LanguageProvider, useTranslation } from './i18n'
import { supabase } from './supabase'

const ADMIN_PAGES = [
  { id: 'dashboard', labelKey: 'nav.dashboard' },
  { id: 'services', labelKey: 'nav.services' },
  { id: 'customers', labelKey: 'nav.customers' },
  { id: 'orders', labelKey: 'nav.orders' },
  { id: 'invoices', labelKey: 'nav.invoices' },
  { id: 'settings', labelKey: 'nav.settings' },
]

const RESTRICTED_PAGES = [
  { id: 'orders', labelKey: 'nav.orders' },
]

// Staff display names shown in the login dropdown.
// Order: admin first, then employees alphabetically.
const STAFF_NAMES = [
  'Bager',
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

const EMAIL_DOMAIN = 'newmanbil.local'

// Convert a display name to the internal email used for Supabase Auth.
// "Eva Karlsson" → "eva.karlsson@newmanbil.local"
// "Helén Richter" → "helen.richter@newmanbil.local"
// Never shown to the user.
function usernameToEmail(displayName) {
  return (
    displayName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics (é→e, etc.)
      .toLowerCase()
      .replace(/\s+/g, '.')            // spaces → dots
    + '@' + EMAIL_DOMAIN
  )
}

function readGoogleNotificationFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const google = params.get('google')
  if (!google) return null
  if (google === 'success') {
    return {
      type: 'success',
      email: params.get('email') ?? null,
      calendarOk: params.get('calendar_ok') === 'true',
    }
  }
  if (google === 'error') {
    return {
      type: 'error',
      reason: params.get('reason') ?? 'unknown',
    }
  }
  return null
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

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL ?? 'http://localhost:54321/functions/v1'

function LoginScreen() {
  const { language, setLanguage, t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // forgot-password state
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!username) return
    setError('')
    setLoading(true)
    const email = usernameToEmail(username)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(t('auth.invalidCredentials'))
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!username) {
      setResetError(t('auth.forgotSelectFirst'))
      return
    }
    setResetError('')
    setResetLoading(true)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/password-reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usernameToEmail(username), display_name: username }),
      })
      if (!res.ok) throw new Error('server error')
      setResetSent(true)
    } catch {
      setResetError(t('auth.forgotError'))
    }
    setResetLoading(false)
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
                if (resetSent) setResetSent(false)
                if (resetError) setResetError('')
              }}
              required
            >
              <option value="">{t('auth.usernamePlaceholder')}</option>
              {STAFF_NAMES.map(name => (
                <option key={name} value={name}>{name}</option>
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
              required
            />
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? '...' : t('auth.signIn')}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          {resetSent ? (
            <p style={{ color: 'var(--success, #16a34a)', fontSize: 13 }}>
              {t('auth.forgotSuccess')}
            </p>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                style={{ fontSize: 13 }}
              >
                {resetLoading ? '...' : t('auth.forgotPassword')}
              </button>
              {resetError ? (
                <p style={{ color: 'var(--danger, #dc2626)', fontSize: 13, marginTop: 6 }}>
                  {resetError}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AppShell() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null)
  const [activePage, setActivePage] = useState('orders')
  const [googleNotification, setGoogleNotification] = useState(null)
  const initialPageSet = useRef(false)
  const { language, setLanguage, t } = useTranslation()

  // Bootstrap session from storage, then subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
      if (!session) {
        setProfile(null)
        initialPageSet.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever session user changes
  useEffect(() => {
    if (!session?.user) return
    supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setProfile(
          data ?? { role: 'employee', display_name: session.user.email ?? '' }
        )
      })
  }, [session?.user?.id])

  // Set initial page once after profile loads, and handle Google OAuth redirect
  useEffect(() => {
    if (!profile) return

    if (!initialPageSet.current) {
      initialPageSet.current = true
      const notification = readGoogleNotificationFromUrl()
      if (notification) {
        setGoogleNotification(notification)
        if (profile.role === 'admin') {
          setActivePage('settings')
        }
        window.history.replaceState({}, '', window.location.pathname)
      } else {
        setActivePage(profile.role === 'admin' ? 'dashboard' : 'orders')
      }
    }
  }, [profile])

  // Still resolving session
  if (session === undefined) {
    return null
  }

  if (!session) {
    return <LoginScreen />
  }

  // Session exists but profile not yet loaded
  if (!profile) {
    return null
  }

  const role = profile.role
  const displayName = profile.display_name || session.user.email || ''
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isEmployee = role === 'employee'

  const availablePages = isAdmin ? ADMIN_PAGES : RESTRICTED_PAGES

  const roleBadgeLabel = isAdmin
    ? t('auth.adminLabel')
    : isManager
    ? t('auth.managerLabel')
    : t('auth.accessOrdersOnly')

  const roleLabel = isAdmin
    ? t('auth.adminLabel')
    : isManager
    ? t('auth.managerLabel')
    : t('auth.employeeLabel')

  async function handleLogout() {
    await supabase.auth.signOut()
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
          <span className="badge badge-neutral">{roleBadgeLabel}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} type="button">
            {t('auth.signOut')}
          </button>
          <div className="nav-user">
            <div className="nav-user-meta">
              <span className="nav-user-name">{displayName}</span>
              <span className="nav-user-role">{roleLabel}</span>
            </div>
            <div className="nav-avatar">{getInitials(displayName)}</div>
          </div>
        </div>
      </nav>

      {activePage === 'dashboard' && isAdmin && <Dashboard onNavigate={setActivePage} />}
      {activePage === 'services' && isAdmin && <Services />}
      {activePage === 'customers' && isAdmin && <Customers />}
      {activePage === 'orders' && (
        <Orders
          role={role}
          currentUserId={session.user.id}
          canEdit={isAdmin || isManager}
          canDelete={isAdmin}
          showCustomer={!isEmployee}
          showPrice={!isEmployee}
          employeeName={displayName}
        />
      )}
      {activePage === 'invoices' && isAdmin && <Invoices />}
      {activePage === 'settings' && isAdmin && (
        <Settings
          googleNotification={googleNotification}
          onClearNotification={() => setGoogleNotification(null)}
        />
      )}
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
