import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useTranslation } from '../i18n'

function PasswordResetRequests() {
  const { t, language } = useTranslation()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('password_reset_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function markResolved(id) {
    await supabase
      .from('password_reset_requests')
      .update({ status: 'resolved' })
      .eq('id', id)
    fetchRequests()
  }

  useEffect(() => { fetchRequests() }, [])

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status === 'resolved')

  return (
    <div className="table-wrap" style={{ maxWidth: 640, marginTop: 24 }}>
      <div className="table-toolbar">
        <span className="table-toolbar-title">
          {t('settings.passwordReset.sectionTitle')}
          {pending.length > 0 && (
            <span className="badge badge-warning" style={{ marginLeft: 8 }}>
              {pending.length} {t('settings.passwordReset.pending')}
            </span>
          )}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={fetchRequests}>
          {t('common.refresh')}
        </button>
      </div>
      <div style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('common.loading')}...</p>
        ) : requests.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('settings.passwordReset.noRequests')}</p>
        ) : (
          [...pending, ...resolved].map(req => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{req.display_name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                  {new Date(req.created_at).toLocaleString(language === 'sv' ? 'sv-SE' : 'en-US')}
                </span>
              </div>
              <span className={`badge ${req.status === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                {req.status === 'pending'
                  ? t('settings.passwordReset.statusPending')
                  : t('settings.passwordReset.statusResolved')}
              </span>
              {req.status === 'pending' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => markResolved(req.id)}
                >
                  {t('settings.passwordReset.markResolved')}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function Settings({ googleNotification, onClearNotification }) {
  const { t } = useTranslation()
  const [connection, setConnection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchConnection()
  }, [])

  useEffect(() => {
    if (googleNotification?.type === 'success') {
      fetchConnection()
    }
  }, [googleNotification])

  async function fetchConnection() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    if (!currentUserId) {
      setConnection(null)
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('google_connections')
      .select('status, google_email, expiry_date')
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (fetchError) {
      console.error('Failed to fetch Google connection:', fetchError)
      setConnection(null)
    } else {
      setConnection(data ?? null)
    }
    setLoading(false)
  }

  async function handleConnect() {
    setConnecting(true)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        setError('No session')
        setConnecting(false)
        return
      }

      const { data, error } = await supabase.functions.invoke('google-connect', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (error || !data?.url) {
        setError(error?.message || 'Failed to get URL')
        setConnecting(false)
        return
      }

      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setConnecting(false)
    }
  }

  const isConnected = connection?.status === 'connected'

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('settings.title')}</div>
          <div className="page-subtitle">{t('settings.subtitle')}</div>
        </div>
      </div>

      {googleNotification && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: googleNotification.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
          color: googleNotification.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
        }}>
          <span>
            {googleNotification.type === 'success'
              ? `${t('settings.google.successPrefix')}${googleNotification.email ? ` — ${googleNotification.email}` : ''}${googleNotification.calendarOk ? '' : ` ${t('settings.google.calendarTestFailed')}`}`
              : `${t('settings.google.errorPrefix')} — ${googleNotification.reason ?? t('common.unknown')}`}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={onClearNotification}
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      <div className="table-wrap" style={{ maxWidth: 560 }}>
        <div className="table-toolbar">
          <span className="table-toolbar-title">{t('settings.google.sectionTitle')}</span>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('common.loading')}...</p>
          ) : isConnected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-success">{t('settings.google.connected')}</span>
                {connection.google_email && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {connection.google_email}
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {t('settings.google.changeHint')}
              </p>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
              <button
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={handleConnect}
                disabled={connecting}
                type="button"
              >
                {connecting ? t('settings.google.connecting') : t('settings.google.reconnect')}
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {t('settings.google.notConnected')}
              </p>
              {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
              <button
                className="btn btn-primary btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={handleConnect}
                disabled={connecting}
                type="button"
              >
                {connecting ? t('settings.google.connecting') : t('settings.google.connect')}
              </button>
            </>
          )}
        </div>
      </div>

      <PasswordResetRequests />
    </div>
  )
}
