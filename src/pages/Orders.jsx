import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n'
import { supabase } from '../supabase'

const CUSTOMERS_STORAGE_KEY = 'app-customers'
const EMPLOYEE_OPTIONS = [
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


const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled']
const FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Cancelled']

const STATUS_BADGE = {
  Completed: 'badge-success',
  'In Progress': 'badge-info',
  Pending: 'badge-warning',
  Cancelled: 'badge-danger',
}

const EMPTY_FORM = { customer: '', employee: '', vehicle: '', service: '', price: '', date: '', time: '', status: 'Pending' }

function loadCustomers() {
  if (typeof window === 'undefined') return []

  try {
    const storedCustomers = window.localStorage.getItem(CUSTOMERS_STORAGE_KEY)
    return storedCustomers ? JSON.parse(storedCustomers) : []
  } catch {
    return []
  }
}

function getFilterLabel(filter, t) {
  return filter === 'All' ? t('statuses.order.all') : t(`statuses.order.${filter}`)
}

function formatOrderDate(dateValue, language) {
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return dateValue
  return parsed.toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatOrderTime(timeValue, language) {
  const parsed = new Date(`2000-01-01T${timeValue.replace(' ', '')}`)
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(`2000-01-01 ${timeValue}`)
    if (Number.isNaN(fallback.getTime())) return timeValue
    return fallback.toLocaleTimeString(language === 'sv' ? 'sv-SE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return parsed.toLocaleTimeString(language === 'sv' ? 'sv-SE' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrderModal({ order, onSave, onClose, showCustomer, showPrice, customers, services, servicesError }) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState(order
    ? { ...order, vehicle: order.vehicle || order.plate_number || '' }
    : { ...EMPTY_FORM, customerCode: '', date: today }
  )
  const [customerSearch, setCustomerSearch] = useState('')

  const matchingCustomers = showCustomer && customerSearch.trim()
    ? customers.filter(customer => {
        const query = customerSearch.trim().toLowerCase()
        return (
          String(customer.code || '').includes(customerSearch.trim()) ||
          customer.name.toLowerCase().includes(query) ||
          (customer.phone || '').toLowerCase().includes(query) ||
          (customer.email || '').toLowerCase().includes(query) ||
          (customer.address || '').toLowerCase().includes(query)
        )
      }).slice(0, 6)
    : []

  function selectCustomer(customer) {
    setCustomerSearch('')
    setForm(prev => ({
      ...prev,
      customerCode: customer.code,
      customer: customer.name,
    }))
  }

  function set(field, value) {
    setForm(prev => {
      if (field === 'customerCode') {
        const selectedCustomer = customers.find(customer => customer.code === value)
        return {
          ...prev,
          customerCode: value,
          customer: selectedCustomer?.name || prev.customer,
        }
      }

      return { ...prev, [field]: value }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (showCustomer && !form.customer.trim()) return
    onSave({ ...form, price: showPrice ? Number(form.price) : Number(form.price) || 0 })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {order ? `${t('pages.orders.editOrder')} #${order.id}` : t('pages.orders.newOrder')}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {showCustomer ? (
              <>
                <div className="form-group">
                  <label className="form-label">{t('pages.orders.customerSearch')}</label>
                  <input
                    className="form-input"
                    placeholder={t('pages.orders.customerSearchPlaceholder')}
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                  />
                  {matchingCustomers.length > 0 ? (
                    <div className="lookup-results">
                      {matchingCustomers.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          className="lookup-result"
                          onClick={() => selectCustomer(customer)}
                        >
                          {customer.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">{t('pages.orders.customerName')}</label>
                    <input
                      className="form-input"
                      value={form.customer}
                      onChange={e => set('customer', e.target.value)}
                      placeholder={t('pages.orders.fullName')}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">{t('common.customerCode')}</label>
                    <select className="form-input" value={form.customerCode || ''} onChange={e => set('customerCode', e.target.value)}>
                      <option value="">{t('pages.orders.customerCodePlaceholder')}</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.code}>
                          {customer.code} - {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">{t('common.employee')}</label>
                    <select className="form-input" value={form.employee} onChange={e => set('employee', e.target.value)}>
                      <option value="">{t('pages.orders.employeePlaceholder')}</option>
                      {EMPLOYEE_OPTIONS.map(employee => <option key={employee} value={employee}>{employee}</option>)}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t('common.employee')}</label>
                  <select className="form-input" value={form.employee} onChange={e => set('employee', e.target.value)}>
                    <option value="">{t('pages.orders.employeePlaceholder')}</option>
                    {EMPLOYEE_OPTIONS.map(employee => <option key={employee} value={employee}>{employee}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Plate Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. ABC-123 or e.g. 12345"
                  value={form.vehicle}
                  onChange={e => set('vehicle', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.service')}</label>
                {servicesError ? (
                  <div style={{ color: 'var(--danger)', marginBottom: 6 }}>{servicesError}</div>
                ) : null}
                <select
                  className="form-input"
                  value={form.service}
                  onChange={e => {
                    const selectedServiceName = e.target.value
                    const selectedService = services.find(s => s.name === selectedServiceName)
                    set('service', selectedServiceName)
                    if (selectedService) {
                      set('price', selectedService.default_price)
                    }
                  }}
                >
                  {servicesLoading ? (
                    <option value="">{t('common.loading')}...</option>
                  ) : services.length === 0 ? (
                    <option value="">{t('pages.orders.noServices')}</option>
                  ) : (
                    services.map(service => (
                      <option key={service.id} value={service.name}>{service.name}</option>
                    ))
                  )}
                </select>
              </div>
              {showPrice ? (
                <div className="form-group" style={{ flex: '0 0 110px' }}>
                  <label className="form-label">{t('pages.orders.priceLabel')}</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.price}
                    onChange={e => set('price', e.target.value)}
                  />
                </div>
              ) : null}
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.orders.date')}</label>
                <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.orders.time')}</label>
                <input className="form-input" type="time" value={form.time} onChange={e => set('time', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.status')}</label>
                <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(status => <option key={status} value={status}>{t(`statuses.order.${status}`)}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">
              {order ? t('common.saveChanges') : t('pages.orders.createOrder')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OrderView({ order, onClose, onEdit, onStatusChange, canEdit, showCustomer, showPrice }) {
  const { formatCurrency, language, t } = useTranslation()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('pages.orders.orderDetails')} #{order.id}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ...(showCustomer ? [{ label: t('common.customer'), value: order.customer }] : []),
              ...(showCustomer ? [{ label: t('common.customerCode'), value: order.customerCode }] : []),
              { label: t('common.employee'), value: order.employee },
              { label: 'Plate Number', value: order.plate_number || order.vehicle },
              { label: t('common.service'), value: order.service || t('common.noData') },
              ...(showPrice ? [{ label: t('common.price'), value: formatCurrency(order.price, language) }] : []),
              { label: t('pages.orders.date'), value: `${formatOrderDate(order.date, language)} ${formatOrderTime(order.time, language)}` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <span style={{ width: 90, color: 'var(--text-muted)', fontSize: 13 }}>{row.label}</span>
                <span style={{ fontWeight: 500 }}>{row.value || t('common.noData')}</span>
              </div>
            ))}
            <div style={{ display: 'flex', paddingTop: 4 }}>
              <span style={{ width: 90, color: 'var(--text-muted)', fontSize: 13, paddingTop: 6 }}>{t('common.status')}</span>
              {canEdit ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status}
                      className={`btn btn-sm ${order.status === status ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => onStatusChange(order.id, status)}
                    >
                      {t(`statuses.order.${status}`)}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`statuses.order.${order.status}`)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
          {canEdit ? <button className="btn btn-primary" onClick={onEdit}>{t('common.edit')}</button> : null}
        </div>
      </div>
    </div>
  )
}

export default function Orders({ canManage = true }) {
  const { formatCurrency, language, t } = useTranslation()
  const [customers, setCustomers] = useState(() => loadCustomers())
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)

  async function fetchServices() {
    setServicesLoading(true)
    setServicesError(null)

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch services:', error)
      setServicesError(error.message)
      setServices([])
    } else {
      setServices(data || [])
    }

    setServicesLoading(false)
  }

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.error('Failed to fetch orders from Supabase:', error)
      return
    }

    setOrders(data || [])
  }

  useEffect(() => {
    fetchOrders()
    fetchServices()
  }, [])

  const mapOrderToDb = (form) => {
    const payload = {
      customer: form.customer || '',
      plate_number: form.vehicle || form.plate_number || '',
      service: form.service || '',
      employee: form.employee || '',
      price: Number(form.price) || 0,
      status: form.status || 'Pending',
      date: form.date || null,
      time: form.time || null,
    }

    console.log('payload:', payload)
    return payload
  }

  const filtered = orders.filter(order => {
    const normalizedSearch = search.toLowerCase()
    const matchSearch = (
      (canManage && order.customer.toLowerCase().includes(normalizedSearch)) ||
      (canManage && String(order.customerCode || '').includes(search)) ||
      String(order.id).includes(search) ||
      (order.employee || '').toLowerCase().includes(normalizedSearch)
    )
    const matchFilter = filter === 'All' || order.status === filter
    return matchSearch && matchFilter
  })

  async function handleSave(form) {
    try {
      if (modal === 'add') {
        const payload = mapOrderToDb(form)
        console.log('payload:', payload)

        const { data, error } = await supabase.from('orders').insert([payload]).select()
        console.log('error:', error)
        if (error) {
          console.error('Supabase insert error:', error)
          return
        }
        console.log('Supabase insert result:', data)

        if (canManage && form.customerCode) {
          const nextCustomers = customers.map(customer => (
            customer.code === form.customerCode
              ? { ...customer, visits: (Number(customer.visits) || 0) + 1 }
              : customer
          ))

          setCustomers(nextCustomers)

          if (typeof window !== 'undefined') {
            window.localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(nextCustomers))
          }
        }
      } else {
        const orderId = modal?.order?.id
        if (!orderId) {
          console.error('Missing order id for update')
          return
        }

        const payload = mapOrderToDb(form)
        console.log('Supabase update payload:', payload)

        const { data, error: updateError } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', orderId)
          .select()

        if (updateError) {
          console.error('Supabase update error:', updateError)
          return
        }
        console.log('Supabase update result:', data)
      }

      await fetchOrders()
      setModal(null)
    } catch (error) {
      console.error('handleSave error:', error)
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const payload = {
        status,
      }
      console.log('Supabase status update payload:', payload)

      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', id)
        .select()

      if (error) {
        console.error('Supabase status update error:', error)
        return
      }
      console.log('Supabase status update result:', data)

      await fetchOrders()
    } catch (error) {
      console.error('handleStatusChange error:', error)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('pages.orders.deleteConfirm'))) return

    try {
      const { data, error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
        .select()

      if (error) {
        console.error('Supabase delete error:', error)
        return
      }
      console.log('Supabase delete result:', data)

      await fetchOrders()
    } catch (error) {
      console.error('handleDelete error:', error)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.orders.title')}</div>
          <div className="page-subtitle">{t('pages.orders.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('add')}>{t('pages.orders.newOrder')}</button>
      </div>

      <div className="filter-bar">
        {FILTERS.map(status => (
          <button
            key={status}
            className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(status)}
          >
            {getFilterLabel(status, t)}
          </button>
        ))}
      </div>

      <div className="table-wrap orders-table-wrap">
        <div className="table-toolbar">
          <span className="table-toolbar-title">
            {filtered.length} {filter === 'All' ? t('pages.orders.totalOrders') : t(`statuses.order.${filter}`)}
          </span>
          <input
            className="search-input"
            type="text"
            placeholder={canManage ? t('pages.orders.searchPlaceholder') : t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <table className="orders-table">
          <thead>
            <tr>
              <th className="col-order-id">{t('pages.orders.orderId')}</th>
              {canManage ? <th className="col-customer">{t('common.customer')}</th> : null}
              {canManage ? <th className="col-customer-code">{t('common.customerCode')}</th> : null}
              <th className="col-employee">{t('common.employee')}</th>
              <th className="col-vehicle">Plate Number</th>
              <th className="col-service">{t('common.service')}</th>
              <th className="col-date-time">{t('pages.orders.dateTime')}</th>
              <th className="col-status">{t('common.status')}</th>
              {canManage ? <th className="col-price text-right">{t('common.price')}</th> : null}
              <th className="col-actions">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id}>
                <td className="col-order-id" data-label={t('pages.orders.orderId')} style={{ fontWeight: 600 }}>#{order.id}</td>
                {canManage ? <td className="col-customer" data-label={t('common.customer')}>{order.customer}</td> : null}
                {canManage ? <td className="col-customer-code" data-label={t('common.customerCode')}>{order.customerCode ? `#${order.customerCode}` : t('common.noData')}</td> : null}
                <td className="col-employee" data-label={t('common.employee')}>{order.employee || t('common.noData')}</td>
                <td className="col-vehicle" data-label="Plate Number" style={{ color: 'var(--text-muted)' }}>{order.plate_number || order.vehicle}</td>
                <td className="col-service" data-label={t('common.service')}>{t(`services.${order.service}`)}</td>
                <td className="col-date-time" data-label={t('pages.orders.dateTime')} style={{ color: 'var(--text-muted)' }}>
                  <div>{formatOrderDate(order.date, language)}</div>
                  <div style={{ fontSize: 12 }}>{formatOrderTime(order.time, language)}</div>
                </td>
                <td className="col-status" data-label={t('common.status')}><span className={`badge ${STATUS_BADGE[order.status]}`}>{t(`statuses.order.${order.status}`)}</span></td>
                {canManage ? <td className="col-price text-right" data-label={t('common.price')} style={{ fontWeight: 600 }}>{formatCurrency(order.price, language)}</td> : null}
                <td className="col-actions" data-label={t('common.actions')}>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'view', order })}>{t('common.view')}</button>
                    {canManage ? <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', order })}>{t('common.edit')}</button> : null}
                    {canManage ? <button className="btn btn-danger btn-sm" onClick={() => handleDelete(order.id)}>{t('common.delete')}</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 10 : 8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {t('pages.orders.noOrders')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'add' && (
        <OrderModal
          onSave={handleSave}
          onClose={() => setModal(null)}
          showCustomer={canManage}
          showPrice={canManage}
          customers={customers}
          services={services}
          servicesLoading={servicesLoading}
          servicesError={servicesError}
        />
      )}

      {modal?.mode === 'view' && (
        <OrderView
          order={modal.order}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', order: modal.order })}
          canEdit={canManage}
          showCustomer={canManage}
          showPrice={canManage}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status)
            setModal(prev => ({ ...prev, order: { ...prev.order, status } }))
          }}
        />
      )}

      {canManage && modal?.mode === 'edit' && (
        <OrderModal
          order={modal.order}
          onSave={handleSave}
          onClose={() => setModal(null)}
          showCustomer
          showPrice
          customers={customers}
          services={services}
          servicesLoading={servicesLoading}
          servicesError={servicesError}
        />
      )}
    </div>
  )
}
