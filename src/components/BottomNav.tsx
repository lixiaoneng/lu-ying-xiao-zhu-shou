import { useApp, type TabId } from '../App';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',   label: '概况', icon: '🗺' },
  { id: 'supplies',   label: '物资', icon: '🎒' },
  { id: 'expenses',   label: '花费', icon: '💰' },
  { id: 'settlement', label: 'AA',   icon: '⚖️' },
  { id: 'share',      label: '分享', icon: '📤' },
];

export default function BottomNav() {
  const { currentTab, setCurrentTab } = useApp();

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      height: 'var(--nav-height)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 500,
    }}>
      {TABS.map(tab => {
        const active = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 4px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* Pill container */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: active ? '6px 14px' : '6px 6px',
              borderRadius: 14,
              background: active ? 'var(--primary-dim)' : 'transparent',
              transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
              minWidth: active ? 52 : 32,
            }}>
              <span style={{
                fontSize: active ? 20 : 17,
                lineHeight: 1,
                transition: 'font-size 0.22s ease',
                opacity: active ? 1 : 0.45,
              }}>
                {tab.icon}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--primary)' : 'var(--text-light)',
                fontFamily: 'Noto Sans SC, sans-serif',
                letterSpacing: active ? '-0.01em' : '0.01em',
                transition: 'all 0.18s ease',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
