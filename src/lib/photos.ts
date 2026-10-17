/**
 * Profile photos are shrunk in the browser before upload, so storage stays small and pages stay fast:
 *  - full:  longest side 1080px (sharp on phones and profile pages), WebP, capped at ~200 KB
 *  - thumb: shortest side 360px for avatars and small lists, WebP, capped at ~30 KB
 * WebP is ~30% smaller than JPEG at the same quality; browsers that can't encode it get JPEG.
 * Re-encoding also strips EXIF data (GPS location etc.) from people's photos.
 */

const FULL = { side: 1080, maxBytes: 200_000, minQuality: 0.5 }
// Thumbnails are shown tiny, so they may go lower in quality when a photo is very detailed.
const THUMB = { side: 360, maxBytes: 30_000, minQuality: 0.3 }
const QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.36, 0.3]

export interface EncodedPhoto {
  full: Blob
  thumb: Blob
  ext: 'webp' | 'jpg'
  url: string // preview (object URL of the full image)
}

function toBlob(c: HTMLCanvasElement, type: string, q: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the image.'))), type, q))
}

/** Highest quality that fits the byte budget. */
async function encode(c: HTMLCanvasElement, { maxBytes, minQuality }: { maxBytes: number; minQuality: number }, webp: boolean): Promise<Blob> {
  const type = webp ? 'image/webp' : 'image/jpeg'
  let blob: Blob | null = null
  for (const q of QUALITIES.filter((x) => x >= minQuality)) {
    blob = await toBlob(c, type, q)
    if (blob.size <= maxBytes) break
  }
  return blob!
}

function draw(img: HTMLImageElement, scale: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * scale))
  c.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return c
}

let webpSupport: Promise<boolean> | null = null
/** Safari < 16 and some older browsers silently return PNG when asked for WebP. */
function canEncodeWebp() {
  webpSupport ??= toBlob(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }), 'image/webp', 0.8).then(
    (b) => b.type === 'image/webp',
    () => false,
  )
  return webpSupport
}

export async function encodePhoto(file: File): Promise<EncodedPhoto> {
  const src = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Could not read that image.'))
      i.src = src
    })
    const { naturalWidth: w, naturalHeight: h } = img
    const webp = await canEncodeWebp()
    const full = await encode(draw(img, Math.min(1, FULL.side / Math.max(w, h))), FULL, webp)
    const thumb = await encode(draw(img, Math.min(1, THUMB.side / Math.min(w, h))), THUMB, webp)
    return { full, thumb, ext: webp ? 'webp' : 'jpg', url: URL.createObjectURL(full) }
  } finally {
    URL.revokeObjectURL(src)
  }
}

/** Storage names: "<user>/<id>.p.webp" (full) + "<user>/<id>.t.webp" (thumb). */
export const photoPaths = (user: string, id: string, ext: EncodedPhoto['ext']) => ({ full: `${user}/${id}.p.${ext}`, thumb: `${user}/${id}.t.${ext}` })

/** Storage path of the small version, or null for older photos uploaded before thumbnails existed. */
export function thumbPath(path: string): string | null {
  const m = /^(.+)\.p\.(webp|jpg)$/.exec(path)
  return m ? `${m[1]}.t.${m[2]}` : null
}

/** Every stored file behind a photo (for deleting). */
export const storedFiles = (paths: string[]) => paths.flatMap((p) => [p, thumbPath(p)].filter((x): x is string => !!x))
