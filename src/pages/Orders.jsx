import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n'
import { supabase } from '../supabase'

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

const EMPTY_FORM = {
  customer: '',
  customerCode: '',
  employee: '',
  vehicle: '',
  service: '',
  price: '',
  date: '',
  time: '',
  status: 'Pending',
}

// Normalize a raw order/form object so every field is a safe non-null string.
function normalizeForm(raw) {
  return {
    customer: String(raw.customer || ''),
    customerCode: String(raw.customerCode || ''),
    employee: String(raw.employee || ''),
    vehicle: String(raw.vehicle || raw.plate_number || ''),
    service: String(raw.service || ''),
    price: raw.price != null ? String(raw.price) : '',
    date: String(raw.date || ''),
    time: String(raw.time || ''),
    status: String(raw.status || 'Pending'),
  }
}

function getFilterLabel(filter, t) {
  return filter === 'All' ? t('statuses.order.all') : t(`statuses.order.${filter}`)
}

function safeStatus(status) {
  return STATUS_OPTIONS.includes(status) ? status : 'Pending'
}

function formatOrderDate(dateValue, language) {
  if (!dateValue) return '—'
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return String(dateValue)
  return parsed.toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatOrderTime(timeValue, language) {
  if (!timeValue) return '—'
  const safe = String(timeValue).replace(' ', '')
  const parsed = new Date(`2000-01-01T${safe}`)
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(`2000-01-01 ${timeValue}`)
    if (Number.isNaN(fallback.getTime())) return String(timeValue)
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

function OrderModal({
  order,
  onSave,
  onClose,
  showCustomer,
  showPrice,
  employeeName = '',
  lockEmployeeSelection = false,
  customers = [],
  services = [],
  servicesLoading = false,
}) {
  const { t } = useTranslation()
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState(() =>
    order
      ? normalizeForm(order)
      : {
          ...EMPTY_FORM,
          date: today,
          employee: lockEmployeeSelection ? employeeName : '',
        }
  )
  const [customerSearch, setCustomerSearch] = useState('')

  useEffect(() => {
    if (!lockEmployeeSelection) return
    setForm(prev => ({ ...prev, employee: employeeName || prev.employee }))
  }, [employeeName, lockEmployeeSelection])

  const safeCustomers = Array.isArray(customers) ? customers : []
  const safeServices = Array.isArray(services) ? services : []

  const matchingCustomers = showCustomer && customerSearch.trim()
    ? safeCustomers.filter(customer => {
        const query = customerSearch.trim().toLowerCase()
        return (
          String(customer.code || '').includes(customerSearch.trim()) ||
          (customer.name || '').toLowerCase().includes(query) ||
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
      customerCode: String(customer.code || ''),
      customer: String(customer.name || ''),
    }))
  }

  function set(field, value) {
    setForm(prev => {
      if (field === 'customerCode') {
        const matched = safeCustomers.find(c => c.code === value)
        return {
          ...prev,
          customerCode: String(value || ''),
          customer: matched ? String(matched.name || '') : prev.customer,
        }
      }
      return { ...prev, [field]: value }
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (showCustomer && !form.customer.trim()) return
    onSave({
      ...form,
      price: Number(form.price) || 0,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {order ? t('pages.orders.editOrder') : t('pages.orders.newOrder')}
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
                          {customer.name || '—'}
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
                    <select className="form-input" value={form.customerCode} onChange={e => set('customerCode', e.target.value)}>
                      <option value="">{t('pages.orders.customerCodePlaceholder')}</option>
                      {safeCustomers.map(customer => (
                        <option key={customer.id} value={customer.code || ''}>
                          {customer.code || ''} - {customer.name || ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">{t('common.seller')}</label>
                    <select className="form-input" value={form.employee} onChange={e => set('employee', e.target.value)}>
                      <option value="">{t('pages.orders.employeePlaceholder')}</option>
                      {EMPLOYEE_OPTIONS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t('common.seller')}</label>
                  {lockEmployeeSelection ? (
                    <input className="form-input" value={form.employee || employeeName} readOnly />
                  ) : (
                    <select className="form-input" value={form.employee} onChange={e => set('employee', e.target.value)}>
                      <option value="">{t('pages.orders.employeePlaceholder')}</option>
                      {EMPLOYEE_OPTIONS.map(emp => <option key={emp} value={emp}>{emp}</option>)}
                    </select>
                  )}
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.orders.plateNumber')}</label>
                <input
                  className="form-input"
                  placeholder={t('pages.orders.plateNumberPlaceholder')}
                  value={form.vehicle}
                  onChange={e => set('vehicle', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.service')}</label>
                <select
                  className="form-input"
                  value={form.service}
                  onChange={e => {
                    const selectedName = e.target.value
                    const selectedService = safeServices.find(s => (s.name || '') === selectedName)
                    setForm(prev => {
                      const next = { ...prev, service: selectedName }
                      if (selectedService && selectedService.default_price != null) {
                        next.price = String(selectedService.default_price)
                      }
                      return next
                    })
                  }}
                >
                  {servicesLoading ? (
                    <option value="">{t('common.loading')}...</option>
                  ) : safeServices.length === 0 ? (
                    <option value="">{t('pages.orders.noServices')}</option>
                  ) : (
                    <>
                      <option value="">{t('pages.orders.servicePlaceholder')}</option>
                      {safeServices.map(service => (
                        <option key={service.id} value={service.name || ''}>{service.name || ''}</option>
                      ))}
                    </>
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
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{t(`statuses.order.${status}`)}</option>
                  ))}
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
  const status = safeStatus(order.status)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('pages.orders.orderDetails')}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ...(showCustomer ? [{ label: t('common.customer'), value: order.customer }] : []),
              ...(showCustomer ? [{ label: t('common.customerCode'), value: order.customerCode }] : []),
              { label: t('common.seller'), value: order.employee },
              { label: t('pages.orders.plateNumber'), value: order.plate_number || order.vehicle },
              { label: t('common.service'), value: order.service },
              ...(showPrice ? [{ label: t('common.price'), value: formatCurrency(Number(order.price) || 0, language) }] : []),
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
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => onStatusChange(order.id, s)}
                    >
                      {t(`statuses.order.${s}`)}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`badge ${STATUS_BADGE[status] || ''}`}>{t(`statuses.order.${status}`)}</span>
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

export default function Orders({
  role = 'employee',
  currentUserId = '',
  canEdit = true,
  canDelete = true,
  showCustomer = true,
  showPrice = true,
  employeeName = '',
}) {
  const { formatCurrency, language, t } = useTranslation()
  const isEmployeeRole = role === 'employee'
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [services, setServices] = useState([])
  const [employeeProfiles, setEmployeeProfiles] = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)

  async function fetchServices() {
    setServicesLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Failed to fetch services:', error)
      setServices([])
    } else {
      setServices(Array.isArray(data) ? data : [])
    }
    setServicesLoading(false)
  }

  async function fetchOrders() {
    setOrdersLoading(true)
    const orderSelect = isEmployeeRole
      ? 'id, employee, plate_number, service, status, date, time, assigned_employee_id'
      : '*'
    let query = supabase
      .from('orders')
      .select(orderSelect)
      .order('id', { ascending: false })
    if (isEmployeeRole && currentUserId) {
      query = query.eq('assigned_employee_id', currentUserId)
    }
    const { data, error } = await query
    if (error) {
      console.error('Failed to fetch orders from Supabase:', error)
    } else {
      setOrders(Array.isArray(data) ? data : [])
    }
    setOrdersLoading(false)
  }

  async function fetchCustomers() {
    if (!showCustomer) {
      setCustomers([])
      return
    }
    const { data } = await supabase
      .from('customers')
      .select('id, code, name, phone, email, address, visits')
      .order('name', { ascending: true })
    setCustomers(Array.isArray(data) ? data : [])
  }

  async function fetchEmployeeProfiles() {
    if (isEmployeeRole) {
      setEmployeeProfiles([])
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
    if (error) {
      console.error('Failed to fetch employee profiles:', error)
      setEmployeeProfiles([])
      return
    }
    setEmployeeProfiles(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    fetchOrders()
    fetchServices()
    fetchCustomers()
    fetchEmployeeProfiles()
  }, [])

  function resolveAssignedEmployeeId(selectedEmployeeName, fallbackId = null) {
    if (isEmployeeRole) {
      return currentUserId || fallbackId || null
    }
    const normalized = String(selectedEmployeeName || '').trim()
    const matched = employeeProfiles.find(
      profile => String(profile.display_name || '').trim() === normalized
    )
    return matched?.id || fallbackId || currentUserId || null
  }

  function mapOrderToDb(form) {
    return {
      customer: String(form.customer || ''),
      plate_number: String(form.vehicle || form.plate_number || ''),
      service: String(form.service || ''),
      employee: String(form.employee || ''),
      price: Number(form.price) || 0,
      status: safeStatus(form.status),
      date: form.date || null,
      time: form.time || null,
    }
  }

  const filtered = orders.filter(order => {
    const q = search.toLowerCase()
    const matchSearch = !search || (
      (showCustomer && (order.customer || '').toLowerCase().includes(q)) ||
      (showCustomer && String(order.customerCode || '').includes(search)) ||
      (order.employee || '').toLowerCase().includes(q)
    )
    const matchFilter = filter === 'All' || order.status === filter
    return matchSearch && matchFilter
  })

  async function handleSave(form) {
    try {
      if (modal === 'add') {
        const selectedEmployeeName = isEmployeeRole
          ? employeeName
          : (form.employee || employeeName)
        const assignedEmployeeId = resolveAssignedEmployeeId(selectedEmployeeName)
        if (!assignedEmployeeId) {
          console.error('Missing assigned employee id for new order')
          return
        }
        const payload = {
          ...mapOrderToDb(form),
          employee: selectedEmployeeName,
          assigned_employee_id: assignedEmployeeId,
        }
        const { data, error } = await supabase.from('orders').insert([payload]).select()
        if (error) {
          console.error('Supabase insert error:', error.message, error.details, error.hint)
          return
        }
        console.log('Supabase insert result:', data)

        if (showCustomer && form.customerCode) {
          const customer = customers.find(c => c.code === form.customerCode)
          if (customer) {
            await supabase
              .from('customers')
              .update({ visits: (Number(customer.visits) || 0) + 1 })
              .eq('id', customer.id)
            await fetchCustomers()
          }
        }
      } else {
        const orderId = modal?.order?.id
        if (!orderId) {
          console.error('Missing order id for update')
          return
        }
        const selectedEmployeeName = isEmployeeRole
          ? employeeName
          : (form.employee || employeeName || modal?.order?.employee || '')
        const payload = {
          ...mapOrderToDb(form),
          employee: selectedEmployeeName,
          assigned_employee_id: resolveAssignedEmployeeId(
            selectedEmployeeName,
            modal?.order?.assigned_employee_id ?? null
          ),
        }
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
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
      if (error) {
        console.error('Supabase status update error:', error)
        return
      }
      await fetchOrders()
    } catch (error) {
      console.error('handleStatusChange error:', error)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('pages.orders.deleteConfirm'))) return
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
        .select()
      if (error) {
        console.error('Supabase delete error:', error)
        return
      }
      await fetchOrders()
    } catch (error) {
      console.error('handleDelete error:', error)
    }
  }

  const colSpan = 6 + (showCustomer ? 2 : 0) + (showPrice ? 1 : 0)

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
            placeholder={showCustomer ? t('pages.orders.searchPlaceholder') : t('common.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <table className="orders-table">
          <thead>
            <tr>
              {showCustomer ? <th className="col-customer">{t('common.customer')}</th> : null}
              {showCustomer ? <th className="col-customer-code">{t('common.customerCode')}</th> : null}
              <th className="col-employee">{t('common.seller')}</th>
              <th className="col-vehicle">{t('pages.orders.plateNumber')}</th>
              <th className="col-service">{t('common.service')}</th>
              <th className="col-date-time">{t('pages.orders.dateTime')}</th>
              <th className="col-status">{t('common.status')}</th>
              {showPrice ? <th className="col-price text-right">{t('common.price')}</th> : null}
              <th className="col-actions">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {ordersLoading ? (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {t('common.loading')}...
                </td>
              </tr>
            ) : filtered.map(order => {
              const status = safeStatus(order.status)
              return (
                <tr key={order.id}>
                  {showCustomer ? <td className="col-customer" data-label={t('common.customer')}>{order.customer || t('common.noData')}</td> : null}
                  {showCustomer ? <td className="col-customer-code" data-label={t('common.customerCode')}>{order.customerCode ? `#${order.customerCode}` : t('common.noData')}</td> : null}
                  <td className="col-employee" data-label={t('common.seller')}>{order.employee || t('common.noData')}</td>
                  <td className="col-vehicle" data-label={t('pages.orders.plateNumber')} style={{ color: 'var(--text-muted)' }}>{order.plate_number || order.vehicle || t('common.noData')}</td>
                  <td className="col-service" data-label={t('common.service')}>{order.service || t('common.noData')}</td>
                  <td className="col-date-time" data-label={t('pages.orders.dateTime')} style={{ color: 'var(--text-muted)' }}>
                    <div>{formatOrderDate(order.date, language)}</div>
                    <div style={{ fontSize: 12 }}>{formatOrderTime(order.time, language)}</div>
                  </td>
                  <td className="col-status" data-label={t('common.status')}>
                    <span className={`badge ${STATUS_BADGE[status] || ''}`}>{t(`statuses.order.${status}`)}</span>
                  </td>
                  {showPrice ? <td className="col-price text-right" data-label={t('common.price')} style={{ fontWeight: 600 }}>{formatCurrency(Number(order.price) || 0, language)}</td> : null}
                  <td className="col-actions" data-label={t('common.actions')}>
                    <div className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'view', order })}>{t('common.view')}</button>
                      {canEdit ? <button className="btn btn-secondary btn-sm" onClick={() => setModal({ mode: 'edit', order })}>{t('common.edit')}</button> : null}
                      {canDelete ? <button className="btn btn-danger btn-sm" onClick={() => handleDelete(order.id)}>{t('common.delete')}</button> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!ordersLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
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
          showCustomer={showCustomer}
          showPrice={showPrice}
          employeeName={employeeName}
          lockEmployeeSelection={isEmployeeRole}
          customers={customers}
          services={services}
          servicesLoading={servicesLoading}
        />
      )}

      {modal?.mode === 'view' && modal.order && (
        <OrderView
          order={modal.order}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'edit', order: modal.order })}
          canEdit={canEdit}
          showCustomer={showCustomer}
          showPrice={showPrice}
          onStatusChange={(id, status) => {
            handleStatusChange(id, status)
            setModal(prev => prev?.order ? { ...prev, order: { ...prev.order, status } } : prev)
          }}
        />
      )}

      {canEdit && modal?.mode === 'edit' && modal.order && (
        <OrderModal
          order={modal.order}
          onSave={handleSave}
          onClose={() => setModal(null)}
          showCustomer={showCustomer}
          showPrice={showPrice}
          employeeName={employeeName}
          lockEmployeeSelection={false}
          customers={customers}
          services={services}
          servicesLoading={servicesLoading}
        />
      )}
    </div>
  )
}
