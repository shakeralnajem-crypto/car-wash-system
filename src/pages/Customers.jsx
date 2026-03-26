import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'

const CUSTOMERS_STORAGE_KEY = 'app-customers'

const INITIAL_CUSTOMERS = [
  { id: 1, code: '1001', name: 'James Carter', email: 'james@example.com', phone: '(555) 201-3344', address: '88 Maple Drive, Austin TX', visits: 14, joined: 'Jan 2024', status: 'Active' },
  { id: 2, code: '1002', name: 'Sarah Mitchell', email: 'sarah@example.com', phone: '(555) 408-7721', address: '210 Cedar Lane, Round Rock TX', visits: 8, joined: 'Mar 2024', status: 'Active' },
  { id: 3, code: '1003', name: 'David Lee', email: 'david@example.com', phone: '(555) 310-5599', address: '34 Elm Street, Austin TX', visits: 22, joined: 'Nov 2023', status: 'Active' },
  { id: 4, code: '1004', name: 'Emma Wilson', email: 'emma@example.com', phone: '(555) 714-8832', address: '555 Willow Blvd, Pflugerville TX', visits: 3, joined: 'Jun 2024', status: 'Active' },
  { id: 5, code: '1005', name: 'Ryan Torres', email: 'ryan@example.com', phone: '(555) 619-2240', address: '19 Pine Court, Austin TX', visits: 11, joined: 'Feb 2024', status: 'Active' },
  { id: 6, code: '1006', name: 'Olivia Brown', email: 'olivia@example.com', phone: '(555) 512-6673', address: '647 Sunset Drive, Austin TX', visits: 5, joined: 'May 2024', status: 'Inactive' },
  { id: 7, code: '1007', name: 'Ethan Martinez', email: 'ethan@example.com', phone: '(555) 213-4410', address: '720 Oak Avenue, Kyle TX', visits: 18, joined: 'Dec 2023', status: 'Active' },
  { id: 8, code: '1008', name: 'Ava Thompson', email: 'ava@example.com', phone: '(555) 917-3355', address: '311 Birch Road, Buda TX', visits: 7, joined: 'Apr 2024', status: 'Active' },
]

const EMPTY_FORM = { code: '', name: '', email: '', phone: '', address: '', status: 'Active' }

function loadCustomers() {
  if (typeof window === 'undefined') return INITIAL_CUSTOMERS

  try {
    const storedCustomers = window.localStorage.getItem(CUSTOMERS_STORAGE_KEY)
    return storedCustomers ? JSON.parse(storedCustomers) : INITIAL_CUSTOMERS
  } catch {
    return INITIAL_CUSTOMERS
  }
}

function getNextCustomerCode(customers) {
  const highestCode = customers.reduce((maxCode, customer) => {
    const parsedCode = Number(customer.code)
    return Number.isFinite(parsedCode) ? Math.max(maxCode, parsedCode) : maxCode
  }, 1000)

  return String(highestCode + 1)
}

function formatJoinedDate(value, language) {
  const parsed = new Date(`1 ${value}`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function Avatar({ name }) {
  const initials = name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--primary-light)',
      color: 'var(--primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function CustomerModal({ customer, onSave, onClose, isNew = false }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(customer ? { ...customer } : { ...EMPTY_FORM })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {isNew ? t('pages.customers.addCustomerTitle') : t('pages.customers.editCustomer')}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">{t('common.customerCode')}</label>
              <input className="form-input" value={form.code} readOnly />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {t('pages.customers.autoCodeHint')}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('pages.customers.fullName')}</label>
              <input
                className="form-input"
                placeholder={t('pages.customers.fullNamePlaceholder')}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.email')}</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder={t('pages.customers.emailPlaceholder')}
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.phone')}</label>
                <input
                  className="form-input"
                  placeholder={t('pages.customers.phonePlaceholder')}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.address')}</label>
              <input
                className="form-input"
                placeholder={t('pages.customers.addressPlaceholder')}
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.status')}</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Active">{t('statuses.customer.Active')}</option>
                <option value="Inactive">{t('statuses.customer.Inactive')}</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('pages.customers.saveCustomer')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerView({ customer, onClose, onEdit }) {
  const { language, t } = useTranslation()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('pages.customers.customerDetails')}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <Avatar name={customer.name} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{customer.name}</div>
              <span className={`badge ${customer.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                {t(`statuses.customer.${customer.status}`)}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: t('common.customerCode'), value: customer.code },
              { label: t('common.email'), value: customer.email },
              { label: t('common.phone'), value: customer.phone },
              { label: t('common.address'), value: customer.address },
              { label: t('common.joined'), value: formatJoinedDate(customer.joined, language) },
              { label: t('common.visits'), value: customer.visits },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ width: 90, color: 'var(--text-muted)', fontSize: 13 }}>{row.label}</span>
                <span style={{ fontWeight: 500 }}>{row.value || t('common.noData')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
          <button className="btn btn-primary" onClick={onEdit}>{t('common.edit')}</button>
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const { language, t } = useTranslation()
  const [customers, setCustomers] = useState(() => loadCustomers())
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers))
    }
  }, [customers])

  const filtered = customers.filter(customer =>
    customer.code.includes(search) ||
    customer.name.toLowerCase().includes(search.toLowerCase()) ||
    customer.email.toLowerCase().includes(search.toLowerCase())
  )

  function handleSave(form) {
    if (modal === 'add') {
      const locale = language === 'sv' ? 'sv-SE' : 'en-US'
      const joined = new Date().toLocaleDateString(locale, { month: 'short', year: 'numeric' })
      setCustomers(prev => [...prev, { ...form, id: Date.now(), visits: 0, joined }])
    } else {
      setCustomers(prev => prev.map(customer => (
        customer.id === modal.customer.id ? { ...customer, ...form } : customer
      )))
    }
    setModal(null)
  }

  function handleDelete(id) {
    if (window.confirm(t('pages.customers.deleteConfirm'))) {
      setCustomers(prev => prev.filter(customer => customer.id !== id))
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.customers.title')}</div>
          <div className="page-subtitle">{t('pages.customers.subtitle')(customers.length)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>{t('pages.customers.addCustomer')}</button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <span className="table-toolbar-title">{t('pages.customers.allCustomers')}</span>
          <input
            className="search-input"
            type="text"
            placeholder={t('pages.customers.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <table className="customers-table data-table">
          <thead>
            <tr>
              <th>{t('common.customerCode')}</th>
              <th>{t('common.customer')}</th>
              <th>{t('common.phone')}</th>
              <th>{t('common.visits')}</th>
              <th>{t('common.joined')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(customer => (
              <tr key={customer.id}>
                <td style={{ fontWeight: 600 }}>#{customer.code}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={customer.name} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{customer.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customer.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{customer.phone}</td>
                <td style={{ fontWeight: 500 }}>{customer.visits}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatJoinedDate(customer.joined, language)}</td>
                <td>
                  <span className={`badge ${customer.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                    {t(`statuses.customer.${customer.status}`)}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'view', customer })}>{t('common.view')}</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', customer })}>{t('common.edit')}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(customer.id)}>{t('common.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {t('pages.customers.noCustomers')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'add' && (
        <CustomerModal
          onSave={handleSave}
          onClose={() => setModal(null)}
          customer={{ ...EMPTY_FORM, code: getNextCustomerCode(customers) }}
          isNew
        />
      )}

      {modal?.mode === 'view' && (
        <CustomerView
          customer={modal.customer}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', customer: modal.customer })}
        />
      )}

      {modal?.mode === 'edit' && (
        <CustomerModal customer={modal.customer} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
