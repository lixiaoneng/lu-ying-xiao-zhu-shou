import { useState, useRef } from 'react';
import type { CampingPlan } from '../types';
import {
  loadPlans, loadPlan, savePlan, deletePlan, generateId,
  exportPlanAsJson, importPlanFromJson, duplicatePlan,
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
  const [newEndDate, setNewEndDate] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [enableCloud, setEnableCloud] = useState(isSupabaseConfigured());
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Duplicate flow
  const [duplicateSource, setDuplicateSource] = useState<CampingPlan | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Room join state
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  // Conflict: local plan is newer than cloud plan when joining
  const [joinConflict, setJoinConflict] = useState<{
    cloudPlan: CampingPlan; roomCode: string;
  } | null>(null);

  // ⋯ Action Sheet
  const [actionSheetPlan, setActionSheetPlan] = useState<CampingPlan | null>(null);

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
      endDate: newEndDate,
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
    setNewName(''); setNewDate(''); setNewEndDate(''); setNewLoc('');
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

    // Check if there's a local copy of this plan that is newer than the cloud version
    const localCopy = loadPlan(cloudPlan.id);
    if (localCopy && localCopy.updatedAt > cloudPlan.updatedAt) {
      // Surface conflict dialog — let user decide
      setJoinConflict({ cloudPlan, roomCode });
      setJoining(false);
      return;
    }

    // No conflict: cloud is same age or newer, use it directly
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
      // Overwrite local with cloud version
      cloudPlan.roomCode = roomCode;
      savePlan(cloudPlan);
      refresh();
      onOpenPlan(cloudPlan.id, roomCode);
    } else {
      // Keep local version but attach the room code so sync works going forward
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

  async function handleDuplicateLocal() {
    if (!duplicateSource) return;
    const copy = duplicatePlan(duplicateSource);
    savePlan(copy);
    refresh();
    setDuplicateSource(null);
    onOpenPlan(copy.id);
  }

  async function handleDuplicateCloud() {
    if (!duplicateSource || !cloudEnabled) return;
    setDuplicating(true);
    const copy = duplicatePlan(duplicateSource);
    const code = generateRoomCode();
    const { error } = await createPlanInCloud(copy, code);
    if (!error) {
      copy.roomCode = code;
    }
    savePlan(copy);
    refresh();
    setDuplicating(false);
    setDuplicateSource(null);
    onOpenPlan(copy.id, copy.roomCode);
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

  function formatDate(d: string, end?: string) {
    if (!d) return '';
    const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    return end ? `${fmt(d)} - ${fmt(end)}` : fmt(d);
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #E8783C 0%, #C85616 38%, #D07840 70%, #E0A040 100%)',
        padding: '22px 20px 44px', position: 'relative', overflow: 'hidden',
      }}>
        {/* 日落光晕 — 右上，主光源 */}
        <div style={{
          position: 'absolute', top: -60, right: -50,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,215,110,0.22) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        {/* 左侧柔和环境光 */}
        <div style={{
          position: 'absolute', top: -20, left: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,235,175,0.07)',
          pointerEvents: 'none',
        }} />

        {/* 云端 badge — 右上角毛玻璃 */}
        {cloudEnabled && (
          <div style={{
            position: 'absolute', top: 14, right: 14, zIndex: 3,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.13)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20, padding: '4px 10px 4px 8px',
            fontSize: 11, color: 'rgba(255,255,255,0.88)',
            fontWeight: 500, letterSpacing: '0.02em',
            pointerEvents: 'none',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#A8D898', flexShrink: 0 }} />
            云端多人协作开启
          </div>
        )}

        {/* 月牙 */}
        <div style={{ position: 'absolute', top: 30, right: 64, pointerEvents: 'none' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,242,160,0.30)',
            boxShadow: '0 0 20px rgba(255,220,70,0.18)',
          }} />
          <div style={{
            position: 'absolute', top: -3, right: -5,
            width: 21, height: 21, borderRadius: '50%',
            background: '#C06020',
          }} />
        </div>

        {/* 星点 — 4颗，克制 */}
        {([{ t: 14, r: 108 }, { t: 40, r: 140 }, { t: 9, r: 168 }, { t: 26, r: 202 }] as {t:number,r:number}[]).map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.t, right: s.r,
            width: 2, height: 2, borderRadius: '50%',
            background: `rgba(255,252,230,${0.30 + (i % 2) * 0.12})`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* 草地轮廓 — 松针绿，极淡，只做大地感 */}
        <svg viewBox="0 0 400 38" preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 38, pointerEvents: 'none' }}>
          {/* 后景：平缓草坡 */}
          <path d="M 0 38 L 0 26 Q 60 16 130 22 Q 200 28 270 18 Q 330 10 400 20 L 400 38 Z"
            fill="rgba(100, 160, 75, 0.11)" />
          {/* 前景：微起伏草地边缘 */}
          <path d="M 0 38 L 0 32 Q 80 26 160 30 Q 240 34 320 28 Q 370 24 400 30 L 400 38 Z"
            fill="rgba(110, 170, 80, 0.13)" />
        </svg>

        {/* 文字内容 */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 42, marginBottom: 6, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))' }}>⛺</div>
          <h1 style={{
            fontSize: 24, color: 'white', margin: 0,
            letterSpacing: '0.04em', lineHeight: 1.2,
            textShadow: '0 2px 10px rgba(0,0,0,0.20)',
          }}>
            露营小助手
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.70)', fontSize: 12.5,
            marginTop: 7, lineHeight: 1.7, letterSpacing: '0.10em',
          }}>
            有组织地松弛一下
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 16px 32px' }}>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ flex: 1, fontSize: 15, padding: '14px 0' }}>
            ＋ 新建露营计划
          </button>
          {cloudEnabled && (
            <button className="btn btn-secondary" onClick={() => setShowJoin(true)} style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
              🔗 加入房间
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} style={{ padding: '14px 14px' }} title="导入 JSON">
            📥
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </div>

        {/* Plan list */}
        {plans.length === 0 ? (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--radius)', padding: '32px 20px',
            textAlign: 'center', border: '1.5px dashed var(--border)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏕️</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
              还没有露营计划<br />新建一个，或者加载示例数据试试
            </p>
            <button className="btn btn-secondary" onClick={handleLoadSample} style={{ marginTop: 16 }}>
              加载示例计划
            </button>
          </div>
        ) : (
          <>
            {/* Section header */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.10em', textTransform: 'uppercase',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#6A9B58', flexShrink: 0, display: 'inline-block',
              }} />
              我的计划 · {plans.length}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plans.map((p, i) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    animation: `slideUp 0.28s ease ${i * 0.05}s both`,
                    padding: '13px 14px 12px',
                    position: 'relative',
                    transition: 'box-shadow 0.18s ease, transform 0.15s ease',
                  }}
                  onClick={() => onOpenPlan(p.id)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(90,140,72,0.12), 0 1px 6px rgba(200,101,26,0.07)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                  }}
                >
                  {/* ── Row 1: 名称 + 云端 badge + ⋯ ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{
                      fontWeight: 700, fontSize: 15, lineHeight: 1.3,
                      flex: 1, minWidth: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </span>
                    {p.roomCode && (
                      <span style={{
                        fontSize: 10, color: '#4A7A5A', flexShrink: 0,
                        background: 'rgba(74,122,90,0.09)',
                        border: '1px solid rgba(74,122,90,0.18)',
                        borderRadius: 6, padding: '1px 6px', lineHeight: 1.7,
                      }}>☁️ 云端</span>
                    )}

                    {/* ⋯ 按钮 → 底部 Action Sheet */}
                    <button
                      onClick={e => { e.stopPropagation(); setActionSheetPlan(p); }}
                      style={{
                        flexShrink: 0, width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8, border: 'none', background: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-warm)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      title="更多操作"
                    >
                      •••
                    </button>
                  </div>

                  {/* ── Row 2: 日期 + 地点 ── */}
                  {(p.date || p.location) && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 5, overflow: 'hidden',
                    }}>
                      {p.date && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          📅 {formatDate(p.date, p.endDate)}
                        </span>
                      )}
                      {p.date && p.location && (
                        <span style={{ color: 'var(--border)', fontSize: 10 }}>|</span>
                      )}
                      {p.location && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          📍 {p.location}
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Row 3: 人数 + 物资 ── */}
                  <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.people.length > 0 ? (
                      <>
                        <span style={{ color: '#5E8F4A', fontWeight: 600 }}>👥 {p.people.length} 人</span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ color: '#5E8F4A', fontWeight: 600 }}>📦 {p.supplies.length} 项物资</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-light)' }}>还没有参与者</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── New plan sheet ── */}
      {showNew && (
        <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(44,26,14,0.45)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.22s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--card)', borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)', animation: 'sheetIn 0.3s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 4px' }} />
            <div style={{ padding: '8px 20px 24px' }}>
              <h3 style={{ fontSize: 18, marginBottom: 20 }}>新建露营计划</h3>
              <div className="form-group">
                <label className="form-label">计划名称 *</label>
                <input className="input" placeholder="例：五月山野露营" value={newName} onChange={e => setNewName(e.target.value)} maxLength={20} />
              </div>
              <div className="form-group">
                <label className="form-label">日期</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ flex: 1, width: '100%' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>至</span>
                  <input className="input" type="date" value={newEndDate} min={newDate || undefined} onChange={e => setNewEndDate(e.target.value)} style={{ flex: 1, width: '100%' }} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">地点</label>
                <input className="input" placeholder="例：北京延庆松山营地" value={newLoc} onChange={e => setNewLoc(e.target.value)} maxLength={20} />
              </div>

              {cloudEnabled && (
                <div className="toggle-wrap" style={{ marginBottom: 24, padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>☁️ 上传云端，生成房间码</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>开启后朋友可通过房间码加入协作</div>
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
                  {creating ? '创建中…' : '创建计划 →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Join room sheet ── */}
      {showJoin && (
        <div onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(44,26,14,0.45)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.22s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--card)', borderRadius: '20px 20px 0 0', paddingBottom: 'env(safe-area-inset-bottom)', animation: 'sheetIn 0.3s cubic-bezier(0.32,0.72,0,1)' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 4px' }} />
            <div style={{ padding: '8px 20px 24px' }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>加入露营计划</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                输入队友分享的 6 位房间码，进入同一个计划协作
              </p>
              <div className="form-group">
                <label className="form-label">房间码</label>
                <input
                  className="input"
                  placeholder="例：ABC123"
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                  maxLength={6}
                  autoFocus
                  style={{ fontSize: 22, letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700 }}
                />
                {joinError && (
                  <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 6 }}>{joinError}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setShowJoin(false); setJoinCode(''); setJoinError(''); }} style={{ flex: 1 }}>取消</button>
                <button
                  className="btn btn-primary"
                  onClick={handleJoin}
                  disabled={joinCode.trim().length < 6 || joining}
                  style={{ flex: 2, opacity: (joinCode.trim().length < 6 || joining) ? 0.5 : 1 }}
                >
                  {joining ? '加入中…' : '加入 →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Join conflict dialog ── */}
      {joinConflict && (
        <div onClick={() => setJoinConflict(null)} style={{ position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(44,26,14,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', animation: 'fadeIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 20, padding: '24px 20px', animation: 'slideUp 0.25s ease', maxWidth: 340, width: '100%' }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, marginBottom: 8, textAlign: 'center' }}>本地有更新的版本</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 20, textAlign: 'center' }}>
              你的设备上已有一份更新的本地版本。<br />请选择保留哪个版本：
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', textAlign: 'left', padding: '12px 16px', display: 'block' }}
                onClick={() => resolveJoinConflict(false)}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>✅ 保留本地版本（推荐）</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>使用你设备上最新的修改，并绑定到此房间</div>
              </button>
              <button
                className="btn"
                style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid #F5BDB8', borderRadius: 'var(--radius-sm)', display: 'block' }}
                onClick={() => resolveJoinConflict(true)}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>☁️ 使用云端版本</div>
                <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>会覆盖本地修改，数据无法恢复</div>
              </button>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setJoinConflict(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate confirm ── */}
      {duplicateSource && (
        <div
          onClick={() => { if (!duplicating) setDuplicateSource(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(44,26,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', animation: 'fadeIn 0.2s ease' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 20, padding: '24px 20px', animation: 'slideUp 0.25s ease', maxWidth: 340, width: '100%' }}
          >
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>📋</div>
            <h3 style={{ fontSize: 17, marginBottom: 8, textAlign: 'center' }}>复制露营计划</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, marginBottom: 6, textAlign: 'center' }}>
              将复制「{duplicateSource.name}」的全部人员、物资、菜单和花费，生成一个全新的独立计划。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
              {cloudEnabled && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'left', padding: '13px 16px', display: 'block', opacity: duplicating ? 0.6 : 1 }}
                  onClick={handleDuplicateCloud}
                  disabled={duplicating}
                >
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {duplicating ? '上传中…' : '☁️ 生成房间码'}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2, fontWeight: 400 }}>
                    上传云端，可分享给朋友一起协作
                  </div>
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ width: '100%', textAlign: 'left', padding: '13px 16px', display: 'block', opacity: duplicating ? 0.6 : 1 }}
                onClick={handleDuplicateLocal}
                disabled={duplicating}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>💾 仅本地复制</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  只保存在当前设备，不生成房间码
                </div>
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => setDuplicateSource(null)}
                disabled={duplicating}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Sheet ── */}
      {actionSheetPlan && (
        <div
          onClick={() => setActionSheetPlan(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(44,26,14,0.45)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.22s ease' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '0 10px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)', animation: 'sheetIn 0.3s cubic-bezier(0.32,0.72,0,1)' }}
          >
            {/* 主操作组 */}
            <div style={{ background: 'var(--card)', borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}>
              {/* 计划名称提示 */}
              <div style={{
                padding: '13px 16px 11px',
                textAlign: 'center',
                borderBottom: '1px solid var(--bg-warm)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {actionSheetPlan.name}
                </div>
              </div>

              {/* 查看详情 */}
              <button
                onClick={() => { onOpenPlan(actionSheetPlan.id); setActionSheetPlan(null); }}
                style={{ display: 'block', width: '100%', padding: '16px', fontSize: 16, textAlign: 'center', background: 'none', border: 'none', borderBottom: '1px solid var(--bg-warm)', color: 'var(--text)', cursor: 'pointer', fontWeight: 500 }}
              >
                查看详情
              </button>

              {/* 复制计划 */}
              <button
                onClick={() => { setDuplicateSource(actionSheetPlan); setActionSheetPlan(null); }}
                style={{ display: 'block', width: '100%', padding: '16px', fontSize: 16, textAlign: 'center', background: 'none', border: 'none', borderBottom: '1px solid var(--bg-warm)', color: 'var(--text)', cursor: 'pointer', fontWeight: 500 }}
              >
                复制计划
              </button>

              {/* 导出 */}
              <button
                onClick={() => { exportPlanAsJson(actionSheetPlan); setActionSheetPlan(null); }}
                style={{ display: 'block', width: '100%', padding: '16px', fontSize: 16, textAlign: 'center', background: 'none', border: 'none', borderBottom: '1px solid var(--bg-warm)', color: 'var(--text)', cursor: 'pointer', fontWeight: 500 }}
              >
                导出 JSON
              </button>

              {/* 删除（红色，二次确认） */}
              <button
                onClick={() => { setToDelete(actionSheetPlan.id); setActionSheetPlan(null); }}
                style={{ display: 'block', width: '100%', padding: '16px', fontSize: 16, textAlign: 'center', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 500 }}
              >
                删除
              </button>
            </div>

            {/* 取消 — 独立卡片 */}
            <div style={{ background: 'var(--card)', borderRadius: 16, overflow: 'hidden' }}>
              <button
                onClick={() => setActionSheetPlan(null)}
                style={{ display: 'block', width: '100%', padding: '16px', fontSize: 16, textAlign: 'center', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {toDelete && (
        <div onClick={() => setToDelete(null)} style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(44,26,14,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', animation: 'fadeIn 0.2s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', borderRadius: 20, padding: '24px 20px', textAlign: 'center', animation: 'slideUp 0.25s ease', maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>确认删除？</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>删除后无法恢复，建议先导出备份。</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setToDelete(null)} style={{ flex: 1 }}>取消</button>
              <button className="btn btn-danger" onClick={() => handleDelete(toDelete)} style={{ flex: 1 }}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
