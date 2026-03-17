export function resolveMediaUrl(url) {
  const normalized = url?.trim()

  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('//')) return `https:${normalized}`
  if (normalized.startsWith('/')) return normalized

  return `/${normalized}`
}

function extractYoutubeId(value) {
  const normalized = value?.trim()
  if (!normalized) return ''

  if (/^[A-Za-z0-9_-]{11}$/.test(normalized)) return normalized

  const youtubeMatch = normalized.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )

  return youtubeMatch?.[1] || ''
}

function buildYoutubeThumbnailUrl(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
}

export function resolveThumbnailUrl(thumbnailUrl, videoUrl) {
  const normalized = thumbnailUrl?.trim()

  if (normalized) {
    const youtubeId = extractYoutubeId(normalized)
    if (youtubeId) return buildYoutubeThumbnailUrl(youtubeId)
    return resolveMediaUrl(normalized)
  }

  const fallbackYoutubeId = extractYoutubeId(videoUrl)
  if (fallbackYoutubeId) return buildYoutubeThumbnailUrl(fallbackYoutubeId)

  return ''
}
