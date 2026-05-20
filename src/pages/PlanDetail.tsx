import { useApp } from '../App';
import BottomNav from '../components/BottomNav';
import OverviewTab from './tabs/OverviewTab';
import SuppliesTab from './tabs/SuppliesTab';
import ExpensesTab from './tabs/ExpensesTab';
import SettlementTab from './tabs/SettlementTab';
import ShareTab from './tabs/ShareTab';
import { exportPlanAsJson } from '../store';

export default function PlanDetail() {
  const { plan, goHome, currentTab, roomCode, toast, syncStatus, forceSync } = useApp();

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>

      {/* ── Header ───────────────────────────────── */}
      <header style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 8px 0 4px',
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        position: 'sticky',
        top: 0,
        zIndex: 400,
        flexShrink: 0,
      }}>
        {/* Back */}
        <button
          onClick={goHome}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: 'var(--text-2)', flexShrink: 0,
            borderRadius: '50%',
          }}
        >
          ←
        </button>

        {/* Plan info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 17, fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>
            {plan.name}
          </div>
          {(plan.date || plan.location) && (
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 1 }}>
              {plan.date && formatDate(plan.date)}
              {plan.date && plan.location && ' · '}
              {plan.location}
            </div>
          )}
        </div>

        {/* Sync indicator — minimal */}
        {roomCode && (
          <button
            onClick={forceSync}
            title={syncStatus === 'error' ? '同步失败，点击重试' : syncStatus === 'syncing' ? '同步中…' : '已同步'}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: '4px 6px', flexShrink: 0, display: 'flex', alignItems: 'center',
              fontSize: 16,
              animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
              opacity: syncStatus === 'idle' ? 0 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            {syncStatus === 'syncing' ? '↻' : syncStatus === 'synced' ? '✓' : syncStatus === 'error' ? '⚠' : ''}
          </button>
        )}

        {/* Room code — subtle pill */}
        {roomCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode).catch(() => {});
              toast('房间码已复制：' + roomCode);
            }}
            style={{
              border: '1px solid var(--primary-border)',
              cursor: 'pointer',
              background: 'var(--primary-dim)',
              borderRadius: 'var(--radius-pill)',
              padding: '5px 10px',
              fontSize: 12, fontWeight: 600,
              color: 'var(--primary)',
              letterSpacing: '0.1em',
              flexShrink: 0,
            }}
            title="点击复制房间码"
          >
            {roomCode}
          </button>
        )}

        {/* Export */}
        <button
          onClick={() => exportPlanAsJson(plan)}
          title="导出 JSON"
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, color: 'var(--text-light)', borderRadius: '50%', flexShrink: 0,
          }}
        >
          ↑
        </button>
      </header>

      {/* ── Tab content ──────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as const,
        overscrollBehavior: 'contain',
        paddingBottom: 'calc(var(--nav-height) + 8px)',
      }}>
        {currentTab === 'overview'   && <OverviewTab />}
        {currentTab === 'supplies'   && <SuppliesTab />}
        {currentTab === 'expenses'   && <ExpensesTab />}
        {currentTab === 'settlement' && <SettlementTab />}
        {currentTab === 'share'      && <ShareTab />}
      </div>

      <BottomNav />
    </div>
  );
}
