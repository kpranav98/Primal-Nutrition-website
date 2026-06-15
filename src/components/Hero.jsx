import { useEffect, useRef, useState } from 'react'
import CountUp from './CountUp.jsx'
import Picture from './Picture.jsx'

const SLIDE_COUNT = 2

export default function Hero() {
  const [slide, setSlide] = useState(0)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef(null)

  const next = () => setSlide((s) => (s + 1) % SLIDE_COUNT)
  const prev = () => setSlide((s) => (s - 1 + SLIDE_COUNT) % SLIDE_COUNT)

  // Pause/play video when slide changes + lock body scroll on full-page video
  useEffect(() => {
    const v = videoRef.current
    if (v) {
      if (slide === 1) v.play().catch(() => {})
      else v.pause()
    }
    document.body.style.overflow = slide === 1 ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [slide])

  // ESC closes the full-page video
  useEffect(() => {
    if (slide !== 1) return
    const onKey = (e) => { if (e.key === 'Escape') setSlide(0) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slide])

  const toggleMute = (e) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted) v.play().catch(() => {})
  }

  return (
    <section className="relative min-h-screen pt-28 pb-20 overflow-hidden gradient-amber grain">
      {/* Ambient glow */}
      <div className="absolute top-1/3 right-0 w-[600px] h-[600px] rounded-full bg-amber/10 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-rust/10 blur-[120px] pointer-events-none" />

      {/* Carousel stage */}
      <div className="relative">
        {/* Slide 1 — Hero copy + bottle */}
        <div
          className={`transition-opacity duration-500 ${
            slide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'
          }`}
        >
          <div className="container-x relative grid lg:grid-cols-12 gap-12 items-center min-h-[80vh]">
            {/* Left: copy */}
            <div className="lg:col-span-7 z-10">
              <div className="eyebrow mb-6 animate-fade-up font-brand tracking-[0.28em]">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-primal mr-3 align-middle animate-shimmer" />
                India's First 7-in-1 Natural Performance Liquid
              </div>

              <h1 className="font-display text-6xl sm:text-7xl lg:text-[8rem] leading-[0.88] tracking-tight mb-6 animate-fade-up uppercase">
                BUILT FOR THE<br />
                MEN INDIA<br />
                <span className="text-shimmer">FORGOT TO MAKE.</span>
              </h1>

              <p className="text-lg lg:text-xl text-bone/70 max-w-xl mb-8 leading-relaxed animate-fade-up">
                <span className="text-bone">Himalayan Shilajit + 6 Ayurvedic herbs</span> in liquid form. The way our ancestors made it. Built for the man who walks the rough road — and refuses chemicals, stimulants, or shortcuts.
              </p>

              {/* CTA cluster */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 animate-fade-up">
                <a href="#bundle" className="btn-primary text-base">
                  Buy T-Rex — ₹1,999
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>
                </a>
                <a href="#science" className="btn-ghost text-base">See the science</a>
              </div>

              {/* Price anchor strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-10 text-[12px] uppercase tracking-widest text-bone/55 font-brand animate-fade-up">
                <span className="text-bone/85">₹1,999 <span className="line-through text-bone/35 ml-1">₹2,200</span></span>
                <span className="w-1 h-1 rounded-full bg-bone/20" />
                <span>Hazelnut · 500ml</span>
                <span className="w-1 h-1 rounded-full bg-bone/20" />
                <span>COD available</span>
                <span className="w-1 h-1 rounded-full bg-bone/20" />
                <span>Free shipping</span>
              </div>

              {/* Trust micro-stats */}
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-bone/60 animate-fade-up pb-6">
                <Stat label="Verified buyers" valueNode={<><CountUp end={12400} duration={2200} />+</>} />
                <Stat label="Avg. rating" valueNode={<><CountUp end={4.8} decimals={1} duration={1600} /> ★</>} />
                <Stat label="Lab-tested" value="3rd Party" />
                <Stat label="Made in" value="India" />
              </div>
            </div>

            {/* Right: product showcase */}
            <div className="lg:col-span-5 relative z-10 flex justify-center lg:justify-end lg:translate-x-12 animate-fade-up">
              <Bottle3D />
            </div>
          </div>
        </div>

        {/* Slide 2 — Full-page video overlay */}
        {slide === 1 && (
          <div className="fixed inset-0 z-[60] bg-ink animate-fade-up">
            <video
              ref={videoRef}
              src="/brand/trex-reel-final.mp4"
              autoPlay
              loop
              muted={muted}
              playsInline
              preload="auto"
              poster="/products/trex-liquid-01.webp"
              className="w-full h-full object-cover"
            />

            {/* Close — returns to hero */}
            <button
              onClick={prev}
              aria-label="Close video"
              className="absolute top-6 left-6 w-12 h-12 rounded-full bg-ink/70 backdrop-blur-md border border-bone/20 flex items-center justify-center text-bone hover:bg-amber hover:text-ink transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-ink/70 backdrop-blur-md border border-amber/30 flex items-center justify-center text-bone hover:bg-amber hover:text-ink transition"
            >
              {muted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.786L4.586 14H3a1 1 0 01-1-1V7a1 1 0 011-1h1.586l3.797-2.924zM15.293 4.293a1 1 0 011.414 0L18 5.586l1.293-1.293a1 1 0 011.414 1.414L19.414 7l1.293 1.293a1 1 0 01-1.414 1.414L18 8.414l-1.293 1.293a1 1 0 01-1.414-1.414L16.586 7l-1.293-1.293a1 1 0 010-1.414z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.786L4.586 14H3a1 1 0 01-1-1V7a1 1 0 011-1h1.586l3.797-2.924A1 1 0 019.383 3.076zM12.293 7.293a1 1 0 011.414 0 5 5 0 010 7.07 1 1 0 11-1.414-1.414 3 3 0 000-4.243 1 1 0 010-1.413zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              )}
            </button>

            {/* Caption — bottom-left, low-key */}
            <div className="absolute bottom-6 left-6 right-6 sm:right-auto sm:max-w-md pointer-events-none">
              <p className="font-brand uppercase tracking-[0.28em] text-[11px] text-bone/70 mb-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-gradient-primal mr-3 align-middle animate-shimmer" />
                The T-Rex Story
              </p>
              <p className="text-bone/80 text-sm sm:text-base leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                Watch how Himalayan Shilajit and 6 Ayurvedic herbs become India's first 7-in-1 performance liquid.
              </p>
            </div>
          </div>
        )}

        {/* Carousel arrows */}
        <button
          onClick={prev}
          aria-label="Previous slide"
          className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-ink/85 backdrop-blur-md border border-bone/15 hover:border-amber hover:text-amber items-center justify-center text-bone transition z-30"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <button
          onClick={next}
          aria-label="Next slide"
          className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-ink/85 backdrop-blur-md border border-bone/15 hover:border-amber hover:text-amber items-center justify-center text-bone transition z-30"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </button>

        {/* Mobile next button (full width tap) */}
        <button
          onClick={next}
          aria-label="Next slide"
          className="sm:hidden absolute right-3 top-4 w-11 h-11 rounded-full bg-ink/85 backdrop-blur-md border border-amber/30 flex items-center justify-center text-bone transition z-30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === slide ? 'w-10 bg-amber' : 'w-2 bg-bone/30 hover:bg-bone/50'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, valueNode }) {
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="font-stencil text-gradient-primal text-2xl leading-none">{valueNode || value}</span>
      <span className="text-[11px] uppercase tracking-widest text-bone/50">{label}</span>
    </div>
  )
}

