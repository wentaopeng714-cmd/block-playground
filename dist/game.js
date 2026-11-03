import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {COLORS,key,occupancy} from './world.js?v=12.0';
import {MODULES,DIFFICULTIES,moduleMeta,moduleOffers,moduleBlueprint,makeRoute,appendModule,serializeRoute,validateRoute} from './segments.js?v=12.0';
import {mechanismPose,stepDynamicPlayer,reachedCheckpoint,createMechanismState,resetMechanismState} from './mechanisms.js?v=12.0';
import {BIOMES,biomeMaterialColors,touchesBiomeHazard} from './biomes.js?v=12.0';
import {createGrowth,serializeGrowth,mergeGrowth,growthStatus,refillShield,shieldImpact,resourcePickups,collectNearby} from './progression.js?v=12.0';

import {createShieldMaterial,createVisualEffects} from './effects.js?v=12.0';

import {installTouchControls} from './touch-controls.js?v=12.0';

const $=id=>document.getElementById(id);
const ICONS={
  menu:'M4 6h16M4 12h16M4 18h16',
  gem:'m12 3 8 7-8 11L4 10l8-7ZM4 10h16M8 6l4 15 4-15',
  shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
  check:'m5 12 4 4L19 6',
  pen:'m16 3 5 5M4 20l4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Z',
  blocks:'m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9',
  play:'m9 5 11 7-11 7V5Z',
  help:'M9.1 9a3 3 0 1 1 5.5 1.6c-.8.7-2.6 1.2-2.6 3.4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  download:'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',
  upload:'M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4',
  eraser:'m15 3 6 6-11 11H6l-4-4L15 3ZM8 10l6 6M10 20h11',
  pin:'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  flag:'M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0',
  focus:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8',
  undo:'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12',
  redo:'m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
  plus:'M12 5v14M5 12h14',minus:'M5 12h14',
  layout:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  camera:'M8 6 10 3h4l2 3h5v14H3V6h5Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  search:'M16 16 21 21M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  rotate:'M3 9a9 9 0 1 1 0 6M3 3v6h6',
  flip:'M12 3v18M4 7l5 5-5 5V7Zm16 0-5 5 5 5V7Z',
  close:'m6 6 12 12M6 18 18 6',restart:'M3 10a9 9 0 1 1 1 7M3 4v6h6',
  jump:'M12 19V5m-5 5 5-5 5 5M5 21h14',
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]||ICONS.blocks}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
const STORAGE='block-playground-route-v2';
const GROWTH_STORAGE='block-playground-growth-v1';
function randomSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}
function freshRoute(empty=false){const seed=randomSeed();return makeRoute(empty?[]:[{kind:'mix',seed:(seed^0x2e5a15)>>>0,level:1,layout:'bend',biome:'forest',features:1,variety:1,terrain:0}],undefined,seed);}
let world,storageAvailable=true;
try{const saved=localStorage.getItem(STORAGE);world=saved?validateRoute(JSON.parse(saved)):freshRoute();}catch{world=freshRoute();}
let growth;try{const saved=localStorage.getItem(GROWTH_STORAGE);growth=createGrowth(saved?JSON.parse(saved):null);}catch{growth=createGrowth();}
let occupied=occupancy(world),mode='build',offers=[];
let undo=[],redo=[],saveTimeout,toastTimeout,audio;
let blockMesh,capacity=0;
let lastTime=performance.now(),accumulator=0,runTime=0,jumps=0,falls=0,won=false;
let player=null,cameraYaw=0,cameraPitch=.4,movingPhase=0;
let mechanismTime=0,checkpointIndex=-1,safeUntil=0,mechanismVisuals=[];
let mechanismState=createMechanismState();
let pickups=[],pickupMesh=null,pickupRings=null,shieldFlashUntil=0,growthGainTimeout,upgradeTimeout;
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
const keys=new Set(),touchMove={x:0,z:0};let touchJump=false;
const isTouch=()=>matchMedia('(pointer:coarse)').matches;
const mobileLayout=()=>innerWidth<=850||(innerWidth<=1024&&innerHeight<=600);
const showTouchControls=()=>isTouch()||mobileLayout();
document.body.classList.toggle('mobile-layout',mobileLayout());
document.body.classList.toggle('is-landscape',innerWidth>innerHeight);
function closeTools(){document.body.classList.remove('tools-open');$('toolsBtn').setAttribute('aria-expanded','false');$('toolsScrim').hidden=true;}
function resetTouchInput(){touchControls.reset();keys.clear();down=null;}


function toast(message,kind='check'){$('toastMessage').textContent=message;$('toastIcon').innerHTML=icon(kind);$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
function sound(kind){
  try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);const t=audio.currentTime;const tone={place:550,erase:240,jump:400,fall:180,win:740,pickup:860,craft:690,shield:980}[kind]||400;o.type='sine';o.frequency.setValueAtTime(tone,t);o.frequency.exponentialRampToValueAtTime(tone*(kind==='fall'?.5:1.4),t+.11);g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.0001,t+.14);o.start();o.stop(t+.15);}catch{}
}
function saveNow(){
  try{localStorage.setItem(STORAGE,JSON.stringify(serializeRoute(world)));localStorage.setItem(GROWTH_STORAGE,JSON.stringify(serializeGrowth(growth)));storageAvailable=true;$('saveStatus').innerHTML='<i></i> 已保存到本机';}
  catch{storageAvailable=false;$('saveStatus').textContent='本机存储不可用，请导出';}
}
function saveSoon(){$('saveStatus').textContent='正在保存…';clearTimeout(saveTimeout);saveTimeout=setTimeout(saveNow,450);}
function history(){undo.push(JSON.stringify(serializeRoute(world)));if(undo.length>35)undo.shift();redo=[];updateHistory();}
function updateHistory(){$('undoBtn').disabled=!undo.length;$('redoBtn').disabled=!redo.length;}
function doUndo(){if(mode!=='build'||!undo.length)return;redo.push(JSON.stringify(serializeRoute(world)));world=validateRoute(JSON.parse(undo.pop()));rebuild();showAll();focusLatest();saveSoon();toast('已撤销');}
function doRedo(){if(mode!=='build'||!redo.length)return;undo.push(JSON.stringify(serializeRoute(world)));world=validateRoute(JSON.parse(redo.pop()));rebuild();showAll();focusLatest();saveSoon();toast('已重做');}

const scene=new THREE.Scene();
scene.fog=new THREE.Fog('#d6e7f2',150,340);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(error){$('loading').innerHTML='<strong>暂时无法开启三维场景</strong><small>请使用支持 WebGL 的浏览器，并开启硬件加速后重试。</small>';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,mobileLayout()?1.5:2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.setClearColor(0x000000,0);$('viewport').append(renderer.domElement);
const fx=createVisualEffects(THREE,scene,{reducedMotion,pixelRatio:renderer.getPixelRatio()});
const fxFocus=new THREE.Vector3();
const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','三维拼接场景。点击下方四张卡片自动接上一段场景，拖动可以观察。');
const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,300);
camera.setViewOffset(innerWidth,innerHeight,0,Math.min(80,innerHeight*.085),innerWidth,innerHeight);
const runCamera=new THREE.PerspectiveCamera(61,innerWidth/innerHeight,.1,240);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=8;controls.maxDistance=155;controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.12;controls.target.set(0,3,-2);controls.panSpeed=.75;controls.rotateSpeed=.65;
const sun=new THREE.DirectionalLight('#fff4e6',3.1);sun.position.set(-25,55,15);sun.castShadow=true;sun.shadow.mapSize.set(mobileLayout()?1024:2048,mobileLayout()?1024:2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:140});sun.shadow.bias=-.0003;sun.shadow.normalBias=.045;scene.add(sun);const skyLight=new THREE.HemisphereLight('#f1f8ff','#bac5de',2.3);scene.add(skyLight);
const ground=new THREE.Mesh(new THREE.BoxGeometry(80,.3,80),new THREE.MeshStandardMaterial({color:'#e3eaf2',roughness:1}));ground.position.y=-.24;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(80,80,'#b7c8d9','#c9d6e2');grid.position.y=-.075;grid.material.transparent=true;grid.material.opacity=.65;scene.add(grid);
const border=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(80,.3,80)),new THREE.LineBasicMaterial({color:'#c5d5e2',transparent:true,opacity:.6}));border.position.copy(ground.position);scene.add(border);

