/**
 * Lazy-load the Razorpay Checkout JS and open the modal.
 *
 * Usage:
 *   const { paymentId, signature, orderId } = await openRazorpayCheckout({
 *     keyId, orderId, amount, currency, name, description, prefill, theme
 *   })
 *
 * Resolves on payment success, rejects on dismiss / failure.
 */
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let scriptPromise = null

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.Razorpay) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      scriptPromise = null
      reject(new Error('Failed to load Razorpay checkout script'))
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

export async function openRazorpayCheckout({
  keyId,
  orderId,
  amount,
  currency = 'INR',
  name = 'Primal Nutrition',
  description = 'T-Rex liquid + supplements',
  prefill = {},
  theme = { color: '#d6a85a' },
}) {
  await loadScript()

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name,
      description,
      prefill,
      theme,
      modal: {
        ondismiss: () => {
          // User closed the modal (e.g. to switch card → UPI). Not a failure —
          // flag it so the UI shows a calm "ready when you are" prompt, not a red error.
          const err = new Error('Payment cancelled')
          err.cancelled = true
          reject(err)
        },
      },
      handler: (response) => {
        resolve({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        })
      },
    })
    rzp.on('payment.failed', (err) => {
      reject(new Error(err?.error?.description || 'Payment failed'))
    })
    rzp.open()
  })
}
