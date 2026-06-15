import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { usePage } from '../context/RouterContext.jsx'
import { productById, products, tiers } from '../data/products.js'
import ProductVisual from './ProductVisual.jsx'
import ProductGallery from './ProductGallery.jsx'
import Footer from './Footer.jsx'
import StickyProductCTA from './StickyProductCTA.jsx'
import { track } from '../lib/metaPixel.js'

export default function ProductDetail({ productId }) {
  const product = productById(productId)
  const { addToCart } = useCart()
  const { navigate } = usePage()
  const [variantId, setVariantId] = useState(product?.variants[0]?.id)
  const [adding, setAdding] = useState(false)

  // Scroll to top when product changes
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
    if (product) setVariantId(product.variants[0].id)
  }, [productId])

  useEffect(() => {
    if (!product) return
    const entryVariant = product.variants[0]
    track('ViewContent', {
      content_ids: [entryVariant?.id || product.id],
      content_name: product.name,
      content_type: 'product',
      value: entryVariant?.price,
      currency: 'INR',
    })
  }, [productId])

  if (!product) {
    return (
      <section className="pt-40 pb-32 container-x text-center">
        <div className="eyebrow mb-3">404</div>
        <h1 className="font-display text-4xl font-bold mb-4">Product not found</h1>
        <button onClick={() => navigate('shop')} className="btn-primary">Back to shop</button>
      </section>
    )
  }

  const pdp = product.pdp
  const variant = product.variants.find((v) => v.id === variantId)
  const stackProducts = (pdp?.stackWith || [])
    .map((id) => productById(id))
    .filter(Boolean)

  const handleAdd = () => {
    setAdding(true)
    addToCart(product.id, variantId, 1, true)   // open the cart so checkout is one tap away
    setTimeout(() => setAdding(false), 900)
  }

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 lg:pb-24 overflow-hidden gradient-amber grain">
        <div className="absolute -top-40 right-0 w-[600px] h-[600px] rounded-full bg-amber/10 blur-[140px] pointer-events-none" />

        <div className="container-x relative">
          {/* Breadcrumb */}
          <nav className="mb-10 text-xs uppercase tracking-widest text-bone/45 flex items-center gap-2">
            <button onClick={() => navigate('home')} className="hover:text-amber transition">Home</button>
            <span>/</span>
            <button onClick={() => navigate('shop')} className="hover:text-amber transition">Shop</button>
            <span>/</span>
            <span className="text-bone/80">{product.name}</span>
          </nav>

          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Visual */}
            <div className="lg:col-span-6 lg:sticky lg:top-28">
              <div className="max-w-md mx-auto">
                <ProductGallery product={product} />
              </div>
              {pdp?.metrics && (
                <div className="grid grid-cols-2 gap-3 mt-6 max-w-md mx-auto">
                  {pdp.metrics.map((m) => (
                    <div key={m.label} className="p-4 rounded-xl border border-bone/10 bg-ink-800/40">
                      <div className="font-display font-bold text-amber text-xl leading-none">{m.value}</div>
                      <div className="text-[10px] uppercase tracking-widest text-bone/45 mt-1.5">{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="lg:col-span-6">
              {product.tier && (
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold mb-5 px-3 py-1 rounded-full bg-amber/15 text-amber border border-amber/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber" />
                  {tiers[product.tier]?.label || product.tier} · {tiers[product.tier]?.role}
                </div>
              )}

              <h1 className="font-display font-black text-5xl lg:text-6xl leading-[0.95] tracking-tightest mb-3">
                {product.name}
              </h1>
              <p className="font-display italic text-2xl text-amber-light mb-6">{product.subtitle}</p>

              <p className="text-lg text-bone/75 leading-relaxed mb-8">{pdp?.heroClaim || product.description}</p>

              {/* Variant selector */}
              {product.variants.length > 1 ? (
                <div className="space-y-2 mb-6">
                  <div className="eyebrow text-[10px]">Choose size</div>
                  {product.variants.map((v) => {
                    const active = v.id === variantId
                    return (
                      <button
                        key={v.id}
                        onClick={() => setVariantId(v.id)}
                        className={`w-full flex items-center justify-between text-left px-4 py-3 rounded-xl border text-sm transition ${
                          active
                            ? 'border-amber bg-amber/10'
                            : 'border-bone/10 hover:border-bone/30'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-bone">{v.label}</div>
                          <div className="text-[11px] uppercase tracking-widest text-bone/45">{v.sub}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-display font-bold text-bone">₹{v.price.toLocaleString('en-IN')}</div>
                          {v.compareAt && (
                            <div className="text-[10px] text-bone/40 line-through">₹{v.compareAt.toLocaleString('en-IN')}</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mb-6">
                  <div className="text-[10px] uppercase tracking-widest text-bone/45 mb-1">{variant.label} · {variant.sub}</div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display font-bold text-4xl text-bone">₹{variant.price.toLocaleString('en-IN')}</span>
                    {variant.compareAt && (
                      <span className="text-bone/40 line-through text-lg">₹{variant.compareAt.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleAdd}
                disabled={adding}
                className={`w-full py-4 rounded-full font-semibold transition-all duration-300 text-base ${
                  adding ? 'bg-forest text-bone' : 'btn-primary'
                }`}
              >
                {adding ? '✓ Added to cart' : `Add to Cart — ₹${variant.price.toLocaleString('en-IN')}`}
              </button>

              <div className="grid grid-cols-3 gap-2 mt-6 text-[10px] uppercase tracking-widest text-bone/50 text-center font-brand">
                <div className="p-3 border border-bone/10 rounded-xl">
                  <div className="text-amber font-bold mb-1">Free</div>
                  Pan-India shipping
                </div>
                <div className="p-3 border border-bone/10 rounded-xl">
                  <div className="text-amber font-bold mb-1">COD</div>
                  Available nationwide
                </div>
                <div className="p-3 border border-bone/10 rounded-xl">
                  <div className="text-amber font-bold mb-1">3rd Party</div>
                  Lab tested
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ───────────────────────────────────────── */}
      {pdp?.problem && (
        <section className="py-24 bg-gradient-to-b from-ink to-ink-800/30">
          <div className="container-x max-w-4xl">
            <div className="eyebrow mb-5">The Problem</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05] mb-8">
              {pdp.problem.title}
            </h2>
            <p className="text-xl text-bone/70 leading-relaxed">{pdp.problem.body}</p>
          </div>
        </section>
      )}

      {/* ── Mechanism ─────────────────────────────────────── */}
      {pdp?.mechanism && (
        <section className="py-24">
          <div className="container-x">
            <div className="max-w-2xl mb-12">
              <div className="eyebrow mb-5">The Mechanism</div>
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                {pdp.mechanism.title}
              </h2>
            </div>
            <div data-reveal-stagger className="grid md:grid-cols-3 gap-5">
              {pdp.mechanism.steps.map((s, i) => {
                /* Per-step icon SVGs — amber/gold toned */
                const icons = [
                  /* 01 — Liquid drop */
                  <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9" aria-hidden>
                    <path d="M20 5C20 5 9 17 9 24.5C9 30.85 13.93 36 20 36C26.07 36 31 30.85 31 24.5C31 17 20 5 20 5Z"
                          fill="rgba(245,176,55,0.18)" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M14 26C14 26 14 30 20 30" stroke="rgb(245,176,55)" strokeWidth="1.4"
                          strokeLinecap="round" strokeOpacity="0.5"/>
                  </svg>,
                  /* 02 — Mortar & pestle */
                  <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9" aria-hidden>
                    <ellipse cx="20" cy="28" rx="11" ry="4.5" fill="rgba(245,176,55,0.12)" stroke="rgb(245,176,55)" strokeWidth="1.5"/>
                    <path d="M9 28V22C9 16.48 14.37 12 20 12C25.63 12 31 16.48 31 22V28"
                          fill="rgba(245,176,55,0.08)" stroke="rgb(245,176,55)" strokeWidth="1.5"/>
                    <path d="M25 12L30 6" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="31.5" cy="5" r="2" fill="rgb(245,176,55)" fillOpacity="0.7"/>
                  </svg>,
                  /* 03 — Herb cluster */
                  <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9" aria-hidden>
                    <path d="M20 36V22" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M20 26C20 26 14 21 7 22C7 22 7 29 13 31.5L20 34"
                          fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M20 24C20 24 26 19 33 20C33 20 33 27 27 29.5L20 32"
                          fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M20 22C20 22 18 14 13 10C13 10 17 18 20 22Z"
                          fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M20 20C20 20 23 12 28 9C28 9 24 17 20 20Z"
                          fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>,
                ]

                return (
                  <div key={s.h} className="relative card-lift rounded-2xl border border-amber/20 bg-ink-800/50 overflow-hidden flex flex-col">
                    {/* Amber top stripe */}
                    <div className="h-[2px] bg-gradient-to-r from-amber via-amber/40 to-transparent flex-shrink-0" />

                    <div className="p-7 flex flex-col gap-6 flex-1">

                      {/* ── Icon circle ── */}
                      <div className="relative w-[68px] h-[68px] flex-shrink-0">
                        {/* Dashed amber ring */}
                        <svg viewBox="0 0 68 68" className="absolute inset-0 w-full h-full" aria-hidden>
                          <circle cx="34" cy="34" r="32"
                            stroke="rgb(245,176,55)" strokeOpacity="0.35"
                            strokeWidth="1.5" strokeDasharray="4 5"
                            fill="none"/>
                        </svg>
                        {/* Solid inner circle */}
                        <div className="absolute inset-[10px] rounded-full bg-amber/5 border border-amber/25 flex items-center justify-center">
                          {icons[i]}
                        </div>
                      </div>

                      {/* ── Number · divider · heading ── */}
                      <div className="flex items-center gap-3">
                        <span className="font-display font-black text-[2rem] leading-none text-amber tracking-tighter flex-shrink-0">
                          0{i + 1}<span className="text-amber/50">.</span>
                        </span>
                        {/* Vertical divider */}
                        <div className="w-px h-8 bg-amber/40 flex-shrink-0" />
                        <h3 className="font-display font-bold text-[0.95rem] uppercase tracking-widest text-bone leading-snug">
                          {s.h}
                        </h3>
                      </div>

                      {/* ── Body ── */}
                      <p className="text-bone/60 leading-relaxed text-[14px]">{s.b}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Evidence ──────────────────────────────────────── */}
      {pdp?.evidence?.length > 0 && (
        <section className="py-24 bg-gradient-to-b from-ink-800/30 to-ink">
          <div className="container-x">
            <div className="max-w-2xl mb-12">
              <div className="eyebrow mb-5">The Evidence</div>
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                We don't make claims.<br/>
                <span className="italic font-medium text-amber-light">We cite studies.</span>
              </h2>
            </div>
            <div className="space-y-4 max-w-4xl">
              {pdp.evidence.map((e, i) => (
                <article key={i} className="card-lift p-6 rounded-2xl border border-bone/10 bg-ink-800/40 grid md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-5">
                    <div className="text-[11px] uppercase tracking-widest text-amber mb-1">Study {i + 1}</div>
                    <div className="font-display font-semibold text-bone leading-tight">{e.study}</div>
                  </div>
                  <div className="md:col-span-6 text-bone/70 text-[15px] leading-relaxed">{e.finding}</div>
                  <div className="md:col-span-1 text-[10px] uppercase tracking-widest text-bone/40 md:text-right break-all">
                    {e.source}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Protocol + Who-for/Not-for ─────────────────────── */}
      <section className="py-24">
        <div className="container-x grid lg:grid-cols-2 gap-12">
          {pdp?.protocol && (
            <div>
              <div className="eyebrow mb-5">The Protocol</div>
              <h3 className="font-display text-3xl font-bold mb-8 tracking-tightest leading-tight">
                When, how, with what.
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: 'When', value: pdp.protocol.when,
                    icon: (
                      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7" aria-hidden>
                        {/* Sunrise */}
                        <path d="M9 27C9 21.48 13.03 17 18 17C22.97 17 27 21.48 27 27" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M5 27H31" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M18 13V10" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M9.5 16.5L7.5 14.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M26.5 16.5L28.5 14.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M5.5 20.5H8" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M28 20.5H30.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    label: 'How', value: pdp.protocol.how,
                    icon: (
                      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7" aria-hidden>
                        {/* Dropper / sublingual */}
                        <path d="M22 4L26 8L14 20L10 16L22 4Z" fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M10 16L8 24L16 22L10 16Z" fill="rgba(245,176,55,0.1)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                        <circle cx="21" cy="29" r="2.5" fill="rgba(245,176,55,0.25)" stroke="rgb(245,176,55)" strokeWidth="1.3"/>
                        <path d="M21 25V26.5" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    label: 'With', value: pdp.protocol.withWhat,
                    icon: (
                      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7" aria-hidden>
                        {/* Shaker bottle with motion lines */}
                        <path d="M14 7H22V11H14V7Z" fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M12 11H24L26 29C26 29.55 25.55 30 25 30H11C10.45 30 10 29.55 10 29L12 11Z" fill="rgba(245,176,55,0.08)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                        <path d="M5 18H8.5" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.55"/>
                        <path d="M4 22H7" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.35"/>
                        <path d="M27.5 18H31" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.55"/>
                        <path d="M29 22H32" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.35"/>
                      </svg>
                    ),
                  },
                  {
                    label: 'Cycle', value: pdp.protocol.cycle,
                    icon: (
                      <svg viewBox="0 0 36 36" fill="none" className="w-7 h-7" aria-hidden>
                        {/* Circular refresh arrows */}
                        <path d="M28 18C28 23.52 23.52 28 18 28C12.48 28 8 23.52 8 18C8 12.48 12.48 8 18 8C21.5 8 24.6 9.74 26.5 12.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M24 8L27 12.5L22 13" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ),
                  },
                ].map(({ label, value, icon }, i) => (
                  <div key={label} className="flex items-center gap-3 md:gap-4 rounded-2xl border border-amber/20 bg-ink-800/50 px-4 py-4 md:px-5">
                    {/* Dashed-ring icon */}
                    <div className="relative flex-shrink-0 w-[58px] h-[58px]">
                      <svg viewBox="0 0 58 58" className="absolute inset-0 w-full h-full" aria-hidden>
                        <circle cx="29" cy="29" r="27" stroke="rgb(245,176,55)" strokeOpacity="0.35"
                                strokeWidth="1.5" strokeDasharray="4 5" fill="none"/>
                      </svg>
                      <div className="absolute inset-[8px] rounded-full bg-amber/5 border border-amber/25 flex items-center justify-center">
                        {icon}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-9 bg-amber/35 flex-shrink-0" />

                    {/* Step number */}
                    <span className="font-display font-black text-[1.85rem] leading-none text-amber flex-shrink-0 tracking-tighter">
                      0{i + 1}<span className="text-amber/45">.</span>
                    </span>

                    {/* Divider */}
                    <div className="w-px h-9 bg-amber/35 flex-shrink-0" />

                    {/* Label + value */}
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[0.8rem] uppercase tracking-widest text-bone mb-1">{label}</div>
                      <div className="text-bone/60 text-[13px] leading-relaxed">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(pdp?.whoFor || pdp?.whoNotFor) && (
            <div className="grid gap-6">
              {pdp?.whoFor && (
                <div className="p-6 rounded-2xl border border-amber/20 bg-amber/5">
                  <div className="eyebrow mb-3 text-amber">Built for</div>
                  <ul className="space-y-2">
                    {pdp.whoFor.map((w) => (
                      <li key={w} className="flex items-start gap-2 text-bone/85 text-[15px]">
                        <span className="text-amber mt-0.5">✓</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pdp?.whoNotFor && (
                <div className="p-6 rounded-2xl border border-rust/30 bg-rust/5">
                  <div className="eyebrow mb-3 text-rust">Not for</div>
                  <ul className="space-y-2">
                    {pdp.whoNotFor.map((w) => (
                      <li key={w} className="flex items-start gap-2 text-bone/85 text-[15px]">
                        <span className="text-rust mt-0.5">✕</span>{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Timeline (for T-Rex Liquid) ─────────────────────── */}
      {pdp?.timeline && (
        <section className="py-24 bg-gradient-to-b from-ink to-ink-800/30">
          <div className="container-x">
            <div className="max-w-2xl mb-12">
              <div className="eyebrow mb-5">The 90-Day Curve</div>
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                What changes when.
              </h2>
            </div>
            <div className="space-y-4 max-w-3xl">
              {pdp.timeline.map((t, i) => {
                const num = t.week.split(' ')[1].padStart(2, '0')
                const icons = [
                  /* Week 1 — Crescent moon (sleep) */
                  <svg key="moon" viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden>
                    <path d="M21 7C15 7 10 12 10 18C10 24 15 29 21 29C24.5 29 27.7 27.3 29.6 24.6C27.5 25.1 25.1 25 23 23.8C18.3 21.2 16.2 15.5 18 10.2C18.9 7.9 19.8 7.2 21 7Z"
                          fill="rgba(245,176,55,0.18)" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinejoin="round"/>
                    <circle cx="27.5" cy="9.5" r="1.5" fill="rgb(245,176,55)" fillOpacity="0.65"/>
                    <circle cx="30.5" cy="13.5" r="1" fill="rgb(245,176,55)" fillOpacity="0.45"/>
                    <circle cx="28.5" cy="6.5" r="0.8" fill="rgb(245,176,55)" fillOpacity="0.35"/>
                  </svg>,
                  /* Week 4 — Flexed arm (strength) */
                  <svg key="arm" viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden>
                    <path d="M8 26C8 26 7 20 10 17C12 15 14 15 15 13C16.2 10.8 16 8.5 18.5 7.5C21.5 6.5 24.5 9 25 12C25.4 14.2 24.5 16 23 17.5L26 20.5C28 22.5 28 26 26 27C24.2 27.8 22 27 21 25L19 22C18 23 16.5 24 14.5 24C11.5 24 9.5 25.5 8.5 27L8 26Z"
                          fill="rgba(245,176,55,0.15)" stroke="rgb(245,176,55)" strokeWidth="1.4" strokeLinejoin="round"/>
                  </svg>,
                  /* Week 8 — Male symbol (testosterone) */
                  <svg key="male" viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden>
                    <circle cx="15.5" cy="22" r="8.5" fill="rgba(245,176,55,0.12)" stroke="rgb(245,176,55)" strokeWidth="1.5"/>
                    <path d="M22 16L29.5 8.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M24.5 8.5H29.5V13.5" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>,
                  /* Week 12 — Mountain with flag (new baseline) */
                  <svg key="mountain" viewBox="0 0 36 36" fill="none" className="w-8 h-8" aria-hidden>
                    <path d="M3 30L13 13L18.5 21.5L23 15L33 30H3Z"
                          fill="rgba(245,176,55,0.12)" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M23 15V8" stroke="rgb(245,176,55)" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M23 8L28.5 10.8L23 13.5" fill="rgba(245,176,55,0.3)" stroke="rgb(245,176,55)" strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>,
                ]

                return (
                  <div key={t.week} className="flex items-center gap-4 md:gap-5 rounded-2xl border border-amber/20 bg-ink-800/50 px-4 md:px-6 py-4 card-lift">
                    {/* Dashed-ring icon */}
                    <div className="relative flex-shrink-0 w-[64px] h-[64px]">
                      <svg viewBox="0 0 64 64" className="absolute inset-0 w-full h-full" aria-hidden>
                        <circle cx="32" cy="32" r="30" stroke="rgb(245,176,55)" strokeOpacity="0.35"
                                strokeWidth="1.5" strokeDasharray="4 5" fill="none"/>
                      </svg>
                      <div className="absolute inset-[9px] rounded-full bg-amber/5 border border-amber/25 flex items-center justify-center">
                        {icons[i]}
                      </div>
                    </div>

                    {/* Vertical bar */}
                    <div className="w-px h-12 bg-amber/35 flex-shrink-0" />

                    {/* WEEK + large number */}
                    <div className="flex-shrink-0 w-[4.5rem]">
                      <div className="font-display text-[0.6rem] uppercase tracking-[0.22em] text-bone/45 mb-0.5">Week</div>
                      <div className="font-display font-black text-[2.6rem] leading-none text-amber tracking-tighter">{num}</div>
                    </div>

                    {/* Vertical bar */}
                    <div className="w-px h-12 bg-amber/35 flex-shrink-0" />

                    {/* Description */}
                    <p className="text-bone/65 text-[14px] leading-relaxed">{t.what}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Stack with ───────────────────────────────────── */}
      {stackProducts.length > 0 && (
        <section className="py-24">
          <div className="container-x">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
              <div className="max-w-xl">
                <div className="eyebrow mb-5">Stack with</div>
                <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                  Designed to layer.
                </h2>
                <p className="mt-4 text-bone/65">Recommended companions for the {product.name} protocol.</p>
              </div>
              <button onClick={() => navigate('shop')} className="btn-ghost text-sm">View full catalog →</button>
            </div>

            <div data-reveal-stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {stackProducts.map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => navigate('product', { id: sp.id })}
                  className="card-lift group text-left flex flex-col p-3 rounded-3xl border border-bone/10 bg-ink-800/40 hover:border-amber/30 transition"
                >
                  <ProductVisual product={sp} />
                  <div className="p-3 pt-5">
                    <div className="font-display font-bold text-xl mb-1">{sp.name}</div>
                    <div className="text-[11px] uppercase tracking-widest text-bone/45 mb-3">{sp.tagline}</div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-display font-bold text-bone">From ₹{sp.variants[0].price.toLocaleString('en-IN')}</span>
                      <span className="text-amber text-sm group-hover:translate-x-1 transition">View →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Reviews ──────────────────────────────────────── */}
      {pdp?.reviews?.length > 0 && (
        <section className="py-24 bg-gradient-to-b from-ink-800/30 to-ink">
          <div className="container-x">
            <div className="max-w-2xl mb-10">
              <div className="eyebrow mb-5">Verified buyers</div>
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                Real men. Real results.
              </h2>
            </div>
            <div data-reveal-stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pdp.reviews.map((r) => (
                <article key={r.name} className="card-lift p-6 rounded-2xl border border-bone/10 bg-ink-800/40 flex flex-col">
                  <div className="flex items-center gap-1 text-amber mb-3">
                    {Array.from({ length: r.rating }).map((_, i) => <span key={i}>★</span>)}
                    {Array.from({ length: 5 - r.rating }).map((_, i) => <span key={i} className="text-bone/15">★</span>)}
                  </div>
                  <h3 className="font-display font-semibold text-lg leading-snug mb-3">"{r.title}"</h3>
                  <p className="text-bone/65 text-[14px] leading-relaxed flex-1 mb-5">{r.body}</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-bone/5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber/40 to-rust/30 flex items-center justify-center font-display font-bold text-bone text-sm">
                      {r.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-[11px] text-bone/40">{r.city} · {r.age}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-forest/80">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      Verified
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-bone/30 mt-2">{r.time}</div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────── */}
      {pdp?.faq?.length > 0 && (
        <section className="py-24">
          <div className="container-x grid lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <div className="eyebrow mb-5">Questions</div>
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05]">
                Asked & answered.
              </h2>
            </div>
            <div className="lg:col-span-8 border-t border-bone/10">
              {pdp.faq.map((f) => (
                <details key={f.q} className="group border-b border-bone/10">
                  <summary className="cursor-pointer flex items-center justify-between py-5 list-none">
                    <span className="font-display text-lg lg:text-xl pr-6 text-bone group-hover:text-amber transition">{f.q}</span>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full border border-bone/20 flex items-center justify-center text-bone/60 group-open:bg-amber group-open:text-ink group-open:border-amber group-open:rotate-45 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                    </span>
                  </summary>
                  <p className="pb-6 text-bone/70 leading-relaxed text-[15px] max-w-2xl">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="py-24">
        <div className="container-x">
          <div className="relative max-w-4xl mx-auto p-10 lg:p-14 rounded-3xl border border-amber/30 bg-gradient-to-br from-amber/10 via-ink-800/40 to-rust/5 text-center overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-amber/20 blur-[100px]" />
            <div className="relative">
              <h2 className="font-display text-4xl lg:text-5xl font-bold tracking-tightest leading-[1.05] mb-5">
                Start the {product.name} protocol.
              </h2>
              <p className="text-bone/70 text-lg mb-8 max-w-xl mx-auto">
                {pdp?.protocol?.cycle || 'Cycle this with discipline. We refund if the bottle does not deliver.'}
              </p>
              <button onClick={handleAdd} className="btn-primary text-base">
                {adding ? '✓ Added' : `Add ${product.name} — ₹${variant.price.toLocaleString('en-IN')}`}
              </button>
              <div className="mt-5 flex items-center justify-center gap-4 text-[11px] uppercase tracking-widest text-bone/40 font-brand">
                <span>Free shipping</span>
                <span>·</span>
                <span>Cash on delivery</span>
                <span>·</span>
                <span>3rd Party tested</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <StickyProductCTA product={product} variant={variant} />
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-bone/10">
      <dt className="text-[11px] uppercase tracking-widest text-bone/45 self-center">{label}</dt>
      <dd className="col-span-2 text-bone/85 text-[15px]">{value}</dd>
    </div>
  )
}
