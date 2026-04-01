import { useEffect, useRef, useState } from 'react'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let googleScriptPromise

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (googleScriptPromise) return googleScriptPromise

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }

      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })

  return googleScriptPromise
}

export default function GoogleAuthButton({ clientId, onCredential, onError }) {
  const buttonRef = useRef(null)
  const credentialHandlerRef = useRef(onCredential)
  const errorHandlerRef = useRef(onError)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    credentialHandlerRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    errorHandlerRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!clientId || !buttonRef.current) return undefined

    let cancelled = false
    setIsReady(false)

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: response => {
            const credential = typeof response?.credential === 'string' ? response.credential.trim() : ''
            if (!credential) {
              errorHandlerRef.current?.('Nao foi possivel validar a conta Google.')
              return
            }
            credentialHandlerRef.current?.(credential)
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        buttonRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'medium',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          locale: 'pt_BR',
        })

        requestAnimationFrame(() => {
          if (!cancelled) setIsReady(true)
        })
      })
      .catch(() => {
        if (cancelled) return
        errorHandlerRef.current?.('Nao foi possivel carregar o login com Google agora.')
      })

    return () => {
      cancelled = true
      if (buttonRef.current) {
        buttonRef.current.innerHTML = ''
      }
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <div className={`google-auth-button-shell${isReady ? ' is-ready' : ''}`}>
      <div ref={buttonRef} className="google-auth-button" />
    </div>
  )
}