/* Clean product showcase — bottle rendered at native dimensions, no animations.
   All motion lives in the three floating chips: orbital drift + shimmer sweep
   + amber accent pulse + magnetic cursor attraction. */
function Bottle3D() {
  const wrapRef = useRef(null)
  const rafRef = useRef(null)
  const chipRefs = useRef({})
  const [magnetic, setMagnetic] = useState({})

  const handleMove = (e) => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const next = {}
      for (const [key, el] of Object.entries(chipRefs.current)) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = e.clientX - cx
        const dy = e.clientY - cy
        const dist = Math.hypot(dx, dy)
        const RANGE = 180
        if (dist < RANGE) {
          const pull = (RANGE - dist) / RANGE  // 0..1
          next[key] = {
            x: dx * pull * 0.25,
            y: dy * pull * 0.25,
            scale: 1 + pull * 0.08,
            glow: 0.4 + pull * 0.6,
          }
        } else {
          next[key] = { x: 0, y: 0, scale: 1, glow: 0.35 }
        }
      }
      setMagnetic(next)
    })
  }

  const handleLeave = () =>
    setMagnetic((prev) => {
      const reset = {}
      for (const k of Object.keys(prev)) reset[k] = { x: 0, y: 0, scale: 1, glow: 0.35 }
      return reset
    })

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative w-full max-w-[520px]"
    >
      {/* Bottle — natural dimensions, no animations, just a soft drop shadow */}
      <Picture
        src="/products/trex-liquid-01.png"
        alt="T-Rex 500ml"
        className="w-full h-auto block select-none drop-shadow-[0_30px_40px_rgba(0,0,0,0.4)]"
        loading="eager"
        fetchpriority="high"
        decoding="async"
        draggable={false}
      />

      {/* Floating labels — only these move */}
      <FloatingLabel
        positionClass="top-[6%] -left-4 sm:-left-6"
        orbit="A"
        chipKey="fssai"
        chipRefs={chipRefs}
        magnetic={magnetic.fssai}
      >
        ✓ FSSAI Licensed
      </FloatingLabel>
      <FloatingLabel
        positionClass="top-[34%] -right-4 sm:-right-6"
        orbit="B"
        chipKey="natural"
        chipRefs={chipRefs}
        magnetic={magnetic.natural}
      >
        100% Natural
      </FloatingLabel>
      <FloatingLabel
        positionClass="bottom-[18%] -left-6 sm:-left-10"
        orbit="C"
        chipKey="servings"
        chipRefs={chipRefs}
        magnetic={magnetic.servings}
      >
        50 Servings
      </FloatingLabel>
    </div>
  )
}

