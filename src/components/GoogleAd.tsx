import { useEffect } from 'react'

interface GoogleAdProps {
  adSlot: string
  adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  fullWidth?: boolean
  className?: string
}

export const GoogleAd = ({
  adSlot,
  adFormat = 'auto',
  fullWidth = false,
  className = '',
}: GoogleAdProps) => {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (error) {
      console.error('GoogleAd error:', error)
    }
  }, [])

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{
        display: 'block',
        textAlign: 'center',
      }}
      data-ad-client="ca-pub-2229206109705215"
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={fullWidth ? 'true' : 'false'}
    />
  )
}
