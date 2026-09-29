import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GameAvatarStyle } from "../game";
import { createSwimmer } from "./createSwimmer";
import { characterCamera, type CharacterView } from "./characterPreviewViews";
import { supportsOceanWebGL } from "./webglSupport";
import { swimmerAsset } from "./swimmerAssets";

interface Props {
  avatarStyle: GameAvatarStyle;
  request: {view: CharacterView; revision: number};
  rotating: boolean;
  onReady: () => void;
  onFailure: () => void;
}

function Studio({ avatarStyle, request, rotating, onReady, onFailure }: Props) {
  const gltf = useLoader(GLTFLoader, swimmerAsset(avatarStyle));
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const subject = useMemo(() => {
    const swimmer = createSwimmer(gltf.scene);
    swimmer.setAppearance({avatarStyle,proportions:{bodyWidth:1,strokeReach:1}});
    return {swimmer, framing:swimmer.setPreviewPose()};
  }, [gltf.scene, avatarStyle]);
  useEffect(() => () => subject.swimmer.dispose(), [subject]);
  useEffect(() => {
    const orbit = new OrbitControls(camera,gl.domElement);
    orbit.enablePan = false;
    orbit.enableDamping = false;
    orbit.minDistance = 0.55;
    orbit.maxDistance = 6;
    orbit.minPolarAngle = 0.35;
    orbit.maxPolarAngle = Math.PI*0.72;
    orbit.autoRotateSpeed = 0.7;
    orbit.rotateSpeed = 0.55;
    orbit.zoomSpeed = 0.6;
    const requestFrame = () => invalidate();
    orbit.addEventListener("change",requestFrame);
    controls.current = orbit;
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    gl.domElement.addEventListener("webglcontextlost",lost);
    return () => { orbit.removeEventListener("change",requestFrame); orbit.dispose(); controls.current = null; gl.domElement.removeEventListener("webglcontextlost",lost); };
  }, [camera,gl,invalidate,onFailure]);
  useEffect(() => {
    const framing = characterCamera(request.view,subject.framing.height,subject.framing.face.toArray());
    camera.position.fromArray(framing.position);
    if (controls.current) controls.current.autoRotate = false;
    controls.current?.target.fromArray(framing.target);
    controls.current?.update();
    invalidate();
  }, [camera,request,subject,invalidate]);
  useEffect(() => { onReady(); }, [onReady]);
  useFrame((_,delta) => {
    if (controls.current) {
      controls.current.autoRotate = rotating;
      if (rotating) controls.current.update(Math.min(delta,0.05));
    }
  });
  return <primitive object={subject.swimmer.group} />;
}

export default function CharacterPreviewCanvas(props: Props) {
  const [supported] = useState(supportsOceanWebGL);
  const { onFailure } = props;
  useEffect(() => { if (!supported) onFailure(); }, [supported,onFailure]);
  if (!supported) return null;
  return <Canvas camera={{position:[0,0.9,3.6],fov:35,near:0.03,far:30}} dpr={[1,1.5]}
    frameloop={props.rotating ? "always" : "demand"}
    gl={{antialias:true,alpha:false,powerPreference:"default",toneMapping:ACESFilmicToneMapping,toneMappingExposure:1}}
    onCreated={({gl}) => { gl.debug.onShaderError = () => onFailure(); }}>
    <color attach="background" args={["#e5ece8"]} />
    <hemisphereLight args={["#f2f6f5","#b1bdb6",0.65]} />
    <directionalLight position={[3,4,5]} color="#fff7ed" intensity={1.5} />
    <directionalLight position={[-3,2,-2]} color="#d9ebf5" intensity={0.35} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.003,0]}><circleGeometry args={[0.65,64]} /><meshStandardMaterial color="#c8d8cf" roughness={0.9} /></mesh>
    <Suspense fallback={null}><Studio {...props} /></Suspense>
  </Canvas>;
}
