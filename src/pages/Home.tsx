import { useState, useRef } from 'react';
import type { CampingPlan } from '../types';
import {
  loadPlans, loadPlan, savePlan, deletePlan, generateId,
  exportPlanAsJson, importPlanFromJson,
} from '../store';
import { createSamplePlan } from '../sampleData';
import { isSupabaseConfigured } from '../supabase';
import { generateRoomCode, createPlanInCloud, loadPlanByRoomCode } from '../sync';

interface Props {
  onOpenPlan: (id: string, roomCode?: string) => void;
}

export default function Home({ onOpenPlan }: Props) {
  const [plans, setPlans] = useState<CampingPlan[]>(() => loadPlans());
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [enableCloud, setEnableCloud] = useState(isSupabaseConfigured());
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinConflict, setJoinConflict] = useState<{
    cloudPlan: CampingPlan; roomCode: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cloudEnabled = isSupabaseConfigured();

  function refresh() { setPlans(loadPlans()); }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const now = new Date().toISOString();
    const plan: CampingPlan = {
      id: generateId(),
      name: newName.trim(),
      date: newDate,
      location: newLoc.trim(),
      aaMode: 'family',
      people: [],
      families: [],
      supplies: [],
      expenses: [],
      menuItems: [],
      createdAt: now,
      updatedAt: now,
    };

    let roomCode: string | undefined;
    if (enableCloud && cloudEnabled) {
      const code = generateRoomCode();
      const { error } = await createPlanInCloud(plan, code);
      if (!error) {
        roomCode = code;
        plan.roomCode = code;
      }
    }

    savePlan(plan);
    refresh();
    setShowNew(false);
    setNewName(''); setNewDate(''); setNewLoc('');
    setCreating(false);
    onOpenPlan(plan.id, roomCode);
  }

  async function handleJoin() {
    if (joinCode.trim().length < 6) return;
    setJoining(true);
    setJoinError('');
    const { plan: cloudPlan, roomCode, error } = await loadPlanByRoomCode(joinCode.trim());
    if (error || !cloudPlan || !roomCode) {
      setJoinError(error ?? '加入失败，请重试');
      setJoining(false);
      return;
    }
    const localCopy = loadPlan(cloudPlan.id);
    if (localCopy && localCopy.updatedAt > cloudPlan.updatedAt) {
      setJoinConflict({ cloudPlan, roomCode });
      setJoining(false);
      return;
    }
    cloudPlan.roomCode = roomCode;
    savePlan(cloudPlan);
    refresh();
    setShowJoin(false);
    setJoinCode('');
    setJoining(false);
    onOpenPlan(cloudPlan.id, roomCode);
  }

  function resolveJoinConflict(useCloud: boolean) {
    if (!joinConflict) return;
    const { cloudPlan, roomCode } = joinConflict;
    if (useCloud) {
      cloudPlan.roomCode = roomCode;
      savePlan(cloudPlan);
      refresh();
      onOpenPlan(cloudPlan.id, roomCode);
    } else {
      const localCopy = loadPlan(cloudPlan.id);
      if (localCopy) {
        localCopy.roomCode = roomCode;
        savePlan(localCopy);
        refresh();
        onOpenPlan(localCopy.id, roomCode);
      }
    }
    setJoinConflict(null);
    setShowJoin(false);
    setJoinCode('');
  }

  function handleLoadSample() {
    const sample = createSamplePlan();
    savePlan(sample);
    refresh();
    onOpenPlan(sample.id);
  }

  function handleDelete(id: string) {
    deletePlan(id);
    setToDelete(null);
    refresh();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const plan = importPlanFromJson(ev.target?.result as string);
      if (plan) { savePlan(plan); refresh(); onOpenPlan(plan.id); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Hero ───────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(150deg, #2E5540 0%, #3D6B50 40%, #4A7D5E 70%, #6A9E7C 100%)',
        padding: '52px 24px 44px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles — CSS only, no images */}
        <div style={{ position: 'absolute', top: -70, right: -70, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,200,100,0.10)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 52, right: 88, width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,225,80,0.16)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 18, left: '42%', width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', pointerEvents: 'none' }} />

        {/* Top-right utility — white on dark */}
        <div style={{ position: 'absolute', top: 18, right: 16, display: 'flex', gap: 6, zIndex: 2 }}>
          {cloudEnabled && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, color: 'rgba(255,255,255,0.92)',
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 'var(--radius-pill)',
              padding: '5px 10px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#88EDAA', display: 'inline-block' }} />
              实时同步
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.14)',
              cursor: 'pointer',
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, color: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            title="导入 JSON"
          >↓</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>

        {/* Brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 50, marginBottom: 14, lineHeight: 1,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.20))',
          }}>⛺</div>
          <h1 style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 34, fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em', lineHeight: 1.15,
            marginBottom: 8,
            textShadow: '0 2px 14px rgba(0,0,0,0.18)',
          }}>
            一起去露营
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.76)',
            fontWeight: 300, letterSpacing: '0.03em',
          }}>
            有组织地松弛一下
          </p>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────── */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={() => setShowNew(true)}
          style={{ width: '100%', fontSize: 16, padding: '16px 0', borderRadius: 'var(--radius-sm)', justifyContent: 'center' }}
        >
          新建计划
        </button>
        {cloudEnabled && (
          <button
            className="btn btn-secondary"
            onClick={() => setShowJoin(true)}
            style={{ width: '100%', fontSize: 15, padding: '14px 0', justifyContent: 'center' }}
          >
            用房间码加入
          </button>
        )}
      </div>

      {/* ── Plan list ──────────────────────────────── */}
      <div style={{ flex: 1, padding: '28px 20px 40px' }}>
        {plans.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🏕</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
              还没有计划<br />新建一个，或者先感受一下
            </p>
            <button
              className="btn btn-ghost"
              onClick={handleLoadSample}
              style={{ fontSize: 14, color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              加载示例计划
            </button>
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-light)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
            }}>
              我的计划
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plans.map((p, i) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  index={i}
                  onOpen={() => onOpenPlan(p.id)}
                  onExport={() => exportPlanAsJson(p)}
                  onDelete={() => setToDelete(p.id)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── New plan sheet ─────────────────────────── */}
      {showNew && (
        <BottomSheet onClose={() => setShowNew(false)} title="新建计划">
          <div className="form-group">
            <label className="form-label">计划名称 *</label>
            <input
              className="input"
              placeholder="例：五月山野露营"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">日期</label>
            <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">地点</label>
            <input className="input" placeholder="例：北京延庆松山营地" value={newLoc} onChange={e => setNewLoc(e.target.value)} />
          </div>

          {cloudEnabled && (
            <div className="toggle-wrap" style={{
              marginBottom: 24, padding: '14px 16px',
              background: 'var(--bg)', borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>多人实时协作</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>生成房间码，朋友扫码加入</div>
              </div>
              <button className={`toggle${enableCloud ? ' on' : ''}`} onClick={() => setEnableCloud(!enableCloud)} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)} style={{ flex: 1 }}>取消</button>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              style={{ flex: 2, opacity: (!newName.trim() || creating) ? 0.5 : 1 }}
            >
              {creating ? '创建中…' : '出发 →'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── Join room sheet ────────────────────────── */}
      {showJoin && (
        <BottomSheet
          onClose={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }}
          title="加入露营计划"
        >
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            输入队友分享的 6 位房间码，进入同一个计划
          </p>
          <div className="form-group">
            <input
              className="input"
              placeholder="ABC123"
              value={joinCode}
              onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
              maxLength={6}
              autoFocus
              style={{ fontSize: 24, letterSpacing: '0.3em', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }}
            />
            {joinError && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 4 }}>{joinError}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-ghost" onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }} style={{ flex: 1 }}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={handleJoin}
              disabled={joinCode.trim().length < 6 || joining}
              style={{ flex: 2, opacity: (joinCode.trim().length < 6 || joining) ? 0.5 : 1 }}
            >
              {joining ? '加入中…' : '加入'}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* ── Join conflict dialog ───────────────────── */}
      {joinConflict && (
        <div onClick={() => setJoinConflict(null)} style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(44,40,37,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', animation: 'fadeIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: '28px 24px', animation: 'popIn 0.25s ease', maxWidth: 340, width: '100%' }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 14 }}>⚠️</div>
            <h3 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 17, marginBottom: 8, textAlign: 'center', fontWeight: 600 }}>本地有更新的版本</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 20, textAlign: 'center' }}>
              你的设备上已有一份更新的本地版本，请选择保留哪个：
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-secondary" style={{ width: '100%', padding: '13px 16px', flexDirection: 'column', alignItems: 'flex-start', gap: 3, borderRadius: 'var(--radius-sm)' }} onClick={() => resolveJoinConflict(false)}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>保留本地版本（推荐）</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>使用你最新的修改，绑定此房间</div>
              </button>
              <button onClick={() => resolveJoinConflict(true)} style={{ width: '100%', padding: '13px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--red-dim)', border: '1px solid #EDBBBB', cursor: 'pointer', flexDirection: 'column', alignItems: 'flex-start', gap: 3, display: 'flex' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--red)' }}>使用云端版本</div>
                <div style={{ fontSize: 12, color: 'var(--red)', opacity: 0.7 }}>本地修改将丢失</div>
              </button>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setJoinConflict(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────── */}
      {toDelete && (
        <div onClick={() => setToDelete(null)} style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(44,40,37,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', animation: 'fadeIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 'var(--radius)', padding: '28px 24px', textAlign: 'center', animation: 'popIn 0.25s ease', maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>🗑️</div>
            <h3 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 17, marginBottom: 8, fontWeight: 600 }}>确认删除？</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              删除后无法恢复，建议先导出备份。
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)} style={{ flex: 1, border: '1px solid var(--border)' }}>取消</button>
              <button className="btn btn-danger" onClick={() => handleDelete(toDelete)} style={{ flex: 1 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Plan Card ─────────────────────────────────────────────── */
interface PlanCardProps {
  plan: CampingPlan;
  index: number;
  onOpen: () => void;
  onExport: () => void;
  onDelete: () => void;
  formatDate: (d: string) => string;
}

function PlanCard({ plan: p, index, onOpen, onExport, onDelete, formatDate }: PlanCardProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '18px 18px 14px',
        cursor: 'pointer',
        animation: `slideUp 0.28s ease ${index * 0.05}s both`,
      }}
      onClick={onOpen}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--primary-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          ⛺
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 17, fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}>
            {p.name}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {p.date && <span>{formatDate(p.date)}</span>}
            {p.date && p.location && <span>·</span>}
            {p.location && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location}</span>}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
          {p.families.length > 0 ? `${p.families.length} 个家庭 · ${p.people.length} 人` : '点击进入'}
          {p.roomCode && <span style={{ marginLeft: 8, color: 'var(--primary)', fontWeight: 500 }}>· {p.roomCode}</span>}
        </div>
        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button className="btn-icon" onClick={onExport} title="导出" style={{ fontSize: 15 }}>↑</button>
          <button className="btn-icon" onClick={onDelete} style={{ fontSize: 15, color: 'var(--text-light)' }}>✕</button>
        </div>
      </div>
    </div>
  );
}

/* ── Bottom Sheet ─────────────────────────────────────────── */
function BottomSheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(44,40,37,0.4)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.22s ease' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom)',
          animation: 'sheetIn 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '14px auto 4px' }} />
        <div style={{ padding: '8px 24px 28px' }}>
          <h3 style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 19, fontWeight: 600, marginBottom: 20, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
          {children}
        </div>
      </div>
    </div>
  );
}
