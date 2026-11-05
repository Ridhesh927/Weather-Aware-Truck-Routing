import React, { useCallback, useRef, useState } from 'react'

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  tiltMax?: number
  scale?: number
  glare?: boolean
  className?: string
  style?: React.CSSProperties
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  tiltMax = 8,
  scale = 1.012,
  glare = true,
  className = '',
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [transform, setTransform] = useState<string>('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 })
  const [isHovered, setIsHovered] = useState<boolean>(false)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current
      if (!card) return

      const rect = card.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))

      const rotX = (0.5 - y) * 2 * tiltMax
      const rotY = (x - 0.5) * 2 * tiltMax

      setTransform(`perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scale}, ${scale}, 1)`)

      if (glare) {
        setGlareStyle({
          opacity: 0.18,
          background: `radial-gradient(circle at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 65%)`,
        })
      }
    },
    [tiltMax, scale, glare]
  )

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
    if (glare) {
      setGlareStyle({ opacity: 0 })
    }
  }

  return (
    <div
      ref={cardRef}
      className={`tilt-card-wrapper ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform,
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        transformStyle: 'preserve-3d',
        position: 'relative',
        willChange: 'transform',
      }}
      {...props}
    >
      {children}
      {glare && (
        <div
          className="tilt-glare-overlay"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            transition: isHovered ? 'opacity 0.1s ease-out' : 'opacity 0.4s ease-out',
            zIndex: 10,
            ...glareStyle,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export default TiltCard

