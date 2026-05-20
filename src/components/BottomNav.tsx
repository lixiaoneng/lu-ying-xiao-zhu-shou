import { useApp, type TabId } from '../App';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: '概况' },
  { id: 'supplies',   label: '物资' },
  { id: 'expenses',   label: '花费' },
  { id: 'settlement', label: 'AA' },
  { id: 'share',      label: '分享' },
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
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
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
              gap: 5,
              padding: '10px 4px 8px',
              transition: 'all 0.18s ease',
              position: 'relative',
            }}
          >
            {/* Active dot */}
            <div style={{
              width: 4, height: 4, borderRadius: '50%',
              background: active ? 'var(--primary)' : 'transparent',
              transition: 'background 0.2s',
            }} />

            <span style={{
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--text-light)',
              letterSpacing: active ? '-0.01em' : '0',
              transition: 'all 0.18s',
              fontFamily: 'Noto Sans SC, sans-serif',
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