const cubeGeometry=new THREE.BoxGeometry(.976,.976,.976);
const blockMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.65,metalness:0});
const tempMatrix=new THREE.Matrix4(),tempColor=new THREE.Color();
const markerGroup=new THREE.Group();scene.add(markerGroup);
const mechanismGroup=new THREE.Group();scene.add(mechanismGroup);
const biomeGroup=new THREE.Group();scene.add(biomeGroup);let biomeParticles=null,biomeParticleData=[],biomePools=[],currentBiome;
const pickupGroup=new THREE.Group();scene.add(pickupGroup);const pickupDummy=new THREE.Object3D();
let flagCloth;

function material(color){return new THREE.MeshStandardMaterial({color,roughness:.8});}
function meshBox(w,h,d,color,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
function makeAvatar(){
  const g=new THREE.Group();
  const body=meshBox(.43,.57,.28,'#528bea',0,.92,0),head=meshBox(.45,.44,.43,'#efbf9a',0,1.43,0),hair=meshBox(.48,.15,.46,'#514439',0,1.65,.015);g.add(body,head,hair);
  g.add(meshBox(.46,.21,.12,'#514439',0,1.51,.19));
  const limbs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.31,1.13,0);arm.add(meshBox(.16,.25,.23,'#528bea',0,-.1,0),meshBox(.15,.24,.21,'#efbf9a',0,-.34,0));g.add(arm);
    const leg=new THREE.Group();leg.position.set(side*.115,.65,0);leg.add(meshBox(.19,.48,.24,'#3b465e',0,-.23,0),meshBox(.2,.14,.32,'#f5f7fb',0,-.56,-.025));g.add(leg);limbs.push(arm,leg);
  }
  for(const side of [-1,1])g.add(meshBox(.045,.05,.012,'#344155',side*.1,1.44,-.221));
  g.userData.limbs=limbs;return g;
}
const avatar=makeAvatar();scene.add(avatar);
const helmet=new THREE.Group();helmet.add(meshBox(.53,.12,.5,'#68dcd0',0,1.74,0),meshBox(.54,.08,.12,'#e4ffeb',0,1.64,-.24));avatar.add(helmet);
const shieldVisual=new THREE.Group();shieldVisual.position.y=.9;avatar.add(shieldVisual);
const shieldShell=new THREE.Mesh(new THREE.SphereGeometry(1.02,32,20),createShieldMaterial(THREE));shieldShell.scale.set(.8,1.08,.8);shieldVisual.add(shieldShell);
const shieldHalo=new THREE.Mesh(new THREE.RingGeometry(.67,.71,48),new THREE.MeshBasicMaterial({color:'#75dece',transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}));shieldHalo.rotation.x=-Math.PI/2;shieldHalo.position.y=-.86;shieldVisual.add(shieldHalo);
const avatarShadow=new THREE.Mesh(new THREE.CircleGeometry(.5,24),new THREE.MeshBasicMaterial({color:'#44526a',transparent:true,opacity:.13,depthWrite:false}));avatarShadow.rotation.x=-Math.PI/2;scene.add(avatarShadow);

