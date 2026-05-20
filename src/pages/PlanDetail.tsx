import { useApp } from '../App';
import BottomNav from '../components/BottomNav';
import OverviewTab from './tabs/OverviewTab';
import SuppliesTab from './tabs/SuppliesTab';
import ExpensesTab from './tabs/ExpensesTab';
import SettlementTab from './tabs/SettlementTab';
import ShareTab from './tabs/ShareTab';
import { exportPlanAsJson } from '../store';

const SYNC_ICON: Record<string, { icon: string; color: string; title: string }> = {
  syncing: { icon: '🔄', color: 'var(--text-muted)', title: '同步中…' },
  synced:  { icon: '✓',  color: 'var(--green)',      title: '已同步' },
  error:   { icon: '⚠️', color: '#C0392B',            title: '同步失败，点击重试' },
};

export default function PlanDetail() {
  const { plan, goHome, currentTab, roomCode, toast, syncStatus, forceSync } = useApp();

  function formatDate(d: string) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  const syncInfo = roomCode ? SYNC_ICON[syncStatus] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 400,
        flexShrink: 0,
      }}>
        <button className="btn-icon" onClick={goHome} style={{ fontSize: 20 }}>
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'ZCOOL XiaoWei, serif',
            fontSize: 17,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {plan.name}
          </div>
          {(plan.date || plan.location) && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
              {plan.date && formatDate(plan.date)}
              {plan.date && plan.location && ' · '}
              {plan.location}
            </div>
          )}
        </div>

        {/* Sync status indicator — only for cloud plans */}
        {syncInfo && (
          <button
            onClick={forceSync}
            title={syncInfo.title}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: syncStatus === 'synced' ? 14 : 16,
              color: syncInfo.color,
              padding: '4px 2px',
              flexShrink: 0,
              animation: syncStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
              display: 'flex', alignItems: 'center',
            }}
          >
            {syncInfo.icon}
          </button>
        )}

        {/* Room code pill */}
        {roomCode && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomCode).catch(() => {});
              toast('房间码已复制：' + roomCode);
            }}
            style={{
              border: 'none', cursor: 'pointer',
              background: 'var(--primary-dim)',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 13, fontWeight: 700,
              color: 'var(--primary)', letterSpacing: '0.12em',
              flexShrink: 0,
            }}
            title="点击复制房间码"
          >
            {roomCode}
          </button>
        )}

        <button
          className="btn-icon"
          onClick={() => exportPlanAsJson(plan)}
          title="导出 JSON"
          style={{ fontSize: 18 }}
        >
          📤
        </button>
      </header>

      {/* Tab content */}
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
