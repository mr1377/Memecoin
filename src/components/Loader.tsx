import { motion } from 'framer-motion'
import { Glasses } from './Logo'

export default function Loader({ label = 'Loading the town…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-white/50" role="status">
      <motion.div animate={{ rotate: [0, -8, 8, 0], y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-carrot">
        <Glasses className="h-8 w-20" />
      </motion.div>
      <p className="font-mono text-xs uppercase tracking-widest">{label}</p>
    </div>
  )
}
