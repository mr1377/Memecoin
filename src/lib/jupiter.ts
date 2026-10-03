/** $NERDY launches on Jupiter Studio (jup.ag): a bonding curve that graduates into an open liquidity pool. */
const SOL_MINT = 'So11111111111111111111111111111111111111112'

/** Jupiter swap page with SOL → $NERDY preselected. */
export const jupiterBuyUrl = (mint: string) => `https://jup.ag/swap?sell=${SOL_MINT}&buy=${encodeURIComponent(mint)}`
