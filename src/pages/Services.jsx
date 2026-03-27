import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n'
import { supabase } from '../supabase'

const INITIAL_SERVICES = []

const EMPTY_FORM = { name: '', default_price: '' }

function ServiceModal({ service, onSave, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(service ? { name: service.name || '', default_price: service.default_price ?? '' } : { ...EMPTY_FORM })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const name = (form.name || '').trim()
    const default_price = Number(form.default_price)

    if (!name) return
    if (Number.isNaN(default_price) || default_price < 0) return

    onSave({ name, default_price })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {service ? t('pages.services.editService') : t('pages.services.addServiceTitle')}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.services.serviceName')}</label>
                <input
                  className="form-input"
                  placeholder={t('pages.services.serviceNamePlaceholder')}
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Default Price</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.default_price}
                  onChange={e => set('default_price', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">{t('pages.services.saveService')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Services() {
  const { formatCurrency, language, t } = useTranslation()
  const [services, setServices] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetchServices() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Failed to fetch services:', fetchError)
      setError(fetchError.message || 'Failed to load services')
      setServices([])
    } else {
      setServices(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const filtered = services.filter(service =>
    service.name?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(form) {
    const name = (form.name || '').trim()
    if (!name) {
      setError('Service name cannot be empty')
      return
    }

    const exists = services.some(service => service.name?.toLowerCase() === name.toLowerCase() && service.id !== (modal?.id || null))
    if (exists) {
      setError('Service name already exists')
      return
    }

    setError(null)

    if (modal === 'add') {
      const payload = { name, default_price: form.default_price }
      const { data, error: insertError } = await supabase
        .from('services')
        .insert([payload])
        .select()

      console.log('payload:', payload)
      console.log('error:', insertError)

      if (insertError) {
        setError(insertError.message)
        return
      }

      if (data && data.length) {
        setModal(null)
        await fetchServices()
      }
    } else {
      const id = modal?.id
      if (!id) {
        setError('Invalid service id')
        return
      }

      const payload = { name, default_price: form.default_price }
      const { data, error: updateError } = await supabase
        .from('services')
        .update(payload)
        .eq('id', id)
        .select()

      console.log('payload:', payload)
      console.log('error:', updateError)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setModal(null)
      await fetchServices()
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('pages.services.deleteConfirm'))) return

    const { error: deleteError } = await supabase
      .from('services')
      .delete()
      .eq('id', id)

    console.log('error:', deleteError)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await fetchServices()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.services.title')}</div>
          <div className="page-subtitle">{t('pages.services.subtitle')(services.length)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>{t('pages.services.addService')}</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          className="search-input"
          type="text"
          placeholder={t('pages.services.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={loading}
        />
      </div>

      {loading && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t('common.loading')}...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', marginBottom: 16, border: '1px solid var(--danger)', background: 'var(--danger-background)' }}>
          {error}
        </div>
      )}

      <div className="services-grid">
        {filtered.map(service => {
          const display = {
            id: service.id,
            name: service.name || '',
            icon: service.name ? service.name.slice(0, 2).toUpperCase() : 'SV',
            desc: service.desc || '',
            price: service.default_price != null ? service.default_price : 0,
            duration: service.duration || '',
            status: service.status || 'Active',
          }

          return (
            <div className="service-card" key={display.id || display.name}>
              <div className="service-card-header">
                <div className="service-icon">{display.icon}</div>
              </div>
              <div className="service-name">{display.name}</div>
              <div className="service-footer">
                <div>
                  <div className="service-price">{formatCurrency(display.price, language)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal({ ...service, name: service.name || '' })}>{t('common.edit')}</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(service.id)}>{t('common.delete')}</button>
                </div>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>{t('pages.services.noServices')}</p>
          </div>
        )}
      </div>

      {modal && (
        <ServiceModal
          service={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