function label(text,color){const c=document.createElement('canvas');c.width=256;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='rgba(255,255,255,.93)';ctx.beginPath();ctx.roundRect(22,12,212,66,26);ctx.fill();ctx.fillStyle=color;ctx.font='600 33px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,46);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));sprite.scale.set(3.2,1.2,1);sprite.renderOrder=3;return sprite;}
function disposeTree(g){g.traverse(o=>{if(o.isMesh||o.isSprite){if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.map?.dispose();m.dispose();}}});}
function updateGrowthUI(){
  const status=growthStatus(growth),fill=(name,value)=>document.querySelectorAll(`[data-growth-${name}]`).forEach(e=>e.textContent=value);
  fill('material',status.materials);fill('gear',status.level?`护盾 Lv${status.level}`:'护盾未制作');fill('charge',status.level?`保护 ${status.charges}/${status.level}`:'顺路收材料');
  fill('hint',status.max?`强化完成 · 每段 ${status.level} 次保护`:status.level?`再收 ${status.remaining} 块，自动升级 Lv${status.level+1}`:`顺路收集 · 再收 ${status.remaining} 块自动制盾`);
  fill('ratio',status.max?'MAX':`${status.materials} / ${status.cost}`);
  document.querySelectorAll('[data-shield-pips]').forEach(e=>e.innerHTML=Array.from({length:Math.max(1,status.level)},(_,i)=>`<i class="${i<status.charges?'charged':''}">${icon('shield')}</i>`).join(''));
  document.querySelectorAll('[data-growth-progress]').forEach(e=>e.style.width=`${status.progress*100}%`);
}
function rebuildPickups(){
  disposeTree(pickupGroup);pickupGroup.clear();pickups=resourcePickups(world);pickupMesh=pickupRings=null;
  if(!pickups.length)return;
  pickupMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.32,0),new THREE.MeshStandardMaterial({color:'#ffd36e',emissive:'#b98022',emissiveIntensity:.32,roughness:.25,metalness:.12}),pickups.length);
  pickupRings=new THREE.InstancedMesh(new THREE.TorusGeometry(.4,.014,6,20),new THREE.MeshBasicMaterial({color:'#fff3bf',transparent:true,opacity:.58,depthWrite:false}),pickups.length);
  pickupMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);pickupRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);pickupGroup.add(pickupMesh,pickupRings);
  animatePickups(0);pickupMesh.computeBoundingSphere();pickupRings.computeBoundingSphere();
}
function animatePickups(time){
  if(!pickupMesh)return;
  pickups.forEach((q,i)=>{
    const visible=!growth.collected.has(q.id);pickupDummy.scale.setScalar(visible?1:0);pickupDummy.position.set(q.x,q.y+Math.sin(time*2.5+i)*.1,q.z);pickupDummy.rotation.set(.2,time*.9+i*.7,.15);pickupDummy.updateMatrix();pickupMesh.setMatrixAt(i,pickupDummy.matrix);
    pickupDummy.position.y=q.floorY+.035;pickupDummy.rotation.set(Math.PI/2,0,0);pickupDummy.updateMatrix();pickupRings.setMatrixAt(i,pickupDummy.matrix);
  });
  pickupMesh.instanceMatrix.needsUpdate=true;pickupRings.instanceMatrix.needsUpdate=true;
}
function updateGrowthVisuals(){
  const level=growth.level,active=mode==='build'?level>0:growth.charges>0,flash=Math.max(0,shieldFlashUntil-mechanismTime),color=['#77d8ce','#77d8ce','#78b7ff','#ffd166'][level];
  helmet.visible=level>0;helmet.children[0].material.color.set(color);shieldVisual.visible=level>0&&(active||flash>0);
  shieldShell.material.uniforms.tint.value.set(color);shieldShell.material.uniforms.strength.value=(active?.75:.12)+flash*1.4;shieldShell.material.uniforms.time.value=reducedMotion?0:mechanismTime;
  shieldHalo.material.color.set(color);shieldHalo.material.opacity=(active?.4:.05)+Math.min(.5,flash);shieldVisual.scale.setScalar(1+Math.min(.15,flash*.12));
}
function showUpgrade(event){
  $('upgradeEyebrow').textContent=event.level===1?'AUTOMATIC CRAFT':'SHIELD UPGRADED';
  $('upgradeTitle').textContent=event.level===1?'护盾制作完成':'护盾强化完成';
  $('upgradeDetail').textContent=`消耗 ${event.spent} 块材料 · 每段可抵挡 ${event.level} 次机关`;
  $('upgradeLevel').textContent=`0${event.level}`;
  const note=$('upgradeNote');note.style.setProperty('--upgrade-color',['','#58bda9','#6ba9eb','#dbb34e'][event.level]);note.classList.remove('visible');void note.offsetWidth;note.classList.add('visible');
  clearTimeout(upgradeTimeout);upgradeTimeout=setTimeout(()=>note.classList.remove('visible'),3600);
}
function gatherMaterials(){
  const event=collectNearby(growth,pickups,player);if(!event.collected.length)return;
  event.collected.forEach(q=>fx.pickup(q));
  const gain=$('growthGain');gain.textContent=`+${event.collected.length} 材料`;gain.classList.add('visible');clearTimeout(growthGainTimeout);growthGainTimeout=setTimeout(()=>gain.classList.remove('visible'),1000);
  if(event.upgraded){shieldFlashUntil=mechanismTime+1;fx.craft({x:player.x,y:player.y+.9,z:player.z},['','#77d8ce','#78b7ff','#ffd166'][event.level]);showUpgrade(event);sound('craft');}
  else sound('pickup');updateGrowthUI();saveSoon();
}
function handleHazard(hit){
  if(!hit||mechanismTime<=safeUntil)return;
  const outcome=shieldImpact(growth,mechanismTime);
  if(outcome==='blocked'){shieldFlashUntil=mechanismTime+.6;fx.shield({x:player.x,y:player.y+.9,z:player.z},['','#77d8ce','#78b7ff','#ffd166'][growth.level]);sound('shield');updateGrowthUI();toast(`护盾挡住了机关 · 本段还剩 ${growth.charges} 次保护`,'shield');return;}
  if(outcome==='protected')return;
  failRun(({gate:'碰到闸门了，等绿灯再通过',sweeper:'碰到横杆了，看准时机跳过去',pendulum:'碰到摆锤了，等它荡开再通过',spikes:'碰到尖刺了，起跳或等它收起',log:'被滚木碰到了，提前起跳越过',fire:'碰到火焰了，等熄火再通过',crusher:'碰到压柱了，等它完全抬起'})[hit.type]||'回到本段存档点，再试一次');
}
function setBiomeLook(id){
  if(currentBiome===id)return;currentBiome=id;const t=BIOMES[id];
  document.body.dataset.biome=id||'original';document.body.style.background=t?`linear-gradient(165deg,${t.sky[0]},${t.sky[1]})`:'';
  scene.fog.color.set(t?.fog||'#d6e7f2');sun.color.set(t?.sun||'#fff4e6');skyLight.color.set(t?.sky[1]||'#f1f8ff');renderer.toneMappingExposure=id==='lava'?1.02:1.12;
}
function rebuildBiomeScenery(){
  if(biomeParticles){biomeParticles.geometry.dispose();biomeParticles.material.dispose();biomeGroup.remove(biomeParticles);biomeParticles=null;}
  disposeTree(biomeGroup);biomeGroup.clear();biomeParticleData=[];biomePools=[];
  const luminous=world.pieces.filter(p=>p.color===22||p.color===23).flatMap(p=>p.cells.map(cell=>({cell,color:p.color})));
  if(luminous.length){
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.978,.978,.978),new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ff641f',emissiveIntensity:.55,roughness:.7}),luminous.length);
    luminous.forEach((p,i)=>{tempMatrix.makeTranslation(p.cell[0]+.5,p.cell[1]+.5,p.cell[2]+.5);mesh.setMatrixAt(i,tempMatrix);mesh.setColorAt(i,tempColor.set(COLORS[p.color]));});mesh.castShadow=true;mesh.computeBoundingSphere();biomeGroup.add(mesh);
  }
  const positions=[],colors=[];
  for(const e of world.effects){
    const theme=BIOMES[e.biome];let n=e.seed>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    if(e.biome!=='desert'||e.water){
      const lava=e.biome==='lava',snow=e.biome==='snow',mat=new THREE.MeshStandardMaterial({color:lava?'#ff8a35':snow?'#79bddb':'#4caaa0',emissive:lava?'#f86b16':'#000000',emissiveIntensity:lava?.8:0,roughness:snow?.25:.55,metalness:snow?.12:0,transparent:true,opacity:lava?.9:.66,side:THREE.DoubleSide});
      const pool=new THREE.Mesh(new THREE.PlaneGeometry(e.width,e.depth),mat);pool.rotation.x=-Math.PI/2;pool.position.set(e.center[0]+.5,e.center[1]+.02,e.center[2]+.5);biomeGroup.add(pool);if(lava)biomePools.push(pool);
    }
    for(let i=0;i<48;i++){
      const p={x:e.center[0]+.5+(random()-.5)*(e.width+12),y:e.center[1]+2+random()*e.height,z:e.center[2]+.5+(random()-.5)*(e.depth+12),phase:random()*Math.PI*2,offset:random()*e.height,e};
      biomeParticleData.push(p);positions.push(p.x,p.y,p.z);tempColor.set(theme.mote);colors.push(tempColor.r,tempColor.g,tempColor.b);
    }
  }
  if(positions.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));biomeParticles=new THREE.Points(geo,new THREE.PointsMaterial({size:.14,vertexColors:true,transparent:true,opacity:.78,depthWrite:false}));biomeGroup.add(biomeParticles);}
}
function animateBiomeScenery(time){
  if(biomeParticles){const positions=biomeParticles.geometry.attributes.position;
    biomeParticleData.forEach((p,i)=>{const snow=p.e.biome==='snow',lava=p.e.biome==='lava';const y=snow?p.e.center[1]+2+p.e.height-((p.offset+time*.9)%p.e.height):lava?p.e.center[1]+2+((p.offset+time*1.1)%p.e.height):p.y+Math.sin(time*.8+p.phase)*.4;positions.setXYZ(i,p.x+Math.sin(time*.5+p.phase)*(snow?.6:.25),y,p.z+Math.cos(time*.4+p.phase)*.2);});positions.needsUpdate=true;
  }
  for(const p of biomePools)p.material.emissiveIntensity=.7+Math.sin(time*1.7)*.12;
}
function rebuildMechanisms(){
  disposeTree(mechanismGroup);mechanismGroup.clear();mechanismVisuals=[];
  for(const m of world.mechanisms){
    const g=new THREE.Group(),theme=biomeMaterialColors(m.biome),danger=theme?.danger||'#ef786e',accent=theme?.accent||'#ffd155',metal=theme?.metal||'#354b69',deck=theme?.deck||'#6daaf5';let indicator=null;
    if(m.type==='log'){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(m.radius,m.radius,m.depth,12),material('#916441'));trunk.rotation.x=Math.PI/2;trunk.castShadow=true;g.add(trunk);
      for(let i=0;i<8;i++){const angle=i*Math.PI/4;g.add(meshBox(.08,.08,m.depth+.015,'#634b32',Math.cos(angle)*.49,Math.sin(angle)*.49,0));}
      for(const z of [-m.depth/2-.015,m.depth/2+.015]){
        const cap=new THREE.Mesh(new THREE.CircleGeometry(m.radius*.94,12),new THREE.MeshStandardMaterial({color:'#d4ac73',side:THREE.DoubleSide}));cap.position.z=z;g.add(cap);
        for(const radius of [.19,.35]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.025,radius,16),new THREE.MeshBasicMaterial({color:'#956e46',side:THREE.DoubleSide}));ring.position.z=z+Math.sign(z)*.006;g.add(ring);}
      }
      indicator=new THREE.Mesh(new THREE.SphereGeometry(.16,10,10),new THREE.MeshBasicMaterial({color:'#e7b34f'}));indicator.position.set(m.x,m.y+1.6,m.z+2.9);mechanismGroup.add(indicator);
    }else if(m.type==='ice'){
      const sheet=new THREE.Mesh(new THREE.PlaneGeometry(m.width,m.depth),new THREE.MeshStandardMaterial({color:'#b6f0ff',roughness:.08,metalness:.18,transparent:true,opacity:.4,side:THREE.DoubleSide}));sheet.rotation.x=-Math.PI/2;sheet.position.y=.025;g.add(sheet);
      for(let x=-3;x<=3;x+=2)for(const z of [-2,0,2]){const line=meshBox(1.2,.012,.035,'#ecfcff',x,.04,z);line.rotation.y=-.35;g.add(line);}
    }else if(m.type==='fire'){
      const vent=meshBox(1.2,.12,3.5,metal,m.x,m.y-.06,m.z);mechanismGroup.add(vent);
      for(let z=-1.25;z<=1.3;z+=.5)mechanismGroup.add(meshBox(.96,.025,.12,'#e99339',m.x,m.y+.015,m.z+z));
      for(const [z,h,r]of [[-1.1,2.8,.42],[0,3.4,.56],[1.1,2.9,.42]]){
        const flame=new THREE.Mesh(new THREE.ConeGeometry(r,h,7),new THREE.MeshStandardMaterial({color:'#ff9b24',emissive:'#fa6012',emissiveIntensity:1.2,transparent:true,opacity:.86}));flame.position.set(0,h/2,z);g.add(flame);
        const core=new THREE.Mesh(new THREE.ConeGeometry(r*.56,h*.7,7),new THREE.MeshBasicMaterial({color:'#fff3a1'}));core.position.set(.02,h*.35,z+.015);g.add(core);
      }
      indicator=new THREE.Mesh(new THREE.SphereGeometry(.17,10,10),new THREE.MeshBasicMaterial({color:'#e8ad48'}));indicator.position.set(m.x,m.y+.3,m.z+2);mechanismGroup.add(indicator);
    }else if(m.type==='crusher'){
      g.add(meshBox(2,3.4,3.8,theme?.frameColor||'#b59671',0,1.7,0));
      for(const y of [.25,1.1,2.2,3.15])g.add(meshBox(2.03,.1,3.83,accent,0,y,0));
      for(const z of [-1.4,1.4])g.add(meshBox(2.04,1.3,.18,metal,0,1.7,z));
      indicator=new THREE.Mesh(new THREE.SphereGeometry(.17,10,10),new THREE.MeshBasicMaterial({color:'#ef786e'}));indicator.position.set(m.x,m.y+4.1,m.z+3.1);mechanismGroup.add(indicator);
    }else if(m.type==='sweeper'){
      const beamLength=m.length??7.4;g.add(meshBox(beamLength,.28,.3,danger));
      for(let x=-beamLength/2+.5;x<beamLength/2-.2;x+=.8)g.add(meshBox(.27,.3,.32,accent,x,0,0));
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,.65,12),material(metal));hub.position.set(m.x,m.y-.28,m.z);hub.castShadow=true;mechanismGroup.add(hub);
      const warning=new THREE.Mesh(new THREE.RingGeometry(3.45,3.6,40),new THREE.MeshBasicMaterial({color:'#ef786e',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));warning.rotation.x=-Math.PI/2;warning.position.set(m.x,m.y-.53,m.z);mechanismGroup.add(warning);
    }else if(m.type==='gate'){
      g.add(meshBox(.42,3.2,5.5,danger,0,1.6,0));
      for(let z=-2.3;z<=2.4;z+=.8)g.add(meshBox(.45,.24,.45,accent,0,.22,z),meshBox(.45,.24,.45,accent,0,2.98,z));
      for(const y of [.8,1.6,2.4])g.add(meshBox(.44,.08,5.35,'#ffffff',0,y,0));
      indicator=new THREE.Mesh(new THREE.SphereGeometry(.18,10,10),new THREE.MeshBasicMaterial({color:'#ef786e'}));indicator.position.set(m.x,m.y+4.1,m.z+3.1);mechanismGroup.add(indicator);
    }else if(m.type==='collapse'){
      g.add(meshBox(1.96,.28,2.94,theme?.deck||'#f8a36d',0,-.14,0));
      for(const z of [-1,-.5,0,.5,1])g.add(meshBox(1.94,.018,.035,'#bd8057',0,.012,z));
      for(const [x,z,angle]of [[-.45,-.4,-.4],[.1,-.15,.5],[.4,.2,-.5]]){const crack=meshBox(.75,.023,.035,metal,x,.02,z);crack.rotation.y=angle;g.add(crack);}
      g.traverse(o=>{if(o.isMesh)o.material.transparent=true;});
    }else if(m.type==='pendulum'){
      const rod=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,m.length,8),material(metal));rod.position.y=-m.length/2;rod.castShadow=true;g.add(rod);
      const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.72,1),material(danger));ball.position.y=-m.length;ball.castShadow=true;g.add(ball);
      g.add(meshBox(.82,.15,.85,accent,0,-m.length,0));
      const joint=new THREE.Mesh(new THREE.SphereGeometry(.18,10,10),material(accent));g.add(joint);
    }else if(m.type==='spikes'){
      const plate=meshBox(.9,.08,3.2,danger,m.x,m.y-.04,m.z);mechanismGroup.add(plate);
      for(const x of [-.1,.1])for(let z=-1.2;z<=1.21;z+=.6){const tip=new THREE.Mesh(new THREE.ConeGeometry(.31,m.height??.65,4),material(theme?.metal||'#506782'));tip.position.set(x,(m.height??.65)/2,z);tip.castShadow=true;g.add(tip);}
      indicator=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),new THREE.MeshBasicMaterial({color:'#ef786e'}));indicator.position.set(m.x,m.y+.14,m.z+1.8);mechanismGroup.add(indicator);
    }else{
      g.add(meshBox(3.2,.35,3,deck,0,-.175,0));
      for(const z of [-1.42,1.42])g.add(meshBox(3.2,.08,.16,accent,0,.015,z));
      for(const x of [-1.5,1.5])g.add(meshBox(.15,.08,3,accent,x,.015,0));
      g.add(meshBox(.75,.18,.75,'#d8e8ff',0,.015,0));
    }
    mechanismGroup.add(g);mechanismVisuals.push({definition:m,group:g,indicator,baseColor:theme?.deck||'#f8a36d'});
  }
  updateMechanismVisuals();
}
function updateMechanismVisuals(){
  for(const v of mechanismVisuals){
    const m=v.definition,p=mechanismPose(m,mechanismTime,mode==='run'?mechanismState:null);
    if(p.type==='pendulum'){v.group.position.set(m.x,m.y,m.z);v.group.rotation.x=-p.angle;}
    else v.group.position.set(p.x,p.y,p.z);
    if(p.type==='sweeper')v.group.rotation.y=-p.angle;
    if(p.type==='log'){v.group.rotation.z=p.angle;v.group.visible=p.active;}
    if(p.type==='fire'){v.group.scale.y=Math.max(.001,p.extension);v.group.visible=p.extension>.01;}
    if(p.type==='collapse'){
      v.group.visible=p.opacity>.01;v.group.position.x+=Math.sin(mechanismTime*45)*.035*p.progress;
      v.group.traverse(o=>{if(o.isMesh)o.material.opacity=p.opacity;});
      v.group.children[0].material.color.set(v.baseColor).lerp(tempColor.set('#ef786e'),p.progress*.9);
    }
    if(p.type==='spikes'){v.group.scale.y=Math.max(.001,p.extension);v.group.visible=p.extension>.01;}
    if(v.indicator)v.indicator.material.color.set(['log','fire'].includes(p.type)?(p.warning?'#efba48':p.active?'#ef786e':'#62d6a3'):(p.type==='spikes'?!p.active:p.open)?'#62d6a3':'#ef786e');
  }
}
function updateChallengeHud(){
  const index=Math.max(0,checkpointIndex),segment=world.segments[index];if(!segment)return;
  const meta=moduleMeta(segment.id);
  const distance=q=>{const u=(player.x-q.entry[0]-.5)*q.dir;return Math.hypot(u-THREE.MathUtils.clamp(u,0,q.length-1),player.z-q.entry[2]-.5,2*(player.y-q.entry[1]-1));};
  const zone=segment.mixed?[...segment.zones].sort((a,b)=>distance(a)-distance(b))[0]:null;
  const kind=zone?.kind||meta.id,zoneMechanisms=world.mechanisms.filter(m=>m.segment===index&&(!zone||m.zone===zone.index));$('difficultyBadge').textContent=DIFFICULTIES[meta.difficulty]+(meta.biomeLabel?' · '+meta.biomeLabel:'');$('difficultyBadge').dataset.level=meta.difficulty;setBiomeLook(segment.biome);
  let hint=meta.hint;
  if(kind==='log'){
    const log=zoneMechanisms[0],pose=log&&mechanismPose(log,mechanismTime);
    hint=pose?.active?'滚木来了，提前起跳越过':'滚木已滚过，趁现在向前';
  }else if(kind==='ice')hint=player.onIce?'冰面会继续滑行，反方向按键刹车':'蓝色冰面会打滑，出口雪地可减速';
  else if(kind==='fire'){
    const fire=zoneMechanisms[0],pose=fire&&mechanismPose(fire,mechanismTime);
    hint=pose?.active?'正在喷火，先在安全平台等一等':pose?.warning?'喷口发亮了，即将喷火':'火焰熄灭，趁现在通过';
  }else if(kind==='crusher'){
    const crusher=zoneMechanisms[0];hint=crusher&&mechanismPose(crusher,mechanismTime).open?'石柱抬起，快速穿过':'先等石柱抬起，再通过';
  }else if(kind==='gate'){
    const gate=zoneMechanisms.sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];
    if(gate)hint=mechanismPose(gate,mechanismTime).open?'绿灯：趁现在通过':'红灯：等闸门抬起再通过';
  }else if(kind==='moving'||kind==='platform')hint=player.supportId?'跟着平台移动，靠岸后再跳下':'登上移动平台，等它载你过断口';
  else if(kind==='collapse')hint=player.supportId?'地板开始松动，继续向前！':'踩过的地板会塌，别停下来';
  else if(kind==='pendulum')hint='等摆锤扫向两侧，再穿过中间';
  else if(kind==='spikes'){
    const spike=zoneMechanisms.sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];
    hint=spike&&!mechanismPose(spike,mechanismTime).active?'尖刺收起了，快速通过':'起跳越过尖刺，或等它收起';
  }
  if(zone&&distance(zone)>3)hint='沿箭头转弯，台阶处跳跃前进';
  $('mechanismHint').textContent=hint;$('checkpointText').textContent=`第 ${index+1} / ${world.modules.length} 段${zone?' · 机关 '+(zone.index+1)+'/'+segment.zones.length:''} · ${checkpointIndex>=0?'本段已存档':'入口自动存档'}`;
}
function rebuildMarkers(){
  disposeTree(markerGroup);markerGroup.clear();
  const start=new THREE.Group();start.position.set(world.spawn.x,world.spawn.y,world.spawn.z);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.62,32),new THREE.MeshBasicMaterial({color:'#44bba6',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.015;start.add(ring);const sl=label('起点','#4d9b91');sl.position.set(0,2.6,0);start.add(sl);markerGroup.add(start);
  const goal=new THREE.Group();goal.position.set(world.goal.x,world.goal.y,world.goal.z);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,2.8,10),material('#e8ba49'));pole.position.y=1.4;pole.castShadow=true;goal.add(pole);
  flagCloth=new THREE.Mesh(new THREE.PlaneGeometry(1.35,.8,7,2),new THREE.MeshStandardMaterial({color:'#ffce47',roughness:.85,side:THREE.DoubleSide}));flagCloth.position.set(.68,2.27,0);flagCloth.castShadow=true;goal.add(flagCloth);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.1,8,8),material('#ffd155'));tip.position.y=2.85;goal.add(tip);
  const gl=label('终点 · 续接处','#ba8e2e');gl.position.set(0,3.7,0);goal.add(gl);goal.visible=world.modules.length>0;markerGroup.add(goal);
  const guides=world.segments.flatMap(s=>s.guides||[]);
  if(guides.length){
    const shape=new THREE.Shape();shape.moveTo(-.4,-.12);shape.lineTo(.05,-.12);shape.lineTo(.05,-.3);shape.lineTo(.43,0);shape.lineTo(.05,.3);shape.lineTo(.05,.12);shape.lineTo(-.4,.12);shape.closePath();
    const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    const arrows=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:'#d9a631',side:THREE.DoubleSide}),guides.length);
    guides.forEach((g,i)=>{tempMatrix.makeRotationY(Math.atan2(-g.dz,g.dx));tempMatrix.setPosition(g.at[0]+.5,g.at[1]+1.025,g.at[2]+.5);arrows.setMatrixAt(i,tempMatrix);});arrows.computeBoundingSphere();markerGroup.add(arrows);
  }
  if(mode==='build'){avatar.position.set(world.spawn.x,world.spawn.y,world.spawn.z);avatar.rotation.y=-Math.PI/2;}
}
function rebuild(){
  occupied=occupancy(world);
  const count=world.pieces.reduce((sum,p)=>sum+p.cells.length,0);
  if(count>capacity||!blockMesh){if(blockMesh){scene.remove(blockMesh);blockMesh.dispose();}capacity=Math.max(16384,count*2);blockMesh=new THREE.InstancedMesh(cubeGeometry,blockMaterial,capacity);blockMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);blockMesh.castShadow=true;blockMesh.receiveShadow=true;scene.add(blockMesh);}
  let i=0;for(const p of world.pieces){if(p.color===22||p.color===23)continue;for(const c of p.cells){tempMatrix.makeTranslation(c[0]+.5,c[1]+.5,c[2]+.5);blockMesh.setMatrixAt(i,tempMatrix);blockMesh.setColorAt(i,tempColor.set(COLORS[p.color]));i++;}}
  blockMesh.count=i;blockMesh.instanceMatrix.needsUpdate=true;if(blockMesh.instanceColor)blockMesh.instanceColor.needsUpdate=true;blockMesh.computeBoundingSphere();blockMesh.computeBoundingBox();
  $('moduleCount').textContent=world.modules.length;$('connectedCount').textContent=`已连接 ${world.modules.length} 段`;$('routeCount').textContent=world.modules.length?`已接好 ${world.modules.length} 段，继续选择下一段`:'点下面的卡片，接上第一段';$('sceneName').value=world.name;updateHistory();rebuildMarkers();rebuildMechanisms();rebuildBiomeScenery();rebuildPickups();updateGrowthUI();setBiomeLook(world.segments.at(-1)?.biome||null);$('playBtn').disabled=$('runMode').disabled=!world.modules.length;renderModules();
}