/* Floating label — four layers of motion stacked, no animation on bottle itself.
   - Outer: absolute positioning around the bottle
   - Orbit: each chip drifts on its own elliptical path (CSS keyframes orbitA/B/C)
   - Magnetic: when cursor is near, chip nudges toward it + scales up + border glows
   - Inner pill: shimmer sweep across text, pulsing amber accent dot, border glow pulse */
const ORBIT_DURATION = { A: '9s', B: '11s', C: '13s' }

function FloatingLabel({ children, positionClass, orbit, chipKey, chipRefs, magnetic }) {
  const m = magnetic ?? { x: 0, y: 0, scale: 1, glow: 0.35 }
  return (
    <div className={`absolute z-10 ${positionClass}`}>
      {/* Orbital drift */}
      <div
        style={{
          animation: `orbit${orbit} ${ORBIT_DURATION[orbit]} ease-in-out infinite`,
        }}
      >
        {/* Magnetic cursor pull */}
        <div
          ref={(el) => {
            chipRefs.current[chipKey] = el
          }}
          className="transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate(${m.x}px, ${m.y}px) scale(${m.scale})`,
          }}
        >
          {/* The pill itself */}
          <div
            className="hero-chip-pulse bg-ink-800/85 backdrop-blur-md rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-2"
            style={{
              border: `1px solid rgba(214, 168, 90, ${m.glow})`,
            }}
          >
            <span className="hero-chip-dot inline-block w-1.5 h-1.5 rounded-full bg-amber" />
            <span className="hero-chip-text text-bone">{children}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
