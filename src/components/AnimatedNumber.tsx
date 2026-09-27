import { animate, useInView } from 'framer-motion'
import { useEffect, useRef } from 'react'

export default function AnimatedNumber({ value, decimals = 0, className, prefix = '', suffix = '' }: { value: number; decimals?: number; className?: string; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const from = useRef(0)
  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const ctrl = animate(from.current, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = prefix + v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
      },
    })
    from.current = value
    return () => ctrl.stop()
  }, [value, inView, decimals, prefix, suffix])
  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}
