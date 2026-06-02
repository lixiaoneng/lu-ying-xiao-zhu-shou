import { useState } from 'react';
import type { Person, Family, MenuItem } from '../../types';
import { useApp } from '../../App';
import { generateId } from '../../store';
import Modal from '../../components/Modal';


const MEAL_PRESETS = ['早餐', '午餐', '晚餐', '下午茶', '宵夜', '其他'];

// Deterministic pastel color from a string
function responsibleColor(name: string): { bg: string; text: string } {
  const palette = [
    { bg: '#FFE4E4', text: '#B03020' },
    { bg: '#E4EEFF', text: '#2848B0' },
    { bg: '#E4F5E8', text: '#27784A' },
    { bg: '#FFF3E0', text: '#B06820' },
    { bg: '#F0E4FF', text: '#7028B0' },
    { bg: '#E0F8F5', text: '#1A8080' },
    { bg: '#FFE8F0', text: '#B02860' },
    { bg: '#EEFAE0', text: '#4A7820' },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return palette[h % palette.length];
}

export default function OverviewTab() {
  const { plan, updatePlan, toast } = useApp();

  // Basic info edit state
  const [name, setName] = useState(plan.name);
  const [date, setDate] = useState(plan.date);
  const [endDate, setEndDate] = useState(plan.endDate ?? '');
  const [location, setLocation] = useState(plan.location);
  const [dirty, setDirty] = useState(false);

  // Family modal
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [familyName, setFamilyName] = useState('');

  // Solo modal
  const [showSoloModal, setShowSoloModal] = useState(false);
  const [soloName, setSoloName] = useState('');

  // Menu section
  const [menuExpanded, setMenuExpanded] = useState(true);

  // Menu modal
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenu, setEditMenu] = useState<MenuItem | null>(null);
  const [mTime, setMTime] = useState('');
  const [mMeal, setMMeal] = useState('');
  const [mMenuText, setMMenuText] = useState('');
  const [mResponsible, setMResponsible] = useState('');

  // Person modal
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [personName, setPersonName] = useState('');
  const [personFamily, setPersonFamily] = useState('');

  function saveBasic() {
    updatePlan({ ...plan, name, date, endDate, location });
    setDirty(false);
    toast('基本信息已保存');
  }

  // ─── Menu items ─────────────────────────
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
      time: mTime.trim(),
      meal: mMeal || MEAL_PRESETS[1],
      menu: mMenuText.trim(),
      responsible: mResponsible.trim(),
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
  // Group menu items by time → meal (display only, data unchanged)
  const menuGroups = plan.menuItems.reduce<{ time: string; meals: { meal: string; items: MenuItem[] }[] }[]>((acc, item) => {
    let tg = acc.find(g => g.time === item.time);
    if (!tg) { tg = { time: item.time, meals: [] }; acc.push(tg); }
    let mg = tg.meals.find(m => m.meal === item.meal);
    if (!mg) { mg = { meal: item.meal, items: [] }; tg.meals.push(mg); }
    mg.items.push(item);
    return acc;
  }, []);

  // Derived: non-solo families, solo family ids
  const nonSoloFamilies = plan.families.filter(f => !f.isSolo);
  const soloFamilyIds = new Set(plan.families.filter(f => f.isSolo).map(f => f.id));
  const soloPeople = plan.people.filter(p => soloFamilyIds.has(p.familyId));

  // ─── Families ───────────────────────────
  function openAddFamily() {
    setEditFamily(null);
    setFamilyName('');
    setShowFamilyModal(true);
  }
  function openEditFamily(f: Family) {
    setEditFamily(f);
    setFamilyName(f.name);
    setShowFamilyModal(true);
  }
  function saveFamily() {
    if (!familyName.trim()) return;
    if (editFamily) {
      updatePlan({
        ...plan,
        families: plan.families.map(f => f.id === editFamily.id ? { ...f, name: familyName.trim() } : f),
      });
      toast('家庭/小组已更新');
    } else {
      updatePlan({
        ...plan,
        families: [...plan.families, { id: generateId(), name: familyName.trim(), isSolo: false }],
      });
      toast('已添加家庭/小组');
    }
    setShowFamilyModal(false);
  }
  function deleteFamily(id: string) {
    if (plan.people.some(p => p.familyId === id)) {
      toast('请先移除该家庭下的成员', 'error');
      return;
    }
    updatePlan({ ...plan, families: plan.families.filter(f => f.id !== id) });
  }

  // ─── Solo participants ───────────────────
  function openAddSolo() {
    setSoloName('');
    setShowSoloModal(true);
  }
  function saveSolo() {
    if (!soloName.trim()) return;
    const fid = generateId();
    updatePlan({
      ...plan,
      families: [...plan.families, { id: fid, name: soloName.trim(), isSolo: true }],
      people: [...plan.people, { id: generateId(), name: soloName.trim(), familyId: fid }],
    });
    setShowSoloModal(false);
    toast('已添加独立参与者');
  }
  function deleteSoloPerson(personId: string, familyId: string) {
    updatePlan({
      ...plan,
      families: plan.families.filter(f => f.id !== familyId),
      people: plan.people.filter(p => p.id !== personId),
      // clean up supplies and expenses that referenced this solo family
      supplies: plan.supplies.map(s => s.assigneeId === familyId ? { ...s, assigneeId: '' } : s),
      expenses: plan.expenses.filter(e => e.payerFamilyId !== familyId),
    });
  }

  // ─── People ─────────────────────────────
  function openAddPerson() {
    setEditPerson(null);
    setPersonName('');
    setPersonFamily(nonSoloFamilies[0]?.id ?? '');
    setShowPersonModal(true);
  }
  function openEditPerson(p: Person) {
    setEditPerson(p);
    setPersonName(p.name);
    setPersonFamily(p.familyId);
    setShowPersonModal(true);
  }
  function savePerson() {
    if (!personName.trim()) return;
    if (editPerson) {
      const editedFamily = plan.families.find(f => f.id === editPerson.familyId);
      if (editedFamily?.isSolo) {
        // Solo edit: sync name to both Person and their implicit Family
        updatePlan({
          ...plan,
          people: plan.people.map(p => p.id === editPerson.id ? { ...p, name: personName.trim() } : p),
          families: plan.families.map(f => f.id === editedFamily.id ? { ...f, name: personName.trim() } : f),
        });
      } else {
        if (!personFamily) return;
        updatePlan({
          ...plan,
          people: plan.people.map(p => p.id === editPerson.id
            ? { ...p, name: personName.trim(), familyId: personFamily } : p),
        });
      }
      toast('成员信息已更新');
    } else {
      if (!personFamily) return;
      updatePlan({
        ...plan,
        people: [...plan.people, { id: generateId(), name: personName.trim(), familyId: personFamily }],
      });
      toast('已添加成员');
    }
    setShowPersonModal(false);
  }
  function deletePerson(id: string) {
    updatePlan({ ...plan, people: plan.people.filter(p => p.id !== id) });
  }

  // Is the person being edited a solo person?
  const isSoloEdit = !!editPerson && soloFamilyIds.has(editPerson.familyId);

  return (
    <div style={{ padding: '16px 16px 0' }}>

      {/* ── Basic info ── */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-header">
          <span className="section-title">📋 露营信息</span>
          {dirty && (
            <button className="btn btn-primary btn-sm" onClick={saveBasic}>保存</button>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">计划名称</label>
          <input
            className="input"
            value={name}
            onChange={e => { setName(e.target.value); setDirty(true); }}
            placeholder="露营计划名称"
            maxLength={20}
          />
        </div>
        <div className="form-group">
          <label className="form-label">日期</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="date"
              value={date}
              onChange={e => { setDate(e.target.value); setDirty(true); }}
              style={{ flex: 1, width: '100%' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 13, flexShrink: 0 }}>至</span>
            <input
              className="input"
              type="date"
              value={endDate}
              min={date || undefined}
              onChange={e => { setEndDate(e.target.value); setDirty(true); }}
              style={{ flex: 1, width: '100%' }}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">地点</label>
          <input
            className="input"
            value={location}
            onChange={e => { setLocation(e.target.value); setDirty(true); }}
            placeholder="营地地址"
            maxLength={20}
          />
        </div>
      </section>

      {/* ── Families ── */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-header">
          <span className="section-title">🏠 家庭 / 小组</span>
          <button className="btn btn-secondary btn-sm" onClick={openAddFamily}>＋ 添加</button>
        </div>
        {nonSoloFamilies.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <div className="empty-icon">🏠</div>
            <p>还没有家庭/小组<br />先添加再邀请成员</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nonSoloFamilies.map(f => {
              const memberCount = plan.people.filter(p => p.familyId === f.id).length;
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--primary-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>🏕️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{memberCount} 位成员</div>
                  </div>
                  <button className="btn-icon" onClick={() => openEditFamily(f)} style={{ fontSize: 16 }}>✏️</button>
                  <button className="btn-icon" onClick={() => deleteFamily(f.id)} style={{ fontSize: 16 }}>🗑️</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── People ── */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-header">
          <span className="section-title">👥 参与人员</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={openAddSolo}>
              ＋ 单人
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={openAddPerson}
              disabled={nonSoloFamilies.length === 0}
              style={{ opacity: nonSoloFamilies.length === 0 ? 0.4 : 1 }}
            >
              ＋ 成员
            </button>
          </div>
        </div>

        {plan.people.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <div className="empty-icon">👥</div>
            <p>添加露营的小伙伴吧<br />
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                「单人」独立AA·「成员」归属家庭
              </span>
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Solo people */}
            {soloPeople.length > 0 && (
              <div>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                  letterSpacing: '0.06em', marginBottom: 6,
                }}>独立参与者</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {soloPeople.map(person => (
                    <div key={person.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 20, padding: '5px 10px 5px 8px',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#E4EEFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11,
                      }}>
                        👤
                      </div>
                      <span style={{ fontSize: 14 }}>{person.name}</span>
                      <button
                        onClick={() => openEditPerson(person)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
                      >✏️</button>
                      <button
                        onClick={() => deleteSoloPerson(person.id, person.familyId)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--red)', padding: 0 }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Family-grouped people */}
            {nonSoloFamilies.map(fam => {
              const members = plan.people.filter(p => p.familyId === fam.id);
              if (members.length === 0) return null;
              return (
                <div key={fam.id}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                    letterSpacing: '0.06em', marginBottom: 6,
                  }}>
                    {fam.name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {members.map(person => (
                      <div key={person.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 20, padding: '5px 10px 5px 8px',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: 'var(--primary-dim)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12,
                        }}>
                          {person.name.slice(0, 1)}
                        </div>
                        <span style={{ fontSize: 14 }}>{person.name}</span>
                        <button
                          onClick={() => openEditPerson(person)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
                        >✏️</button>
                        <button
                          onClick={() => deletePerson(person.id)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--red)', padding: 0 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Menu ── */}
      <section className="card" style={{ marginBottom: 14 }}>
        <div className="section-header">
          <span className="section-title">🍽️ 露营菜单</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={openAddMenu}>＋ 添加</button>
            {plan.menuItems.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setMenuExpanded(v => !v)}
                style={{ fontSize: 12, padding: '4px 8px' }}
              >
                {menuExpanded ? '收起' : `展开 (${plan.menuItems.length})`}
              </button>
            )}
          </div>
        </div>

        {plan.menuItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '16px 0' }}>
            <div className="empty-icon" style={{ fontSize: 28 }}>🥩</div>
            <p style={{ fontSize: 13 }}>还没有菜单安排<br />添加后当做公告展示给所有人</p>
          </div>
        ) : menuExpanded ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {menuGroups.map(group => (
              <div key={group.time}>
                {/* Day badge */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #E07A30 100%)',
                  color: 'white', borderRadius: 20,
                  padding: '3px 12px', fontSize: 12, fontWeight: 700,
                  marginBottom: 8, letterSpacing: '0.04em',
                }}>
                  {group.time}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.meals.map(mealGroup => (
                    <div key={mealGroup.meal}>
                      {/* Meal sub-header */}
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--primary)',
                        marginBottom: 5, paddingLeft: 2,
                      }}>
                        {mealGroup.meal}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {mealGroup.items.map(item => {
                          const rc = item.responsible ? responsibleColor(item.responsible) : null;
                          return (
                            <div key={item.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                            }}>
                              <span style={{
                                flex: 1, fontSize: 14, color: 'var(--text)',
                                lineHeight: 1.4, minWidth: 0,
                              }}>
                                {item.menu}
                              </span>
                              {rc && (
                                <span style={{
                                  flexShrink: 0, fontSize: 12, fontWeight: 700,
                                  background: rc.bg, color: rc.text,
                                  borderRadius: 20, padding: '2px 8px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {item.responsible}
                                </span>
                              )}
                              <button className="btn-icon" onClick={() => openEditMenu(item)} style={{ fontSize: 14, flexShrink: 0 }}>✏️</button>
                              <button className="btn-icon" onClick={() => deleteMenu(item.id)} style={{ fontSize: 14, flexShrink: 0 }}>🗑️</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Stats */}
      {plan.families.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16,
        }}>
          {[
            { label: '结算主体', value: plan.families.length, icon: '🏠' },
            { label: '参与人数', value: plan.people.length, icon: '👥' },
            { label: '物资项目', value: plan.supplies.length, icon: '📦' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 10px',
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontFamily: 'ZCOOL XiaoWei, serif', color: 'var(--primary)', marginTop: 2 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Menu modal */}
      <Modal
        isOpen={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        title={editMenu ? '编辑菜单' : '添加菜单'}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={saveMenu}
            disabled={!mTime.trim() || !mMenuText.trim()}
          >
            {editMenu ? '保存修改' : '添加'}
          </button>
        }
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">时间 *</label>
            <input
              className="input"
              type="text"
              placeholder="如：周六"
              value={mTime}
              onChange={e => setMTime(e.target.value)}
              autoComplete="off"
              autoFocus
              maxLength={20}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">餐次</label>
            <select className="input" value={mMeal} onChange={e => setMMeal(e.target.value)}>
              {/* 若旧数据 meal 不在预设里，额外加一条以防丢失 */}
              {!MEAL_PRESETS.includes(mMeal) && mMeal && (
                <option key={mMeal} value={mMeal}>{mMeal}</option>
              )}
              {MEAL_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">菜单内容 *</label>
          <input
            className="input"
            placeholder="如：火锅"
            value={mMenuText}
            onChange={e => setMMenuText(e.target.value)}
            maxLength={20}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">负责人</label>
          <input
            className="input"
            placeholder="可选"
            value={mResponsible}
            onChange={e => setMResponsible(e.target.value)}
            maxLength={20}
          />
        </div>
      </Modal>

      {/* Solo modal */}
      <Modal
        isOpen={showSoloModal}
        onClose={() => setShowSoloModal(false)}
        title="添加独立参与者"
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={saveSolo}
            disabled={!soloName.trim()}
          >
            添加
          </button>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">姓名/昵称</label>
          <input
            className="input"
            placeholder="例：小明"
            value={soloName}
            onChange={e => setSoloName(e.target.value)}
            autoFocus
            maxLength={20}
          />
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 6 }}>
            独立参与者作为单独结算主体参与 AA，不属于任何家庭/小组
          </div>
        </div>
      </Modal>

      {/* Family modal */}
      <Modal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        title={editFamily ? '编辑家庭/小组' : '添加家庭/小组'}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={saveFamily}
            disabled={!familyName.trim()}
          >
            {editFamily ? '保存修改' : '添加'}
          </button>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">名称</label>
          <input
            className="input"
            placeholder="例：煊哥家"
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            autoFocus
            maxLength={20}
          />
        </div>
      </Modal>

      {/* Person modal */}
      <Modal
        isOpen={showPersonModal}
        onClose={() => setShowPersonModal(false)}
        title={editPerson ? (isSoloEdit ? '编辑独立参与者' : '编辑成员') : '添加成员'}
        footer={
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={savePerson}
            disabled={!personName.trim() || (!isSoloEdit && !personFamily)}
          >
            {editPerson ? '保存修改' : '添加成员'}
          </button>
        }
      >
        <div className={isSoloEdit ? 'form-group' : 'form-group'} style={isSoloEdit ? { marginBottom: 0 } : {}}>
          <label className="form-label">姓名/昵称</label>
          <input
            className="input"
            placeholder="例：煊哥"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            autoFocus
            maxLength={20}
          />
        </div>
        {!isSoloEdit && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">所属家庭/小组</label>
            <select
              className="input"
              value={personFamily}
              onChange={e => setPersonFamily(e.target.value)}
            >
              <option value="">请选择</option>
              {nonSoloFamilies.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </Modal>
    </div>
  );
}
