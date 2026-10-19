import { Download, Loader2, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { X_HANDLE } from '../lib/jupiter'
import type { Profile } from '../lib/types'
import XIcon from './XIcon'

export interface ShareStats {
  rejectionsWeek: number
  acceptsWeek: number
  pointsWeek: number
  pointsTotal: number
}

const W = 1200
const H = 630

/** The tweet text that goes with the card. */
export function shareText(s: ShareStats) {
  if (s.rejectionsWeek > 0)
    return `Got rejected ${s.rejectionsWeek} time${s.rejectionsWeek === 1 ? '' : 's'} this week on Nerdy Town and I'm still winning 🏆 +${s.pointsWeek} points. ${X_HANDLE}`
  if (s.acceptsWeek > 0) return `${s.acceptsWeek} match${s.acceptsWeek === 1 ? '' : 'es'} this week on Nerdy Town 💘 +${s.pointsWeek} points. Nerds always win. ${X_HANDLE}`
  return `I moved into Nerdy Town, where nerds always win: rejected or accepted 🏆 ${X_HANDLE}`
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const i = new Image()
    i.crossOrigin = 'anonymous' // photos come from Supabase Storage (CORS enabled), so the canvas stays exportable
    i.onload = () => res(i)
    i.onerror = () => res(null)
    i.src = src
  })
}

function roundRect(x: CanvasRenderingContext2D, rx: number, ry: number, w: number, h: number, r: number) {
  x.beginPath()
  x.moveTo(rx + r, ry)
  x.arcTo(rx + w, ry, rx + w, ry + h, r)
  x.arcTo(rx + w, ry + h, rx, ry + h, r)
  x.arcTo(rx, ry + h, rx, ry, r)
  x.arcTo(rx, ry, rx + w, ry, r)
  x.closePath()
}

