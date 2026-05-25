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

  function formatDate(d: string) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #C8651A 0%, #A84E10 60%, #7A3A08 100%)',
        padding: '52px 24px 36px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>⛺</div>
          <h1 style={{ fontSize: 30, color: 'white', letterSpacing: '0.04em', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            露营小助手
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 6 }}>
            告别腾讯文档，轻松规划露营每件事
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 16px 32px' }}>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: cloudEnabled ? 10 : 24 }}>
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

        {/* Cloud status */}
        {cloudEnabled && (
          <div style={{
            fontSize: 12, color: 'var(--green)', background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            borderRadius: 'var(--radius-xs)', padding: '6px 12px',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ☁️ 已连接 Supabase，支持多人协作
          </div>
        )}

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
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
              我的计划
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plans.map((p, i) => (
                <div
                  key={p.id}
                  className="card"
                  style={{ cursor: 'pointer', animation: `slideUp 0.28s ease ${i * 0.05}s both`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => onOpenPlan(p.id)}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⛺</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {p.date && <span>📅 {formatDate(p.date)}</span>}
                      {p.location && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {p.location}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                      {p.families.length}个家庭 · {p.people.length}人
                    </div>
                  </div>
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); setDuplicateSource(p); }} title="复制计划">📋</button>
                  <button className="btn-icon" onClick={e => { e.stopPropagation(); exportPlanAsJson(p); }} title="导出">📤</button>
                  <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={e => { e.stopPropagation(); setToDelete(p.id); }} title="删除">🗑️</button>
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
                <input className="input" placeholder="例：五月山野露营" value={newName} onChange={e => setNewName(e.target.value)} autoFocus maxLength={20} />
              </div>
              <div className="form-group">
                <label className="form-label">日期</label>
                <input className="input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
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
