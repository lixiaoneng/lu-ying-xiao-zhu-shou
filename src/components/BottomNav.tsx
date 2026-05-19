import { useApp, type TabId } from '../App';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',    label: '概况', icon: '🗺️' },
  { id: 'supplies',    label: '物资', icon: '📦' },
  { id: 'expenses',    label: '花费', icon: '💰' },
  { id: 'settlement',  label: 'AA',   icon: '⚖️' },
  { id: 'share',       label: '分享', icon: '💬' },
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
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
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
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '8px 4px',
              position: 'relative',
              transition: 'all 0.18s ease',
            }}
          >
            {/* Active indicator */}
            {active && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                width: '50%',
                height: 2.5,
                background: 'var(--primary)',
                borderRadius: '0 0 3px 3px',
              }} />
            )}
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 11,
              fontWeight: active ? 700 : 400,
              color: active ? 'var(--primary)' : 'var(--text-muted)',
              letterSpacing: '0.02em',
              transition: 'color 0.18s',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
