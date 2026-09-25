import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, Color, FogExp2, PMREMGenerator, Scene, Vector3 } from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { OceanSceneProps } from "../OceanScene";
import { createCoast } from "./createCoast";
import { createSwimmer } from "./createSwimmer";
import { advanceSwim, routePose, transportView, CAMERA_VIEWS, type SwimClock, type OceanQuality, type OceanView } from "./swimMotion";
import swimmerUrl from "./assets/swimmer.glb?url";
import { supportsOceanWebGL } from "./webglSupport";
import { OCEAN_LOOKS, type OceanWeather } from "./oceanLook";

interface Props extends OceanSceneProps {
  active: boolean;
  paused: boolean;
  quality: OceanQuality;
  weather: OceanWeather;
  cameraRequest: { view: OceanView; revision: number };
  onReady: () => void;
  onFailure: () => void;
}

const SUN_POSITION: [number, number, number] = [-30, 45, -55];

function CameraRig({ request, paused, clock }: { request: Props["cameraRequest"]; paused: boolean; clock: RefObject<SwimClock> }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const previousPose = useRef(routePose(0));
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
    const pose = routePose(clock.current.distance);
    camera.position.fromArray(transportView(preset.position, routePose(0), pose));
    controls.current?.target.fromArray(transportView(preset.target, routePose(0), pose));
    previousPose.current = pose;
    controls.current?.update();
    invalidate();
  }, [camera, request, invalidate, clock]);
  useEffect(() => { if (controls.current) controls.current.enableDamping = !paused; }, [paused]);
  useFrame(() => {
    const pose = routePose(clock.current.distance);
    camera.position.fromArray(transportView(camera.position.toArray(), previousPose.current, pose));
    if (controls.current) {
      controls.current.target.fromArray(transportView(controls.current.target.toArray(), previousPose.current, pose));
      controls.current.update();
    }
    previousPose.current = pose;
  }, -1);
  return null;
}

function Environment({ weather }: { weather: OceanWeather }) {
  const { gl, scene, invalidate } = useThree();
  const look = OCEAN_LOOKS[weather];
  const sky = useMemo(() => {
    const object = new Sky();
    object.scale.setScalar(10000);
    object.material.uniforms.turbidity.value = look.turbidity;
    object.material.uniforms.rayleigh.value = look.rayleigh;
    object.material.uniforms.cloudCoverage.value = look.cloud;
    object.material.uniforms.cloudDensity.value = look.cloudDensity;
    object.material.uniforms.showSunDisc.value = weather === "SUNNY" ? 1 : 0;
    object.material.uniforms.overcastAmount = { value: weather === "SUNNY" ? 0 : weather === "CLOUDY" ? 0.55 : 0.85 };
    object.material.uniforms.overcastColor = { value: new Color(look.fog) };
    object.material.fragmentShader = `uniform float overcastAmount; uniform vec3 overcastColor;\n${object.material.fragmentShader}`.replace(
      "gl_FragColor = vec4( texColor, 1.0 );",
      "float cloudLight=dot(texColor,vec3(0.2126,0.7152,0.0722)); texColor=mix(texColor,overcastColor*(0.55+cloudLight*0.55),overcastAmount); gl_FragColor=vec4(texColor,1.0);"
    );
    object.material.uniforms.mieCoefficient.value = 0.005;
    object.material.uniforms.mieDirectionalG.value = 0.82;
    object.material.uniforms.sunPosition.value.copy(new Vector3(...SUN_POSITION));
    return object;
  }, [look, weather]);
  useEffect(() => {
    // Three.js owns this mutable scene; restore its renderer state on cleanup.
    /* eslint-disable react-hooks/immutability */
    const previousEnvironment = scene.environment, previousFog = scene.fog, previousIntensity = scene.environmentIntensity, previousExposure = gl.toneMappingExposure;
    const generator = new PMREMGenerator(gl);
    const environmentScene = new Scene();
    environmentScene.add(sky.clone());
    const environment = generator.fromScene(environmentScene, 0.06, 0.1, 20000);
    scene.environment = environment.texture;
    scene.environmentIntensity = look.environment;
    scene.fog = new FogExp2(look.fog, look.fogDensity);
    gl.toneMappingExposure = look.exposure;
    invalidate();
    generator.dispose();
    return () => { scene.environment = previousEnvironment; scene.environmentIntensity = previousIntensity; scene.fog = previousFog; gl.toneMappingExposure = previousExposure; environment.dispose(); };
    /* eslint-enable react-hooks/immutability */
  }, [gl, scene, sky, look, invalidate]);
  useEffect(() => () => { sky.geometry.dispose(); sky.material.dispose(); }, [sky]);
  return <>
    <primitive object={sky} />
    <hemisphereLight args={[look.sky, look.ground, look.ambient]} />
    <directionalLight position={SUN_POSITION} color={look.sun} intensity={look.sunIntensity} />
  </>;
}

