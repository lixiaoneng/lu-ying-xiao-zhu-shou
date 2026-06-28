import type { CSSProperties, MouseEvent } from 'react';

/** 备案信息全局 Footer — 显示在所有页面底部，满足 ICP / 公安联网备案合规要求 */

const ICP_URL = 'https://beian.miit.gov.cn/';
const POLICE_URL = 'https://beian.mps.gov.cn/#/query/webSearch?code=11010502061524';

const linkStyle: CSSProperties = {
  color: 'var(--text-light)',
  textDecoration: 'none',
  transition: 'color 0.15s ease',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

function hover(e: MouseEvent<HTMLAnchorElement>, on: boolean) {
  e.currentTarget.style.color = on ? 'var(--text-muted)' : 'var(--text-light)';
}

export default function Footer() {
  return (
    <footer style={{
      flexShrink: 0,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px 10px',
      padding: '18px 16px calc(18px + env(safe-area-inset-bottom))',
      fontSize: 12,
      lineHeight: 1.6,
      color: 'var(--text-light)',
    }}>
      <a
        href={ICP_URL}
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
        onMouseEnter={e => hover(e, true)}
        onMouseLeave={e => hover(e, false)}
      >
        京ICP备2026031642号-1
      </a>
      <span aria-hidden style={{ color: 'var(--border-dark)' }}>｜</span>
      <a
        href={POLICE_URL}
        target="_blank"
        rel="noreferrer"
        style={linkStyle}
        onMouseEnter={e => hover(e, true)}
        onMouseLeave={e => hover(e, false)}
      >
        <img
          src="/beian-police.png"
          alt="公安备案"
          width={16}
          height={16}
          style={{ display: 'block', flexShrink: 0 }}
        />
        京公网安备11010502061524号
      </a>
    </footer>
  );
}
