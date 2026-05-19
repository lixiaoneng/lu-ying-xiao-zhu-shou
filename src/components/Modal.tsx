import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, footer }: Props) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Track keyboard height via visualViewport API
  useEffect(() => {
    if (!isOpen) { setKeyboardHeight(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      const kh = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
      setKeyboardHeight(kh);
    }

    vv.addEventListener('resize', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      setKeyboardHeight(0);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(44, 26, 14, 0.45)',
        display: 'flex', alignItems: 'flex-end',
        paddingBottom: keyboardHeight,
        animation: 'fadeIn 0.22s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          paddingBottom: keyboardHeight > 0 ? 8 : 'env(safe-area-inset-bottom)',
          animation: 'sheetIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: `calc(100dvh - ${keyboardHeight}px - 60px)`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'padding-bottom 0.15s ease, max-height 0.15s ease',
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border)',
          margin: '12px auto 4px',
          flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: 17, color: 'var(--text)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              border: 'none', background: 'var(--bg-warm)',
              cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
