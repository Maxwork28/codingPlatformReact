import React from 'react';

const Button = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  style,
  ...props
}) => (
  <button
    type={type}
    disabled={disabled}
    className={`inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-medium bg-accent text-on-accent hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/30 transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    style={style}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);

export default Button;