/** Draws the 1200×630 card (the size X and most apps preview nicely). */
async function drawCard(me: Profile, s: ShareStats): Promise<Blob> {
  await document.fonts?.ready
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const x = c.getContext('2d')!

  // background
  const bg = x.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#120d1f')
  bg.addColorStop(1, '#1d1230')
  x.fillStyle = bg
  x.fillRect(0, 0, W, H)
  for (const [cx, cy, r, col] of [
    [1050, 80, 320, 'rgba(255,122,26,.35)'],
    [150, 600, 300, 'rgba(139,92,246,.35)'],
    [700, 650, 220, 'rgba(255,77,141,.25)'],
  ] as const) {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, col)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g
    x.fillRect(0, 0, W, H)
  }

  // brand
  x.fillStyle = '#ffffff'
  x.font = '800 40px "Bricolage Grotesque", system-ui, sans-serif'
  x.fillText('Nerdy', 72, 100)
  const nw = x.measureText('Nerdy').width
  x.fillStyle = '#ff7a1a'
  x.fillText('Town', 72 + nw, 100)

  // headline
  const big = s.rejectionsWeek > 0 ? String(s.rejectionsWeek) : s.acceptsWeek > 0 ? String(s.acceptsWeek) : '0'
  const line1 = s.rejectionsWeek > 0 ? `time${s.rejectionsWeek === 1 ? '' : 's'} rejected this week` : s.acceptsWeek > 0 ? `match${s.acceptsWeek === 1 ? '' : 'es'} this week` : 'new nerd in town'
  x.fillStyle = '#ff7a1a'
  x.font = '800 190px "Bricolage Grotesque", system-ui, sans-serif'
  x.fillText(big, 64, 300)
  const bw = x.measureText(big).width
  x.fillStyle = '#ffffff'
  x.font = '700 48px "Bricolage Grotesque", system-ui, sans-serif'
  x.fillText(line1, 64 + bw + 28, 230)
  x.fillStyle = 'rgba(255,255,255,.75)'
  x.font = '600 44px "Bricolage Grotesque", system-ui, sans-serif'
  x.fillText('…and still winning 🏆', 64 + bw + 28, 292)

  // points pill
  const pill = `+${s.pointsWeek.toLocaleString('en-US')} points this week · ${s.pointsTotal.toLocaleString('en-US')} total`
  x.font = '700 32px "JetBrains Mono", ui-monospace, monospace'
  const pw = x.measureText(pill).width + 56
  roundRect(x, 64, 352, pw, 68, 34)
  x.fillStyle = 'rgba(182,255,59,.15)'
  x.fill()
  x.strokeStyle = 'rgba(182,255,59,.5)'
  x.lineWidth = 2
  x.stroke()
  x.fillStyle = '#b6ff3b'
  x.fillText(pill, 92, 398)

  // who
  const photo = me.thumbs?.[0] ?? me.photos[0]
  const img = photo ? await loadImage(photo) : null
  const ax = 64
  const ay = 470
  if (img) {
    x.save()
    x.beginPath()
    x.arc(ax + 50, ay + 50, 50, 0, Math.PI * 2)
    x.clip()
    const sc = Math.max(100 / img.naturalWidth, 100 / img.naturalHeight)
    x.drawImage(img, ax + 50 - (img.naturalWidth * sc) / 2, ay + 50 - (img.naturalHeight * sc) / 2, img.naturalWidth * sc, img.naturalHeight * sc)
    x.restore()
  } else {
    x.fillStyle = '#ff7a1a'
    x.beginPath()
    x.arc(ax + 50, ay + 50, 50, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = '#120d1f'
    x.font = '800 48px "Bricolage Grotesque", system-ui, sans-serif'
    x.textAlign = 'center'
    x.fillText(me.name.slice(0, 1).toUpperCase(), ax + 50, ay + 67)
    x.textAlign = 'left'
  }
  x.fillStyle = '#ffffff'
  x.font = '700 40px "Bricolage Grotesque", system-ui, sans-serif'
  x.fillText(me.name, ax + 128, ay + 48)
  x.fillStyle = 'rgba(255,255,255,.6)'
  x.font = '500 28px Inter, system-ui, sans-serif'
  x.fillText(`${me.nerdClass} · ${me.city}`, ax + 128, ay + 88)

  // footer
  x.textAlign = 'right'
  x.fillStyle = 'rgba(255,255,255,.85)'
  x.font = '700 30px "JetBrains Mono", ui-monospace, monospace'
  x.fillText('nerdytown.space', W - 64, ay + 48)
  x.fillStyle = '#ff7a1a'
  x.font = '600 26px Inter, system-ui, sans-serif'
  x.fillText('$NERDY coming soon', W - 64, ay + 88)

  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not create the image.'))), 'image/png'))
}

/** Preview + share buttons for the weekly brag card. */
export default function ShareCard({ me, stats, link }: { me: Profile; stats: ShareStats; link: string }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true
    let made = ''
    drawCard(me, stats).then(
      (b) => {
        if (!alive) return
        made = URL.createObjectURL(b)
        setBlob(b)
        setUrl(made)
      },
      () => {},
    )
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [me, stats])

  const text = shareText(stats)
  const file = blob ? new File([blob], 'nerdy-town.png', { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const postOnX = () => window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`, '_blank', 'noopener')
  const shareImage = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: `${text} ${link}` })
    } catch {
      /* dismissed */
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950">
        {url ? (
          <img src={url} alt="Your weekly Nerdy Town card" className="block aspect-[1200/630] w-full" />
        ) : (
          <div className="grid aspect-[1200/630] w-full place-items-center text-white/40">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-white/70">
        {text} <span className="text-byte">{link}</span>
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={postOnX} className="btn-primary w-full">
          <XIcon className="h-4 w-4" /> Post on X
        </button>
        {canShareFile ? (
          <button onClick={shareImage} disabled={!file} className="btn-ghost w-full">
            <Share2 className="h-4 w-4" /> Share image
          </button>
        ) : (
          <a href={url || undefined} download="nerdy-town.png" className="btn-ghost w-full" aria-disabled={!url}>
            <Download className="h-4 w-4" /> Download image
          </a>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-white/40">Tip: download the image and add it to your post. Your invite link is included.</p>
    </div>
  )
}
