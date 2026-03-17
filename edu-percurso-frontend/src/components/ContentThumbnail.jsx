import { useEffect, useMemo, useState } from 'react'
import { resolveThumbnailUrl } from '../utils/media'

export default function ContentThumbnail({ thumbnailUrl, titulo, videoUrl }) {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setImageError(false)
  }, [thumbnailUrl])

  const imageSrc = useMemo(() => {
    if (imageError) return ''
    return resolveThumbnailUrl(thumbnailUrl, videoUrl)
  }, [imageError, thumbnailUrl, videoUrl])

  return (
    <div className="card-thumb">
      {imageSrc && (
        <img
          className="card-thumb-image"
          src={imageSrc}
          alt={`Thumbnail de ${titulo}`}
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}
      <div className="card-thumb-overlay" />
      <div className="play-btn">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M7 5l9 5-9 5V5z" fill="#2de09a" />
        </svg>
      </div>
    </div>
  )
}
