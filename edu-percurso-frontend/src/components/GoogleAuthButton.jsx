import { useEffect, useRef, useState } from 'react'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let googleScriptPromise

function loadGoogleScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
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

function GoogleMark() {
  return (
    <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12.24 10.285V14.4h5.88c-.255 1.365-1.62 4.005-5.88 4.005-3.54 0-6.42-2.925-6.42-6.54s2.88-6.54 6.42-6.54c2.01 0 3.36.855 4.125 1.59l2.82-2.73C17.385 2.52 15.075 1.5 12.24 1.5 6.945 1.5 2.64 5.805 2.64 11.1s4.305 9.6 9.6 9.6c5.535 0 9.21-3.885 9.21-9.36 0-.63-.075-1.11-.165-1.575z" />
      <path fill="#34A853" d="M2.64 6.69l3.39 2.49c.915-1.815 2.79-3.075 5.205-3.075 2.01 0 3.36.855 4.125 1.59l2.82-2.73C17.385 2.52 15.075 1.5 12.24 1.5c-3.69 0-6.825 2.1-8.415 5.19z" />
      <path fill="#FBBC05" d="M12.24 20.7c2.76 0 5.085-.915 6.78-2.49l-3.135-2.565c-.84.585-1.95 1.005-3.645 1.005-4.245 0-5.595-2.865-5.805-4.305l-3.42 2.64C4.59 18.42 8.07 20.7 12.24 20.7z" />
      <path fill="#4285F4" d="M21.45 11.34c0-.63-.075-1.11-.165-1.575H12.24v4.115h5.88c-.285 1.455-1.14 2.685-2.235 3.54l3.135 2.565c1.815-1.68 2.43-4.155 2.43-6.645z" />
    </svg>
  )
}

function mapGooglePopupError(type) {
  if (type === 'popup_failed_to_open') {
    return 'Não foi possível abrir a janela do Google. Verifique se o navegador bloqueou pop-ups.'
  }
  if (type === 'popup_closed') {
    return 'A janela do Google foi fechada antes da conclusão do login.'
  }
  return 'Não foi possível iniciar o login com Google agora.'
}

export default function GoogleAuthButton({ clientId, disabled = false, onCode, onError, onBeforeStart }) {
  const codeClientRef = useRef(null)
  const codeHandlerRef = useRef(onCode)
  const errorHandlerRef = useRef(onError)
  const beforeStartHandlerRef = useRef(onBeforeStart)
  const [isReady, setIsReady] = useState(false)
  const [isOpening, setIsOpening] = useState(false)

  useEffect(() => {
    codeHandlerRef.current = onCode
  }, [onCode])

  useEffect(() => {
    errorHandlerRef.current = onError
  }, [onError])

  useEffect(() => {
    beforeStartHandlerRef.current = onBeforeStart
  }, [onBeforeStart])

  useEffect(() => {
    if (!clientId) return undefined

    let cancelled = false
    setIsReady(false)

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.oauth2) return

        codeClientRef.current = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          select_account: true,
          callback: response => {
            setIsOpening(false)
            if (response?.error) {
              errorHandlerRef.current?.(response.error_description || 'Não foi possível validar o login com Google.')
              return
            }

            const code = typeof response?.code === 'string' ? response.code.trim() : ''
            if (!code) {
              errorHandlerRef.current?.('Não foi possível validar o login com Google.')
              return
            }

            codeHandlerRef.current?.(code)
          },
          error_callback: error => {
            setIsOpening(false)
            errorHandlerRef.current?.(mapGooglePopupError(error?.type))
          },
        })

        setIsReady(true)
      })
      .catch(() => {
        if (cancelled) return
        errorHandlerRef.current?.('Não foi possível carregar o login com Google agora.')
      })

    return () => {
      cancelled = true
    }
  }, [clientId])

  function handleClick() {
    if (disabled || isOpening) return
    if (beforeStartHandlerRef.current?.() === false) return
    if (!codeClientRef.current) return
    setIsOpening(true)
    codeClientRef.current.requestCode()
  }

  if (!clientId) return null

  return (
    <button
      type="button"
      className="auth-google-button"
      onClick={handleClick}
      disabled={disabled || !isReady || isOpening}
    >
      <GoogleMark />
      <span>{isOpening ? 'Abrindo Google...' : 'Continuar com Google'}</span>
    </button>
  )
}
