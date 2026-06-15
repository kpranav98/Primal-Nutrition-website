/**
 * checkout.js — Phase C live routes for storefront checkout flow.
 *
 * Pipeline:
 *   1. POST /serviceability       → ask Shiprocket if pincode is deliverable
 *   2. POST /create-order         → DB draft order + Razorpay order → frontend opens Razorpay Checkout
 *   3. POST /verify-payment       → verify signature → mark paid → create Shiprocket shipment
 */
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import {
  createRazorpayOrder,
  verifyPaymentSignature,
} from '../lib/razorpay.js'
import {
  checkServiceability,
  createShipment,
  assignAwb,
} from '../lib/shiprocket.js'
import {
  createDraftOrder,
  attachRazorpayOrder,
  markOrderPaid,
  applyShipmentDetails,
  getOrderForShipment,
  listOrdersAwaitingFulfillment,
} from '../services/orderService.js'
import { fireWelcomeEmail, fireOrderConfirmationEmail } from '../services/emailHooks.js'

function mapItemsForEmail(items) {
  return (items ?? []).map((it) => ({
    product_name: it.product_name_snapshot ?? it.product_name ?? '',
    variant_label: it.variant_label_snapshot ?? it.variant_label ?? '',
    qty: it.qty,
    unit_price: it.unit_price,
    line_total: it.line_total,
  }))
}

const router = Router()

// ─── Validation schemas ────────────────────────────────────────────────────

const CartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  qty: z.number().int().positive().max(99),
})

const AddressSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Must be a 6-digit pincode'),
  country: z.string().default('India'),
})

const ServiceabilitySchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Must be a 6-digit pincode'),
  items: z.array(CartItemSchema).min(1),
})

const CreateOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  }),
  address: AddressSchema,
  items: z.array(CartItemSchema).min(1).max(50),
  couponCode: z.string().max(30).optional(),
})

const CreateCodOrderSchema = CreateOrderSchema

const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  internalOrderId: z.string().uuid(),
})

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/checkout/serviceability
 */
router.post('/serviceability', async (req, res, next) => {
  const result = ServiceabilitySchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ error: 'VALIDATION_ERROR', issues: result.error.issues })
  }

  if (!config.shiprocket.pickupPincode) {
    return res.status(503).json({
      error: 'SHIPROCKET_NOT_CONFIGURED',
      message: 'SHIPROCKET_PICKUP_PINCODE is not set. Configure your registered pickup location.',
    })
  }

  // 500g per unit assumption — refine later by joining real product weight
  const totalWeightKg = result.data.items.reduce((sum, i) => sum + i.qty * 0.5, 0)

  try {
    const raw = await checkServiceability({
      pickupPincode: config.shiprocket.pickupPincode,
      deliveryPincode: result.data.pincode,
      weight: totalWeightKg,
    })

    const couriers = raw?.data?.available_courier_companies ?? []
    if (couriers.length === 0) {
      return res.status(200).json({
        serviceable: false,
        message: 'No couriers available for this pincode',
      })
    }

    // Pick the cheapest
    const cheapest = couriers.reduce((min, c) => (c.rate < min.rate ? c : min), couriers[0])
    return res.json({
      serviceable: true,
      estimatedDeliveryDays: cheapest.estimated_delivery_days,
      shippingRate: cheapest.rate,
      courier: cheapest.courier_name,
      codAvailable: cheapest.cod === 1,
    })
  } catch (err) {
    logger.error({ err: err.message }, 'Shiprocket serviceability failed')
    return next(err)
  }
})

/**
 * POST /api/checkout/create-order
 *
 * Returns the data the frontend needs to open Razorpay Checkout:
 *   { internalOrderId, razorpayOrderId, amount, currency, keyId, customer }
 */