function World(props: Props) {
  const { onReady, onFailure } = props;
  const gltf = useLoader(GLTFLoader, swimmerUrl);
  const coast = useMemo(() => createCoast(props.quality), [props.quality]);
  const swimmer = useMemo(() => createSwimmer(gltf.scene), [gltf.scene]);
  const clock = useRef<SwimClock>({ time: 0, phase: 0, distance: 0 });
  const { gl, invalidate } = useThree();
  const { avatarStyle, proportions: { bodyWidth, strokeReach } } = props;
  useEffect(() => { swimmer.setAppearance({ avatarStyle, proportions: { bodyWidth, strokeReach } }); invalidate(); }, [swimmer, avatarStyle, bodyWidth, strokeReach, invalidate]);
  useEffect(() => { coast.setWeather(props.weather); invalidate(); }, [coast, props.weather, invalidate]);
  useEffect(() => { onReady(); }, [onReady]);
  useEffect(() => {
    const onLost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener("webglcontextlost", onLost);
    return () => gl.domElement.removeEventListener("webglcontextlost", onLost);
  }, [gl, onFailure]);
  useEffect(() => () => coast.dispose(), [coast]);
  useEffect(() => () => swimmer.dispose(), [swimmer]);
  useFrame((_, delta) => {
    clock.current = advanceSwim(clock.current, delta, props.pace, props.paused || !props.active);
    const pose = routePose(clock.current.distance);
    coast.update(clock.current.time, clock.current.phase, pose, props.pace === "SURGE", props.luminousWater);
    swimmer.update(clock.current.time, clock.current.phase, pose, coast.heightAt);
    coast.updateSpray(clock.current.time, swimmer.hands);
  }, -2);
  return <><CameraRig request={props.cameraRequest} paused={props.paused} clock={clock} /><primitive object={coast.group} /><primitive object={swimmer.group} /></>;
}

export default function OceanCanvas(props: Props) {
  const [supported] = useState(supportsOceanWebGL);
  const { onFailure } = props;
  useEffect(() => { if (!supported) onFailure(); }, [supported, onFailure]);
  if (!supported) return null;
  return <Canvas
    camera={{ position: CAMERA_VIEWS.FOLLOW.position, fov: 43, near: 0.1, far: 20000 }}
    dpr={props.quality === "LOW" ? 1 : [1, 1.5]}
    gl={{ antialias: true, alpha: false, powerPreference: "default", toneMapping: ACESFilmicToneMapping, toneMappingExposure: 0.85 }}
    frameloop={props.active && !props.paused ? "always" : "demand"}
    fallback={<p>海洋 3D 场景，可使用下方按钮切换镜头与暂停。</p>}
    onCreated={({ gl }) => {
      gl.debug.onShaderError = (context, program, vertex, fragment) => {
        console.error("海洋场景着色器编译失败，已切换轻量场景。", context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment));
        props.onFailure();
      };
    }}
  >
    <Environment weather={props.weather} />
    <Suspense fallback={null}><World {...props} /></Suspense>
  </Canvas>;
}