function showAll(){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=0;
  for(const p of world.pieces)for(const [x,y,z]of p.cells){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);maxY=Math.max(maxY,y+1);}
  const cx=(minX+maxX+1)/2,cz=(minZ+maxZ+1)/2;
  const aspect=innerWidth/innerHeight,s=aspect<.8?1.8:aspect<1.2?1.27:1;
  const span=Math.max(22,(maxX-minX+1)*1.04,(maxZ-minZ+1)*1.04,maxY*1.5);
  controls.maxDistance=Math.max(180,span*5);camera.far=Math.max(300,span*8);camera.updateProjectionMatrix();
  scene.fog.near=Math.max(150,span*4);scene.fog.far=Math.max(340,span*8);
  controls.target.set(cx,Math.max(1,maxY*.44),cz);
  camera.position.copy(controls.target).add(new THREE.Vector3(.76,.68,1.04).multiplyScalar(span*s));controls.update();
  const size=Math.max(60,Math.ceil((Math.max(maxX-minX,maxZ-minZ)+24)/10)*10);
  ground.scale.set(size/80,1,size/80);ground.position.set(cx,-.24,cz);border.scale.copy(ground.scale);border.position.copy(ground.position);
  if(grid.userData.size!==size){const fresh=new THREE.GridHelper(size,size,'#b7c8d9','#c9d6e2');grid.geometry.dispose();grid.geometry=fresh.geometry;fresh.material.dispose();grid.userData.size=size;}
  grid.position.set(cx,-.075,cz);sun.position.set(cx-25,55,cz+15);sun.target.position.set(cx,0,cz);scene.add(sun.target);
  Object.assign(sun.shadow.camera,{left:-size/2,right:size/2,top:size/2,bottom:-size/2});sun.shadow.camera.updateProjectionMatrix();
}
function setBuildViewport(){
  const upper=document.querySelector('.topbar').getBoundingClientRect().bottom+(mobileLayout()?16:24);
  const dock=$('buildDock').getBoundingClientRect(),lower=dock.top-(mobileLayout()?12:16);
  document.body.style.setProperty('--mobile-dock-height',`${dock.height}px`);
  camera.setViewOffset(innerWidth,innerHeight,0,innerHeight/2-(upper+lower)/2,innerWidth,innerHeight);
  return {available:Math.max(96,lower-upper)};
}
function focusLatest(){
  if(!world.segments.length)return;
  const s=world.segments.at(-1),bp=moduleBlueprint(s.id,s.variant,s.entry[1]>=20?-1:1);
  const bounds=new THREE.Box3();
  for(const c of [...bp.cells,...bp.mechanismPreview]){const p=new THREE.Vector3(s.entry[0]+s.dir*c.cell[0]+.5,s.entry[1]+c.cell[1]+.5,s.entry[2]+s.dir*c.cell[2]+.5);bounds.expandByPoint(p);}
  bounds.expandByScalar(2);
  const {available}=setBuildViewport();
  const center=bounds.getCenter(new THREE.Vector3()),toward=new THREE.Vector3(.65,.72,1).normalize(),right=new THREE.Vector3(toward.z,0,-toward.x).normalize(),up=new THREE.Vector3().crossVectors(toward,right);
  const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),aspect=innerWidth/innerHeight;let distance=15;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const d=new THREE.Vector3(x,y,z).sub(center),depth=d.dot(toward);
    distance=Math.max(distance,depth+Math.abs(d.dot(up))/(tan*available/innerHeight),depth+Math.abs(d.dot(right))/(tan*aspect*.82));
  }
  controls.target.copy(center);camera.position.copy(center).addScaledVector(toward,distance*1.04);controls.update();
}
function shade(hex,mul){const c=new THREE.Color(hex);c.multiplyScalar(mul);return '#'+c.getHexString();}
function moduleSvg(id){
  const blueprint=moduleBlueprint(id);const allCells=[...blueprint.cells,...blueprint.mechanismPreview],solid=new Set(allCells.map(p=>key(...p.cell)));
  const cells=allCells.sort((a,b)=>(a.cell[0]+a.cell[2])-(b.cell[0]+b.cell[2])||a.cell[1]-b.cell[1]);
  let paths='',minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const {cell:[x,y,z],color}of cells){
    const px=(x-z)*6,py=(x+z)*2.8-y*6,base=COLORS[color];minX=Math.min(minX,px-6);maxX=Math.max(maxX,px+6);minY=Math.min(minY,py-3);maxY=Math.max(maxY,py+9);
    if(!solid.has(key(x,y+1,z)))paths+=`<path d="M${px},${py-3}l6 3-6 3-6-3Z" fill="${shade(base,1.1)}"/>`;
    if(!solid.has(key(x,y,z+1)))paths+=`<path d="M${px-6},${py}l6 3v6l-6-3Z" fill="${shade(base,.8)}"/>`;
    if(!solid.has(key(x+1,y,z)))paths+=`<path d="M${px},${py+3}l6-3v6l-6 3Z" fill="${base}"/>`;
  }
  return `<svg viewBox="${minX-4} ${minY-4} ${maxX-minX+8} ${maxY-minY+8}" aria-hidden="true">${paths}</svg>`;
}
function renderModules(){
  offers=moduleOffers(world);
  $('moduleRow').innerHTML=offers.map((m,i)=>`<button class="module-option" data-offer="${i}" data-biome="${m.recipe.biome||'original'}" style="--module-color:${m.color}" aria-label="添加${m.name} · ${m.layoutLabel}" title="${m.biomeLabel||''} · ${m.layoutLabel} · ${m.hint} · 点击自动拼接"><span class="card-topline"><kbd>${i+1}</kbd><span class="difficulty-tag" data-level="${m.difficulty}">${DIFFICULTIES[m.difficulty]}</span></span><span class="scene-preview">${moduleSvg(m.recipe)}</span><span class="card-title"><b>${m.name}</b><span class="module-plus">${icon('plus')}</span></span><span class="mix-layout">${m.layoutLabel}</span><span class="mix-hazards">${m.hint.split(' → ').join(' · ')}</span></button>`).join('');
  $('moduleRow').querySelectorAll('button').forEach(b=>b.onclick=()=>addScene(offers[+b.dataset.offer].recipe));
}
function addScene(id){
  if(mode!=='build')return;
  try{const next=appendModule(world,id);history();world=next;rebuild();showAll();focusLatest();saveSoon();dismissWelcome();sound('place');

    const entry=world.segments.at(-1).entry;fx.build({x:entry[0]+.5,y:entry[1]+1.1,z:entry[2]+.5},moduleMeta(id).color);
    toast(`已接上「${moduleMeta(id).name}」`,'blocks');
  }catch(error){toast(error.message);}
}
const raycaster=new THREE.Raycaster();
function markerSafe(p){const x=Math.floor(p.x),y=Math.round(p.y),z=Math.floor(p.z);return occupied.has(key(x,y-1,z))&&!occupied.has(key(x,y,z))&&!occupied.has(key(x,y+1,z));}
let down=null;
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='run'||!$('modalBackdrop').hidden||down||e.button!==0)return;
  e.preventDefault();down={pointerId:e.pointerId,lastX:e.clientX,lastY:e.clientY};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!down||e.pointerId!==down.pointerId||mode!=='run')return;
  e.preventDefault();cameraYaw-=(e.clientX-down.lastX)*.006;cameraPitch=THREE.MathUtils.clamp(cameraPitch+(e.clientY-down.lastY)*.004,.05,1.12);
  down.lastX=e.clientX;down.lastY=e.clientY;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(down?.pointerId===e.pointerId)down=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function resetPlayer(){
  const segment=checkpointIndex>=0?world.segments[checkpointIndex]:null;
  const spawn=segment?{x:segment.entry[0]+.5,y:segment.entry[1]+1.01,z:segment.entry[2]+.5}:world.spawn;
  player={...spawn,vx:0,vy:0,vz:0,grounded:false,coyote:0,jumpBuffer:0,supportId:null};
  avatar.position.set(player.x,player.y,player.z);cameraYaw=segment?.dir===-1?Math.PI/2:-Math.PI/2;avatar.rotation.y=cameraYaw;cameraPitch=.38;
  refillShield(growth,mechanismTime);updateGrowthUI();
  resetTouchInput();updateRunCamera(1);
}
function failRun(message){falls++;sound('fall');resetMechanismState(mechanismState,world.mechanisms,checkpointIndex>=0?checkpointIndex:undefined);resetPlayer();safeUntil=mechanismTime+.85;toast(message);}
function startRun(){
  if(mode==='run'){backToBuild();return;}
  if(!world.modules.length){toast('先点下面的卡片，接上第一段场景');return;}
  if(!markerSafe(world.spawn)||!markerSafe(world.goal)){toast('请先把起点和终点放在上方留空的平台上');return;}
  closeTools();touchControls.reset();mode='run';won=false;runTime=0;jumps=0;falls=0;accumulator=0;checkpointIndex=-1;mechanismTime=0;safeUntil=0;growth.protectedUntil=0;shieldFlashUntil=0;mechanismState=createMechanismState();controls.enabled=false;down=null;keys.clear();
  document.body.classList.add('run-mode');$('runHud').hidden=false;$('runInstructions').hidden=false;$('touchControls').hidden=!showTouchControls();$('playBtn').innerHTML=icon('blocks')+'<span>返回搭建</span><kbd>Esc</kbd>';
  ground.visible=grid.visible=border.visible=false;markerGroup.traverse(o=>{if(o.isSprite)o.visible=false;});dismissWelcome();resetPlayer();canvas.focus();toast(showTouchControls()?'左手移动 · 右手跳跃 · 滑动空白处看方向':'WASD 移动 · 空格跳跃 · 拖动观察');
}
function backToBuild(){
  closeTools();touchControls.reset();mode='build';controls.enabled=true;won=false;keys.clear();touchJump=false;touchMove.x=touchMove.z=0;down=null;markerGroup.traverse(o=>{if(o.isSprite)o.visible=true;});
  document.body.classList.remove('run-mode');$('runHud').hidden=$('runInstructions').hidden=$('touchControls').hidden=true;setBiomeLook(world.segments.at(-1)?.biome||null);
  $('playBtn').innerHTML=icon('play')+'<span>开始跑酷</span><kbd>↵</kbd>';ground.visible=grid.visible=border.visible=false;avatar.position.set(world.spawn.x,world.spawn.y,world.spawn.z);avatar.rotation.set(0,-Math.PI/2,0);avatar.userData.limbs.forEach(l=>l.rotation.x=0);avatarShadow.visible=false;setBuildViewport();if(mobileLayout())focusLatest();canvas.focus();
}
function restart(){runTime=0;jumps=0;falls=0;won=false;checkpointIndex=-1;mechanismTime=0;safeUntil=0;growth.protectedUntil=0;shieldFlashUntil=0;mechanismState=createMechanismState();resetPlayer();}
function updateRunCamera(dt){
  const target=new THREE.Vector3(player.x,player.y+1,player.z);
  const radius=6.6,offset=new THREE.Vector3(Math.sin(cameraYaw)*Math.cos(cameraPitch)*radius,2+Math.sin(cameraPitch)*radius,Math.cos(cameraYaw)*Math.cos(cameraPitch)*radius);
  for(let y=Math.floor(player.y+1.6);y<=player.y+7;y++)if(occupied.has(key(Math.floor(player.x),y,Math.floor(player.z)))){offset.y=Math.min(offset.y,Math.max(.35,y-target.y-.35));break;}
  const distance=offset.length();raycaster.set(target,offset.clone().normalize());raycaster.near=.25;raycaster.far=distance;const obstruction=raycaster.intersectObject(blockMesh,false).find(h=>h.distance>.4);if(obstruction)offset.multiplyScalar(Math.max(.65,obstruction.distance-.3)/distance);raycaster.near=0;raycaster.far=Infinity;
  const desired=target.clone().add(offset);runCamera.position.lerp(desired,1-Math.exp(-14*dt));runCamera.lookAt(target);
}
function timeString(seconds){const min=Math.floor(seconds/60).toString().padStart(2,'0'),sec=(seconds%60).toFixed(1).padStart(4,'0');return min+':'+sec;}
function win(){
  won=true;sound('win');
  showModal('这条路线，你拿下了！',`<p>你点选的风景，成了完整的冒险。</p><p class="result-time">${timeString(runTime)}</p><p>跳跃 ${jumps} 次 · 重试 ${falls} 次<br>继续接一段，让下一次冒险更精彩。</p>`,[{text:'继续拼接',primary:false,action:()=>{closeModal();backToBuild();}},{text:'再跑一次',primary:true,action:()=>{closeModal();restart();}}],'flag');
}

