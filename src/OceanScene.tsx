import type { GameAvatarStyle } from "./game";
import type { AvatarProportions, SwimPace } from "./gamePresentation";

export interface OceanSceneProps {
  progress: number;
  avatarStyle?: GameAvatarStyle;
  pace: SwimPace;
  proportions: AvatarProportions;
  luminousWater: boolean;
  dolphin: boolean;
  butterfly: boolean;
}

export function SwimmerFigure({ avatarStyle, proportions, butterfly = false }: {
  avatarStyle?: GameAvatarStyle;
  proportions: AvatarProportions;
  butterfly?: boolean;
}) {
  const styleClass = avatarStyle === "FEMALE" ? "avatar-female" : avatarStyle === "MALE" ? "avatar-male" : "avatar-neutral";
  return <g className={`swimmer-figure ${styleClass}`}>
    <ellipse cx="-12" cy="25" rx="103" ry="11" fill="#052f42" opacity=".18" />
    <g transform="translate(-53 2)"><g className="swimmer-leg swimmer-leg-back">
      <path d="M0 0 Q-23 14 -54 3 L-79 -15" fill="none" stroke="#a97861" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-76 -17 Q-89 -18 -97 -30" fill="none" stroke="#153f57" strokeWidth="11" strokeLinecap="round" />
    </g></g>
    <g transform="translate(-55 8)"><g className="swimmer-leg swimmer-leg-front">
      <path d="M0 0 Q-27 4 -55 -8 L-80 -1" fill="none" stroke="#dcab87" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-78 -1 Q-92 3 -101 -7" fill="none" stroke="#173f57" strokeWidth="12" strokeLinecap="round" />
    </g></g>
    <g transform="translate(6 -11)"><g className="swimmer-arm swimmer-arm-back">
      <path d="M0 0 Q28 13 51 7 Q68 4 82 -8" fill="none" stroke="#a97861" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
    </g></g>
    <g className="swimmer-core" transform={`scale(${proportions.bodyWidth} 1)`}>
      <path d="M-64 -17 Q-41 -35 -5 -34 Q22 -33 40 -13 Q28 6 7 10 Q-32 19 -65 4 Z" fill="var(--swim-suit)" />
      <path d="M-58 -18 Q-48 -28 -37 -31 Q-29 -15 -37 11 L-61 5 Z" fill="var(--swim-suit-dark)" opacity=".62" />
      <path d="M-43 -26 Q-17 -35 7 -25" fill="none" stroke="#ffffff" strokeWidth="4" opacity=".28" strokeLinecap="round" />
      <path d="M25 -12 Q38 -6 44 -6" fill="none" stroke="#d5a07c" strokeWidth="17" strokeLinecap="round" />
    </g>
    <path d="M33 -28 Q28 -49 48 -54 Q70 -58 78 -36 Q84 -15 67 -5 Q47 3 35 -14 Z" fill="var(--swim-hair)" />
    {avatarStyle === "FEMALE" && <path d="M35 -43 Q13 -45 17 -22 Q20 -11 11 -5 Q33 -5 34 -25" fill="var(--swim-hair)" />}
    <ellipse cx="59" cy="-24" rx="22" ry="20" fill="#e6b48d" />
    <path d="M38 -32 Q45 -54 68 -47 Q80 -43 79 -28 Q65 -36 52 -34 Q45 -27 39 -22 Z" fill="var(--swim-hair)" />
    {avatarStyle === "MALE" && <path d="M42 -39 Q45 -50 51 -47 L52 -55 L60 -49 L65 -55 L71 -47 Q77 -42 77 -35" fill="var(--swim-hair)" />}
    <path d="M56 -27 Q66 -32 76 -26" fill="none" stroke="#143b50" strokeWidth="7" strokeLinecap="round" />
    <path d="M55 -27 Q65 -31 75 -26" fill="none" stroke="#bceaf0" strokeWidth="3" strokeLinecap="round" />
    <circle cx="78" cy="-18" r="2" fill="#7f4d42" />
    <g transform="translate(8 -13)"><g className="swimmer-arm swimmer-arm-front" style={{ scale: `${proportions.strokeReach} 1` }}>
      <path d="M0 0 Q23 -6 44 -19 Q59 -27 83 -21" fill="none" stroke="#e6b48d" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M79 -21 Q89 -22 94 -18" fill="none" stroke="#e6b48d" strokeWidth="8" strokeLinecap="round" />
    </g></g>
    {butterfly && <path className="swimmer-glide" d="M-79 -47 Q-2 -74 90 -49" fill="none" stroke="#d4f5ed" strokeWidth="3" strokeLinecap="round" opacity=".85" />}
  </g>;
}

export function AvatarThumbnail({ avatarStyle }: { avatarStyle: GameAvatarStyle }) {
  return <svg className="game-avatar-thumb" viewBox="-113 -82 230 152" aria-hidden="true" focusable="false">
    <SwimmerFigure avatarStyle={avatarStyle} proportions={{ bodyWidth: 1, strokeReach: 1 }} />
  </svg>;
}

