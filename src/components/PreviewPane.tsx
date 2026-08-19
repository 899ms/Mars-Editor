import { useEffect, useMemo, useRef, useState } from 'react';
import { BatteryFull, CellSignalFull, WifiHigh } from '@phosphor-icons/react';
import type { ScrollSyncChannel } from '../scrollSync';
import type { Theme } from '../theme';

interface Props {
  body: string;
  theme: Theme;
  /** 正文是否包含图片（显示微信粘贴提示） */
  hasImage: boolean;
  /**
   * 布局变化信号（编辑器宽度 / 模式切换都会改变其值）：
   * ResizeObserver 的兜底 —— 拖拽分割、切换对照/预览时强制刷新手机/桌面模式判断
   */
  resizeKey: string;
  /** 滚动同步通道（编辑器发布位置，这里订阅并写 DOM） */
  sync: ScrollSyncChannel;
}

/** 从正文 HTML 提取第一个一级标题作为文章标题 */
function extractTitle(body: string): string {
  const m = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return '';
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 预览时移除正文中的第一个 h1（文章头已展示标题，避免重复；导出不受影响） */
function stripFirstH1(body: string): string {
  return body.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
}

interface Anchor {
  line: number;
  top: number;
}

/** 尾段混合区间：编辑器最后这部分行程用来平滑收敛到预览底部 */
const TAIL_BLEND = 0.18;

/**
 * 把源码位置换算成预览的滚动偏移。
 *
 * 关键在于「插值」而不是「吸附」：找到位置所处的两个锚点，按行号比例在它们的
 * 偏移之间线性取值。吸附到最近锚点会让预览一段一段地跳（就是之前那种顿感），
 * 插值后预览是连续跟着编辑器走的。
 */
function offsetForPosition(anchors: Anchor[], position: number, end: Anchor | null): number {
  // 二分找最后一个 line <= position 的锚点
  let lo = 0;
  let hi = anchors.length - 1;
  let i = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (anchors[mid].line <= position) {
      i = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (i < 0) {
    // 位置落在首个锚点之上（预览会去掉重复的 h1，开头几行没有对应锚点）：
    // 从「内容顶部」虚拟插值到首个锚点，否则进入首锚点时会突然跳一大段
    const first = anchors[0];
    if (first.line <= 0) return 0;
    return Math.max(0, first.top * Math.min(1, Math.max(0, position / first.line)));
  }
  const cur = anchors[i];
  // 末尾锚点之后接上「文末」虚拟锚点，尾段照样连续插值，不再冻结后硬跳
  const next = anchors[i + 1] ?? (end && end.line > cur.line ? end : null);
  if (!next) return Math.max(0, cur.top);
  const span = next.line - cur.line;
  if (span <= 0) return Math.max(0, cur.top);
  const t = Math.min(1, Math.max(0, (position - cur.line) / span));
  return Math.max(0, cur.top + (next.top - cur.top) * t);
}

/**
 * 建立「源码行号 → 预览内容偏移」锚点表。
 * top 是相对滚动内容顶部的偏移（不含当前 scrollTop），因此滚动时可以直接复用，
 * 只在正文或布局变化后才需要重建。
 */
function buildAnchors(scroll: HTMLElement): Anchor[] {
  // 一次性读完所有几何量，中间不写 DOM，浏览器只需强制一次重排
  const base = scroll.getBoundingClientRect().top - scroll.scrollTop;
  const anchors: Anchor[] = [];
  for (const el of scroll.querySelectorAll<HTMLElement>('[data-line]')) {
    const line = Number(el.dataset.line);
    if (anchors.length && anchors[anchors.length - 1].line === line) continue;
    anchors.push({ line, top: el.getBoundingClientRect().top - base });
  }
  return anchors;
}

/**
 * 右侧预览：
 * - 窄面板（<860px）→ 手机样式（设备框 + 灵动岛状态栏）
 * - 宽面板（≥860px）→ 桌面 Mac 窗口样式（交通灯标题栏）
 * - 顶部文章头（标题 + 作者行），底部操作栏（分享/收藏/在看/点赞，内容末尾）
 * 正文 HTML 样式全部内联 ⇒ 预览与导出（微信粘贴）完全一致。
 */
export default function PreviewPane({ body, theme, hasImage, resizeKey, sync }: Props) {
  const paneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [widthMode, setWidthMode] = useState<'phone' | 'desktop'>('phone');
  const title = useMemo(() => extractTitle(body), [body]);
  /** 预览用正文（去掉重复的 h1；仅预览，导出仍用完整 body） */
  const previewBody = useMemo(() => (title ? stripFirstH1(body) : body), [body, title]);
  /** 文章头日期（每次渲染 new Date() 没有意义） */
  const today = useMemo(() => new Date(), []);

  // 面板宽度变化时自动切换手机 / 桌面模式
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => setWidthMode(el.getBoundingClientRect().width >= 860 ? 'desktop' : 'phone');
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 布局变化（拖拽 / 模式切换）兜底刷新
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    setWidthMode(el.getBoundingClientRect().width >= 860 ? 'desktop' : 'phone');
  }, [resizeKey]);

  /** 锚点缓存（null 表示需要重建） */
  const anchorsRef = useRef<Anchor[] | null>(null);
  /** 请求一次同步（rAF 合帧）；供正文变化等场景复用 */
  const scheduleRef = useRef<() => void>(() => {});

  // 编辑器滚动 → 预览滚动同步。整条链路不经过 React：
  // 订阅通道 → rAF 合帧 → 读锚点插值 → 写 scrollTop。
  useEffect(() => {
    const apply = () => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      const { position, endPosition, atTop, atBottom } = sync.state;
      // 边界精确对齐，避免插值误差在首尾留下缝隙。
      // 到底时的吸附现在是「插值本来就已经收敛到底部」，不再是一次跳跃。
      if (atBottom) {
        scroll.scrollTop = scroll.scrollHeight;
        return;
      }
      if (atTop) {
        if (scroll.scrollTop !== 0) scroll.scrollTop = 0;
        return;
      }
      let anchors = anchorsRef.current;
      if (!anchors) {
        anchors = buildAnchors(scroll);
        anchorsRef.current = anchors;
      }
      if (!anchors.length) return;
      const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const end = endPosition > 0 ? { line: endPosition, top: maxScroll } : null;
      let top = offsetForPosition(anchors, position, end);

      // 收尾对齐：编辑器滚到底时，顶部可见行其实还在文档中段，
      // 按锚点算出来的位置离预览底部还差一截 —— 以前靠「到底就跳到底」补上这一截，
      // 于是临近结尾会突然蹦一下。改成在最后一段行程里平滑收敛到底部。
      if (endPosition > 0) {
        const t = Math.min(1, Math.max(0, position / endPosition));
        if (t > 1 - TAIL_BLEND) {
          const w = (t - (1 - TAIL_BLEND)) / TAIL_BLEND;
          const eased = w * w * (3 - 2 * w); // smoothstep，进入混合区时不出现折角
          top = top + (maxScroll - top) * eased;
        }
      }
      if (Math.abs(scroll.scrollTop - top) < 0.5) return;
      scroll.scrollTop = top;
    };

    let raf = 0;
    const schedule = () => {
      // 一帧内的多次滚动事件合并成一次读写
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };
    scheduleRef.current = schedule;
    const unsubscribe = sync.subscribe(schedule);
    schedule();
    return () => {
      unsubscribe();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sync]);

  // 正文重渲染 / 手机⇄桌面切换后，锚点偏移全部作废，并重新对齐一次
  useEffect(() => {
    anchorsRef.current = null;
    scheduleRef.current();
  }, [body, widthMode]);

  // 图片解码、字体加载这类异步高度变化同样让锚点作废
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      anchorsRef.current = null;
      scheduleRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 主题变化时联动状态栏 / 桌面窗口配色
  useEffect(() => {
    document.documentElement.style.setProperty('--art-accent', theme.accent);
    document.documentElement.style.setProperty('--art-heading', theme.heading.color);
    document.documentElement.style.setProperty('--art-ink', theme.body.color);
    document.documentElement.style.setProperty('--art-hr', theme.hr.color);
    document.documentElement.style.setProperty('--art-foot-text', theme.footnote.textColor);
    document.documentElement.style.setProperty('--art-bg', theme.body.bg ?? '#ffffff');
    document.documentElement.style.setProperty('--art-heading-font', theme.heading.font);
    return () => {
      document.documentElement.style.removeProperty('--art-accent');
      document.documentElement.style.removeProperty('--art-heading');
      document.documentElement.style.removeProperty('--art-ink');
      document.documentElement.style.removeProperty('--art-hr');
      document.documentElement.style.removeProperty('--art-foot-text');
      document.documentElement.style.removeProperty('--art-bg');
      document.documentElement.style.removeProperty('--art-heading-font');
    };
  }, [theme]);

  return (
    <section className="split-pane preview-side" ref={paneRef} data-width={widthMode}>
      <div className="pane-head">
        <span className="pane-title">
          预览
        </span>
        {hasImage && (
          <div className="pane-head-right">
            <span className="pane-stat warn">含图片 · 建议公众号内单独上传</span>
          </div>
        )}
      </div>
      <div className="phone-stage">
        <div className="phone-frame">
          {/* iPhone 侧键（手机模式显示）：左静音 + 左音量上下，右电源 */}
          <span className="side-btn action" aria-hidden="true"></span>
          <span className="side-btn vol-up" aria-hidden="true"></span>
          <span className="side-btn vol-down" aria-hidden="true"></span>
          <span className="side-btn power" aria-hidden="true"></span>
          <div className="phone-screen">
            {/* Mac 窗口标题栏（桌面模式显示） */}
            <div className="desktop-bar">
              <span className="traffic t1"></span>
              <span className="traffic t2"></span>
              <span className="traffic t3"></span>
              <span className="bar-title">文章预览 · {theme.name}</span>
            </div>
            {/* 手机状态栏：灵动岛居中，两侧真实状态图标 */}
            <div className="statusbar">
              <span className="time">9:41</span>
              <span className="dynamic-island" aria-hidden="true"></span>
              <span className="sb-icons" aria-hidden="true">
                <CellSignalFull size={13} weight="fill" />
                <WifiHigh size={13} weight="bold" />
                <BatteryFull size={17} weight="fill" />
              </span>
            </div>
            <div className="article-scroll" ref={scrollRef}>
              {/* 公众号文章头：标题（无标题时占位）+ 作者行 */}
              <div className="article-head">
                <h1 className="head-title">{title || '未命名文章'}</h1>
                <div className="meta">
                  <span className="author">火星</span>
                  <span className="byline">
                    {today.getFullYear()} 年 {today.getMonth() + 1} 月 {today.getDate()} 日
                  </span>
                </div>
              </div>
              <div
                className="check-body"
                ref={bodyRef}
                dangerouslySetInnerHTML={{ __html: previewBody }}
              />
              {/* 文章底栏：分享 / 收藏 / 在看 / 点赞（内容末尾） */}
              <div className="article-footer">
                <div className="actions">
                  <button className="action">分享</button>
                  <button className="action">收藏</button>
                  <button className="action">在看</button>
                  <button className="action">点赞</button>
                </div>
              </div>
            </div>
            {/* 底部 home indicator（手机模式） */}
            <span className="home-indicator" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </section>
  );
}