function dismissWelcome(){$('welcomeNote').classList.add('dismissed');}
let previousFocus=null;
function showModal(title,content,actions,badge='blocks'){
  closeTools();resetTouchInput();previousFocus=document.activeElement;$('modalTitle').textContent=title;$('modalContent').innerHTML=content;$('modalBadge').innerHTML=icon(badge);$('modalActions').innerHTML='';
  for(const a of actions){const b=document.createElement('button');b.className='button '+(a.primary?'button-yellow':'button-white');b.textContent=a.text;b.onclick=a.action;$('modalActions').append(b);}
  $('modalBackdrop').hidden=false;$('closeModal').focus();
}
function closeModal(){$('modalBackdrop').hidden=true;previousFocus?.focus();}
function help(){showModal('你只管点，场景自动接',`<div class="help-list"><p><b>01 · 点一张场景卡片</b><br>底部每次展示四个场景，每张卡片是一整段含两到三种机关的混搭场景，卡片会显示组合和难度；选完自动换新。</p><p><b>02 · 一段接着一段</b><br>入口、出口和高度自动衔接；不同机关之间有稳定平台。每个候选已检查落脚点并完成通过路线回放。</p><p><b>03 · 进去跑一跑</b><br>点“开始跑酷”，WASD / 方向键移动，空格跳跃；手机用摇杆和跳跃键。顺路拾取金色材料，集齐后自动制作、升级护盾；有护盾时可抵挡机关，进入新段落会补满。每进一段自动存档，Esc 返回继续拼。</p><p><b>04 · 留住自己的路线</b><br>自动保存到当前浏览器，也可导出、导入和拍照。随机组合和成长进度都会保存，重试不会重抽或重复领取材料。旧路线也能继续使用。</p></div>`,[{text:'明白，去拼接',primary:true,action:closeModal}]);}
function replaceWorld(empty){showModal(empty?'重新拼一条路线？':'看看同主题的不同风景？','<p>当前路线会被替换，可以先导出备份。<br>替换后也可以点撤销找回。</p>',[{text:'取消',primary:false,action:closeModal},{text:empty?'重新开始':'载入示例',primary:true,action:()=>{history();world=freshRoute(true);if(!empty)world=makeRoute([{kind:'mix',seed:1701,level:1,layout:'tower',biome:'forest',features:1,variety:1,terrain:0},{kind:'mix',seed:9173,level:2,layout:'ridge',biome:'forest',features:1,variety:1,terrain:1},{kind:'mix',seed:77,level:2,layout:'courtyard',biome:'forest',features:1,variety:1,terrain:2},{kind:'mix',seed:513,level:3,layout:'zigzag',biome:'forest',features:1,variety:1,terrain:3}],world.name,world.routeSeed);rebuild();saveSoon();showAll();if(!empty)focusLatest();if(!empty)dismissWelcome();else $('welcomeNote').classList.remove('dismissed');closeModal();toast(empty?'从下面四个候选里选一段，开始拼路线':'四种森林地形已接好');}}]);}
function download(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportWorld(){saveNow();download(new Blob([JSON.stringify({...serializeRoute(world),growth:serializeGrowth(growth)},null,2)],{type:'application/json'}),(world.name||'积木场景').replace(/[\\/:*?"<>|]/g,'_')+'.json');toast('场景和成长进度已导出');}
function takePhoto(){renderer.render(scene,mode==='run'?runCamera:camera);canvas.toBlob(blob=>{if(blob)download(blob,'我的积木世界.png');else toast('拍摄失败，请重试');},'image/png');toast('场景照片已保存');}

$('toolsBtn').onclick=()=>{const open=!document.body.classList.contains('tools-open');if(open)resetTouchInput();document.body.classList.toggle('tools-open',open);$('toolsBtn').setAttribute('aria-expanded',String(open));$('toolsScrim').hidden=!open;};
$('toolsScrim').onclick=closeTools;
$('mobileSaveBtn').onclick=()=>{closeTools();exportWorld();};$('mobileHelpBtn').onclick=help;
$('rightTools').addEventListener('click',e=>{if(e.target.closest('button'))closeTools();});
$('playBtn').onclick=startRun;$('runMode').onclick=()=>{if(mode==='build')startRun();};$('buildMode').onclick=()=>{if(mode==='run')backToBuild();};
$('restartBtn').onclick=()=>{restart();canvas.focus();};$('homeBtn').onclick=()=>{showAll();toast('已回到全景视角');};
$('helpBtn').onclick=help;$('undoBtn').onclick=doUndo;$('redoBtn').onclick=doRedo;
$('newBtn').onclick=()=>replaceWorld(true);$('demoBtn').onclick=()=>replaceWorld(false);$('saveBtn').onclick=exportWorld;$('photoBtn').onclick=takePhoto;
$('zoomIn').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(.8).add(controls.target);controls.update();};$('zoomOut').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(1.2).add(controls.target);controls.update();};
$('sceneName').onchange=()=>{history();world.name=$('sceneName').value.trim()||'我的拼接乐园';$('sceneName').value=world.name;saveSoon();};
$('importBtn').onclick=()=>$('importInput').click();
$('importInput').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>10*1024*1024)throw Error('文件过大，请导入 10 MB 以内的场景');const data=JSON.parse(await file.text()),next=validateRoute(data),imported=data.growth?createGrowth(data.growth):null;history();world=next;if(imported)mergeGrowth(growth,serializeGrowth(imported));rebuild();showAll();saveSoon();dismissWelcome();toast('场景和成长进度已导入');}catch(error){toast(error instanceof SyntaxError?'文件格式不正确，请选择导出的 JSON 场景':error.message);}finally{e.target.value='';}
};
$('closeModal').onclick=closeModal;$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal();};

