/** Tiny dependency-free confetti burst on a throwaway canvas. */
export function confetti(opts: { x?: number; y?: number; colors?: string[]; count?: number; emoji?: string[] } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '200' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const colors = opts.colors ?? ['#ff7a1a', '#8b5cf6', '#22d3ee', '#b6f23a', '#ff4d8d', '#ffffff']
  const ox = opts.x ?? innerWidth / 2
  const oy = opts.y ?? innerHeight / 2
  const parts = Array.from({ length: opts.count ?? 140 }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 6 + Math.random() * 10
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
      e: opts.emoji && Math.random() < 0.3 ? opts.emoji[Math.floor(Math.random() * opts.emoji.length)] : null,
    }
  })
  let frame = 0
  const tick = () => {
    frame++
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.35
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.globalAlpha = Math.max(0, 1 - frame / 160)
      if (p.e) {
        ctx.font = '22px serif'
        ctx.fillText(p.e, -11, 8)
      } else {
        ctx.fillStyle = p.c
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)))
      }
      ctx.restore()
    }
    if (frame < 170) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
