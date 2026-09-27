import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react'

type Kind = 'success' | 'error' | 'info' | 'win'
interface T { id: number; kind: Kind; title: string; body?: string }

const Ctx = createContext<(kind: Kind, title: string, body?: string) => void>(() => {})
export const useToast = () => useContext(Ctx)

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info, win: Sparkles }
const TONE = {
  success: 'text-lime',
  error: 'text-rizz',
  info: 'text-byte',
  win: 'text-carrot',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const push = useCallback((kind: Kind, title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x.slice(-2), { id, kind, title, body }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = ICON[t.kind]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-ink-800/95 p-4 shadow-glow backdrop-blur-xl"
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${TONE[t.kind]}`} />
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{t.title}</p>
                  {t.body && <p className="mt-1 text-sm text-white/60">{t.body}</p>}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
