import { useEffect, useMemo, useState } from "react";
import coralScene from "./assets/game/journey-coral.webp";
import mapScene from "./assets/game/journey-map.webp";
import mistScene from "./assets/game/journey-mist.webp";
import restScene from "./assets/game/journey-rest.webp";
import starsScene from "./assets/game/journey-stars.webp";
import {
  JOURNEY_DESTINATIONS,
  JOURNEY_REGIONS,
  journeyPosition,
  type JourneyDestination,
  type JourneySceneId
} from "./game";

export interface JourneyWeekSummary {
  points: number;
  dietPoints: number;
  dietStatus: string;
  goalEarnedSessions: number;
  goalPlannedSessions: number;
}

export interface JourneyMapProps {
  voyagePoints: number;
  recalculatedPoints: number;
  week: JourneyWeekSummary;
}

const SCENE_IMAGES: Record<JourneySceneId, string> = {
  CORAL: coralScene,
  MIST: mistScene,
  STARS: starsScene,
  REST: restScene
};

const TYPE_LABELS: Record<JourneyDestination["type"], string> = {
  START: "起点",
  MILESTONE: "探索地",
  REST: "休息岛",
  REWARD: "伙伴奖励",
  CHALLENGE: "挑战航段",
  FINALE: "第一季终点"
};

function formatPoints(points: number): string {
  return points.toFixed(1).replace(/\.0$/, "");
}

export default function JourneyMap({ voyagePoints, recalculatedPoints, week }: JourneyMapProps) {
  const position = useMemo(() => journeyPosition(voyagePoints), [voyagePoints]);
  const currentDestinationId = position.current.id;
  const [selectedId, setSelectedId] = useState(currentDestinationId);
  const [resting, setResting] = useState(false);
  const selected = JOURNEY_DESTINATIONS.find((destination) => destination.id === selectedId) ?? position.current;
  const reached = voyagePoints >= selected.threshold;

  useEffect(() => {
    setSelectedId(currentDestinationId);
    setResting(false);
  }, [currentDestinationId]);

  const routePoints = JOURNEY_DESTINATIONS.map((destination) => `${destination.x * 10},${destination.y * 7}`).join(" ");
  const scene = resting ? "REST" : selected.scene;
  const seasonComplete = voyagePoints >= JOURNEY_DESTINATIONS.at(-1)!.threshold;
  const protectedVoyage = recalculatedPoints < voyagePoints;
  const goalProgress = week.goalPlannedSessions > 0
    ? `${formatPoints(week.goalEarnedSessions)} / ${week.goalPlannedSessions} 次`
    : "未设置";

  const chooseDestination = (destination: JourneyDestination) => {
    setSelectedId(destination.id);
    setResting(false);
  };

  return <div className="journey-experience">
    <div className="journey-map" aria-label="幻想群岛航海地图">
      <img className="journey-map-art" src={mapScene} alt="幻想群岛从珊瑚浅海延伸至云雾海和星夜洋" />
      <div className="journey-map-shade" aria-hidden="true" />
      <svg className="journey-route" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
        <polyline className="journey-route-shadow" points={routePoints} />
        <polyline className="journey-route-line" points={routePoints} />
      </svg>
      <div className="journey-map-title"><span>幻想群岛 · 第一季</span><b>向星潮灯塔启航</b></div>
      {JOURNEY_DESTINATIONS.map((destination) => {
        const unlocked = voyagePoints >= destination.threshold;
        const isCurrent = destination.id === position.current.id;
        const isSelected = destination.id === selected.id;
        return <button
          type="button"
          key={destination.id}
          className={`journey-node${unlocked ? " reached" : " locked"}${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}`}
          style={{ left: `${destination.x}%`, top: `${destination.y}%` }}
          aria-current={isCurrent ? "location" : undefined}
          aria-pressed={isSelected}
          aria-label={`${destination.name}，${unlocked ? "已到达" : `${destination.threshold} 分解锁`}`}
          onClick={() => chooseDestination(destination)}
        >
          <span className="journey-node-dot" aria-hidden="true">{destination.type === "REST" ? "⌂" : destination.type === "FINALE" ? "✦" : ""}</span>
          <span className="journey-node-label">{destination.name}<small>{destination.threshold} 分</small></span>
        </button>;
      })}
      <div className="journey-boat" style={{ left: `${position.x}%`, top: `${position.y}%` }} aria-label="当前航行位置">
        <span aria-hidden="true">⛵</span>
      </div>
      <div className="journey-map-progress">
        <span>永久航程</span><strong>{formatPoints(voyagePoints)} 分</strong>
        <small>{seasonComplete ? "第一季航程完成，积分仍会继续累积" : `距 ${position.next?.name} 还差 ${formatPoints(position.remaining)} 分`}</small>
      </div>
    </div>

    <section className={`journey-destination${reached ? " reached" : " locked"}`} aria-live="polite">
      {reached && <img className="journey-destination-art" src={SCENE_IMAGES[scene]} alt="" loading="lazy" />}
      <div className="journey-destination-overlay" />
      <div className="journey-destination-copy">
        <span>{JOURNEY_REGIONS[selected.region]} · {TYPE_LABELS[selected.type]}</span>
        <h2>{resting ? `${selected.name} · 靠岸休息` : selected.name}</h2>
        <p>{reached ? selected.description : `继续积累到 ${selected.threshold} 分，即可进入这处地点。`}</p>
        {reached && selected.type === "REST" && !resting && <button className="journey-rest-button" type="button" onClick={() => setResting(true)}>靠岸休息</button>}
        {resting && <button className="journey-rest-button" type="button" onClick={() => setResting(false)}>返回航线</button>}
      </div>
      {resting && <div className="journey-rest-summary">
        <div><span>本周航程</span><b>{formatPoints(week.points)} / 100 分</b></div>
        <div><span>饮食补给</span><b>{week.dietStatus}</b></div>
        <div><span>练习进度</span><b>{goalProgress}</b></div>
        <p>休息不会扣分，也不会中断旅程。准备好时再继续出发。</p>
      </div>}
    </section>

    <div className="journey-ledger">
      <div><span>本周积分</span><strong>{formatPoints(week.points)} 分</strong></div>
      <div><span>当前记录重算</span><strong>{formatPoints(recalculatedPoints)} 分</strong></div>
      <div><span>历史最高航程</span><strong>{formatPoints(voyagePoints)} 分</strong></div>
    </div>
    {protectedVoyage && <p className="journey-protection-note" role="status">当前处于航程保护期：本周贡献已计入当前重算积分；超过历史最高 {formatPoints(voyagePoints)} 分后，小船会继续前进。</p>}
    <p className="helper">本周积分不等于本周地图前进积分。航程取历史最高值，不会因补录或修改历史记录而倒退；积分反映记录与练习，不代表实际距离。</p>
  </div>;
}
