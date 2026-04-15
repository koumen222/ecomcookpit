import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SubscriptionWarningBanner = ({ warning }) => {
  const [hoursLeft, setHoursLeft] = useState(0);
  const [hidden, setHidden] = useState(false);
  const navigate = useNavigate();
  const isInformationalNotice = warning?.variant === 'downgraded' || warning?.variant === 'plan_updated';
  const isDowngradedNotice = warning?.variant === 'downgraded';
  const isPlanUpdatedNotice = warning?.variant === 'plan_updated';

  useEffect(() => {
    if (!warning?.deadline || isInformationalNotice) {
      setHoursLeft(0);
      return;
    }

    const calc = () => {
      const diff = new Date(warning.deadline) - new Date();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
    };

    setHoursLeft(calc());
    const interval = setInterval(() => setHoursLeft(calc()), 60000);
    return () => clearInterval(interval);
  }, [isInformationalNotice, warning?.deadline]);

  if (!warning?.active || hidden) return null;

  const isExpired = !isInformationalNotice && hoursLeft <= 0;
  const background = isDowngradedNotice ? '#d97706' : isPlanUpdatedNotice ? '#2563eb' : isExpired ? '#dc2626' : '#ef4444';
  const buttonLabel = isInformationalNotice ? 'Voir les tarifs' : 'Renouveler';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background,
        color: '#fff',
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '9px 48px 9px 16px',
        textAlign: 'center',
        lineHeight: 1.4,
        letterSpacing: '0.01em',
      }}
    >
      <span>
        {isInformationalNotice
          ? 'ℹ️ '
          : isExpired
          ? '⚠️ Accès suspendu — '
          : '⚠️ '}
        {warning.message || 'Votre abonnement expire bientôt. Renouvelez pour garder l\'accès.'}
        {!isInformationalNotice && !isExpired && (
          <span style={{ marginLeft: 6, fontWeight: 700 }}>
            ⏳ {hoursLeft}h restantes
          </span>
        )}
        <button
          onClick={() => navigate('/ecom/billing')}
          style={{
            marginLeft: 10,
            background: '#fff',
            color: '#dc2626',
            border: 'none',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {buttonLabel}
        </button>
      </span>
      <button
        onClick={() => setHidden(true)}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.7)',
          padding: 4,
          display: 'flex',
          lineHeight: 1,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default SubscriptionWarningBanner;
