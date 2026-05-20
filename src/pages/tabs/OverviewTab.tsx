import { useState } from 'react';
import type { Person, Family, MenuItem } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';

const MEAL_PRESETS = ['早餐', '午餐', '晚餐', '晚间饮品', '宵夜', '下午茶', '篝火烧烤'];

function responsibleColor(name: string): { bg: string; text: string } {
  const palette = [
    { bg: '#EEF4F0', text: '#3D6B4F' },
    { bg: '#F5F0E8', text: '#7A5A2A' },
    { bg: '#EEF0F5', text: '#3A4E6B' },
    { bg: '#F4EFEE', text: '#6B3A3A' },
    { bg: '#F0EEF5', text: '#4E3A6B' },
    { bg: '#EEF4F3', text: '#2E6058' },
    { bg: '#F5F0EE', text: '#6B4A3A' },
    { bg: '#EFF4EE', text: '#426B3A' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return palette[h % palette.length];
}

/* ── Section icon badge ────────────────────────────────────── */
function SectionBadge({ emoji, color }: { emoji: string; color: string }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9,
      background: color + '1A',
      border: `1.5px solid ${color}45`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, flexShrink: 0,
    }}>
      {emoji}
    </div>
  );
}

/* ── Section container ─────────────────────────────────────── */
function SectionCard({
  bg, border, children, style,
}: {
  bg: string; border: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section style={{
      background: bg,
      borderRadius: 'var(--radius)',
      padding: '18px',
      border: `1px solid ${border}`,
      boxShadow: 'var(--shadow-sm)',
      marginBottom: 12,
      ...style,
    }}>
      {children}
    </section>
  );
}