router.post('/create-order', async (req, res, next) => {
  const result = CreateOrderSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ error: 'VALIDATION_ERROR', issues: result.error.issues })
  }

  try {
    // 1. Build the draft order in our DB
    const draft = await createDraftOrder(result.data)

    // 2. Ask Razorpay for an order id
    const rzpOrder = await createRazorpayOrder({
      amount: draft.totalPaise,
      currency: 'INR',
      receipt: draft.orderNumber,
    })

    // 3. Save the Razorpay order id on our row
    await attachRazorpayOrder(draft.internalOrderId, rzpOrder.id)

    logger.info(
      { internalOrderId: draft.internalOrderId, razorpayOrderId: rzpOrder.id, total: draft.totalRupees },
      'Draft order + Razorpay order created'
    )

    res.status(201).json({
      internalOrderId: draft.internalOrderId,
      orderNumber: draft.orderNumber,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: config.razorpay.keyId,
      customer: {
        name: draft.customer.name,
        email: draft.customer.email,
        phone: draft.customer.phone,
      },
    })

    void fireWelcomeEmail({
      customerId: draft.customer.id,
      name: draft.customer.name,
      email: draft.customer.email,
    }).catch((err) => logger.warn({ err }, 'welcome email hook failed'))
    return
  } catch (err) {
    logger.error({ err: err.message }, 'create-order failed')
    return next(err)
  }
})

/**
 * POST /api/checkout/verify-payment
 *
 * Browser calls this after Razorpay Checkout success.
 * 1. Verify the HMAC signature
 * 2. Mark the order paid
 * 3. Create the Shiprocket shipment (fire-and-forget — failures don't block the response)
 */
router.post('/verify-payment', async (req, res, next) => {
  const result = VerifyPaymentSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ error: 'VALIDATION_ERROR', issues: result.error.issues })
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, internalOrderId } = result.data

  if (!verifyPaymentSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
    logger.warn({ razorpayOrderId, razorpayPaymentId }, 'Razorpay signature mismatch')
    return res.status(400).json({ error: 'INVALID_SIGNATURE', message: 'Payment signature verification failed' })
  }

  try {
    const { alreadyPaid, order } = await markOrderPaid({ internalOrderId, razorpayPaymentId })

    // Kick off shipment in the background — don't block the payment response
    if (!alreadyPaid) {
      void createShipmentForOrder(internalOrderId).catch((err) =>
        logger.error({ err: err.message, internalOrderId }, 'Shiprocket shipment creation failed (will retry via cron)')
      )
    }

    res.json({
      success: true,
      alreadyPaid,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paidAt: order.paid_at,
      },
    })

    if (!alreadyPaid) {
      void (async () => {
        try {
          const full = await getOrderForShipment(internalOrderId)
          if (full?.customer?.email) {
            await fireOrderConfirmationEmail({
              orderId: full.id,
              customerId: full.customer.id,
              name: full.customer.name,
              email: full.customer.email,
              orderNumber: full.order_number,
              totalInr: Number(full.total),
              items: mapItemsForEmail(full.order_items),
              placedAt: order.paid_at ?? new Date().toISOString(),
            })
          }
        } catch (err) {
          logger.warn({ err, internalOrderId }, 'verify-payment confirmation email failed')
        }
      })()
    }
    return
  } catch (err) {
    logger.error({ err: err.message }, 'verify-payment failed')
    return next(err)
  }
})

/**
 * POST /api/checkout/create-cod-order
 *
 * Cash-on-Delivery flow — skips Razorpay entirely.
 * Creates a draft order in our DB (payment_method='cod', status stays 'pending'
 * until shipped), then immediately pushes it to Shiprocket as a COD shipment.
 *
 * Returns the order confirmation directly — no payment modal to open.
 */
