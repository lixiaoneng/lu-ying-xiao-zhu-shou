import type { CampingPlan } from '../types';

function fmtDate(d: string, end?: string): string {
  if (!d) return '';
  const fmt = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  return end ? `${fmt(d)} - ${fmt(end)}` : fmt(d);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export function generateMenuImage(plan: CampingPlan): string {
  // ── 分组：time → meal → items ──
  type MealGroup = { meal: string; items: { menu: string; responsible: string }[] };
  type TimeGroup = { time: string; meals: MealGroup[] };

  const groups: TimeGroup[] = [];
  for (const item of plan.menuItems) {
    let tg = groups.find(g => g.time === item.time);
    if (!tg) { tg = { time: item.time, meals: [] }; groups.push(tg); }
    let mg = tg.meals.find(m => m.meal === item.meal);
    if (!mg) { mg = { meal: item.meal, items: [] }; tg.meals.push(mg); }
    mg.items.push({ menu: item.menu, responsible: item.responsible });
  }

  // ── 布局常量（逻辑像素，canvas 内部 2× 缩放）──
  const SCALE    = 2;
  const LW       = 750;   // 逻辑宽度
  const PAD      = 40;
  const HEADER_H = 200;
  const FOOTER_H = 64;

  const TIME_BADGE_H  = 44;
  const TIME_BADGE_R  = 22;
  const MEAL_LABEL_H  = 32;
  const ITEM_H        = 40;
  const GROUP_GAP     = 24;
  const MEAL_GAP      = 10;

  // 计算内容区高度
  let contentH = PAD;
  for (let i = 0; i < groups.length; i++) {
    const tg = groups[i];
    contentH += TIME_BADGE_H + 16;
    for (const mg of tg.meals) {
      contentH += MEAL_LABEL_H;
      contentH += mg.items.length * ITEM_H + MEAL_GAP;
    }
    contentH += GROUP_GAP;
    if (i < groups.length - 1) contentH += 1 + GROUP_GAP; // divider
  }
  contentH += PAD;

  const LH = HEADER_H + contentH + FOOTER_H;

  // ── 创建 canvas（物理像素 2×）──
  const canvas = document.createElement('canvas');
  canvas.width  = LW * SCALE;
  canvas.height = LH * SCALE;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // ── 背景 ──
  ctx.fillStyle = '#FDF8F3';
  ctx.fillRect(0, 0, LW, LH);

  // ── Header 渐变 ──
  const hGrad = ctx.createLinearGradient(0, 0, LW, HEADER_H);
  hGrad.addColorStop(0, '#E8783C');
  hGrad.addColorStop(1, '#B84E10');
  ctx.fillStyle = hGrad;
  roundRect(ctx, 0, 0, LW, HEADER_H, 0);
  ctx.fill();

  // 右上角装饰光晕
  const glow = ctx.createRadialGradient(LW - 60, 40, 10, LW - 60, 40, 120);
  glow.addColorStop(0, 'rgba(255,220,120,0.18)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, LW, HEADER_H);

  // ⛺ icon
  ctx.font = `52px ${FONT}`;
  ctx.fillText('⛺', PAD, 68);

  // 计划名称
  ctx.font = `bold 38px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(truncate(ctx, plan.name, LW - PAD * 2 - 70), PAD + 70, 68);

  // 日期 + 地点
  const meta = [fmtDate(plan.date, plan.endDate), plan.location].filter(Boolean).join('  ·  ');
  if (meta) {
    ctx.font = `22px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(meta, PAD, 112);
  }

  // "露营菜单" 副标题
  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.50)';
  ctx.fillText('露 营 菜 单', PAD, 148);

  // 底部波浪分隔（用圆角矩形盖住让过渡更自然）
  ctx.fillStyle = '#FDF8F3';
  roundRect(ctx, 0, HEADER_H - 20, LW, 24, 12);
  ctx.fill();

  // ── 内容区 ──
  let y = HEADER_H + PAD - 8;

  for (let gi = 0; gi < groups.length; gi++) {
    const tg = groups[gi];

    // 时间徽章
    ctx.font = `bold 24px ${FONT}`;
    const badgeTextW = ctx.measureText(tg.time).width;
    const badgeW     = badgeTextW + 40;
    ctx.fillStyle = '#E8783C';
    roundRect(ctx, PAD, y, badgeW, TIME_BADGE_H, TIME_BADGE_R);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tg.time, PAD + badgeW / 2, y + 29);
    ctx.textAlign = 'left';

    y += TIME_BADGE_H + 16;

    for (const mg of tg.meals) {
      // 餐次标签
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = '#C06428';
      ctx.fillText(mg.meal, PAD + 4, y + 20);
      y += MEAL_LABEL_H;

      // 菜品列表
      for (const it of mg.items) {
        // 菜品名
        ctx.font = `24px ${FONT}`;
        ctx.fillStyle = '#2C1A0E';
        const menuText = truncate(ctx, '· ' + it.menu, LW - PAD * 2 - 180);
        ctx.fillText(menuText, PAD + 16, y + 26);

        // 负责人
        if (it.responsible) {
          ctx.font = `19px ${FONT}`;
          ctx.fillStyle = '#A07050';
          const rText = truncate(ctx, it.responsible, 160);
          ctx.textAlign = 'right';
          ctx.fillText(rText, LW - PAD, y + 26);
          ctx.textAlign = 'left';
        }
        y += ITEM_H;
      }
      y += MEAL_GAP;
    }

    y += GROUP_GAP;

    // 分组分隔线
    if (gi < groups.length - 1) {
      ctx.strokeStyle = '#EDE0D0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(LW - PAD, y);
      ctx.stroke();
      y += GROUP_GAP;
    }
  }

  // ── Footer ──
  const footerY = LH - FOOTER_H;
  ctx.fillStyle = '#F0E8DF';
  ctx.fillRect(0, footerY, LW, FOOTER_H);

  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = '#B89070';
  ctx.textAlign = 'center';
  ctx.fillText('用露营小助手制作 · www.gogocamping.xyz', LW / 2, footerY + 38);

  return canvas.toDataURL('image/png');
}
