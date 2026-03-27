import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { supabase } from '../supabase'

const STATUS_BADGE = {
  Completed:   'badge-success',
  'In Progress': 'badge-info',
  Pending:     'badge-warning',
  Cancelled:   'badge-danger',
}

function safeStatus(status) {
  return STATUS_BADGE[status] ? status : 'Pending'
}

export default function Dashboard({ onNavigate }) {
  const { formatCurrency, language, t } = useTranslation()

  const [stats, setStats] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [topServices, setTopServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)

      const today = new Date().toISOString().split('T')[0]

      // Run all queries in parallel
      const [
        revenueRes,
        ordersTodayRes,
        pendingRes,
        activeCustomersRes,
        recentRes,
        allServicesRes,
      ] = await Promise.all([
        supabase.from('orders').select('price').eq('status', 'Completed'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('orders').select('id, customer, employee, service, status, price').order('id', { ascending: false }).limit(5),
        supabase.from('orders').select('service'),
      ])

      const revenue = (revenueRes.data || []).reduce((sum, o) => sum + (Number(o.price) || 0), 0)

      setStats({
        revenue,
        ordersToday:      ordersTodayRes.count ?? 0,
        pendingOrders:    pendingRes.count ?? 0,
        activeCustomers:  activeCustomersRes.count ?? 0,
      })

      setRecentOrders(Array.isArray(recentRes.data) ? recentRes.data : [])

      // Compute top services from raw order data
      const serviceCounts = {}
      for (const row of (allServicesRes.data || [])) {
        if (row.service) serviceCounts[row.service] = (serviceCounts[row.service] || 0) + 1
      }
      const maxCount = Math.max(...Object.values(serviceCounts), 1)
      const sorted = Object.entries(serviceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([name, count]) => ({ name, count, pct: Math.round((count / maxCount) * 100) }))
      setTopServices(sorted)

      setLoading(false)
    }

    fetchAll()
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">{t('pages.dashboard.title')}</div>
            <div className="page-subtitle">{t('pages.dashboard.subtitle')}</div>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('orders')}>
            {t('pages.dashboard.newOrder')}
          </button>
        </div>
        <p style={{ color: 'var(--text-muted)', padding: '48px 0' }}>{t('common.loading')}...</p>
      </div>
    )
  }

  const statCards = [
    { labelKey: 'revenue',          value: formatCurrency(stats.revenue, language) },
    { labelKey: 'ordersToday',      value: stats.ordersToday },
    { labelKey: 'activeCustomers',  value: stats.activeCustomers },
    { labelKey: 'pendingOrders',    value: stats.pendingOrders },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.dashboard.title')}</div>
          <div className="page-subtitle">{t('pages.dashboard.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={() => onNavigate('orders')}>
          {t('pages.dashboard.newOrder')}
        </button>
      </div>

      <div className="stats-grid">
        {statCards.map(card => (
          <div className="stat-card" key={card.labelKey}>
            <div className="stat-label">{t(`pages.dashboard.stats.${card.labelKey}`)}</div>
            <div className="stat-value">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="two-col-grid">
        {/* Recent orders */}
        <div className="table-wrap">
          <div className="table-toolbar">
            <span className="table-toolbar-title">{t('pages.dashboard.recentOrders')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('orders')}>
              {t('pages.dashboard.viewAll')}
            </button>
          </div>
          <div className="recent-orders-scroll">
            {recentOrders.length === 0 ? (
              <p style={{ padding: '32px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
                {t('pages.orders.noOrders')}
              </p>
            ) : (
              <table className="dashboard-table data-table">
                <thead>
                  <tr>
                    <th>{t('common.customer')}</th>
                    <th>{t('common.seller')}</th>
                    <th>{t('common.service')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => {
                    const status = safeStatus(order.status)
                    return (
                      <tr key={order.id}>
                        <td>{order.customer || '—'}</td>
                        <td>{order.employee || '—'}</td>
                        <td>{order.service || '—'}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[status]}`}>
                            {t(`statuses.order.${status}`)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(Number(order.price) || 0, language)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Top services */}
        <div className="table-wrap">
          <div className="table-toolbar">
            <span className="table-toolbar-title">{t('pages.dashboard.topServices')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('services')}>
              {t('common.manage')}
            </button>
          </div>
          <div className="panel-stack">
            {topServices.length === 0 ? (
              <p style={{ padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                {t('pages.orders.noOrders')}
              </p>
            ) : topServices.map(service => (
              <div key={service.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>{t(`services.${service.name}`) || service.name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {service.count} {t('pages.dashboard.ordersCount')}
                  </span>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${service.pct}%`, background: 'var(--primary)', height: '100%', borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
