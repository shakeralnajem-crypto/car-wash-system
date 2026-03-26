import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTranslation } from '../i18n'

const VAT_RATE = 0.25
const MANUAL_INVOICES_KEY = 'manual-invoices-v1'

const COMPANY = {
  name: 'KM Autogroup AB',
  address: 'Ängdalavägen 3\n281 33 Hässleholm',
  orgNr: '559480-4196',
  momsreg: 'SE559480419601',
  phone: '073-666 50 57',
  email: 'kochmbilvard@gmail.com',
}

const STATUS_BADGE = {
  Betald: 'badge-success',
  Väntar: 'badge-warning',
  Försenad: 'badge-danger',
  Makulerad: 'badge-neutral',
}

const STAMP_CLASS = {
  Betald: 'inv-stamp inv-stamp-paid',
  Väntar: 'inv-stamp inv-stamp-pending',
  Försenad: 'inv-stamp inv-stamp-overdue',
  Makulerad: 'inv-stamp inv-stamp-voided',
}

const FILTERS = ['Alla', 'Betald', 'Väntar', 'Försenad', 'Makulerad']

const EMPTY_LINE_ITEM = {
  description: '',
  qty: 1,
  price: '',
  service_date: '',
  service: '',
  license_plate: '',
  vehicle_brand: '',
}

const EMPTY_INVOICE_FORM = {
  customer: '',
  customerAddress: '',
  invoiceDate: '',
  dueDate: '',
  status: 'Väntar',
  items: [{ ...EMPTY_LINE_ITEM }],
}

function formatDate(val, language = 'sv') {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-GB')
}

function toInputDate(val) {
  if (!val) return ''
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function normalizeInvoiceStatus(status) {
  const normalized = String(status || '').trim()

  if (normalized === 'Betald' || normalized === 'Paid') return 'Betald'
  if (normalized === 'Försenad' || normalized === 'Overdue') return 'Försenad'
  if (normalized === 'Makulerad' || normalized === 'Voided') return 'Makulerad'
  if (normalized === 'Pending' || normalized === 'Väntar') return 'Väntar'

  return 'Väntar'
}

function buildDescription(order, t) {
  if (order.description?.trim()) return order.description.trim()

  const parts = []
  if (order.service_date) parts.push(order.service_date)
  if (order.service) parts.push(t(`services.${order.service}`))
  const vehicle = [order.license_plate, order.vehicle_brand].filter(Boolean).join(' - ')
  if (vehicle) parts.push(vehicle)
  return parts.join(' ') || '—'
}

function calculateInvoiceTotals(items) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.qty) || 1
    const price = Number(item.price) || 0
    return sum + qty * price
  }, 0)

  const vatAmount = subtotal * VAT_RATE
  const rawTotal = subtotal + vatAmount
  const rounding = Math.round(rawTotal) - rawTotal
  const total = rawTotal + rounding

  return { subtotal, vatAmount, rounding, total }
}

function createInvoiceObject({
  id,
  customer,
  customerAddress,
  items,
  status = 'Väntar',
  invoiceDate,
  dueDate,
  source = 'manual',
}) {
  const { subtotal, vatAmount, rounding, total } = calculateInvoiceTotals(items)

  return {
    id,
    customer,
    customerAddress,
    items,
    subtotal,
    vatAmount,
    rounding,
    total,
    invoiceDate,
    dueDate,
    status: normalizeInvoiceStatus(status),
    source,
  }
}

function groupIntoInvoices(rows) {
  const map = new Map()

  rows.forEach(row => {
    const key = (row.customer ?? 'Okänd').trim()
    if (!map.has(key)) {
      map.set(key, {
        customer: key,
        customerAddress: row.customer_address ?? '',
        items: [],
        firstDate: row.created_at ?? row.service_date ?? null,
        status: normalizeInvoiceStatus(row.status),
      })
    }
    map.get(key).items.push(row)
  })

  return Array.from(map.values()).map((group, idx) => {
    const createdAt = group.firstDate ? new Date(group.firstDate) : new Date()
    const invoiceDate = toInputDate(createdAt)
    const dueDate = toInputDate(new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000))

    return createInvoiceObject({
      id: String(100 + idx),
      customer: group.customer,
      customerAddress: group.customerAddress,
      items: group.items,
      status: group.status,
      invoiceDate,
      dueDate,
      source: 'orders',
    })
  })
}

