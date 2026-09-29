import { Component, lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { GameAvatarStyle } from "./game";
import { CHARACTER_VIEWS, type CharacterView } from "./ocean/characterPreviewViews";

const CharacterPreviewCanvas = lazy(() => import("./ocean/CharacterPreviewCanvas"));

class PreviewBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function CharacterPreview({ avatarStyle }: { avatarStyle?: GameAvatarStyle }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [active, setActive] = useState(true);
  const [request, setRequest] = useState<{ view: CharacterView; revision: number }>({view:"FRONT",revision:0});
  const host = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setFailed(true); setRotating(false); }, []);
  useEffect(() => {
    if (!open) return;
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, {threshold:0.03});
    if (host.current) observer?.observe(host.current);
    document.addEventListener("visibilitychange",update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange",update); };
  }, [open]);
  return <div className="character-preview">
    <button type="button" className="secondary" disabled={!avatarStyle} aria-expanded={open} aria-controls={panelId} onClick={() => {
      setOpen(value => !value); setFailed(false); setReady(false); setRotating(false);
      setRequest({view:"FRONT",revision:0});
    }}>{open ? "收起角色预览" : "查看 3D 角色"}</button>
    {!avatarStyle && <span className="helper">先选择一位游泳者，即可查看全身与面部。</span>}
    {open && avatarStyle && <section id={panelId} aria-label="角色观察室" className="character-preview-panel">
      <header><div><span className="eyebrow">角色观察室</span><h3>{avatarStyle === "MALE" ? "男游泳者" : "女游泳者"}</h3></div><span className="character-preview-badge">当前游戏造型</span></header>
      <p className="helper">C 款珊瑚配色 · 动漫角色。观察室展示发型，游泳时佩戴泳帽与泳镜。</p>
      <div className="character-preview-viewport" ref={host}>
        {failed ? <p role="status">角色预览暂不可用。你仍可选择角色并继续旅程。</p> : <PreviewBoundary onFailure={onFailure}>
          <Suspense fallback={null}><CharacterPreviewCanvas avatarStyle={avatarStyle} request={request} rotating={rotating && active} onReady={onReady} onFailure={onFailure} /></Suspense>
        </PreviewBoundary>}
        {!failed && !ready && <p className="character-preview-loading" role="status">正在加载角色…</p>}
      </div>
      {!failed && <div className="character-preview-controls">
        <div role="group" aria-label="角色观察角度">{(Object.keys(CHARACTER_VIEWS) as CharacterView[]).map(view => <button type="button" key={view} aria-pressed={request.view === view} onClick={() => { setRotating(false); setRequest(previous => ({view,revision:previous.revision+1})); }}>{CHARACTER_VIEWS[view]}</button>)}</div>
        <button type="button" aria-pressed={rotating} onClick={() => setRotating(value => !value)}>{rotating ? "停止旋转" : "自动旋转"}</button>
      </div>}
      <p className="helper">拖动旋转 · 滚轮或双指缩放 · 点击视角按钮复位。默认静止。</p>
    </section>}
  </div>;
}
