import { Router } from 'express'
import { getAdminClient } from '../../lib/supabase.js'
import { config } from '../../config.js'

const router = Router()

function requireSupabase(res) {
  if (!config.supabase.configured) {
    res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured' })
    return null
  }
  return getAdminClient()
}

/**
 * GET /api/admin/customers
 * Paginated, searchable customer list with status filter.
 *
 * Query params: page, limit, search, status (active|dormant|churned)
 */
router.get('/', async (req, res, next) => {
  try {
    const supabase = requireSupabase(res)
    if (!supabase) return

    const page = Math.max(1, parseInt(req.query.page ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '25', 10)))
    const offset = (page - 1) * limit
    const search = req.query.search?.trim() ?? ''
    const status = req.query.status?.trim() ?? ''

    let query = supabase
      .from('customer_summary')
      .select('*', { count: 'exact' })
      .order('last_order_date', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query
    if (error) throw error

    const rows = (data ?? []).map((c) => ({
      id: c.customer_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      total_orders: Number(c.total_orders) || 0,
      total_spent: Number(c.total_spent) || 0,
      first_order_date: c.first_order_date,
      last_order_date: c.last_order_date,
      days_since_last_order: c.days_since_last_order,
      favorite_product: c.favorite_product_name,
      status: c.status,
    }))

    const total = count ?? 0
    return res.json({
      data: rows,
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/customers/:id
 * Full customer profile + order history + addresses + lifetime stats.
 *
 * Returns: { customer, orders, addresses, stats }
 */
router.get('/:id', async (req, res, next) => {
  try {
    const supabase = requireSupabase(res)
    if (!supabase) return

    const { id } = req.params

    const [profileRes, customerRes, ordersRes, addressesRes] = await Promise.all([
      supabase
        .from('customer_summary')
        .select('*')
        .eq('customer_id', id)
        .single(),
      supabase
        .from('customers')
        .select('id, created_at')
        .eq('id', id)
        .single(),
      supabase
        .from('orders')
        .select(
          `id, order_number, status, subtotal, discount, shipping_fee, tax, total, payment_method,
           placed_at, paid_at, shipped_at, delivered_at, cancelled_at,
           awb_code, courier_name,
           order_items (
             id, product_name_snapshot, variant_label_snapshot, qty, unit_price, line_total,
             product:products (id, slug, name, image),
             variant:variants (id, label)
           )`
        )
        .eq('customer_id', id)
        .order('placed_at', { ascending: false }),
      supabase
        .from('addresses')
        .select('id, line1, line2, city, state, pincode, country, is_default')
        .eq('customer_id', id),
    ])

    if (profileRes.error) {
      if (profileRes.error.code === 'PGRST116') {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Customer not found' })
      }
      throw profileRes.error
    }
    if (ordersRes.error) throw ordersRes.error
    if (addressesRes.error) throw addressesRes.error

    const p = profileRes.data
    const customer = {
      id: p.customer_id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      total_orders: Number(p.total_orders) || 0,
      total_spent: Number(p.total_spent) || 0,
      days_since_last_order: p.days_since_last_order,
      last_order_date: p.last_order_date,
      created_at: customerRes?.data?.created_at ?? null,
    }

    const orders = (ordersRes.data ?? []).map((o) => {
      const items = (o.order_items ?? []).map((it) => ({
        id: it.id,
        product_id: it.product?.id ?? null,
        product_slug: it.product?.slug ?? null,
        product_name: it.product_name_snapshot ?? it.product?.name ?? 'Unknown product',
        product_image: it.product?.image ?? null,
        variant_id: it.variant?.id ?? null,
        variant_label: it.variant_label_snapshot ?? it.variant?.label ?? null,
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        line_total: Number(it.line_total) || 0,
      }))
      const item_qty = items.reduce((sum, it) => sum + it.qty, 0)
      return {
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        subtotal: Number(o.subtotal) || 0,
        discount: Number(o.discount) || 0,
        shipping_fee: Number(o.shipping_fee) || 0,
        tax: Number(o.tax) || 0,
        total: Number(o.total) || 0,
        payment_method: o.payment_method,
        placed_at: o.placed_at,
        paid_at: o.paid_at,
        shipped_at: o.shipped_at,
        delivered_at: o.delivered_at,
        cancelled_at: o.cancelled_at,
        awb_code: o.awb_code,
        courier_name: o.courier_name,
        item_count: items.length,
        item_qty,
        items,
      }
    })

    // Lifetime per-product breakdown (excludes cancelled orders).
    const productMap = new Map()
    for (const o of orders) {
      if (o.status === 'cancelled') continue
      for (const it of o.items) {
        const key = it.product_id ?? it.product_name
        const prev = productMap.get(key) ?? {
          product_id: it.product_id,
          product_slug: it.product_slug,
          product_name: it.product_name,
          product_image: it.product_image,
          total_qty: 0,
          total_spent: 0,
          order_count: 0,
          last_purchased_at: null,
        }
        prev.total_qty += it.qty
        prev.total_spent += it.line_total
        prev.order_count += 1
        if (!prev.last_purchased_at || (o.placed_at && o.placed_at > prev.last_purchased_at)) {
          prev.last_purchased_at = o.placed_at
        }
        productMap.set(key, prev)
      }
    }
    const products_purchased = Array.from(productMap.values()).sort(
      (a, b) => b.total_spent - a.total_spent
    )

    return res.json({
      customer,
      orders,
      addresses: addressesRes.data ?? [],
      stats: {
        lifetime_spend: Number(p.total_spent) || 0,
        favorite_product: p.favorite_product_name,
        first_order_date: p.first_order_date,
        products_purchased,
        total_units_purchased: products_purchased.reduce((s, p) => s + p.total_qty, 0),
        unique_products_purchased: products_purchased.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
