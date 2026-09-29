import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { suggestedColor, useWalletOptions, type WalletOption } from '../lib/wallets'

/** Grid of every detected Solana wallet, plus popular ones to install / open in-app. */
export default function WalletPicker({ onPick, busyId, disabled }: { onPick: (o: WalletOption) => void; busyId?: string | null; disabled?: boolean }) {
  const options = useWalletOptions()
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o)}
          disabled={disabled}
          title={o.installed ? `Continue with ${o.name}` : mobile ? `Open this site in ${o.name}` : `Install ${o.name}`}
          className={clsx(
            'relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition disabled:opacity-50',
            o.installed ? 'border-white/15 bg-white/[0.05] hover:border-carrot/50 hover:bg-white/[0.08]' : 'border-white/[0.06] bg-transparent text-white/60 hover:border-white/20 hover:text-white',
          )}
        >
          {o.icon ? (
            <img src={o.icon} alt="" className="h-9 w-9 rounded-xl" />
          ) : (
            <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${suggestedColor(o.name)} text-sm font-bold text-white`}>{o.name[0]}</span>
          )}
          {busyId === o.id && (
            <span className="absolute inset-x-0 top-3 mx-auto grid h-9 w-9 place-items-center rounded-xl bg-ink-950/70">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
          <span className="max-w-full break-words text-center leading-tight">{o.name}</span>
          {o.hint && <span className="-mt-1 max-w-full truncate text-[10px] font-normal text-white/40">{o.hint}</span>}
        </button>
      ))}
    </div>
  )
}
