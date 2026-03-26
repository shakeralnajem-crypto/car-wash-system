import { useState } from 'react'
import { useTranslation } from '../i18n'

const INITIAL_SERVICES = [
  { id: 1, icon: 'BW', name: 'Basic Wash', desc: 'Exterior hand wash, rinse, and air dry.', price: 25, duration: '20 min', status: 'Active' },
  { id: 2, icon: 'PW', name: 'Premium Wash', desc: 'Full exterior wash with wax coating and tire shine.', price: 45, duration: '40 min', status: 'Active' },
  { id: 3, icon: 'IC', name: 'Interior Clean', desc: 'Full interior vacuum, dashboard wipe, glass cleaning.', price: 60, duration: '50 min', status: 'Active' },
  { id: 4, icon: 'FD', name: 'Full Detail', desc: 'Complete interior and exterior detailing. Showroom quality.', price: 89, duration: '90 min', status: 'Active' },
  { id: 5, icon: 'TR', name: 'Tire & Rim Clean', desc: 'Deep cleaning of tires and rims.', price: 30, duration: '25 min', status: 'Active' },
  { id: 6, icon: 'HR', name: 'Headlight Restore', desc: 'Restore cloudy headlights to like-new clarity.', price: 35, duration: '30 min', status: 'Inactive' },
]

const EMPTY_FORM = { icon: 'SV', name: '', desc: '', price: '', duration: '', status: 'Active' }

function ServiceModal({ service, onSave, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(service ? { ...service } : { ...EMPTY_FORM })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, price: Number(form.price) })
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
              <div className="form-group" style={{ flex: '0 0 70px' }}>
                <label className="form-label">{t('pages.services.icon')}</label>
                <input
                  className="form-input"
                  style={{ textAlign: 'center', fontSize: 20 }}
                  value={form.icon}
                  onChange={e => set('icon', e.target.value)}
                  maxLength={2}
                />
              </div>
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
            <div className="form-group">
              <label className="form-label">{t('pages.services.description')}</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder={t('pages.services.descriptionPlaceholder')}
                value={form.desc}
                onChange={e => set('desc', e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.services.priceLabel')}</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.services.duration')}</label>
                <input
                  className="form-input"
                  placeholder={t('pages.services.durationPlaceholder')}
                  value={form.duration}
                  onChange={e => set('duration', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.status')}</label>
                <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="Active">{t('statuses.service.Active')}</option>
                  <option value="Inactive">{t('statuses.service.Inactive')}</option>
                </select>
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
  const [services, setServices] = useState(INITIAL_SERVICES)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const filtered = services.filter(service =>
    service.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleSave(form) {
    if (modal === 'add') {
      setServices(prev => [...prev, { ...form, id: Date.now() }])
    } else {
      setServices(prev => prev.map(service => service.id === modal.id ? { ...service, ...form } : service))
    }
    setModal(null)
  }

  function handleDelete(id) {
    if (window.confirm(t('pages.services.deleteConfirm'))) {
      setServices(prev => prev.filter(service => service.id !== id))
    }
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
        />
      </div>

      <div className="services-grid">
        {filtered.map(service => (
          <div className="service-card" key={service.id}>
            <div className="service-card-header">
              <div className="service-icon">{service.icon}</div>
              <span className={`badge ${service.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                {t(`statuses.service.${service.status}`)}
              </span>
            </div>
            <div className="service-name">{t(`services.${service.name}`)}</div>
            <div className="service-desc">{t(`serviceDescriptions.${service.name}`)}</div>
            <div className="service-footer">
              <div>
                <div className="service-price">{formatCurrency(service.price, language)}</div>
                <div className="service-duration">{service.duration}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal(service)}>{t('common.edit')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(service.id)}>{t('common.delete')}</button>
              </div>
            </div>
          </div>
        ))}

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
