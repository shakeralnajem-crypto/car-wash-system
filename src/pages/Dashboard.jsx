import { useTranslation } from '../i18n'

const stats = [
  { key: 'revenue', value: 12480, trend: 'up' },
  { key: 'ordersToday', value: '34', trend: 'up' },
  { key: 'activeCustomers', value: '218', trend: 'up' },
  { key: 'pendingOrders', value: '7', trend: 'down' },
]

const recentOrders = [
  { id: '#1042', customer: 'James Carter', service: 'Full Detail', status: 'Completed', amount: 89 },
  { id: '#1041', customer: 'Sarah Mitchell', service: 'Basic Wash', status: 'In Progress', amount: 25 },
  { id: '#1040', customer: 'David Lee', service: 'Premium Wash', status: 'Completed', amount: 45 },
  { id: '#1039', customer: 'Emma Wilson', service: 'Interior Clean', status: 'Pending', amount: 60 },
  { id: '#1038', customer: 'Ryan Torres', service: 'Basic Wash', status: 'Completed', amount: 25 },
]

const STATUS_BADGE = {
  Completed: 'badge-success',
  'In Progress': 'badge-info',
  Pending: 'badge-warning',
  Cancelled: 'badge-danger',
}

const topServices = [
  { name: 'Basic Wash', count: 142, pct: 78 },
  { name: 'Premium Wash', count: 98, pct: 54 },
  { name: 'Full Detail', count: 65, pct: 36 },
  { name: 'Interior Clean', count: 44, pct: 24 },
]

export default function Dashboard({ onNavigate }) {
  const { formatCurrency, language, t } = useTranslation()

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
        {stats.map(stat => (
          <div className="stat-card" key={stat.key}>
            <div className="stat-label">{t(`pages.dashboard.stats.${stat.key}`)}</div>
            <div className="stat-value">{stat.key === 'revenue' ? formatCurrency(stat.value, language) : stat.value}</div>
            <div className={`stat-change ${stat.trend}`}>{t(`pages.dashboard.stats.${stat.key}Change`)}</div>
          </div>
        ))}
      </div>

      <div className="two-col-grid">
        <div className="table-wrap">
          <div className="table-toolbar">
            <span className="table-toolbar-title">{t('pages.dashboard.recentOrders')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('orders')}>
              {t('pages.dashboard.viewAll')}
            </button>
          </div>
          <div className="recent-orders-scroll">
            <table className="dashboard-table data-table">
              <thead>
                <tr>
                  <th>{t('pages.orders.orderId')}</th>
                  <th>{t('common.customer')}</th>
                  <th>{t('common.service')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 500 }}>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{t(`services.${order.service}`)}</td>
                    <td><span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`statuses.order.${order.status}`)}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(order.amount, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-wrap">
          <div className="table-toolbar">
            <span className="table-toolbar-title">{t('pages.dashboard.topServices')}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('services')}>
              {t('common.manage')}
            </button>
          </div>
          <div className="panel-stack">
            {topServices.map(service => (
              <div key={service.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>{t(`services.${service.name}`)}</span>
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
