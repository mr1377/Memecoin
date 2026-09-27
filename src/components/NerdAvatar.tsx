import { useId } from 'react'
import type { AvatarSeed } from '../lib/types'

interface Props {
  seed: AvatarSeed
  className?: string
  look?: { x: number; y: number } // -1..1
  blink?: boolean
  bg?: boolean
  mood?: AvatarSeed['mood']
  title?: string
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, v + amt))
  const r = c((n >> 16) & 255)
  const g = c((n >> 8) & 255)
  const b = c(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Procedural caricature nerd: long face, big ears, bigger glasses, iconic teeth. */
export default function NerdAvatar({ seed, className, look = { x: 0, y: 0 }, blink = false, bg = true, mood, title }: Props) {
  const id = useId().replace(/:/g, '')
  const m = mood ?? seed.mood
  const skinDark = shade(seed.skin, -28)
  const hairDark = shade(seed.hair, -40)
  const px = look.x * 4
  const py = look.y * 3
  const lensStroke = seed.glasses === 'thick' ? 7 : 4.5

  const eye = (cx: number) => (
    <g>
      <ellipse cx={cx} cy={104} rx={m === 'shock' ? 10 : 9} ry={m === 'shock' ? 10.5 : 9} fill="#fff" />
      <g style={{ transform: `translate(${px}px, ${py}px)`, transition: 'transform 120ms ease-out' }}>
        <circle cx={cx} cy={104} r={m === 'shock' ? 3.8 : 5} fill="#1a1033" />
        <circle cx={cx + 1.8} cy={102} r={1.6} fill="#fff" />
      </g>
      {m === 'smug' && <path d={`M${cx - 11} 97 Q${cx} 100 ${cx + 11} 97 L${cx + 11} 92 L${cx - 11} 92 Z`} fill={seed.skin} stroke={skinDark} strokeWidth="1.5" />}
      <rect
        x={cx - 12}
        y={93}
        width={24}
        height={22}
        fill={seed.skin}
        style={{ transformOrigin: `${cx}px 93px`, transform: `scaleY(${blink ? 1 : 0})`, transition: 'transform 90ms' }}
      />
    </g>
  )

  const lens = (cx: number) => {
    if (seed.glasses === 'round') return <circle cx={cx} cy={104} r={17} fill={`url(#lens-${id})`} />
    return <rect x={cx - 19} y={89} width={38} height={31} rx={seed.glasses === 'thick' ? 5 : 3} fill={`url(#lens-${id})`} />
  }
  const frame = (cx: number) =>
    seed.glasses === 'round' ? (
      <circle cx={cx} cy={104} r={17} fill="none" stroke={seed.frame} strokeWidth={lensStroke} />
    ) : (
      <rect x={cx - 19} y={89} width={38} height={31} rx={seed.glasses === 'thick' ? 5 : 3} fill="none" stroke={seed.frame} strokeWidth={lensStroke} />
    )

  const hair = () => {
    const f = seed.hair
    switch (seed.hairStyle) {
      case 'spiky':
        return (
          <path
            d="M56 84 L52 52 L68 62 L70 36 L86 52 L96 26 L106 50 L122 32 L124 56 L144 46 L140 72 L148 80 C140 66 120 60 100 60 C80 60 62 68 56 84 Z"
            fill={f}
            stroke={hairDark}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )
      case 'bowl':
        return <path d="M54 90 C50 40 150 40 146 90 L146 78 C130 70 70 70 54 78 Z M54 90 L146 90 L146 76 C120 64 80 64 54 76 Z" fill={f} stroke={hairDark} strokeWidth="2" />
      case 'curly':
        return (
          <g fill={f} stroke={hairDark} strokeWidth="2">
            {[58, 72, 86, 100, 114, 128, 142].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 56 : 64} r={14} />
            ))}
            {[64, 82, 100, 118, 136].map((x) => (
              <circle key={'b' + x} cx={x} cy={46} r={13} />
            ))}
          </g>
        )
      case 'long':
        return (
          <g fill={f} stroke={hairDark} strokeWidth="2" strokeLinejoin="round">
            <path d="M52 92 C44 40 156 40 148 92 L154 150 C150 160 140 158 138 150 L136 88 C120 74 80 74 64 88 L62 150 C60 158 50 160 46 150 Z" />
            <path d="M64 88 C80 60 124 58 138 86 C124 72 96 70 64 88 Z" fill={hairDark} opacity=".35" stroke="none" />
          </g>
        )
      default:
        return (
          <g stroke={hairDark} strokeWidth="2" strokeLinejoin="round">
            <path d="M54 88 C46 48 90 30 118 36 C140 40 152 58 146 86 C136 70 118 64 100 66 C84 60 66 70 54 88 Z" fill={f} />
            <path d="M96 38 C104 26 122 22 134 30 C124 30 114 34 110 42 Z" fill={f} />
            <path d="M70 70 C88 52 124 50 140 62" fill="none" stroke={hairDark} strokeWidth="2.5" opacity=".5" />
          </g>
        )
    }
  }

  return (
    <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? 'Nerd avatar'}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={seed.bg[0]} />
          <stop offset="1" stopColor={seed.bg[1]} />
        </linearGradient>
        <radialGradient id={`face-${id}`} cx=".45" cy=".35" r=".8">
          <stop offset="0" stopColor={shade(seed.skin, 14)} />
          <stop offset="1" stopColor={seed.skin} />
        </radialGradient>
        <linearGradient id={`lens-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".05" />
          <stop offset="1" stopColor="#c4b5fd" stopOpacity=".25" />
        </linearGradient>
      </defs>
      {bg && (
        <>
          <rect width="200" height="200" fill={`url(#bg-${id})`} />
          <g opacity=".12" stroke="#fff" strokeWidth=".6">
            {Array.from({ length: 10 }, (_, i) => (
              <path key={i} d={`M0 ${i * 20} H200 M${i * 20} 0 V200`} />
            ))}
          </g>
        </>
      )}
      {/* shoulders + sweater */}
      <path d="M40 200 C44 176 70 168 100 168 C130 168 156 176 160 200 Z" fill={seed.bg[1] === '#b6f23a' ? '#166534' : shade(seed.frame, 30)} />
      <path d="M84 170 L100 186 L116 170" fill="#fff" />
      <path d="M92 178 L100 172 L108 178 L100 184 Z" fill="#e11d48" stroke="#7f1d1d" strokeWidth="1" />
      {/* neck */}
      <path d="M90 150 L90 176 C96 180 104 180 110 176 L110 150 Z" fill={skinDark} />
      {/* ears */}
      <g fill={seed.skin} stroke={skinDark} strokeWidth="2">
        <ellipse cx="50" cy="108" rx="13" ry="18" />
        <ellipse cx="150" cy="108" rx="13" ry="18" />
      </g>
      <path d="M48 100 C54 104 54 114 48 118" fill="none" stroke={skinDark} strokeWidth="2" />
      <path d="M152 100 C146 104 146 114 152 118" fill="none" stroke={skinDark} strokeWidth="2" />
      {seed.hairStyle === 'long' && hair()}
      {/* head */}
      <path
        d="M58 92 C56 52 144 52 142 92 L140 124 C136 152 116 170 100 171 C84 170 64 152 60 124 Z"
        fill={`url(#face-${id})`}
        stroke={skinDark}
        strokeWidth="2"
      />
      {seed.hairStyle === 'long' ? (
        <path d="M56 94 C54 52 146 52 144 94 C130 70 96 66 56 94 Z" fill={seed.hair} stroke={hairDark} strokeWidth="2" />
      ) : (
        hair()
      )}
      {/* freckles */}
      {seed.freckles && (
        <g fill={shade(seed.hair, 10)} opacity=".6">
          {[
            [70, 124],
            [76, 128],
            [66, 130],
            [130, 124],
            [124, 128],
            [134, 130],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
          ))}
        </g>
      )}
      {/* brows */}
      <g stroke={hairDark} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d={m === 'shock' ? 'M68 80 Q80 72 92 78' : m === 'smug' ? 'M68 84 Q80 82 92 86' : 'M68 82 Q80 78 92 82'} />
        <path d={m === 'shock' ? 'M108 78 Q120 72 132 80' : m === 'smug' ? 'M108 82 Q120 76 132 80' : 'M108 82 Q120 78 132 82'} />
      </g>
      {eye(80)}
      {eye(120)}
      {lens(80)}
      {lens(120)}
      {frame(80)}
      {frame(120)}
      <path d="M99 102 Q100 98 101 102" stroke={seed.frame} strokeWidth="4" fill="none" />
      <path d="M61 100 L50 98 M139 100 L150 98" stroke={seed.frame} strokeWidth="3.5" />
      {/* nose */}
      <path d="M100 112 C94 122 88 130 94 134 C98 137 106 137 110 132 C112 128 106 124 104 116" fill={shade(seed.skin, -8)} stroke={skinDark} strokeWidth="2" strokeLinejoin="round" />
      {/* mouth + teeth */}
      {m === 'shock' ? (
        <g>
          <ellipse cx="100" cy="152" rx="15" ry="11" fill="#4a0e1f" stroke={skinDark} strokeWidth="2" />
          <rect x="91" y="141" width="8.5" height="10" rx="2" fill="#fff" />
          <rect x="100.5" y="141" width="8.5" height="10" rx="2" fill="#fff" />
          <ellipse cx="100" cy="158" rx="8" ry="3.5" fill="#e0607e" />
        </g>
      ) : m === 'happy' ? (
        <g>
          <path d="M82 144 Q100 162 118 144 Z" fill="#4a0e1f" stroke={skinDark} strokeWidth="2" strokeLinejoin="round" />
          {seed.teeth !== 'grin' ? (
            <>
              <rect x="92" y="144" width="7.5" height="10" rx="1.5" fill="#fff" />
              <rect x="100.5" y="144" width="7.5" height="10" rx="1.5" fill="#fff" />
            </>
          ) : (
            <path d="M84 145 L116 145 L113 149 L87 149 Z" fill="#fff" />
          )}
        </g>
      ) : (
        <g>
          <path d="M84 146 Q96 150 116 141" fill="none" stroke={skinDark} strokeWidth="2.6" strokeLinecap="round" />
          {seed.teeth === 'one' ? (
            <path d="M100 146 L112 144 L108 162 Z" fill="#fff" stroke="#cbd5e1" strokeWidth="1" strokeLinejoin="round" />
          ) : seed.teeth === 'buck' ? (
            <>
              <rect x="93" y="146" width="8" height="11" rx="2" fill="#fff" stroke="#cbd5e1" />
              <rect x="101.5" y="145" width="8" height="11" rx="2" fill="#fff" stroke="#cbd5e1" />
            </>
          ) : (
            <path d="M88 147 L112 143 L111 149 L89 152 Z" fill="#fff" stroke="#cbd5e1" />
          )}
        </g>
      )}
      {/* glasses glare */}
      <path d="M66 94 L74 90 M106 94 L114 90" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
    </svg>
  )
}
