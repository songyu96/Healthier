import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, FogExp2, PMREMGenerator, Scene, Vector3 } from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { OceanSceneProps } from "../OceanScene";
import { createCoast } from "./createCoast";
import { createSwimmer } from "./createSwimmer";
import { CAMERA_VIEWS, SWIM_CYCLE_SECONDS, type OceanQuality, type OceanView } from "./swimMotion";
import swimmerUrl from "./assets/swimmer.glb?url";
import { supportsOceanWebGL } from "./webglSupport";

interface Props extends OceanSceneProps {
  active: boolean;
  paused: boolean;
  quality: OceanQuality;
  cameraRequest: { view: OceanView; revision: number };
  onReady: () => void;
  onFailure: () => void;
}

function CameraRig({ request, paused }: { request: Props["cameraRequest"]; paused: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.enablePan = false;
    orbit.minDistance = 2.7;
    orbit.maxDistance = 11;
    orbit.minPolarAngle = 0.12;
    orbit.maxPolarAngle = Math.PI / 2 - 0.12;
    orbit.rotateSpeed = 0.55;
    orbit.zoomSpeed = 0.65;
    const requestFrame = () => invalidate();
    orbit.addEventListener("change", requestFrame);
    controls.current = orbit;
    return () => { orbit.removeEventListener("change", requestFrame); orbit.dispose(); controls.current = null; };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const preset = CAMERA_VIEWS[request.view];
    camera.position.fromArray(preset.position);
    controls.current?.target.fromArray(preset.target);
    controls.current?.update();
    invalidate();
  }, [camera, request, invalidate]);
  useEffect(() => { if (controls.current) controls.current.enableDamping = !paused; }, [paused]);
  useFrame(() => controls.current?.update());
  return null;
}

function Environment() {
  const { gl, scene } = useThree();
  const sky = useMemo(() => {
    const object = new Sky();
    object.scale.setScalar(10000);
    object.material.uniforms.turbidity.value = 2;
    object.material.uniforms.rayleigh.value = 3;
    object.material.uniforms.mieCoefficient.value = 0.005;
    object.material.uniforms.mieDirectionalG.value = 0.82;
    object.material.uniforms.sunPosition.value.copy(new Vector3(-30, 45, -55));
    return object;
  }, []);
  useEffect(() => {
    // Three.js owns this mutable scene; restore its renderer state on cleanup.
    /* eslint-disable react-hooks/immutability */
    const previousEnvironment = scene.environment, previousFog = scene.fog, previousIntensity = scene.environmentIntensity;
    const generator = new PMREMGenerator(gl);
    const environmentScene = new Scene();
    environmentScene.add(sky.clone());
    const environment = generator.fromScene(environmentScene, 0.06, 0.1, 20000);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.065;
    scene.fog = new FogExp2("#a0c4ce", 0.0038);
    generator.dispose();
    return () => { scene.environment = previousEnvironment; scene.environmentIntensity = previousIntensity; scene.fog = previousFog; environment.dispose(); };
    /* eslint-enable react-hooks/immutability */
  }, [gl, scene, sky]);
  useEffect(() => () => { sky.geometry.dispose(); sky.material.dispose(); }, [sky]);
  return <>
    <primitive object={sky} />
    <hemisphereLight args={["#d0e6ed", "#43717a", 0.7]} />
    <directionalLight position={[-12, 16, -14]} color="#fff3da" intensity={2.5} />
  </>;
}

function World(props: Props) {
  const { onReady, onFailure } = props;
  const gltf = useLoader(GLTFLoader, swimmerUrl);
  const coast = useMemo(() => createCoast(props.quality), [props.quality]);
  const swimmer = useMemo(() => createSwimmer(gltf.scene), [gltf.scene]);
  const clock = useRef({ time: 0, phase: 0 });
  const { gl, invalidate } = useThree();
  useEffect(() => { swimmer.setAppearance(props); invalidate(); }, [swimmer, props, invalidate]);
  useEffect(() => { onReady(); }, [onReady]);
  useEffect(() => {
    const onLost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener("webglcontextlost", onLost);
    return () => gl.domElement.removeEventListener("webglcontextlost", onLost);
  }, [gl, onFailure]);
  useEffect(() => () => coast.dispose(), [coast]);
  useEffect(() => () => swimmer.dispose(), [swimmer]);
  useFrame((_, delta) => {
    if (!props.paused) {
      const step = Math.min(delta, 0.05);
      clock.current.time += step;
      clock.current.phase += step / SWIM_CYCLE_SECONDS[props.pace] * Math.PI * 2;
    }
    swimmer.update(clock.current.time, clock.current.phase);
    coast.update(clock.current.time, clock.current.phase, props.pace === "SURGE", props.luminousWater);
  });
  return <><primitive object={coast.group} /><primitive object={swimmer.group} /></>;
}

export default function OceanCanvas(props: Props) {
  const [supported] = useState(supportsOceanWebGL);
  const { onFailure } = props;
  useEffect(() => { if (!supported) onFailure(); }, [supported, onFailure]);
  if (!supported) return null;
  return <Canvas
    camera={{ position: CAMERA_VIEWS.FOLLOW.position, fov: 43, near: 0.1, far: 20000 }}
    dpr={props.quality === "LOW" ? 1 : [1, 1.5]}
    gl={{ antialias: true, alpha: false, powerPreference: "default", toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.65 }}
    frameloop={props.active && !props.paused ? "always" : "demand"}
    fallback={<p>海洋 3D 场景，可使用下方按钮切换镜头与暂停。</p>}
    onCreated={({ gl }) => {
      gl.debug.onShaderError = () => { console.error("海洋场景着色器编译失败，已切换轻量场景。"); props.onFailure(); };
    }}
  >
    <Environment />
    <CameraRig request={props.cameraRequest} paused={props.paused} />
    <Suspense fallback={null}><World {...props} /></Suspense>
  </Canvas>;
}