router.post('/create-cod-order', async (req, res, next) => {
  const result = CreateCodOrderSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(422).json({ error: 'VALIDATION_ERROR', issues: result.error.issues })
  }

  try {
    const draft = await createDraftOrder({ ...result.data, paymentMethod: 'cod' })

    logger.info(
      { internalOrderId: draft.internalOrderId, total: draft.totalRupees },
      'COD order created — sending to Shiprocket'
    )

    // Fire shipment creation now (no payment step). Surface failures so the
    // user sees "Shiprocket couldn't accept this order" rather than a silent
    // pending state.
    try {
      await createShipmentForOrder(draft.internalOrderId, { paymentMethod: 'COD', deferAwb: true })
    } catch (shipErr) {
      logger.error({ err: shipErr.message, internalOrderId: draft.internalOrderId }, 'COD shipment creation failed')
      return res.status(502).json({
        error: 'SHIPMENT_FAILED',
        message: shipErr.message,
        internalOrderId: draft.internalOrderId,
        orderNumber: draft.orderNumber,
      })
    }

    res.status(201).json({
      internalOrderId: draft.internalOrderId,
      orderNumber: draft.orderNumber,
      total: draft.totalRupees,
      paymentMethod: 'cod',
    })

    void Promise.all([
      fireWelcomeEmail({
        customerId: draft.customer.id,
        name: draft.customer.name,
        email: draft.customer.email,
      }),
      fireOrderConfirmationEmail({
        orderId: draft.internalOrderId,
        customerId: draft.customer.id,
        name: draft.customer.name,
        email: draft.customer.email,
        orderNumber: draft.orderNumber,
        totalInr: draft.totalRupees,
        items: mapItemsForEmail(draft.items),
        placedAt: new Date().toISOString(),
      }),
    ]).catch((err) => logger.warn({ err, internalOrderId: draft.internalOrderId }, 'COD post-response email hooks failed'))
    return
  } catch (err) {
    logger.error({ err: err.message }, 'create-cod-order failed')
    return next(err)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Build the Shiprocket payload from an order and create the shipment.
 * Then assigns an AWB + courier so the order actually ships — without this
 * step the order sits as "NEW" in Shiprocket and never moves.
 *
 * When `deferAwb` is true, the (slow) courier-booking step runs in the
 * background and the function resolves as soon as the shipment is created — so
 * the customer isn't left waiting on "Processing…" through two Shiprocket calls.
 *
 * @param {string} internalOrderId
 * @param {{ paymentMethod?: 'Prepaid' | 'COD', deferAwb?: boolean }} opts
 */
async function createShipmentForOrder(internalOrderId, { paymentMethod = 'Prepaid', deferAwb = false } = {}) {
  if (!config.shiprocket.email || !config.shiprocket.password) {
    logger.warn('Shiprocket not configured — skipping shipment creation')
    return
  }

  const order = await getOrderForShipment(internalOrderId)
  if (!order?.shipping_address) {
    throw new Error(`Order ${internalOrderId} has no shipping address`)
  }

  const addr = order.shipping_address
  const customer = order.customer
  const [firstName, ...rest] = (customer.name ?? 'Customer').split(' ')
  const isCOD = paymentMethod === 'COD'

  const payload = {
    order_id: order.order_number,
    order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: config.shiprocket.pickupLocation,
    billing_customer_name: firstName,
    billing_last_name: rest.join(' ') || '.',
    billing_address: addr.line1,
    billing_address_2: addr.line2 ?? '',
    billing_city: addr.city,
    billing_pincode: addr.pincode,
    billing_state: addr.state,
    billing_country: addr.country,
    billing_email: customer.email,
    billing_phone: customer.phone,
    shipping_is_billing: true,
    order_items: order.order_items.map((i) => ({
      name: i.product_name_snapshot,
      sku: i.variant?.id ?? 'PRIMAL-SKU',
      units: i.qty,
      selling_price: Number(i.unit_price),
    })),
    payment_method: paymentMethod,
    sub_total: Number(order.subtotal),
    length: 15,
    breadth: 10,
    height: 10,
    weight: Math.max(0.5, order.order_items.reduce((sum, i) => sum + i.qty * 0.5, 0)),
  }

  if (isCOD) {
    payload.cod_collectable_amount = Number(order.total)
  }

  const result = await createShipment(payload)
  const shiprocketOrderId = String(result.order_id ?? result.shiprocket_order_id ?? '')
  const shipmentId = result.shipment_id ?? result.shipment?.shipment_id

  await applyShipmentDetails(internalOrderId, {
    shiprocketOrderId,
    awbCode: result.awb_code ?? null,
    courierName: result.courier_name ?? null,
  })

  logger.info({ internalOrderId, shiprocketOrderId, shipmentId }, 'Shipment created in Shiprocket')

  // Assign AWB so the order actually books a courier and ships.
  // Without this, the order sits in "NEW" in the Shiprocket dashboard
  // and looks like a test / unplaced order.
  if (!shipmentId) {
    logger.warn({ internalOrderId, shiprocketOrderId }, 'No shipment_id from Shiprocket — cannot assign AWB')
    return
  }

  // Assign AWB so the order actually books a courier and ships. Without this,
  // the order sits in "NEW" in the Shiprocket dashboard and never moves.
  const bookCourier = async () => {
    const awbResult = await assignAwb({ shipmentId })
    const awbData = awbResult?.response?.data ?? awbResult?.data ?? awbResult
    await applyShipmentDetails(internalOrderId, {
      awbCode: awbData?.awb_code ?? null,
      courierName: awbData?.courier_name ?? null,
      status: 'shipped',
      shippedAt: new Date().toISOString(),
    })
    logger.info({ internalOrderId, awbCode: awbData?.awb_code, courier: awbData?.courier_name }, 'AWB assigned — order is now placed for shipping')
  }

  if (deferAwb) {
    // Don't make the customer wait on courier booking — do it in the background.
    // NOTE: there is no shipment-retry cron, so a failure here leaves the order
    // created in Shiprocket but un-booked ("NEW") and needs manual assignment.
    void bookCourier().catch((awbErr) =>
      logger.error({ err: awbErr.message, internalOrderId, shipmentId }, 'Deferred AWB assignment failed — order is in Shiprocket but not yet booked')
    )
    return
  }

  try {
    await bookCourier()
  } catch (awbErr) {
    logger.error({ err: awbErr.message, internalOrderId, shipmentId }, 'AWB assignment failed — order is in Shiprocket but not yet booked')
    throw awbErr
  }
}

/**
 * Recover orders that should have shipped but have no AWB — e.g. a background
 * shipment-creation failure (online) or a deferred AWB that never completed.
 * Safe to run repeatedly: orders that already have a Shiprocket order are NOT
 * re-created (avoids duplicate shipments) — they're flagged for manual booking.
 *
 * Intended to be hit on a schedule via POST /cron/reconcile-shipments.
 */
export async function reconcilePendingShipments() {
  const orders = await listOrdersAwaitingFulfillment()
  const summary = { checked: orders.length, reconciled: 0, needsManualAwb: 0, failed: 0, details: [] }

  for (const o of orders) {
    try {
      if (!o.shiprocket_order_id) {
        // No shipment at all — safe to create it (this also assigns the AWB).
        await createShipmentForOrder(o.id, { paymentMethod: o.payment_method === 'cod' ? 'COD' : 'Prepaid' })
        summary.reconciled++
        summary.details.push({ orderNumber: o.order_number, action: 'shipment_created' })
      } else {
        // Shipment exists but no courier booked. We don't persist the
        // Shiprocket shipment_id, so re-booking must be done manually.
        summary.needsManualAwb++
        summary.details.push({ orderNumber: o.order_number, action: 'needs_manual_awb', shiprocketOrderId: o.shiprocket_order_id })
      }
    } catch (err) {
      summary.failed++
      summary.details.push({ orderNumber: o.order_number, action: 'failed', error: err.message })
      logger.error({ err: err.message, orderId: o.id }, 'Shipment reconciliation failed for order')
    }
  }

  logger.info(
    { checked: summary.checked, reconciled: summary.reconciled, needsManualAwb: summary.needsManualAwb, failed: summary.failed },
    'Shipment reconciliation run complete'
  )
  return summary
}

export default router
