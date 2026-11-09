import React from 'react';

interface AlertBannerProps {
  variant: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  variant,
  title,
  message,
  onClose
}) => {
  return (
    <div
      className={`alert-banner alert-${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <div className="alert-content">
        {title && <strong>{title}: </strong>}
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          className="btn-link alert-close"
          onClick={onClose}
          aria-label="Cerrar aviso"
        >
          Cerrar
        </button>
      )}
    </div>
  );
};

