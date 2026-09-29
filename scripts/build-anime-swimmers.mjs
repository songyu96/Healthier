// Reproducible Coral C character assets. Body topology/rig: MakeHuman CC0.
// Face, hair, garment cuts and accessories are authored here in meters.
import { readFile, writeFile } from "node:fs/promises";
import { Bone, BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Skeleton, SkinnedMesh, SphereGeometry, TorusGeometry, TubeGeometry, Uint16BufferAttribute, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
};
const bytes = await readFile("src/ocean/assets/swimmer.glb");
const source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
const v = (x,y,z) => new Vector3(x,y,z);
const clamp = (x,a=0,b=1) => Math.min(b,Math.max(a,x));
const material = (name,color) => new MeshStandardMaterial({name,color,roughness:0.85,metalness:0});
function intersection(...constraints) {
  const fn=o=>Math.min(...constraints.map(test=>test(o)));
  fn.planes=constraints.flatMap(test=>test.planes??[test]);
  return fn;
}

function surface(rows, segments=64) {
  const positions=[], indices=[];
  rows.forEach((row,i) => {
    for(let j=0;j<=segments;j++) positions.push(...row(j/segments).toArray());
    if(i) for(let j=0;j<segments;j++) {
      const a=(i-1)*(segments+1)+j,b=i*(segments+1)+j;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
  });
  const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function add(parent,name,geometry,mat) {const mesh=new Mesh(geometry,mat);mesh.name=name;parent.add(mesh);return mesh;}
function ellipsoid(parent,name,p,scale,mat) {const mesh=add(parent,name,new SphereGeometry(1,24,16),mat);mesh.position.copy(p);mesh.scale.copy(scale);return mesh;}
function line(parent,name,points,radius,mat) {return add(parent,name,new TubeGeometry(new CatmullRomCurve3(points),32,radius,6,false),mat);}

async function build(female) {
  const model=clone(source);model.name=female?"AnimeFemaleCoralC":"AnimeMaleCoralC";
  model.userData={characterStyle:"anime-coral-c",avatarStyle:female?"FEMALE":"MALE",version:1};
  const old=[],bones=[];model.updateMatrixWorld(true);
  model.traverse(o=>{if(o instanceof SkinnedMesh)old.push(o);if(o instanceof Bone)bones.push(o);});
  const skeleton=old[0].skeleton;
  const boneMap=new Map(bones.map(b=>[b.name,b]));
  const world=name=>boneMap.get(name).getWorldPosition(new Vector3());
  const base=old[0].geometry;
  const positions=base.getAttribute("position"),si=base.getAttribute("skinIndex"),sw=base.getAttribute("skinWeight");
  const vertices=[];
  for(let i=0;i<positions.count;i++) {
    const p=new Vector3().fromBufferAttribute(positions,i),original=p.clone();
    const links=[];for(let j=0;j<4;j++) if(sw.getComponent(i,j)>0)links.push([si.getComponent(i,j),sw.getComponent(i,j)]);
    const arm=links.reduce((sum,[id,w])=>sum+(/upperarm|lowerarm|wrist|finger|metacarpal/.test(skeleton.bones[id].name)?w:0),0);
    const leg=links.reduce((sum,[id,w])=>sum+(/upperleg|lowerleg/.test(skeleton.bones[id].name)?w:0),0);
    if(arm>0.01) {
      const side=p.x>0?"L":"R";
      const segments=[[world(`upperarm01_${side}`),world(`lowerarm01_${side}`)],[world(`lowerarm01_${side}`),world(`wrist_${side}`)]];
      let nearest,dist=Infinity;
      for(const [a,b] of segments) {const d=b.clone().sub(a);const q=a.clone().addScaledVector(d,clamp(p.clone().sub(a).dot(d)/d.lengthSq()));const distance=q.distanceTo(p);if(distance<dist){dist=distance;nearest=q;}}
      const hand=links.reduce((sum,[id,w])=>sum+(/wrist|finger|metacarpal/.test(skeleton.bones[id].name)?w:0),0);
      p.lerp(nearest,arm*(1-hand)*(female?0.17:0.27));
    }
    if(leg>0.01) {
      const side=p.x>0?"L":"R",a=world(`upperleg01_${side}`),b=world(`foot_${side}`),d=b.clone().sub(a);
      const q=a.clone().addScaledVector(d,clamp(p.clone().sub(a).dot(d)/d.lengthSq()));
      p.lerp(q,leg*(female?0.09:0.16));
    }
    const torso=(1-arm)*(1-leg)*clamp((0.56-p.y)/0.08);
    const hip=Math.exp(-(((p.y+0.01)/0.14)**2));
    p.x*=1-torso*(female?0.04:0.06+hip*0.10);
    if(!female && p.y>0.23 && p.y<0.49 && p.z>0.14) p.z-=torso*0.024*Math.exp(-(((p.y-0.36)/0.09)**2));
    vertices.push({p,original,links,arm});
  }
  // Reassemble the primitive groups exported from the original indexed mesh.
  const triangles=old.flatMap(mesh=>{const index=mesh.geometry.index;const out=[];for(let i=0;i<index.count;i+=3)out.push([index.getX(i),index.getX(i+1),index.getX(i+2)]);return out;});
  const smooth=new BufferGeometry();smooth.setAttribute("position",new Float32BufferAttribute(vertices.flatMap(o=>o.p.toArray()),3));smooth.setIndex(triangles.flat());smooth.computeVertexNormals();
  vertices.forEach((o,i)=>o.n=new Vector3().fromBufferAttribute(smooth.getAttribute("normal"),i));
  old.forEach(o=>o.removeFromParent());
  const skin=material("AnimeSkin",female?"#f3c8b2":"#efc4ad"),coral=material("CoralFabric","#e88777"),cream=material("IvoryFabric","#f6f2e6"),teal=material("DeepTealFabric","#294d5e");
  const dark=material("Ink","#273342"),hairMat=material("Hair",female?"#463637":"#1d293b"),hairLight=material("HairHighlight",female?"#695053":"#344358");
  const topBottom=female?0.235:0.035,shortTop=female?0.155:0.035,shortBottom=-0.265;
  const sleeveValue=o=>{
    const p=o.p;
    const side=p.x>=0?"L":"R",shoulder=world(`upperarm01_${side}`),elbow=world(`lowerarm01_${side}`),d=elbow.clone().sub(shoulder);
    const t=p.clone().sub(shoulder).dot(d)/d.lengthSq();
    const armCut=female?Math.min(p.y>.34?.16-(p.y-.34)*.45-Math.abs(p.x):1,.12-o.arm):o.arm>0.4?(0.46-t)*0.2:1;
    return armCut;
  };
  const topValue=intersection(o=>o.p.y-topBottom,o=>0.514-o.p.y,sleeveValue);
  const shortsValue=intersection(o=>o.p.y-(female?-.15+Math.abs(o.p.x)*.72:shortBottom),o=>shortTop-o.p.y,o=>0.26-Math.abs(o.p.x));
  function interpolate(a,b,t) {
    const weights=new Map();for(const [id,w] of a.links)weights.set(id,(weights.get(id)||0)+w*(1-t));for(const [id,w] of b.links)weights.set(id,(weights.get(id)||0)+w*t);
    const links=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=links.reduce((s,x)=>s+x[1],0);links.forEach(x=>x[1]/=sum);
    return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),original:a.original.clone().lerp(b.original,t),arm:a.arm*(1-t)+b.arm*t,links};
  }
  function clip(poly,fn) {const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],av=fn(a),bv=fn(b);if(av>=0)out.push(a);if((av>=0)!==(bv>=0))out.push(interpolate(a,b,av/(av-bv)));}return out;}
  function garment(name,fn,mats,select) {
    const ps=[],ns=[],ids=[],ws=[],groups=[];
    const shellOffset=name==="SkinBody"?0:name==="TopHem"||name==="Waistband"?.006:.004;
    function vertex(o,offset) {ps.push(...o.p.clone().addScaledVector(o.n,offset).toArray());ns.push(...o.n.toArray());for(let j=0;j<4;j++){ids.push(o.links[j]?.[0]??0);ws.push(o.links[j]?.[1]??0);}}
    for(const triangle of triangles) {
      let poly=triangle.map(i=>vertices[i]);for(const plane of fn.planes??[fn])poly=clip(poly,plane);if(poly.length<3)continue;
      for(let i=1;i<poly.length-1;i++) {const pts=[poly[0],poly[i],poly[i+1]],center=pts.reduce((p,o)=>p.add(o.p),new Vector3()).divideScalar(3);const mat=select(center);groups.push([ps.length/3,3,mat]);pts.forEach(o=>vertex(o,shellOffset));}
      if(name!=="SkinBody")for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length];if(Math.abs(fn(a))<0.0001&&Math.abs(fn(b))<0.0001){groups.push([ps.length/3,6,Math.min(1,mats.length-1)]);for(const [o,d] of [[a,shellOffset],[b,shellOffset],[a,.0005],[b,shellOffset],[b,.0005],[a,.0005]])vertex(o,d);}
      }
    }
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(ps,3));g.setAttribute("normal",new Float32BufferAttribute(ns,3));g.setAttribute("skinIndex",new Uint16BufferAttribute(ids,4));g.setAttribute("skinWeight",new Float32BufferAttribute(ws,4));
    // Group by material into indexed runs to keep draw calls bounded.
    const indices=[];mats.forEach((_,mat)=>{const start=indices.length;for(const [offset,count,m]of groups)if(m===mat)for(let i=0;i<count;i++)indices.push(offset+i);g.addGroup(start,indices.length-start,mat);});g.setIndex(indices);
    const mesh=new SkinnedMesh(mergeVertices(g,0.00001),mats);mesh.name=name;model.add(mesh);model.updateMatrixWorld(true);mesh.bind(new Skeleton(skeleton.bones,skeleton.boneInverses.map(m=>m.clone())));
  }
  garment("SkinBody",intersection(o=>0.602-o.p.y,o=>o.p.y>.548?Math.min(.039-Math.abs(o.p.x),.15-o.p.z):1),[skin],()=>0);
  const panelValue=o=>Math.abs(o.p.x)-(female?.112:.103+Math.max(0,.49-o.p.y)*.3);
  garment("CoralTop",intersection(topValue,o=>-panelValue(o)),[female?coral:cream],()=>0);
  garment("TopSidePanels",intersection(topValue,panelValue),[female?cream:coral],()=>0);
  garment("TealSwimShorts",intersection(shortsValue,o=>female?.151-Math.abs(o.p.x):1),[teal],()=>0);
  if(female)garment("ShortsSideTrim",intersection(shortsValue,o=>Math.abs(o.p.x)-.151),[cream],()=>0);
  // Narrow hem bands are separate skinned geometry with their own physical edge.
  garment("TopHem",intersection(topValue,o=>topBottom+0.006-o.p.y),[cream],()=>0);
  garment("Waistband",intersection(shortsValue,o=>o.p.y-shortTop+0.008),[female?cream:teal],()=>0);

  const head=boneMap.get("head");
  const face=new Group();face.name="AnimeFace";head.add(face);
  const profile=[[-.083,.003,.087,.064],[-.073,.025,.111,.015],[-.055,.045,.129,-.005],[-.025,.065,.136,-.025],[.015,.075,.138,-.04],[.05,.078,.133,-.041],[.085,.074,.12,-.031],[.12,.056,.096,-.007],[.146,.023,.063,.024],[.15,.001,.043,.041]];
  function rowAt(y) {
    let i=0;while(i<profile.length-2&&profile[i+1][0]<y)i++;
    const a=profile[i],b=profile[i+1],previous=profile[Math.max(0,i-1)],next=profile[Math.min(profile.length-1,i+2)],span=b[0]-a[0],t=clamp((y-a[0])/span);
    return a.map((n,j)=>j===0?y:(2*t**3-3*t*t+1)*n+(t**3-2*t*t+t)*(b[j]-previous[j])/(b[0]-previous[0])*span+(-2*t**3+3*t*t)*b[j]+(t**3-t*t)*(next[j]-n)/(next[0]-a[0])*span);
  }
  function faceZ(x,y) {const r=rowAt(y),xn=clamp(Math.abs(x)/r[1]);const z=(r[2]+r[3])/2+(r[2]-r[3])/2*Math.sqrt(1-xn*xn);return z+0.013*Math.exp(-((x/.010)**2+((y+.013)/.026)**2));}
  const rows=[];for(let i=0;i<=80;i++){const y=-.083+.233*i/80,r=rowAt(y);rows.push(t=>{const angle=t*Math.PI*2,x=Math.sin(angle)*r[1]*(female?.98:1),c=Math.cos(angle);let z=(r[2]+r[3])/2+(r[2]-r[3])/2*c;if(c>0)z=faceZ(x,y);return v(x,y,z);});}
  const headMesh=add(face,"SculptedAnimeHead",surface(rows),skin);headMesh.material.side=DoubleSide;
  const white=material("EyeWhite","#fff9ed"),iris=material("Iris",female?"#397b80":"#4c6476"),pupil=material("Pupil","#182939"),shine=material("EyeGlint","#ffffff"),lip=material("LipLine","#a86f67");
  for(const side of [-1,1]) {
    ellipsoid(face,`Ear_${side}`,v(side*.078,-.006,.032),v(.012,.025,.014),skin);
    const cx=side*.034,cy=.027,rx=female?.025:.024,ry=female?.0115:.0085;
    function eyePoint(t,s=1){const a=t*Math.PI*2,x=cx+rx*Math.cos(a)*s,y=cy+ry*Math.sin(a)*s+side*(x-cx)*.10;return v(x,y,faceZ(x,y)+.0018+.001*(1-s));}
    const erows=[];for(let i=0;i<=8;i++)erows.push(t=>eyePoint(t,Math.max(.0001,i/8)));
    add(face,`EyeWhite_${side}`,surface(erows,48),white).material.side=DoubleSide;
    const eyeZ=faceZ(cx,cy)+.003;
    ellipsoid(face,`Iris_${side}`,v(cx,cy,eyeZ),v(.0072,ry*.91,.0016),iris);
    ellipsoid(face,`Pupil_${side}`,v(cx,cy,eyeZ+.0015),v(.0032,ry*.75,.0009),pupil);
    ellipsoid(face,`Glint_${side}`,v(cx-.002,cy+.0035,eyeZ+.0024),v(.0022,.0022,.0006),shine);
    const upper=[],lower=[];for(let i=0;i<=12;i++){const p=eyePoint(i/24);p.z+=.0008;upper.push(p);const q=eyePoint(.5+i/24);q.z+=.0005;lower.push(q);}
    line(face,`UpperLid_${side}`,upper,female?.0012:.0010,dark);line(face,`LowerLid_${side}`,lower,.00045,lip);
    const brow=[];for(let i=0;i<=8;i++){const x=cx-rx+2*rx*i/8,y=cy+.024+side*(x-cx)*.10+Math.sin(i/8*Math.PI)*.002;brow.push(v(x,y,faceZ(x,y)+.002));}line(face,`Brow_${side}`,brow,.0016,hairMat);
  }
  const mouthPoints=[];for(let i=0;i<=12;i++){const x=-.016+i/12*.032,y=-.053+(female?.0015:0)*Math.sin(i/12*Math.PI);mouthPoints.push(v(x,y,faceZ(x,y)+.002));}line(face,"MouthLine",mouthPoints,.0009,lip);
  line(face,"NoseDetail",[v(.003,-.021,faceZ(.003,-.021)+.001),v(.005,-.027,faceZ(.005,-.027)+.001),v(.001,-.028,faceZ(.001,-.028)+.001)],.00045,lip);
  // The breathing controller samples this exact mouth surface anchor.
  model.updateMatrixWorld(true);const lips=boneMap.get("oris01"),mouthWorld=head.localToWorld(v(0,-.053,faceZ(0,-.053)));lips.position.copy(lips.parent.worldToLocal(mouthWorld));

  const hair=new Group();hair.name="PreviewHair";hair.userData.previewOnly=true;head.add(hair);
  const hairRows=[];for(let i=0;i<=32;i++)hairRows.push(t=>{if(i===0)return v(0,.162,.04);const a=t*Math.PI*2,front=Math.cos(a),bottom=front>0?.072:(female?-.047:.001),y=.160-(.160-bottom)*i/32,r=rowAt(Math.min(.149,y-.007));return v(Math.sin(a)*(r[1]+.005),y,.039+Math.cos(a)*(.097*Math.sin(Math.acos(clamp((y-.041)/.120,-1,1)))));});
  add(hair,"HairCrown",surface(hairRows),hairMat).material.side=DoubleSide;
  function lock(name,points,width,mat=hairMat) {
    const path=new CatmullRomCurve3(points),p=[],idx=[];
    for(let i=0;i<=24;i++){const t=i/24,c=path.getPoint(t),tangent=path.getTangent(t),out=v(c.x,.025,c.z-.035).normalize(),across=new Vector3().crossVectors(tangent,out).normalize();const w=width*Math.pow(Math.sin(Math.PI*(.09+t*.91)),.65);
      for(let j=0;j<=6;j++){const u=j/6*2-1,q=c.clone().addScaledVector(across,w*u).addScaledVector(out,.0035*(1-u*u));p.push(...q.toArray());}
      if(i)for(let j=0;j<6;j++){const a=(i-1)*7+j,b=i*7+j;idx.push(a,b,a+1,b,b+1,a+1);}}
    const g=new BufferGeometry();g.setAttribute("position",new Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();add(hair,name,g,mat).material.side=DoubleSide;
  }
  for(let i=0;i<12;i++) {
    const x=-.076+i*.0138,endX=x+(female?.024:-.012),endY=(female?.025:.038)+Math.abs(x)*.12+(i%3-1)*.008;
    lock(`Fringe_${i}`,[v(x*.45+.022,.153,.069),v(x*.7+.012,.116,.116),v(x+.004,.077,.136),v(endX,endY,.140-Math.abs(endX)*.30)],female?.014:.011,i===2||i===8?hairLight:hairMat);
  }
  for(const side of [-1,1])for(let i=0;i<8;i++){
    const a=side*(.9+i*.31),endY=female?-.066:-.008;
    lock(`SideLock_${side}_${i}`,[v(Math.sin(a)*.047,.139,.04+Math.cos(a)*.065),v(Math.sin(a)*.080,.074,.04+Math.cos(a)*.098),v(Math.sin(a)*.083,.016,.04+Math.cos(a)*.087),v(Math.sin(a)*.074,endY+(i%3)*.006,.04+Math.cos(a)*.075)],female?.018:.011,i===5?hairLight:hairMat);
  }
  const capGroup=new Group();capGroup.name="SwimEquipment";capGroup.userData.swimOnly=true;head.add(capGroup);
  const capMat=material("SiliconeCap",female?"#e88777":"#294d5e");
  const capRows=[];for(let i=0;i<=32;i++)capRows.push(t=>{const a=t*Math.PI*2,end=1.85-Math.max(0,Math.cos(a))*.56,theta=.001+end*i/32;return v(.083*Math.sin(theta)*Math.sin(a),.042+.116*Math.cos(theta),.038+.103*Math.sin(theta)*Math.cos(a));});
  add(capGroup,"FittedRaceCap",surface(capRows),capMat).material.side=DoubleSide;
  const edge=[];for(let i=0;i<=64;i++)edge.push(capRows[32](i/64));line(capGroup,"CapRim",edge,.0015,capMat);
  const lensMat=material("GoggleLens","#5c9daf"),rimMat=material("GoggleFrame","#29434c");
  for(const side of [-1,1]){ellipsoid(capGroup,`RaceLens_${side===1?"L":"R"}`,v(side*.034,.027,.145),v(.030,.019,.010),lensMat);const rim=add(capGroup,`GoggleRim_${side}`,new TorusGeometry(1,.07,6,36),rimMat);rim.position.set(side*.034,.027,.147);rim.scale.set(.031,.020,.017);}
  line(capGroup,"GoggleBridge",[v(-.01,.03,.148),v(0,.035,.156),v(.01,.03,.148)],.002,rimMat);
  const strap=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;strap.push(v(.086*Math.sin(a),.028,.038+.108*Math.cos(a)));}line(capGroup,"GoggleStrap",strap,.0025,rimMat);
  // Export both modes; visibility is selected on each cloned runtime instance.
  model.updateMatrixWorld(true);
  const binary=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:false});
  const file=`src/ocean/assets/swimmer-${female?"female":"male"}.glb`;await writeFile(file,Buffer.from(binary));
  console.log(JSON.stringify({file,bytes:binary.byteLength,bones:bones.length,style:model.userData.characterStyle}));
}
await build(false);await build(true);