function getNextInvoiceId(invoices) {
  const numericIds = invoices
    .map(invoice => Number(invoice.id))
    .filter(id => Number.isFinite(id))

  const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 999
  return String(maxId + 1)
}

function hydrateStoredInvoice(invoice) {
  return createInvoiceObject({
    ...invoice,
    items: Array.isArray(invoice.items) ? invoice.items : [],
    source: invoice.source || 'manual',
    invoiceDate: invoice.invoiceDate || invoice.date,
    dueDate: invoice.dueDate || invoice.due,
  })
}

function loadManualInvoices() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(MANUAL_INVOICES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(hydrateStoredInvoice) : []
  } catch {
    return []
  }
}

function saveManualInvoices(invoices) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MANUAL_INVOICES_KEY, JSON.stringify(invoices))
}

function InvoiceModal({ nextInvoiceId, invoice, onSave, onClose }) {
  const { formatCurrency, language, t } = useTranslation()
  const today = toInputDate(new Date())
  const nextMonth = toInputDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  const [form, setForm] = useState({
    ...(invoice ? {
      customer: invoice.customer ?? '',
      customerAddress: invoice.customerAddress ?? '',
      invoiceDate: toInputDate(invoice.invoiceDate) || today,
      dueDate: toInputDate(invoice.dueDate) || nextMonth,
      status: normalizeInvoiceStatus(invoice.status),
      items: (invoice.items ?? []).length > 0
        ? invoice.items.map(item => ({ ...EMPTY_LINE_ITEM, ...item }))
        : [{ ...EMPTY_LINE_ITEM }],
    } : {
      ...EMPTY_INVOICE_FORM,
      invoiceDate: today,
      dueDate: nextMonth,
    }),
  })

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setItem(index, field, value) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      )),
    }))
  }

  function addItem() {
    setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_LINE_ITEM }] }))
  }

  function removeItem(index) {
    setForm(prev => ({
      ...prev,
      items: prev.items.length === 1 ? prev.items : prev.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()

    const cleanedItems = form.items
      .map(item => ({
        ...item,
        description: item.description.trim(),
        qty: Number(item.qty) || 1,
        price: Number(item.price) || 0,
      }))
      .filter(item => item.description || item.price > 0)

    if (!form.customer.trim() || cleanedItems.length === 0) return

    onSave(createInvoiceObject({
      id: invoice?.id ?? nextInvoiceId,
      customer: form.customer.trim(),
      customerAddress: form.customerAddress.trim(),
      items: cleanedItems,
      status: form.status,
      invoiceDate: form.invoiceDate,
      dueDate: form.dueDate,
      source: invoice?.source ?? 'manual',
    }))
  }

  const previewTotals = calculateInvoiceTotals(form.items)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invoice-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>
            {invoice ? `${t('common.edit')} #${invoice.id}` : `${t('pages.invoices.newInvoice')} #${nextInvoiceId}`}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.invoices.customerName')}</label>
                <input
                  className="form-input"
                  value={form.customer}
                  onChange={e => setField('customer', e.target.value)}
                  placeholder={t('pages.invoices.customerNamePlaceholder')}
                  required
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('common.status')}</label>
                <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
                  {FILTERS.filter(filter => filter !== 'Alla').map(status => (
                    <option key={status} value={status}>{t(`statuses.invoice.${status}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('pages.invoices.customerAddress')}</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.customerAddress}
                onChange={e => setField('customerAddress', e.target.value)}
                placeholder={t('pages.invoices.customerAddressPlaceholder')}
              />
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.invoices.invoiceDate')}</label>
                <input className="form-input" type="date" value={form.invoiceDate} onChange={e => setField('invoiceDate', e.target.value)} />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">{t('pages.invoices.dueDate')}</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
              </div>
            </div>

            <div className="invoice-items-head">
              <div className="section-title" style={{ marginBottom: 0 }}>{t('pages.invoices.lineItems')}</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                {t('pages.invoices.addLine')}
              </button>
            </div>

            <div className="invoice-item-list">
              {form.items.map((item, index) => (
                <div className="invoice-item-card" key={index}>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{t('pages.invoices.description')}</label>
                      <input
                        className="form-input"
                        value={item.description}
                        onChange={e => setItem(index, 'description', e.target.value)}
                        placeholder={t('pages.invoices.descriptionPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{t('pages.invoices.quantity')}</label>
                      <input className="form-input" type="number" min="1" value={item.qty} onChange={e => setItem(index, 'qty', e.target.value)} />
                    </div>

                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">{t('common.price')}</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={item.price} onChange={e => setItem(index, 'price', e.target.value)} />
                    </div>

                    <div className="form-group invoice-item-remove">
                      <label className="form-label">&nbsp;</label>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="invoice-preview-totals">
              <div className="inv-total-row">
                <span>{t('pages.invoices.subtotal')}</span>
                <span>{formatCurrency(previewTotals.subtotal, language)}</span>
              </div>
              <div className="inv-total-row">
                <span>{t('pages.invoices.vat')}</span>
                <span>{formatCurrency(previewTotals.vatAmount, language)}</span>
              </div>
              <div className="inv-total-row grand">
                <span>{t('common.total')}</span>
                <span>{formatCurrency(previewTotals.total, language)}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary">
              {invoice ? t('common.saveChanges') : t('pages.invoices.saveInvoice')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InvoicePreview({ invoice, onClose, onMarkPaid, onEdit }) {
  const { formatCurrency, language, t } = useTranslation()

  return (
    <div className="inv-overlay" onClick={onClose}>
      <div className="inv-panel inv-panel-wide" onClick={e => e.stopPropagation()}>
        <div className="inv-panel-header no-print">
          <span className="inv-panel-header-title">
            {t('pages.invoices.previewTitle')} — #{invoice.id} · {invoice.customer}
          </span>
          <div className="inv-panel-actions">
            {(invoice.status === 'Väntar' || invoice.status === 'Försenad') ? (
              <button className="btn btn-secondary btn-sm" onClick={() => onMarkPaid(invoice.id)}>
                {t('pages.invoices.markPaid')}
              </button>
            ) : null}
            {invoice.source === 'manual' && (
              <button className="btn btn-secondary btn-sm" onClick={() => onEdit(invoice)}>
                {t('common.edit')}
              </button>
            )}

            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              {t('pages.invoices.print')}
            </button>

            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="inv-panel-body">
          <div className="inv-doc" id="printable-invoice">
            <div className="inv-doc-top">
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {invoice.customer}
                </div>
                <div className="inv-company-details">
                  {(invoice.customerAddress || '').split('\n').map((line, index) => (
                    <span key={index}>{line}{line && <br />}</span>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div className="inv-meta-block">
                  <div className="inv-meta-label">{t('pages.invoices.invoiceDate')}</div>
                  <div className="inv-meta-value">{formatDate(invoice.invoiceDate, language)}</div>
                </div>

                <div className="inv-meta-block" style={{ marginTop: 10 }}>
                  <div className="inv-meta-label">{t('pages.invoices.dueDate')}</div>
                  <div className="inv-meta-value" style={invoice.status === 'Försenad' ? { color: 'var(--danger)' } : {}}>
                    {formatDate(invoice.dueDate, language)}
                  </div>
                </div>

                <div className="inv-meta-block" style={{ marginTop: 10 }}>
                  <div className="inv-meta-label">{t('pages.invoices.invoiceNo')}</div>
                  <div className="inv-meta-value" style={{ color: 'var(--primary)' }}>
                    {invoice.id}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="inv-company-name">{COMPANY.name}</div>
                <div className="inv-company-details">
                  {COMPANY.address.split('\n').map((line, index) => (
                    <span key={index}>{line}<br /></span>
                  ))}
                  {t('common.orgNo')}: {COMPANY.orgNr}<br />
                  {t('common.vatNo')}: {COMPANY.momsreg}<br />
                  {COMPANY.email}<br />
                  {t('common.tel')}: {COMPANY.phone}
                </div>
              </div>
            </div>

            <hr className="inv-divider" />

            <table className="inv-items-table">
              <thead>
                <tr>
                  <th style={{ width: '55%' }}>{t('pages.invoices.descriptionColumn')}</th>
                  <th>{t('pages.invoices.quantityColumn')}</th>
                  <th>{t('pages.invoices.unitPriceColumn')}</th>
                  <th>{t('pages.invoices.totalColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((row, index) => {
                  const qty = Number(row.qty) || 1
                  const price = Number(row.price) || 0

                  return (
                    <tr key={row.id ?? `${invoice.id}-${index}`}>
                      <td>{buildDescription(row, t)}</td>
                      <td>{qty}</td>
                      <td>{formatCurrency(price, language)}</td>
                      <td><strong>{formatCurrency(price * qty, language)}</strong></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="inv-totals">
              <div className="inv-total-row">
                <span>{t('pages.invoices.subtotal')}</span>
                <span>{formatCurrency(invoice.subtotal, language)}</span>
              </div>
              <div className="inv-total-row">
                <span>{t('pages.invoices.vat')}</span>
                <span>{formatCurrency(invoice.vatAmount, language)}</span>
              </div>
              {invoice.rounding !== 0 && (
                <div className="inv-total-row" style={{ color: 'var(--text-muted)' }}>
                  <span>{t('pages.invoices.rounding')}</span>
                  <span>{invoice.rounding > 0 ? '+' : ''}{formatCurrency(invoice.rounding, language)}</span>
                </div>
              )}
              <div className="inv-total-row grand">
                <span>{t('common.total')}</span>
                <span>{formatCurrency(invoice.total, language)}</span>
              </div>
            </div>

            <div className="inv-status-stamp">
              <span className={STAMP_CLASS[invoice.status] ?? 'inv-stamp inv-stamp-pending'}>
                {t(`statuses.invoice.${invoice.status}`)}
              </span>
              <div className="inv-thank-you">
                {t('pages.invoices.thanks')} {COMPANY.name}!<br />
                {t('pages.invoices.questions')} {COMPANY.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Invoices() {
  const { formatCurrency, language, t } = useTranslation()
  const [invoices, setInvoices] = useState([])
  const [manualInvoices, setManualInvoices] = useState(() => loadManualInvoices())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Alla')
  const [selected, setSelected] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setInvoices(groupIntoInvoices(data ?? []))
      }

      setLoading(false)
    }

    fetchOrders()
  }, [])

  useEffect(() => {
    saveManualInvoices(manualInvoices)
  }, [manualInvoices])

  const allInvoices = [...manualInvoices, ...invoices].sort((a, b) => Number(b.id) - Number(a.id))

  const filtered = allInvoices.filter(invoice => {
    const matchSearch = invoice.customer.toLowerCase().includes(search.toLowerCase()) || String(invoice.id).includes(search)
    const matchFilter = filter === 'Alla' || invoice.status === filter
    return matchSearch && matchFilter
  })

  const grandTotal = allInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
  const totalPaid = allInvoices.filter(invoice => invoice.status === 'Betald').reduce((sum, invoice) => sum + invoice.total, 0)
  const totalUnpaid = allInvoices
    .filter(invoice => invoice.status === 'Väntar' || invoice.status === 'Försenad')
    .reduce((sum, invoice) => sum + invoice.total, 0)

  function handleMarkPaid(id) {
    setInvoices(prev => prev.map(invoice => (invoice.id === id ? { ...invoice, status: 'Betald' } : invoice)))
    setManualInvoices(prev => prev.map(invoice => (invoice.id === id ? { ...invoice, status: 'Betald' } : invoice)))
    setSelected(prev => (prev?.id === id ? { ...prev, status: 'Betald' } : prev))
  }

  function handleAddInvoice(invoice) {
    if (editingInvoice) {
      setManualInvoices(prev => prev.map(row => (row.id === editingInvoice.id ? invoice : row)))
      setSelected(prev => (prev?.id === editingInvoice.id ? invoice : prev))
    } else {
      setManualInvoices(prev => [invoice, ...prev])
      setSelected(invoice)
    }
    setEditingInvoice(null)
    setShowAddModal(false)
  }

  function handleStartCreate() {
    setEditingInvoice(null)
    setShowAddModal(true)
  }

  function handleStartEdit(invoice) {
    if (invoice.source !== 'manual') return
    setEditingInvoice(invoice)
    setSelected(null)
    setShowAddModal(true)
  }

  const nextInvoiceId = getNextInvoiceId(allInvoices)

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">{t('pages.invoices.title')}</div>
        </div>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '64px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <p style={{ fontSize: 14 }}>{t('pages.invoices.loadingOrders')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <div className="page-title">{t('pages.invoices.title')}</div>
            <div className="page-subtitle">{t('pages.invoices.fallbackSubtitle')}</div>
          </div>
          <button className="btn btn-primary" onClick={handleStartCreate}>
            {t('pages.invoices.createInvoice')}
          </button>
        </div>

        <div style={{
          background: 'var(--danger-light)',
          border: '1px solid #fca5a5',
          borderRadius: 'var(--radius)',
          padding: '32px 24px',
          textAlign: 'center',
          color: 'var(--danger)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('pages.invoices.fetchErrorTitle')}</div>
          <p style={{ fontSize: 13 }}>{error}</p>
        </div>

        {manualInvoices.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 20 }}>
            <div className="table-toolbar">
              <span className="table-toolbar-title">{t('pages.invoices.manualInvoices')}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t('pages.invoices.invoiceNo')}</th>
                  <th>{t('common.customer')}</th>
                  <th>{t('common.total')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {manualInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: 600 }}>{invoice.id}</td>
                    <td>{invoice.customer}</td>
                    <td>{formatCurrency(invoice.total, language)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[invoice.status] ?? 'badge-neutral'}`}>
                        {t(`statuses.invoice.${invoice.status}`)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(invoice)}>
                          {t('common.view')}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleStartEdit(invoice)}>
                          {t('common.edit')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAddModal && (
          <InvoiceModal
            nextInvoiceId={nextInvoiceId}
            invoice={editingInvoice}
            onSave={handleAddInvoice}
            onClose={() => {
              setShowAddModal(false)
              setEditingInvoice(null)
            }}
          />
        )}

        {selected && (
          <InvoicePreview
            invoice={selected}
            onClose={() => setSelected(null)}
            onMarkPaid={handleMarkPaid}
            onEdit={handleStartEdit}
          />
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{t('pages.invoices.title')}</div>
          <div className="page-subtitle">{t('pages.invoices.subtitle')}</div>
        </div>
        <button className="btn btn-primary" onClick={handleStartCreate}>
          {t('pages.invoices.createInvoice')}
        </button>
      </div>

      {allInvoices.length === 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '64px 24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--text)' }}>
            {t('pages.invoices.noInvoicesTitle')}
          </div>
          <p style={{ fontSize: 14 }}>{t('pages.invoices.noInvoicesText')}</p>
        </div>
      )}

      {allInvoices.length > 0 && (
        <>
          <div className="stats-grid stats-grid-compact" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">{t('pages.invoices.totalInvoiced')}</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(grandTotal, language)}</div>
              <div className="stat-change up">{allInvoices.length} {t('pages.invoices.invoicesCount')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('pages.invoices.paid')}</div>
              <div className="stat-value" style={{ fontSize: 22, color: 'var(--success)' }}>
                {formatCurrency(totalPaid, language)}
              </div>
              <div className="stat-change up">
                {allInvoices.filter(invoice => invoice.status === 'Betald').length} {t('pages.invoices.paidCount')}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('pages.invoices.outstanding')}</div>
              <div className="stat-value" style={{ fontSize: 22, color: 'var(--warning)' }}>
                {formatCurrency(totalUnpaid, language)}
              </div>
              <div className="stat-change down">
                {allInvoices.filter(invoice => invoice.status === 'Väntar' || invoice.status === 'Försenad').length} {t('pages.invoices.unpaidCount')}
              </div>
            </div>
          </div>

          <div className="filter-bar">
            {FILTERS.map(status => (
              <button
                key={status}
                className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(status)}
              >
                {t(`statuses.invoice.${status}`)}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <div className="table-toolbar">
              <span className="table-toolbar-title">
                {filtered.length} {t('pages.invoices.invoicesCount')}
              </span>
              <input
                className="search-input"
                type="text"
                placeholder={t('pages.invoices.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <table className="invoices-table data-table">
              <thead>
                <tr>
                  <th>{t('pages.invoices.invoiceNo')}</th>
                  <th>{t('common.customer')}</th>
                  <th>{t('pages.invoices.source')}</th>
                  <th>{t('pages.invoices.itemsCount')}</th>
                  <th>{t('pages.invoices.invoiceDate')}</th>
                  <th>{t('pages.invoices.dueDate')}</th>
                  <th>{t('pages.invoices.subtotal')}</th>
                  <th>{t('pages.invoices.vat')}</th>
                  <th>{t('pages.invoices.totalWithVat')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(invoice => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: 600 }}>{invoice.id}</td>
                    <td style={{ fontWeight: 500 }}>{invoice.customer}</td>
                    <td>
                      <span className={`badge ${invoice.source === 'manual' ? 'badge-info' : 'badge-neutral'}`}>
                        {invoice.source === 'manual' ? t('pages.invoices.sourceManual') : t('pages.invoices.sourceOrders')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{invoice.items.length}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(invoice.invoiceDate, language)}</td>
                    <td style={{ color: invoice.status === 'Försenad' ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {formatDate(invoice.dueDate, language)}
                    </td>
                    <td>{formatCurrency(invoice.subtotal, language)}</td>
                    <td>{formatCurrency(invoice.vatAmount, language)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(invoice.total, language)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[invoice.status] ?? 'badge-neutral'}`}>
                        {t(`statuses.invoice.${invoice.status}`)}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(invoice)}>
                          {t('common.view')}
                        </button>
                        {invoice.source === 'manual' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleStartEdit(invoice)}>
                            {t('common.edit')}
                          </button>
                        )}
                        {(invoice.status === 'Väntar' || invoice.status === 'Försenad') && (
                          <button className="btn btn-primary btn-sm" onClick={() => handleMarkPaid(invoice.id)}>
                            {t('statuses.invoice.Betald')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                      {t('pages.invoices.noFilterResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAddModal && (
        <InvoiceModal
          nextInvoiceId={nextInvoiceId}
          invoice={editingInvoice}
          onSave={handleAddInvoice}
          onClose={() => {
            setShowAddModal(false)
            setEditingInvoice(null)
          }}
        />
      )}

      {selected && (
        <InvoicePreview
          invoice={selected}
          onClose={() => setSelected(null)}
          onMarkPaid={handleMarkPaid}
          onEdit={handleStartEdit}
        />
      )}
    </div>
  )
}
