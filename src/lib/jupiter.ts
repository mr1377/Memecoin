/** $NERDY trades on Jupiter (jup.ag). */
const SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Jupiter swap page with SOL → $NERDY preselected. */
export const jupiterBuyUrl = (mint: string) => `https://jup.ag/swap?sell=${SOL_MINT}&buy=${encodeURIComponent(mint)}`