document.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&document.body.classList.contains('tools-open')){e.preventDefault();closeTools();$('toolsBtn').focus();return;}
  if(!$('modalBackdrop').hidden){
    if(e.code==='Escape'){e.preventDefault();closeModal();return;}
    if(e.code==='Tab'){const items=[...$('modalBackdrop').querySelectorAll('button')];const i=items.indexOf(document.activeElement);e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length].focus();}return;
  }
  if(e.target instanceof HTMLInputElement)return;
  if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='Escape'&&mode==='run')backToBuild();
  if(e.code==='Enter'&&mode==='build')startRun();
  if(mode!=='build')return;
  if((e.metaKey||e.ctrlKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?doRedo():doUndo();return;}
  if(e.metaKey||e.ctrlKey)return;
  if(e.code==='KeyH')showAll();
  const n=Number(e.key);if(n>=1&&n<=4&&offers[n-1])addScene(offers[n-1].recipe);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',resetTouchInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetTouchInput();saveNow();}lastTime=performance.now();});
window.addEventListener('beforeunload',saveNow);
window.addEventListener('storage',e=>{if(e.key!==GROWTH_STORAGE||!e.newValue)return;try{const needsSave=mergeGrowth(growth,JSON.parse(e.newValue));updateGrowthUI();if(needsSave)saveSoon();}catch{}});
const touchControls=installTouchControls({joystick:$('joystick'),jumpButton:$('jumpBtn'),onMove:(x,z)=>{touchMove.x=x;touchMove.z=z;},onJump:pressed=>{touchJump=pressed;}});
let previousWidth=innerWidth,previousHeight=innerHeight;
function resize(){
  const layoutChanged=mobileLayout()!==document.body.classList.contains('mobile-layout')||Math.abs(innerWidth-previousWidth)>24||(innerWidth>innerHeight)!==(previousWidth>previousHeight);
  document.body.classList.toggle('mobile-layout',mobileLayout());document.body.classList.toggle('is-landscape',innerWidth>innerHeight);closeTools();
  const a=innerWidth/innerHeight;camera.aspect=a;runCamera.aspect=a;camera.updateProjectionMatrix();runCamera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,mobileLayout()?1.5:2));
  const size=mobileLayout()?1024:2048;if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;}
  $('touchControls').hidden=mode!=='run'||!showTouchControls();resetTouchInput();
  if(mode==='build'){setBuildViewport();if(layoutChanged)focusLatest();}else updateRunCamera(1);
  previousWidth=innerWidth;previousHeight=innerHeight;
}
window.addEventListener('resize',resize);

