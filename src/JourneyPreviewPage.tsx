import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import JourneyMap from "./JourneyMap";
import { JOURNEY_DESTINATIONS } from "./game";

const week = {
  points: 68, dietPoints: 38, dietStatus: "本周饮食补给 38 分",
  goalEarnedSessions: 2.5, goalPlannedSessions: 4
};

export default function JourneyPreviewPage() {
  const [params] = useSearchParams();
  const [sceneId, setSceneId] = useState("DEPARTURE");
  const [mobile, setMobile] = useState(false);
  const [resting, setResting] = useState(false);
  const [motion, setMotion] = useState(true);
  const selected = JOURNEY_DESTINATIONS.find((destination) => destination.id === sceneId)!;

  if (params.get("canvas") === "1") {
    const destination = JOURNEY_DESTINATIONS.find((entry) => entry.id === params.get("scene")) ?? JOURNEY_DESTINATIONS[0];
    return <div className={params.get("motion") === "0" ? "journey-preview-canvas motion-off" : "journey-preview-canvas"}>
      <JourneyMap voyagePoints={1200} recalculatedPoints={1200} week={week}
        initialDestinationId={destination.id} initialResting={destination.type === "REST" && params.get("rest") === "1"} />
    </div>;
  }

  const previewParams = new URLSearchParams({
    canvas: "1", scene: sceneId, rest: resting && selected.type === "REST" ? "1" : "0", motion: motion ? "1" : "0"
  });
  return <section className="card journey-preview">
    <h1>旅程设计预览</h1>
    <p className="helper">使用模拟的 1200 分航程与每周回顾，可查看全部地点。仅开发环境可用。</p>
    <div className="journey-preview-controls">
      <label>地点<select value={sceneId} onChange={(event) => setSceneId(event.target.value)}>
        {JOURNEY_DESTINATIONS.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
      </select></label>
      <label>视图<select value={mobile ? "mobile" : "desktop"} onChange={(event) => setMobile(event.target.value === "mobile")}>
        <option value="desktop">桌面 · 960px</option><option value="mobile">手机 · 360px</option>
      </select></label>
      <label>动态<select value={motion ? "on" : "off"} onChange={(event) => setMotion(event.target.value === "on")}>
        <option value="on">开启（遵循系统减少动态设置）</option><option value="off">关闭</option>
      </select></label>
      <label>靠岸状态<select disabled={selected.type !== "REST"} value={resting ? "rest" : "route"} onChange={(event) => setResting(event.target.value === "rest")}>
        <option value="route">普通场景</option><option value="rest">靠岸休息</option>
      </select></label>
    </div>
    <div className="journey-preview-scroll">
      <iframe key={previewParams.toString()} title={`旅程预览：${selected.name}`}
        className="journey-preview-frame" style={{ width: mobile ? 360 : 960 }}
        src={`#/dev/journey?${previewParams}`} />
    </div>
  </section>;
}
