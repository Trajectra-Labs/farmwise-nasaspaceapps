import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const cls = ['fw-btn', `fw-btn--${variant}`, className].filter(Boolean).join(' ')
  return <button type={type} className={cls} {...rest} />
}