// Purely decorative block clouds; no external assets or services are required.
const cloudMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.58,depthWrite:false});
for(const [x,y,z,s]of [[-60,20,-40,2],[-20,24,-74,2.2],[45,25,-64,2.5],[65,16,0,1.8],[-65,13,32,1.8]]){
  const cloud=new THREE.Group();cloud.position.set(x,y,z);for(const [a,b,w]of [[0,0,5],[-3,0,4],[2,1,4],[-1,2,3]]){const m=new THREE.Mesh(new THREE.BoxGeometry(w*s,1.3*s,2.7*s),cloudMat);m.position.set(a*s,b*s,0);cloud.add(m);}scene.add(cloud);
}

function animate(now){
  requestAnimationFrame(animate);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(document.hidden)return;
  if(mode==='build'){controls.update();avatarShadow.visible=false;avatar.visible=true;mechanismTime+=dt;}
  else if(player){
    if(!won&&$('modalBackdrop').hidden&&!document.body.classList.contains('tools-open')){
      runTime+=dt;
      let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+touchMove.x;
      let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+touchMove.z;
      const len=Math.hypot(x,z);if(len>1){x/=len;z/=len;}
      const move={x:x*Math.cos(cameraYaw)+z*Math.sin(cameraYaw),z:-x*Math.sin(cameraYaw)+z*Math.cos(cameraYaw)};
      accumulator+=dt;while(accumulator>=1/90){
        const hit=stepDynamicPlayer(player,1/90,{move,jump:keys.has('Space')||touchJump},(a,b,c)=>occupied.has(key(a,b,c)),world.mechanisms,mechanismTime,mechanismState);
        mechanismTime+=1/90;
        if(player.didJump){jumps++;sound('jump');}
        gatherMaterials();handleHazard(hit);
        if(world.effects.some(e=>touchesBiomeHazard(player,e)))failRun('落入熔岩，回到本段入口');
        const next=reachedCheckpoint(world.segments,player,checkpointIndex);
        if(next>checkpointIndex){checkpointIndex=next;refillShield(growth,mechanismTime);updateGrowthUI();if(mechanismTime>=shieldFlashUntil)toast(`已到达第 ${next+1} 段，自动存档${growth.level?' · 护盾补满':''}`);}
        accumulator-=1/90;
      }
      if(player.y< -9)failRun(checkpointIndex>=0?'回到本段存档点，再试一次':'回到起点，再试一次');
      if(Math.hypot(player.x-world.goal.x,player.z-world.goal.z)<.85&&Math.abs(player.y-world.goal.y)<.5)win();
      avatar.position.set(player.x,player.y,player.z);
      const speed=Math.hypot(player.vx,player.vz);movingPhase+=dt*speed*2.7;
      if(speed>.2){const desired=Math.atan2(-player.vx,-player.vz);avatar.rotation.y+=Math.atan2(Math.sin(desired-avatar.rotation.y),Math.cos(desired-avatar.rotation.y))*.2;}
      avatar.userData.limbs.forEach((l,i)=>l.rotation.x=Math.sin(movingPhase+(i===0||i===3?0:Math.PI))*.52*Math.min(1,speed/3));
    }
    updateRunCamera(dt);updateChallengeHud();avatar.visible=mechanismTime>=Math.max(safeUntil,growth.protectedUntil)||Math.floor(mechanismTime*14)%2===0;$('runTimer').textContent=timeString(runTime);$('jumpCount').textContent=jumps;$('fallCount').textContent=falls;
    let groundY=null;for(let y=Math.floor(player.y)-1;y>=Math.max(0,Math.floor(player.y)-8);y--){if(occupied.has(key(Math.floor(player.x),y,Math.floor(player.z)))){groundY=y+1;break;}}
    if(player.supportId){const support=world.mechanisms.find(m=>m.id===player.supportId);if(support)groundY=mechanismPose(support,mechanismTime,mechanismState).y;}
    avatarShadow.visible=groundY!==null;if(groundY!==null){avatarShadow.position.set(player.x,groundY+.013,player.z);avatarShadow.material.opacity=.14/Math.max(1,player.y-groundY);}
  }
  updateMechanismVisuals();
  animateBiomeScenery(now/1000);
  animatePickups(reducedMotion?0:now/1000);updateGrowthVisuals();
  fxFocus.copy(avatar.position).y+=.9;fx.update(now/1000,mode==='run'?runCamera:camera,fxFocus,renderer.getPixelRatio());
  if(flagCloth){const pos=flagCloth.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setZ(i,Math.sin(now*.0025+x*3)*.1*(x+.675));}pos.needsUpdate=true;}
  renderer.render(scene,mode==='run'?runCamera:camera);
}
rebuild();showAll();focusLatest();saveNow();ground.visible=grid.visible=border.visible=false;if(world.modules.length)dismissWelcome();
requestAnimationFrame(animate);requestAnimationFrame(()=>{$('loading').style.opacity='0';setTimeout(()=>$('loading').remove(),450);document.body.dataset.ready='true';});
if(showTouchControls())$('interactionHint').innerHTML='<span><kbd>点卡片</kbd> 自动拼接</span><span><kbd>拖动</kbd> 看看场景</span>';