export default function OceanScene({ progress, avatarStyle, pace, proportions, luminousWater, dolphin, butterfly }: OceanSceneProps) {
  const swimmerX = 354 + Math.min(1, Math.max(0, progress)) * 195;
  return <div className={`ocean-stage pace-${pace.toLowerCase()}${luminousWater ? " ocean-stage-luminous" : ""}`}>
    <svg className="ocean-stage-art" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="角色持续在海面游泳，水流与海洋生物在身边移动">
      <defs>
        <linearGradient id="ocean-sky" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#ebd5ac" /><stop offset="1" stopColor="#9ac9d1" /></linearGradient>
        <linearGradient id="ocean-water" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#338da1" /><stop offset=".45" stopColor="#126179" /><stop offset="1" stopColor="#073d58" /></linearGradient>
        <linearGradient id="ocean-light" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#e2f6d9" stopOpacity=".65" /><stop offset="1" stopColor="#e2f6d9" stopOpacity="0" /></linearGradient>
        <linearGradient id="ocean-glass" x1="0" x2="1"><stop stopColor="#fff" stopOpacity=".32" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id="ocean-clip"><rect width="900" height="400" rx="22" /></clipPath>
      </defs>
      <g clipPath="url(#ocean-clip)">
        <rect width="900" height="400" fill="url(#ocean-sky)" />
        <circle cx="724" cy="44" r="34" fill="#fff3d2" opacity=".88" />
        <path d="M0 89 Q140 58 290 86 T604 86 T900 78 L900 0 L0 0 Z" fill="#f8ead1" opacity=".19" />
        <path d="M0 113 Q80 93 160 111 T320 109 T480 113 T640 108 T800 112 T960 106 L960 400 L0 400 Z" fill="url(#ocean-water)" />
        <g className="ocean-light-rays"><path d="M620 112 L720 112 L825 400 L740 400 Z" fill="url(#ocean-light)" opacity=".3" />
          <path d="M345 114 L397 114 L478 400 L419 400 Z" fill="url(#ocean-light)" opacity=".27" />
          <path d="M72 112 L116 112 L179 395 L136 395 Z" fill="url(#ocean-light)" opacity=".18" /></g>
        <path className="ocean-wave ocean-wave-back" d="M-70 119 Q0 100 70 119 T210 119 T350 119 T490 119 T630 119 T770 119 T910 119 T1050 119" fill="none" stroke="#c1e6dc" strokeWidth="12" opacity=".28" />
        <path className="ocean-wave ocean-wave-front" d="M-70 112 Q0 96 70 112 T210 112 T350 112 T490 112 T630 112 T770 112 T910 112 T1050 112" fill="none" stroke="#ecf6dc" strokeWidth="6" opacity=".88" />
        <path d="M0 352 Q115 320 208 352 T417 350 T648 356 T900 339 L900 400 L0 400 Z" fill="#073d55" opacity=".52" />
        <g className="ocean-fish-school" fill="#bce1d4" opacity=".42">
          <path d="M114 212 Q128 205 143 212 Q128 222 114 212 Z M113 212 L103 205 L104 220 Z" />
          <path d="M156 230 Q169 225 182 230 Q169 238 156 230 Z M156 230 L147 224 L147 237 Z" />
          <path d="M744 252 Q764 244 784 252 Q764 264 744 252 Z M744 252 L731 241 L731 264 Z" />
        </g>
        <g className="ocean-seaweed" fill="none" stroke="#2c847c" strokeWidth="7" strokeLinecap="round" opacity=".72">
          <path d="M74 400 Q43 370 64 332 Q88 301 63 275" /><path d="M84 400 Q111 365 95 330 Q80 301 107 282" />
          <path d="M844 400 Q821 356 843 320 Q859 291 839 272" /><path d="M855 400 Q887 367 874 334 Q863 304 885 287" />
        </g>
        <g className="ocean-particles" fill="#c8ebd6" opacity=".58"><circle cx="161" cy="172" r="2" /><circle cx="251" cy="296" r="2" /><circle cx="693" cy="199" r="2" /><circle cx="810" cy="312" r="2" /><circle cx="525" cy="346" r="2" /></g>
        <g transform={`translate(${swimmerX} 176)`}>
          <g className="swimmer-motion"><SwimmerFigure avatarStyle={avatarStyle} proportions={proportions} butterfly={butterfly} /></g>
          <g className="ocean-wake" fill="none" stroke="#d8f5e9" strokeLinecap="round">
            <path d="M-96 6 Q-128 -2 -157 10" strokeWidth="4" opacity=".76" />
            <path d="M-107 20 Q-142 13 -176 24" strokeWidth="2" opacity=".55" />
          </g>
          <g className="ocean-bubble bubble-one" fill="#e2f6ee" opacity=".72"><circle cx="-86" cy="18" r="6" /><circle cx="-112" cy="38" r="3" /></g>
          <g className="ocean-bubble bubble-two" fill="#e2f6ee" opacity=".58"><circle cx="-99" cy="25" r="4" /><circle cx="-131" cy="53" r="2" /></g>
        </g>
        {dolphin && <g className="ocean-dolphin" transform={`translate(${Math.min(767, swimmerX + 182)} 205)`} fill="#a3d5d5">
          <path d="M-57 3 Q-9 -34 51 -12 Q23 17 -26 20 Q-44 17 -57 3 Z" /><path d="M-13 -12 L3 -37 L14 -13" /><path d="M-50 4 L-74 -12 L-65 11" />
          <circle cx="35" cy="-8" r="3" fill="#16475c" />
        </g>}
        <rect y="111" width="900" height="2" fill="url(#ocean-glass)" opacity=".7" />
      </g>
    </svg>
    <div className="ocean-stage-heading"><span>OPEN WATER · 海洋旅程</span><b>每一次练习，都向前一程</b></div>
    <div className="ocean-stage-marker" aria-hidden="true"><span>航线</span><b>{Math.round(Math.min(1, Math.max(0, progress)) * 100)}%</b></div>
  </div>;
}