export default function OverviewTab() {
  const { plan, updatePlan, toast } = useApp();

  const [name, setName] = useState(plan.name);
  const [date, setDate] = useState(plan.date);
  const [location, setLocation] = useState(plan.location);
  const [dirty, setDirty] = useState(false);

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [familyName, setFamilyName] = useState('');

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenu, setEditMenu] = useState<MenuItem | null>(null);
  const [mTime, setMTime] = useState('');
  const [mMeal, setMMeal] = useState('');
  const [mMenuText, setMMenuText] = useState('');
  const [mResponsible, setMResponsible] = useState('');

  const [showPersonModal, setShowPersonModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [personName, setPersonName] = useState('');
  const [personFamily, setPersonFamily] = useState('');

  function saveBasic() {
    updatePlan({ ...plan, name, date, location });
    setDirty(false);
    toast('已保存');
  }

  function openAddMenu() {
    setEditMenu(null);
    setMTime(''); setMMeal(MEAL_PRESETS[1]); setMMenuText(''); setMResponsible('');
    setShowMenuModal(true);
  }
  function openEditMenu(m: MenuItem) {
    setEditMenu(m);
    setMTime(m.time); setMMeal(m.meal); setMMenuText(m.menu); setMResponsible(m.responsible);
    setShowMenuModal(true);
  }
  function saveMenu() {
    if (!mTime.trim() || !mMenuText.trim()) return;
    const item: MenuItem = {
      id: editMenu?.id ?? generateId(),
      time: mTime.trim(), meal: mMeal || MEAL_PRESETS[1],
      menu: mMenuText.trim(), responsible: mResponsible.trim(),
    };
    const items = editMenu
      ? plan.menuItems.map(m => m.id === editMenu.id ? item : m)
      : [...plan.menuItems, item];
    updatePlan({ ...plan, menuItems: items });
    setShowMenuModal(false);
    toast(editMenu ? '已更新' : '已添加');
  }
  function deleteMenu(id: string) {
    updatePlan({ ...plan, menuItems: plan.menuItems.filter(m => m.id !== id) });
  }

  const menuGroups = plan.menuItems.reduce<{ time: string; items: MenuItem[] }[]>((acc, item) => {
    const g = acc.find(g => g.time === item.time);
    if (g) g.items.push(item); else acc.push({ time: item.time, items: [item] });
    return acc;
  }, []);

  function openAddFamily() {
    setEditFamily(null); setFamilyName(''); setShowFamilyModal(true);
  }
  function openEditFamily(f: Family) {
    setEditFamily(f); setFamilyName(f.name); setShowFamilyModal(true);
  }
  function saveFamily() {
    if (!familyName.trim()) return;
    if (editFamily) {
      updatePlan({ ...plan, families: plan.families.map(f => f.id === editFamily.id ? { ...f, name: familyName.trim() } : f) });
      toast('已更新');
    } else {
      updatePlan({ ...plan, families: [...plan.families, { id: generateId(), name: familyName.trim() }] });
      toast('已添加');
    }
    setShowFamilyModal(false);
  }
  function deleteFamily(id: string) {
    if (plan.people.some(p => p.familyId === id)) { toast('请先移除该家庭下的成员', 'error'); return; }
    updatePlan({ ...plan, families: plan.families.filter(f => f.id !== id) });
  }

  function openAddPerson() {
    setEditPerson(null); setPersonName(''); setPersonFamily(plan.families[0]?.id ?? ''); setShowPersonModal(true);
  }
  function openEditPerson(p: Person) {
    setEditPerson(p); setPersonName(p.name); setPersonFamily(p.familyId); setShowPersonModal(true);
  }
  function savePerson() {
    if (!personName.trim() || !personFamily) return;
    if (editPerson) {
      updatePlan({ ...plan, people: plan.people.map(p => p.id === editPerson.id ? { ...p, name: personName.trim(), familyId: personFamily } : p) });
      toast('已更新');
    } else {
      updatePlan({ ...plan, people: [...plan.people, { id: generateId(), name: personName.trim(), familyId: personFamily }] });
      toast('已添加');
    }
    setShowPersonModal(false);
  }
  function deletePerson(id: string) {
    updatePlan({ ...plan, people: plan.people.filter(p => p.id !== id) });
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>

      {/* ── Basic info ───────────────────────────── */}
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="section-header">
          <span className="section-title">📋 基本信息</span>
          {dirty && (
            <button className="btn btn-primary btn-sm" onClick={saveBasic}>保存</button>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">计划名称</label>
          <input className="input" value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="露营计划名称" />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">日期</label>
          <input className="input" type="date" value={date} onChange={e => { setDate(e.target.value); setDirty(true); }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">地点</label>
          <input className="input" value={location} onChange={e => { setLocation(e.target.value); setDirty(true); }} placeholder="营地地址" />
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────── */}
      {plan.families.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: '家庭', value: plan.families.length, color: '#3D6B4F', bg: '#EBF5EE', border: '#B8D8C4' },
            { label: '成员', value: plan.people.length,   color: '#A85A30', bg: '#FAF0E8', border: '#E8C4A0' },
            { label: '物资', value: plan.supplies.length, color: '#7A6020', bg: '#FAF5E4', border: '#DDD098' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg,
              borderRadius: 'var(--radius-sm)',
              padding: '14px 10px',
              textAlign: 'center',
              border: `1px solid ${s.border}`,
            }}>
              <div style={{
                fontSize: 28, fontFamily: "'Noto Serif SC', serif",
                fontWeight: 700, color: s.color, lineHeight: 1,
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: s.color, opacity: 0.7, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Menu ─────────────────────────────────── */}
      {/* Warm cream — food energy */}
      <SectionCard bg="#FBF8F0" border="#E8DECA">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SectionBadge emoji="🍽" color="#C07840" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>露营菜单</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={openAddMenu}>＋ 添加</button>
        </div>

        {plan.menuItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <div className="empty-icon" style={{ fontSize: 28 }}>🥩</div>
            <p style={{ fontSize: 13 }}>还没有菜单安排<br />添加后作为公告展示给所有人</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {menuGroups.map(group => (
              <div key={group.time}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: '#E8D4B8', color: '#7A4A20',
                  borderRadius: 'var(--radius-pill)', padding: '3px 12px',
                  fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: '0.03em',
                }}>
                  {group.time}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.items.map(item => {
                    const rc = item.responsible ? responsibleColor(item.responsible) : null;
                    return (
                      <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'white', border: '1px solid #EDE0CC',
                        borderRadius: 'var(--radius-xs)', padding: '10px 12px',
                      }}>
                        <span style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 600,
                          color: '#9A6030', background: '#F5E8D8',
                          border: '1px solid #E8D0B0',
                          borderRadius: 'var(--radius-pill)', padding: '2px 9px', whiteSpace: 'nowrap',
                        }}>
                          {item.meal}
                        </span>
                        <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', lineHeight: 1.4, minWidth: 0 }}>
                          {item.menu}
                        </span>
                        {rc && (
                          <span style={{
                            flexShrink: 0, fontSize: 12, fontWeight: 500,
                            background: rc.bg, color: rc.text,
                            borderRadius: 'var(--radius-pill)', padding: '3px 10px', whiteSpace: 'nowrap',
                          }}>
                            {item.responsible}
                          </span>
                        )}
                        <button className="btn-icon" onClick={() => openEditMenu(item)} style={{ fontSize: 14, flexShrink: 0 }}>✏️</button>
                        <button className="btn-icon" onClick={() => deleteMenu(item.id)} style={{ fontSize: 14, flexShrink: 0, color: 'var(--text-light)' }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Families ─────────────────────────────── */}
      {/* Sage green — community, belonging */}
      <SectionCard bg="#EEF6F1" border="#C0DDC8">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SectionBadge emoji="🏠" color="#3D6B4F" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>家庭 / 小组</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={openAddFamily}>＋ 添加</button>
        </div>
        {plan.families.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 13 }}>先添加家庭或小组<br />再邀请成员和安排物资</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plan.families.map(f => {
              const memberCount = plan.people.filter(p => p.familyId === f.id).length;
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', background: 'white',
                  borderRadius: 'var(--radius-xs)', border: '1px solid #C8DDD2',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: 'var(--primary-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'var(--primary)', fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {f.name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 1 }}>
                      {memberCount > 0 ? `${memberCount} 位成员` : '暂无成员'}
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => openEditFamily(f)} style={{ fontSize: 15 }}>✏️</button>
                  <button className="btn-icon" onClick={() => deleteFamily(f.id)} style={{ fontSize: 15, color: 'var(--text-light)' }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── People ───────────────────────────────── */}
      {/* Warm peach — people, warmth */}
      <SectionCard bg="#FBF3EF" border="#E0C4B4" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SectionBadge emoji="👥" color="#C06840" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>参与成员</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={openAddPerson}
            disabled={plan.families.length === 0}
            style={{ opacity: plan.families.length === 0 ? 0.4 : 1 }}
          >
            ＋ 添加
          </button>
        </div>

        {plan.families.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>请先添加家庭/小组</p>
        )}

        {plan.people.length === 0 && plan.families.length > 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 13 }}>把这次要去露营的小伙伴都加上吧</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plan.families.map(fam => {
              const members = plan.people.filter(p => p.familyId === fam.id);
              if (members.length === 0) return null;
              return (
                <div key={fam.id}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: '#B06840',
                    letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase',
                  }}>
                    {fam.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {members.map(person => (
                      <div key={person.id} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        background: 'white', border: '1px solid #E0C4B4',
                        borderRadius: 'var(--radius-pill)', padding: '6px 10px 6px 8px',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: '#F5E4DC', color: '#C06840',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {person.name.slice(0, 1)}
                        </div>
                        <span style={{ fontSize: 14, color: 'var(--text)' }}>{person.name}</span>
                        <button onClick={() => openEditPerson(person)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-light)', padding: 0, lineHeight: 1 }}>✏️</button>
                        <button onClick={() => deletePerson(person.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-light)', padding: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Modals ───────────────────────────────── */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={editMenu ? '编辑菜单' : '添加菜单'}
        footer={
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveMenu} disabled={!mTime.trim() || !mMenuText.trim()}>
            {editMenu ? '保存' : '添加'}
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">时间 *</label>
            <input className="input" placeholder="如：周六、Day 1" value={mTime} onChange={e => setMTime(e.target.value)} list="time-suggestions" autoFocus />
            <datalist id="time-suggestions">
              {['周五', '周六', '周日', 'Day 1', 'Day 2', 'Day 3'].map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">餐次</label>
            <select className="input" value={mMeal} onChange={e => setMMeal(e.target.value)}>
              {MEAL_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">菜单内容 *</label>
          <input className="input" placeholder="如：番茄微辣火锅、烤肉+沙拉" value={mMenuText} onChange={e => setMMenuText(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">负责人</label>
          <input className="input" placeholder="可填家庭/小组或个人名字" value={mResponsible} onChange={e => setMResponsible(e.target.value)} />
        </div>
      </Modal>

      <Modal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        title={editFamily ? '编辑家庭/小组' : '添加家庭/小组'}
        footer={
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveFamily} disabled={!familyName.trim()}>
            {editFamily ? '保存' : '添加'}
          </button>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">名称</label>
          <input className="input" placeholder="例：煊哥家" value={familyName} onChange={e => setFamilyName(e.target.value)} autoFocus />
        </div>
      </Modal>

      <Modal
        isOpen={showPersonModal}
        onClose={() => setShowPersonModal(false)}
        title={editPerson ? '编辑成员' : '添加成员'}
        footer={
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={savePerson} disabled={!personName.trim() || !personFamily}>
            {editPerson ? '保存' : '添加成员'}
          </button>
        }
      >
        <div className="form-group">
          <label className="form-label">姓名 / 昵称</label>
          <input className="input" placeholder="例：煊哥" value={personName} onChange={e => setPersonName(e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">所属家庭 / 小组</label>
          <select className="input" value={personFamily} onChange={e => setPersonFamily(e.target.value)}>
            <option value="">请选择</option>
            {plan.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  );
}
