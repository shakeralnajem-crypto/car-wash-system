import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import { supabase } from '../supabase'

const EMPTY_FORM = { code: '', name: '', email: '', phone: '', address: '', status: 'Active' }

function getNextCode(customers) {
  const max = customers.reduce((m, c) => {
    const n = Number(c.code)
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 1000)
  return String(max + 1)
}

function formatCreatedAt(value, language) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function Avatar({ name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'var(--primary-light)', color: 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function CustomerModal({ customer, onSave, onClose, isNew = false }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(customer ? { ...customer } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '...' : t('pages.customers.saveCustomer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CustomerView({ customer, onClose, onEdit, language }) {
  const { t } = useTranslation()
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
              { label: t('common.email'),         value: customer.email },
              { label: t('common.phone'),          value: customer.phone },
              { label: t('common.address'),        value: customer.address },
              { label: t('common.joined'),         value: formatCreatedAt(customer.created_at, language) },
              { label: t('common.visits'),         value: customer.visits },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ width: 90, color: 'var(--text-muted)', fontSize: 13 }}>{row.label}</span>
                <span style={{ fontWeight: 500 }}>{row.value ?? t('common.noData')}</span>
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
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  async function fetchCustomers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Failed to fetch customers:', error)
      setCustomers([])
    } else {
      setCustomers(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return (
      String(c.code || '').includes(search) ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  })

  async function handleSave(form) {
    if (modal === 'add') {
      const { error } = await supabase.from('customers').insert([{
        code:    form.code,
        name:    form.name,
        email:   form.email || '',
        phone:   form.phone || '',
        address: form.address || '',
        status:  form.status,
        visits:  0,
      }])
      if (error) { console.error('Insert customer error:', error); return }
    } else {
      const { error } = await supabase
        .from('customers')
        .update({
          name:    form.name,
          email:   form.email || '',
          phone:   form.phone || '',
          address: form.address || '',
          status:  form.status,
        })
        .eq('id', modal.customer.id)
      if (error) { console.error('Update customer error:', error); return }
    }
    await fetchCustomers()
    setModal(null)
  }

  async function handleDelete(id) {
    if (!window.confirm(t('pages.customers.deleteConfirm'))) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { console.error('Delete customer error:', error); return }
    await fetchCustomers()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.customers.title')}</div>
          <div className="page-subtitle">{t('pages.customers.subtitle')(customers.length)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>
          {t('pages.customers.addCustomer')}
        </button>
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
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {t('common.loading')}...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {t('pages.customers.noCustomers')}
                </td>
              </tr>
            ) : filtered.map(customer => (
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
                <td style={{ color: 'var(--text-muted)' }}>{customer.phone || '—'}</td>
                <td style={{ fontWeight: 500 }}>{customer.visits}</td>
                <td style={{ color: 'var(--text-muted)' }}>{formatCreatedAt(customer.created_at, language)}</td>
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
          </tbody>
        </table>
      </div>

      {modal === 'add' && (
        <CustomerModal
          isNew
          customer={{ ...EMPTY_FORM, code: getNextCode(customers) }}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.mode === 'view' && (
        <CustomerView
          customer={modal.customer}
          language={language}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', customer: modal.customer })}
        />
      )}

      {modal?.mode === 'edit' && (
        <CustomerModal
          customer={modal.customer}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
