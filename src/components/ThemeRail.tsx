import { darkThemes, lightThemes, type Theme } from '../theme';

interface Props {
  themeId: string;
  onThemeChange: (id: string) => void;
}

/**
 * 左侧主题竖栏。
 *
 * 每张卡片是用该主题自己的令牌画出来的迷你纸样 —— 纸底、衬线/等宽的「Aa」、
 * 强调色短条、两根正文线。比一个只有名字的下拉更直观：不用切换就能看出风格差异。
 *
 * 浅色与深色分区展示：深色卡片视觉重量大，混在浅色里会显得突兀，
 * 单独归到「深色」小节、排在浅色之后（默认要往下滚才看得到）。
 */
export default function ThemeRail({ themeId, onThemeChange }: Props) {
  const renderCard = (th: Theme) => {
    const active = th.id === themeId;
    return (
      <button
        key={th.id}
        role="radio"
        aria-checked={active}
        className={`theme-card ${active ? 'active' : ''}`}
        title={`${th.name} — ${th.description}`}
        onClick={() => onThemeChange(th.id)}
      >
        <span className="swatch" style={{ background: th.body.bg ?? '#ffffff' }}>
          <span className="swatch-aa" style={{ fontFamily: th.heading.font, color: th.heading.color }}>
            Aa
          </span>
          <span className="swatch-bar" style={{ background: th.accent }} />
          <span className="swatch-line" style={{ background: th.body.color }} />
          <span className="swatch-line short" style={{ background: th.body.color }} />
        </span>
        <span className="theme-card-name">{th.name}</span>
      </button>
    );
  };

  return (
    <nav className="theme-rail" aria-label="排版主题">
      <div className="rail-head">主题</div>
      <div className="rail-list" role="radiogroup" aria-label="排版主题">
        <div className="rail-section">
          <div className="rail-section-label">浅色</div>
          {lightThemes.map(renderCard)}
        </div>
        <div className="rail-section">
          <div className="rail-section-label">深色</div>
          {darkThemes.map(renderCard)}
        </div>
      </div>
    </nav>
  );
}
