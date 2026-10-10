import OceanScene, { type OceanSceneProps } from "./OceanScene";

export default function OceanExperience(props: OceanSceneProps) {
  return <div className="ocean-experience">
    <OceanScene {...props} />
    <p className="ocean-interaction-hint">轻量海洋场景不会加载 3D 模型，更适合移动设备。</p>
  </div>;
}
