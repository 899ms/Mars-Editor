import { ClipboardText } from '@phosphor-icons/react';

interface Props {
  viewMode: 'split' | 'preview';
  onViewMode: (m: 'split' | 'preview') => void;
  status: string | null;
  onCopy: () => void;
}

export default function Toolbar({
  viewMode,
  onViewMode,
  status,
  onCopy,
}: Props) {
  return (
    <header className="toolbar">
      <div className="brand">
        {/* 印章式字标：平涂描边，不用发光徽标 */}
        <span className="brand-mark" aria-hidden="true">火</span>
        <span className="title">火星编辑器</span>
      </div>

      {/* 对照 / 预览 */}
      <div className="segmented" role="tablist" aria-label="工作区模式">
        {(['split', 'preview'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={viewMode === m}
            className={`seg-btn ${viewMode === m ? 'active' : ''}`}
            onClick={() => onViewMode(m)}
          >
            {m === 'split' ? '对照' : '预览'}
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <button className="btn primary" onClick={onCopy}>
          <ClipboardText size={15} weight="bold" />
          复制到公众号
        </button>

        {status && <span className="status show">{status}</span>}
      </div>
    </header>
  );
}
