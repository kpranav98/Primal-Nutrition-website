import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { usePage } from '../context/RouterContext.jsx'
import { api } from '../lib/api.js'
import { openRazorpayCheckout } from '../lib/razorpayCheckout.js'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh',
  'Puducherry','Chandigarh','Andaman and Nicobar Islands','Dadra and Nagar Haveli and Daman and Diu','Lakshadweep'
]

const initialForm = {
  name: '', email: '', phone: '',
  line1: '', line2: '', city: '', state: '', pincode: '',
}

export default function CartDrawer() {
  const { isOpen, closeCart, lineItems, subtotal, compareSubtotal, count, updateQty, removeItem, clearCart } = useCart()
  const { navigate } = usePage()
  const [step, setStep] = useState('cart')     // cart | form | success
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [notice, setNotice] = useState(null)   // calm, non-error message (e.g. payment window closed)
  const [procStep, setProcStep] = useState(0)  // advances the "Processing…" label so it never looks frozen
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('online')  // 'online' | 'cod'
  const saved = compareSubtotal - subtotal

  // Lock body scroll when open
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Reset state when drawer is closed
  useEffect(() => {
    if (!isOpen) {
      setStep('cart')
      setSubmitError(null)
      setNotice(null)
      setErrors({})
    }
  }, [isOpen])

  // While submitting, advance a status step every 2.2s so the button shows live
  // progress ("Placing your order…" → "Booking courier…") instead of a static,
  // frozen-looking "Processing…" — important on slow mobile + COD's courier call.
  useEffect(() => {
    if (!submitting) { setProcStep(0); return }
    const id = setInterval(() => setProcStep((s) => s + 1), 2200)
    return () => clearInterval(id)
  }, [submitting])

  // Close on escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && isOpen) closeCart() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Full name required'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email required'
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = '10-digit Indian mobile starting with 6-9'
    if (form.line1.trim().length < 5) e.line1 = 'Address line 1 required'
    if (form.city.trim().length < 2) e.city = 'City required'
    if (!form.state) e.state = 'State required'
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = '6-digit pincode'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handlePay = async () => {
    setSubmitError(null)
    setNotice(null)
    if (!validate()) return
    setSubmitting(true)

    const customer = { name: form.name, email: form.email, phone: form.phone }
    const address = {
      fullName: form.name, phone: form.phone,
      line1: form.line1, line2: form.line2 || undefined,
      city: form.city, state: form.state, pincode: form.pincode, country: 'India',
    }
    const items = lineItems.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty }))

    try {
      if (paymentMethod === 'cod') {
        // COD — server creates order + Shiprocket shipment (several courier API
        // calls) in one request, so allow more time before aborting.
        const cod = await api.post('/api/checkout/create-cod-order', { customer, address, items }, { timeout: 45000 })
        setConfirmedOrder({ orderNumber: cod.orderNumber, total: cod.total, method: 'cod' })
        setStep('success')
        clearCart()
        // Meta Pixel — Purchase event
        if (typeof window.fbq === 'function') {
          window.fbq('track', 'Purchase', { value: cod.total, currency: 'INR', content_type: 'product' })
        }
        return
      }

      // Online — Razorpay flow.
      const draft = await api.post('/api/checkout/create-order', { customer, address, items })

      let rzp
      try {
        rzp = await openRazorpayCheckout({
          keyId: draft.keyId,
          orderId: draft.razorpayOrderId,
          amount: draft.amount,
          currency: draft.currency,
          description: `Order ${draft.orderNumber}`,
          prefill: { name: form.name, email: form.email, contact: form.phone },
        })
      } catch (err) {
        // User dismissed the payment window — not an error. Keep their details
        // and invite them back instead of flashing a scary red banner.
        if (err.cancelled) {
          setNotice('Payment window closed — your details are saved. Tap “Pay” whenever you’re ready.')
          return
        }
        throw err
      }

      // ── Payment is now CAPTURED by Razorpay. Past this point we must never
      //    tell the customer to "try again" — that risks a double charge. ──
      try {
        await api.post('/api/checkout/verify-payment', {
          razorpayOrderId: rzp.orderId,
          razorpayPaymentId: rzp.paymentId,
          razorpaySignature: rzp.signature,
          internalOrderId: draft.internalOrderId,
        })
        setConfirmedOrder({ orderNumber: draft.orderNumber, paymentId: rzp.paymentId, total: draft.amount / 100, method: 'online' })
      } catch (verifyErr) {
        // Money was taken but confirmation didn't come back. Show success with a
        // "we're finalizing" note — do NOT send them back to pay again.
        setConfirmedOrder({
          orderNumber: draft.orderNumber,
          paymentId: rzp.paymentId,
          total: draft.amount / 100,
          method: 'online',
          pendingVerification: true,
        })
      }

      setStep('success')
      clearCart()
      // Meta Pixel — Purchase event (payment was captured either way)
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', { value: draft.amount / 100, currency: 'INR', content_type: 'product' })
      }
    } catch (err) {
      setSubmitError(friendlyError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const processingSteps = paymentMethod === 'cod'
    ? ['Placing your order…', 'Booking your courier…', 'Almost there — hang tight…', 'Still working — please don’t close this…']
    : ['Securing your order…', 'Opening secure payment…', 'Almost there…']
  const processingLabel = processingSteps[Math.min(procStep, processingSteps.length - 1)]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className={`fixed inset-0 z-[60] bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full sm:w-[440px] bg-ink-800 border-l border-bone/10 shadow-2xl flex flex-col transition-transform duration-400 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16,1,0.3,1)' }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-bone/10">
          <div>
            <div className="eyebrow mb-1">
              {step === 'cart' && 'Your Cart'}
              {step === 'form' && 'Shipping & Payment'}
              {step === 'success' && 'Order Confirmed'}
            </div>
            <div className="font-display font-bold text-xl">
              {step === 'cart' && `${count} item${count !== 1 ? 's' : ''}`}
              {step === 'form' && `₹${subtotal.toLocaleString('en-IN')} due`}
              {step === 'success' && `#${confirmedOrder?.orderNumber || ''}`}
            </div>
          </div>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="w-9 h-9 flex items-center justify-center rounded-full border border-bone/15 hover:border-amber hover:text-amber transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        {/* Body */}
        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber/20 border border-amber flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-amber" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            </div>
            <div className="font-display font-bold text-2xl mb-1">
              {confirmedOrder?.method === 'cod' ? 'Order placed' : 'Payment received'}
            </div>
            <div className="font-stencil text-amber mb-3">₹{confirmedOrder?.total.toLocaleString('en-IN')}</div>
            <p className="text-bone/60 text-sm max-w-xs mb-6">
              Order <span className="font-mono text-bone/80">{confirmedOrder?.orderNumber}</span> is confirmed.
              {confirmedOrder?.pendingVerification
                ? ' Your payment went through — we\'re finalizing the order now and will email confirmation shortly. Please do not pay again.'
                : confirmedOrder?.method === 'cod'
                  ? ' Pay on delivery in cash. You\'ll get an email and tracking link shortly.'
                  : ' You\'ll get an email shortly. Shipping update follows when it\'s dispatched.'}
            </p>
            <button onClick={closeCart} className="btn-primary text-sm">Done</button>
          </div>
        ) : step === 'form' ? (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <Field label="Full name" value={form.name} onChange={(v) => setField('name', v)} error={errors.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" type="email" inputMode="email" value={form.email} onChange={(v) => setField('email', v)} error={errors.email} />
              <Field label="Phone" type="tel" inputMode="numeric" value={form.phone} onChange={(v) => {
                let d = v.replace(/\D/g, '')
                if (d.length > 10 && d.startsWith('91')) d = d.slice(2)   // drop pasted +91 prefix
                setField('phone', d.slice(0, 10))
              }} error={errors.phone} />
            </div>
            <Field label="Address line 1" value={form.line1} onChange={(v) => setField('line1', v)} error={errors.line1} />
            <Field label="Address line 2 (optional)" value={form.line2} onChange={(v) => setField('line2', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={form.city} onChange={(v) => setField('city', v)} error={errors.city} />
              <Field label="Pincode" type="tel" inputMode="numeric" value={form.pincode} onChange={(v) => setField('pincode', v.replace(/\D/g,'').slice(0,6))} error={errors.pincode} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-bone/55 block mb-1">State</label>
              <select
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                className="w-full bg-ink border border-bone/15 rounded-lg px-3 py-2.5 text-sm focus:border-amber focus:outline-none"
              >
                <option value="">Select state…</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <div className="text-[11px] text-rust mt-1">{errors.state}</div>}
            </div>
            {submitError && (
              <div className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg p-3">
                {submitError}
              </div>
            )}
            {notice && (
              <div className="text-sm text-amber bg-amber/10 border border-amber/30 rounded-lg p-3">
                {notice}
              </div>
            )}
            <footer className="border-t border-bone/10 pt-5 mt-2 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-bone/55 block mb-2">Payment method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    disabled={submitting}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                      paymentMethod === 'online'
                        ? 'border-amber bg-amber/10 text-bone'
                        : 'border-bone/15 text-bone/70 hover:border-bone/30'
                    }`}
                  >
                    <div className="font-semibold">Pay online</div>
                    <div className="text-[11px] text-bone/50">UPI · Card · Netbanking</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    disabled={submitting}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                      paymentMethod === 'cod'
                        ? 'border-amber bg-amber/10 text-bone'
                        : 'border-bone/15 text-bone/70 hover:border-bone/30'
                    }`}
                  >
                    <div className="font-semibold">Cash on Delivery</div>
                    <div className="text-[11px] text-bone/50">Pay when it arrives</div>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bone/55 text-sm">Total</span>
                <span className="font-display font-bold text-2xl">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <button
                onClick={handlePay}
                disabled={submitting}
                className="btn-primary w-full text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                    </svg>
                    {processingLabel}
                  </>
                ) : (
                  <>
                    {paymentMethod === 'cod'
                      ? `Place COD order · ₹${subtotal.toLocaleString('en-IN')}`
                      : `Pay ₹${subtotal.toLocaleString('en-IN')}`}
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>
                  </>
                )}
              </button>
              <button
                onClick={() => setStep('cart')}
                disabled={submitting}
                className="w-full text-xs uppercase tracking-widest text-bone/40 hover:text-amber transition disabled:opacity-30"
              >
                ← Back to cart
              </button>
            </footer>
          </div>
        ) : lineItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full border-2 border-bone/10 flex items-center justify-center mb-5 text-bone/30">
              <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <div className="font-display font-bold text-xl mb-1">Your cart is empty</div>
            <p className="text-bone/50 text-sm mb-6">Start with the T-Rex 500ml bottle — ₹1,999.</p>
            <button onClick={() => { closeCart(); navigate('shop') }} className="btn-primary text-sm">Shop the stack</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {lineItems.map((l, i) => (
                <div key={`${l.productId}-${l.variantId}-${i}`} className="flex gap-3 p-3 rounded-xl border border-bone/10 bg-ink/40">
                  <div className={`flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br ${l.product.accent} flex items-center justify-center font-display font-black text-ink/70 text-2xl`}>
                    {l.product.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-tight">{l.product.name}</div>
                      <button onClick={() => removeItem(i)} aria-label="Remove" className="text-bone/40 hover:text-rust transition shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 3h6"/></svg>
                      </button>
                    </div>
                    <div className="text-[11px] uppercase tracking-widest text-bone/40 mb-2">
                      {l.variant.label}{l.variant.sub ? ` · ${l.variant.sub}` : ''}
                    </div>
                    <div className="flex items-center justify-between">
                      <QtyStepper qty={l.qty} onChange={(q) => updateQty(i, q)} />
                      <div className="text-right">
                        <div className="font-display font-bold">₹{(l.variant.price * l.qty).toLocaleString('en-IN')}</div>
                        {l.variant.compareAt && (
                          <div className="text-[10px] text-bone/40 line-through">₹{(l.variant.compareAt * l.qty).toLocaleString('en-IN')}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-bone/10 p-6 space-y-4">
              {saved > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-bone/55">You save</span>
                  <span className="font-semibold text-amber">₹{saved.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-bone/55">Subtotal</span>
                <span className="font-display font-bold text-2xl">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="text-[11px] uppercase tracking-widest text-bone/40 flex items-center gap-2">
                <svg className="w-3 h-3 text-forest" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Free shipping over ₹1000 · 3rd party tested
              </div>
              <button
                onClick={() => {
                  setStep('form')
                  if (typeof window.fbq === 'function') {
                    window.fbq('track', 'InitiateCheckout', { value: subtotal, currency: 'INR', num_items: count })
                  }
                }}
                className="btn-primary w-full text-base"
              >
                Checkout — ₹{subtotal.toLocaleString('en-IN')}
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>
              </button>
              <button onClick={clearCart} className="w-full text-xs uppercase tracking-widest text-bone/40 hover:text-rust transition">
                Clear cart
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}

// Turn technical/server errors into copy a customer can act on.
function friendlyError(err) {
  const code = err?.payload?.error
  if (code === 'SHIPMENT_FAILED' || err?.status === 502) {
    return 'We couldn’t reach our courier just now. Please try again in a moment, or switch to “Pay online”.'
  }
  if (err?.status === 503 || code === 'SUPABASE_NOT_CONFIGURED') {
    return 'Our checkout is briefly unavailable. Please try again in a minute.'
  }
  if (err?.code === 'TIMEOUT' || err?.code === 'NETWORK') {
    return err.message
  }
  return err?.message || 'Something went wrong. Please try again.'
}

function Field({ label, type = 'text', inputMode, value, onChange, error }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-bone/55 block mb-1">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-ink border border-bone/15 rounded-lg px-3 py-2.5 text-sm focus:border-amber focus:outline-none"
      />
      {error && <div className="text-[11px] text-rust mt-1">{error}</div>}
    </div>
  )
}

function QtyStepper({ qty, onChange }) {
  return (
    <div className="inline-flex items-center border border-bone/15 rounded-full overflow-hidden text-sm">
      <button
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 1}
        aria-label="Decrease quantity"
        className="w-7 h-7 flex items-center justify-center text-bone/60 hover:text-amber disabled:opacity-30 transition"
      >−</button>
      <span className="px-2 min-w-[1.5rem] text-center font-medium tabular-nums">{qty}</span>
      <button
        onClick={() => onChange(qty + 1)}
        aria-label="Increase quantity"
        className="w-7 h-7 flex items-center justify-center text-bone/60 hover:text-amber transition"
      >+</button>
    </div>
  )
}
