import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import OceanScene, { type OceanSceneProps } from "./OceanScene";
import type { OceanQuality, OceanView } from "./ocean/swimMotion";
import { OCEAN_LOOKS, type OceanWeather } from "./ocean/oceanLook";

const OceanCanvas = lazy(() => import("./ocean/OceanCanvas"));

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.error("海洋 3D 场景加载失败：", error.message);
    this.props.onFailure();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

const VIEW_LABELS: Record<OceanView, string> = { FOLLOW: "跟随", OVERHEAD: "俯瞰", COAST: "看海" };

export default function OceanExperience(props: OceanSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const [lightweight, setLightweight] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [paused, setPaused] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [quality, setQuality] = useState<OceanQuality>("BALANCED");
  const [weather, setWeather] = useState<OceanWeather>("SUNNY");
  const look = OCEAN_LOOKS[weather];
  const [cameraRequest, setCameraRequest] = useState<{ view: OceanView; revision: number }>({ view: "FOLLOW", revision: 0 });
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setFailed(true); setLightweight(true); setReady(false); }, []);
  useEffect(() => {
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: 0.03 });
    if (host.current) observer?.observe(host.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  return <div className="ocean-experience" ref={host}>
    {lightweight ? <OceanScene {...props} /> : <div className="ocean-viewport" aria-label="可交互海洋场景，使用下方按钮切换镜头，也可拖动或缩放">
      <SceneBoundary onFailure={onFailure}>
        <Suspense fallback={null}><OceanCanvas {...props} active={active} paused={paused} quality={quality} weather={weather} cameraRequest={cameraRequest} onReady={onReady} onFailure={onFailure} /></Suspense>
      </SceneBoundary>
      {!ready && <div className="ocean-loading" role="status"><span className="ocean-loading-ring" /><b>正在驶入海湾</b><span>首次进入需要加载场景与角色</span></div>}
      <div className="ocean-3d-heading"><span className="ocean-coordinate">OPEN WATER / 01</span><h2>{look.title}</h2><span className="ocean-scene-tag">{look.description}</span></div>
      <div className="ocean-3d-footer"><div><span>今日节奏</span><b>{paused ? "画面已暂停" : props.pace === "SURGE" ? "迎浪加速" : props.pace === "STEADY" ? "稳步前进" : "自在巡游"}</b></div><div className="ocean-route"><span>本周航程</span><b>{Math.round(Math.max(0, Math.min(1, props.progress)) * 100)}<small> / 100</small></b></div></div>
    </div>}
    <div className="ocean-controls">
      {!lightweight && <>
        <div className="ocean-view-buttons" role="group" aria-label="场景镜头">{(Object.keys(VIEW_LABELS) as OceanView[]).map((view) => <button type="button" key={view} aria-pressed={cameraRequest.view === view} onClick={() => setCameraRequest((previous) => ({ view, revision: previous.revision + 1 }))}>{VIEW_LABELS[view]}</button>)}</div>
        <div className="ocean-render-controls"><button type="button" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? "继续动态" : "暂停动态"}</button><button type="button" aria-pressed={quality === "LOW"} onClick={() => setQuality((value) => value === "LOW" ? "BALANCED" : "LOW")}>{quality === "LOW" ? "省电画质" : "均衡画质"}</button></div>
      </>}
      <button className="ocean-mode-button" type="button" onClick={() => {
        // Reload also clears rejected lazy imports and cached model-load errors.
        if (failed) { window.location.reload(); return; }
        setReady(false); setLightweight((value) => !value);
      }}>{failed ? "重新加载 3D" : lightweight ? "进入 3D 场景" : "轻量场景"}</button>
    </div>
    {!lightweight && <div className="ocean-weather-controls"><span>海湾天气</span><div className="ocean-view-buttons" role="group" aria-label="海湾天气">{(Object.keys(OCEAN_LOOKS) as OceanWeather[]).map(value => <button type="button" key={value} aria-pressed={weather === value} onClick={() => setWeather(value)}>{OCEAN_LOOKS[value].label}</button>)}</div></div>}
    <p className="ocean-interaction-hint" role={failed ? "status" : undefined}>{failed ? "3D 暂时无法加载，已为你切换轻量场景。可检查连接后重试。" : lightweight ? "轻量场景适合低性能设备。" : "拖动环绕 · 滚轮或双指缩放 · 点击镜头按钮回到预设视角"}</p>
  </div>;
}
