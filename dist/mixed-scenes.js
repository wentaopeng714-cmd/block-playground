import {key} from './world.js?v=10.0';
import {stepDynamicPlayer,mechanismPose,createMechanismState,SECOND_PHASE_TYPES,mechanismPhaseShift} from './mechanisms.js?v=10.0';
import {BIOMES,BIOME_KEYS,decorateBiome,touchesBiomeHazard} from './biomes.js?v=10.0';
import {TERRAIN_TYPES} from './terrain.js?v=10.0';

export const HAZARD_NAMES={gate:'闸门',spikes:'尖刺',sweeper:'横杆',pendulum:'摆锤',collapse:'塌板',platform:'移动台',log:'滚木',ice:'滑面',fire:'喷火',crusher:'压柱'};
export const ROOM_KINDS=['gate','spikes','sweeper','pendulum','collapse','platform'];
export const BIOME_FEATURES={forest:'log',snow:'ice',lava:'fire',desert:'crusher'};
export const FEATURE_KINDS=Object.values(BIOME_FEATURES);
const THEMES=[{name:'虹彩',color:'#f5849b',index:0},{name:'薄荷',color:'#55cbbb',index:2},{name:'云端',color:'#6daaf5',index:4},{name:'暮紫',color:'#a98bea',index:3}];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2,DT=1/90;
export const ROUTE_LAYOUTS={bend:'回转弯道',tower:'绕塔盘旋',weave:'上下穿插',zigzag:'折返山路',ridge:'山脊高架',courtyard:'回廊环线'};
export function isMixedRecipe(r){return !!r&&typeof r==='object'&&!Array.isArray(r)&&r.kind==='mix'&&Number.isInteger(r.seed)&&r.seed>=0&&r.seed<=4294967295&&[1,2,3].includes(r.level)&&(r.layout===undefined||Object.hasOwn(ROUTE_LAYOUTS,r.layout))&&(r.biome===undefined||(!!r.layout&&Object.hasOwn(BIOMES,r.biome)))&&(r.features===undefined||(r.features===1&&!!r.biome))&&(r.variety===undefined||(r.variety===1&&r.features===1&&Number.isInteger(r.terrain)&&r.terrain>=0&&r.terrain<4))&&(r.terrain===undefined||r.variety===1)&&(!['zigzag','ridge','courtyard'].includes(r.layout)||r.variety===1);}
export function canonicalMixed(r){if(!isMixedRecipe(r))throw Error('混搭场景参数不正确');return {kind:'mix',seed:r.seed>>>0,level:r.level,...(r.layout?{layout:r.layout}:{}),...(r.biome?{biome:r.biome}:{}),...(r.features?{features:r.features}:{}),...(r.variety?{variety:r.variety,terrain:r.terrain}:{})};}
function rng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function mixedPlan(recipe){
  const r=canonicalMixed(recipe),random=rng(r.seed),pool=r.level===1?['gate','spikes']:[...ROOM_KINDS];
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const count=r.variety&&r.layout==='courtyard'?2:r.level===3||r.variety&&r.layout==='zigzag'?3:r.variety&&r.level===2?2+Math.floor(random()*2):2;
  const kinds=r.features?pool.slice(0,count-1):pool.slice(0,count);
  if(r.features)kinds.splice(r.variety?Math.floor(random()*count):0,0,BIOME_FEATURES[r.biome]);
  const theme=THEMES[r.seed%THEMES.length];
  return {recipe:r,kinds,theme,phases:kinds.map(()=>random()),variants:kinds.map(()=>r.variety?Math.floor(random()*3):0)};
}
export function mixedMeta(recipe){
  const p=mixedPlan(recipe),r=p.recipe,layout=r.layout,biome=BIOMES[r.biome];
  return {id:`mix-${r.seed}-${r.level}${layout?'-'+layout:''}${biome?'-'+r.biome:''}${r.features?'-f'+r.features:''}${r.variety?'-v1-t'+r.terrain:''}`,recipe:r,
    name:r.variety?TERRAIN_TYPES[r.biome][r.terrain]:biome?.title||p.theme.name+(layout?{bend:'回转乐园',tower:'环塔之旅',weave:'立体天桥'}[layout]:(p.kinds.length===3?'三重试炼':'双重乐园')),
    biomeLabel:biome?.name,layoutLabel:ROUTE_LAYOUTS[layout]||'阶梯连廊',hint:p.kinds.map(k=>HAZARD_NAMES[k]).join(' → '),hazards:p.kinds,difficulty:r.level,color:biome?.color||p.theme.color,mechanic:true,mixed:true};
}
export function mixedOffers(world){
  let seed=(world.routeSeed??1701)>>>0;const content=JSON.stringify(world.modules);
  for(const c of content)seed=(Math.imul(seed,31)+c.charCodeAt(0))>>>0;
  const random=rng(seed),offers=[];
  for(const level of [1,2,2,3]){
    const biome=BIOME_KEYS[(offers.length+seed%4)%4],past=world.modules.filter(m=>m?.biome===biome&&m.variety===1),recent=new Set(past.slice(-3).map(m=>m.terrain));
    const terrains=[0,1,2,3].filter(t=>!recent.has(t)),terrain=terrains[Math.floor(random()*terrains.length)];
    const layouts=(level===1?['bend','ridge','courtyard']:Object.keys(ROUTE_LAYOUTS)).filter(l=>l!==past.at(-1)?.layout&&!offers.some(o=>o.recipe.layout===l));
    let chosen=null;
    for(let attempt=0;attempt<32;attempt++){
      const recipe={kind:'mix',seed:Math.floor(random()*4294967296),level,layout:layouts[Math.floor(random()*layouts.length)],biome,features:1,variety:1,terrain};
      try{const meta=mixedMeta(recipe);if(attempt<24&&past.length&&meta.hint===mixedMeta(past.at(-1)).hint)continue;mixedBlueprint(recipe,1);mixedBlueprint(recipe,-1);chosen={...meta,verified:true};break;}catch{}
    }
    if(!chosen)throw Error('正在重新准备可通行的混搭场景，请再试一次');offers.push(chosen);
  }
  return offers;
}

// Flat, independent challenge rooms have permanent safe entrance/exit pads.
// Mixed scenes connect them with six solid stair cells, never with a trap.
export function challengeRoom(kind,level,variant=0){
  if(![...ROOM_KINDS,...FEATURE_KINDS].includes(kind)||![1,2,3].includes(level))throw Error('未知的机关挑战区');
  if(![0,1,2].includes(variant))throw Error('未知的挑战区变体');
  if(variant){
    const room=challengeRoom(kind,level),pad=variant,cells=room.cells.map(c=>({...c,cell:[c.cell[0]+pad,c.cell[1],c.cell[2]]})),width=kind==='ice'?7:5;
    for(const start of [0,pad+room.length])for(let x=start;x<start+pad;x++)for(let z=-Math.floor(width/2);z<=Math.floor(width/2);z++)cells.push({cell:[x,0,z],color:4});
    const mechanisms=room.mechanisms.map(m=>({...m,x:m.x+pad,...(m.period?{period:m.period*(variant===1?.94:1.06)}:{}),...(m.type==='sweeper'?{speed:m.speed*(variant===1?.94:1.06)}:{})}));
    return {...room,cells,mechanisms,preview:room.preview.map(c=>({...c,cell:[c.cell[0]+pad,c.cell[1],c.cell[2]]})),length:room.length+pad*2,entryPad:pad,variant};
  }
  const length=['log','ice'].includes(kind)?16:kind==='platform'?14:12,cells=new Map(),mechanisms=[],preview=[];
  const put=(x,y,z,color)=>cells.set(key(x,y,z),{cell:[x,y,z],color});
  const rect=(x,y,z,sx,sy,sz,c)=>{for(let a=0;a<sx;a++)for(let b=0;b<sy;b++)for(let d=0;d<sz;d++)put(x+a,y+b,z+d,c);};
  for(let x=0;x<length;x++){
    if(kind==='collapse'&&x>=2&&x<=9)continue;
    if(kind==='platform'&&x>=4&&x<=9)continue;
    const width=kind==='ice'?7:['log','crusher'].includes(kind)||x<2||x>=length-2||kind==='sweeper'?5:3;
    rect(x,0,-Math.floor(width/2),1,1,width,kind==='collapse'?5:4);
  }
  const add=(type,x,y,z,params={})=>mechanisms.push({type,id:`proof-${kind}-${mechanisms.length}`,x,y,z,...params});
  function arch(x,half=3,tall=6){rect(x,1,-half,1,tall,1,3);rect(x,1,half,1,tall,1,3);rect(x,tall+1,-half,1,1,half*2+1,1);}
  if(kind==='log'){
    add('log',10.5,1.52,.5,{dir:1,radius:.52,depth:3.8,range:6,period:[0,6.2,5.5,4.8][level],warning:[0,.8,.65,.55][level],rollDuration:[0,2.6,2.4,2.2][level],phase:0});
    for(const x of [3,12])for(const z of [-3,3])rect(x,0,z,1,3,1,8);
    for(let z=-1;z<=2;z++)preview.push({cell:[10,1,z],color:8});
  }else if(kind==='ice'){
    add('ice',8,1,.5,{width:8,depth:7,grip:[0,1.7,1.25,.9][level],speed:6.4});
    for(let x=4;x<=11;x++)for(const z of [-4,4])rect(x,1,z,1,2,1,4);
  }else if(kind==='fire'){
    add('fire',6.5,1,.5,{period:[0,6.4,5.8,5.1][level],warning:[0,.9,.8,.7][level],burst:[0,1.3,1.5,1.65][level],phase:0});
    for(const z of [-3,3])rect(6,0,z,1,2,1,10);
    for(let y=1;y<=3;y++)for(let z=-1;z<=1;z++)preview.push({cell:[6,y,z],color:y===3?23:22});
  }else if(kind==='crusher'){
    arch(6,3,7);add('crusher',6.5,1,.5,{period:[0,6.6,5.8,5][level],closedDuration:1.4,transition:.45,openDuration:[0,3.2,2.6,2][level],phase:0});
    for(let x=5;x<=6;x++)for(let y=1;y<=3;y++)for(let z=-1;z<=2;z++)preview.push({cell:[x,y,z],color:8});
  }else if(kind==='gate'){
    arch(6);add('gate',6.5,1,.5,{period:level===1?6:level===2?4.8:4.4,closedDuration:level===1?1.3:1.7,transition:level===3?.4:.5,openDuration:level===1?3:level===2?1.7:1.3,phase:0});
    for(let y=1;y<=3;y++)for(let z=-2;z<=2;z++)preview.push({cell:[6,y,z],color:9});
  }else if(kind==='spikes'){
    add('spikes',6.5,1,.5,{height:level===1?.45:.65,period:level===1?4.8:0,phase:0});
    for(let z=-1;z<=1;z++)preview.push({cell:[6,1,z],color:9});
    for(const x of [3,9])for(const z of [-4,4])rect(x,0,z,1,4,1,9);
  }else if(kind==='sweeper'){
    add('sweeper',6.5,1.55,.5,{length:5,speed:[0,.65,.9,1.15][level],phase:0});arch(2);
    for(let x=4;x<=8;x++)preview.push({cell:[x,1,0],color:9});
  }else if(kind==='pendulum'){
    arch(6,7,9);add('pendulum',6.5,11,.5,{length:9.2,amplitude:.64,period:level===1?5:level===2?4.5:3.8,phase:0});
    for(let y=2;y<=9;y++)preview.push({cell:[6,y,0],color:10});preview.push({cell:[6,1,0],color:9});
  }else if(kind==='collapse'){
    for(let x=2;x<=8;x+=2){add('collapse',x+1,1,.5,{delay:level===3?.68:.85});for(let a=0;a<2;a++)for(let z=-1;z<=1;z++)preview.push({cell:[x+a,0,z],color:(x+a)%2?5:1});}arch(1,4,7);arch(10,4,7);
  }else{
    add('platform',4.5,1,.5,{dir:1,range:6,lift:0,period:level===3?5.8:6.4,phase:0});arch(2,4,7);arch(11,4,7);
    for(let x=3;x<=5;x++)for(let z=-1;z<=1;z++)preview.push({cell:[x,0,z],color:1});
  }
  return {kind,level,length,cells:[...cells.values()].map(c=>({...c,...(kind==='ice'&&c.cell[1]===0&&c.cell[0]>=4&&c.cell[0]<=11?{surfaceType:'ice'}:{})})),mechanisms,preview};
}
function makePolicy(room){
  let jumped=false,stage='approach';const m=room.mechanisms[0];
  return (p,time)=>{
    if(room.kind!=='platform'){
      const q=room.kind==='log'?mechanismPose(m,time):null;
      const jump=!jumped&&p.grounded&&(['spikes','sweeper'].includes(room.kind)&&p.x>=m.x-1.8||q?.active&&q.x-p.x<=2.4&&q.x>p.x);
      if(jump)jumped=true;return {move:{x:1,z:0},jump};
    }
    const q=mechanismPose(m,time);
    if(stage==='approach'){
      const d=2.5+(room.entryPad||0)-p.x;if(Math.abs(d)<.055&&Math.abs(p.vx)<.2)stage='wait';
      return {move:{x:clamp(d*3,-1,1),z:0}};
    }
    if(stage==='wait'){
      if(q.progress<.08&&mechanismPose(m,time+DT).x>=q.x)stage='board';else return {move:{x:0,z:0}};
    }
    if(stage==='board'&&p.supportId)stage='ride';
    if(stage==='ride'){
      if(q.progress>.9){stage='exit';jumped=true;return {move:{x:1,z:0},jump:true};}
      return {move:{x:0,z:0}};
    }
    return {move:{x:1,z:0}};
  };
}
export function replayRoom(room,startTime=0){
  const blocks=new Set(room.cells.map(c=>key(...c.cell))),state=createMechanismState(),policy=makePolicy(room);
  const p={x:.5,y:1.01,z:.5,vx:0,vy:0,vz:0,grounded:false,supportId:null};
  for(let i=0;i<1800;i++){
    const time=startTime+i*DT,input=policy(p,time),hit=stepDynamicPlayer(p,DT,input,(x,y,z)=>blocks.has(key(x,y,z)),room.mechanisms,time,state);
    if(hit||p.y<.2)return {ok:false,reason:hit?.type||'fall',time:i*DT};
    if(p.x>=room.length-1&&p.grounded)return {ok:true,startTime,duration:(i+1)*DT};
  }
  return {ok:false,reason:'timeout'};
}
const CERTIFICATES=new Map();
export function roomCertificate(kind,level,variant=0){
  const k=`${kind}:${level}:${variant}`;if(CERTIFICATES.has(k))return CERTIFICATES.get(k);
  const room=challengeRoom(kind,level,variant),m=room.mechanisms[0],period=kind==='sweeper'?TAU/m.speed:m.period||0;
  const samples=['collapse','spikes','platform','ice'].includes(kind)?1:48;
  for(let i=0;i<samples;i++){
    const start=period*i/samples,proof=replayRoom(room,start);
    if(proof.ok&&replayRoom(room,start-.07).ok&&replayRoom(room,start+.07).ok){const result={kind,level,...(variant?{variant}:{}),verified:true,startTime:start,period,duration:proof.duration};CERTIFICATES.set(k,result);return result;}
  }
  throw Error(`机关挑战区没有找到可重复的通过路径：${k}`);
}
export function validateMixedBlueprint(b){
  const cells=new Set(b.cells.map(c=>key(...c.cell)));
  for(const [x,y]of [[0,0],[b.length-1,b.rise]])for(let z=-2;z<=2;z++){
    if(!cells.has(key(x,y,z))||cells.has(key(x,y+1,z))||cells.has(key(x,y+2,z)))throw Error('混搭段接口不连通');
  }
  for(const z of b.zones){
    if(!z.certificate.verified)throw Error('机关挑战区尚未通过回放');
    const [x,y,v]=z.entry||[z.start,z.base,0],dir=z.dir||1;
    for(const u of [0,1,z.length-2,z.length-1])for(let w=-1;w<=1;w++)if(!cells.has(key(x+dir*u,y,v+dir*w)))throw Error('缺少稳定落脚点');
    for(const m of b.mechanisms.filter(m=>m.zone===z.index)){const u=(m.u-x)*dir;if(u<2||u>z.length-2)throw Error('机关侵入安全等待区');}
  }
  for(const s of b.safeLinks.filter(s=>!s.path))for(let x=s.start;x<s.end;x++){
    if(b.mechanisms.some(m=>m.u>=x&&m.u<x+1))throw Error('机关放到了连接平台上');
  }
  for(const link of b.safeLinks.filter(s=>s.path))for(const [x,y,z]of link.path){
    if(!cells.has(key(x,y,z))||cells.has(key(x,y+1,z))||cells.has(key(x,y+2,z)))throw Error('转弯或楼梯被结构堵住');
  }
  return true;
}
const MIXED_PROOFS=new Map();
export function mixedBlueprint(recipe,trend=1){
  if(recipe.layout)return richBlueprint(recipe,trend);
  const plan=mixedPlan(recipe),cells=new Map(),mechanisms=[],mechanismPreview=[],path=[],zones=[],safeLinks=[];
  const put=(c,color)=>cells.set(key(...c),{cell:c,color});let offset=0,base=0;
  for(let i=0;i<plan.kinds.length;i++){
    const kind=plan.kinds[i],room=challengeRoom(kind,recipe.level),certificate=roomCertificate(kind,recipe.level);
    for(const c of room.cells)put([c.cell[0]+offset,c.cell[1]+base,c.cell[2]],c.color===4?plan.theme.index:c.color);
    for(let x=0;x<room.length;x++)path.push([offset+x,base,0]);
    for(const c of room.preview)mechanismPreview.push({cell:[c.cell[0]+offset,c.cell[1]+base,c.cell[2]],color:c.color});
    for(const m of room.mechanisms){
      const copy={...m,u:m.x-.5+offset,y:m.y+base,v:m.z-.5,zone:i};delete copy.x;delete copy.z;
      if(SECOND_PHASE_TYPES.includes(m.type))copy.phase=plan.phases[i]*(m.period||0);
      else if(m.type!=='collapse')copy.phase=plan.phases[i]*TAU;
      mechanisms.push(copy);
    }
    zones.push({index:i,kind,start:offset,length:room.length,base,certificate});offset+=room.length;
    if(i<plan.kinds.length-1){
      const start=offset;for(let x=0;x<6;x++){const h=base+Math.floor(x/2)*trend;for(let z=-2;z<=2;z++)put([offset+x,h,z],6);path.push([offset+x,h,0]);}
      offset+=6;base+=2*trend;safeLinks.push({start,end:offset});
    }
  }
  const b={level:recipe.level,cells:[...cells.values()],mechanisms,mechanismPreview,path,rise:base,length:offset,zones,safeLinks,certificate:{verified:true,roomKinds:plan.kinds,method:'physics-replay-and-safe-connectors'}};
  validateMixedBlueprint(b);
  const proofKey=`${recipe.seed}:${recipe.level}:${trend}`;
  if(!MIXED_PROOFS.has(proofKey)){
    const first=replayMixedBlueprint(b,0),late=replayMixedBlueprint(b,17.317,true);
    if(!first.ok||!late.ok)throw Error('混搭段回放失败 '+JSON.stringify({seed:recipe.seed,level:recipe.level,trend,first,late}));
    MIXED_PROOFS.set(proofKey,{verified:true,roomKinds:plan.kinds,method:'full-physics-replay',steps:first.steps+late.steps});
  }
  b.certificate=MIXED_PROOFS.get(proofKey);return b;
}

// Rooms retain certified neutral ports. Permanent three-wide corridors turn
// around them; stairs flatten at every corner. Weave decks are twelve cells
// apart, clearing even the tallest lower-room arch in either height direction.
function richBlueprint(recipe,trend){
  const plan=mixedPlan(recipe),rooms=plan.kinds.map((k,i)=>challengeRoom(k,recipe.level,plan.variants[i]));
  const cells=new Map(),mechanisms=[],mechanismPreview=[],path=[],zones=[],safeLinks=[];
  const put=(c,color,part='route')=>cells.set(key(...c),{cell:c,color,...(recipe.biome?{part}:{})});
  const random=rng(recipe.seed^0x79a4d31),A=Math.max(...rooms.map(r=>r.length))+(recipe.variety?(recipe.layout==='courtyard'?22:6)+2*Math.floor(random()*4):6);
  const D=recipe.variety?(recipe.layout==='zigzag'?12+2*Math.floor(random()*2):['ridge','courtyard'].includes(recipe.layout)?20+2*Math.floor(random()*3):16+2*Math.floor(random()*5)):(recipe.layout==='tower'?22:18);
  const H=recipe.variety?(recipe.layout==='zigzag'?4:4+Math.floor(random()*3)*2):(recipe.layout==='bend'?4:6),stack=recipe.variety?12+2*Math.floor(random()*3):12;
  const endX=recipe.layout==='ridge'?rooms.reduce((n,r)=>n+r.length,0)+(rooms.length-1)*8+6:A+6,layer=recipe.layout==='weave'&&rooms.length===2?stack:H;
  let cursor=[0,0,0];
  function connect(points,endY,to,riseToCorner=null){
    const line=[{x:points[0][0],z:points[0][1]}],corners=[0];
    for(let i=1;i<points.length;i++){
      let {x,z}=line.at(-1);const [tx,tz]=points[i];if(x!==tx&&z!==tz)throw Error('连接须为直角转弯');
      while(x!==tx||z!==tz){x+=Math.sign(tx-x);z+=Math.sign(tz-z);line.push({x,z});}corners.push(line.length-1);
    }
    const delta=endY-cursor[1],eligible=[];
    for(let i=3;i<line.length-2;i++)if((riseToCorner===null||i<corners[riseToCorner])&&corners.every(c=>Math.abs(c-i)>2)&&(eligible.length===0||i-eligible.at(-1)>=2))eligible.push(i);
    if(eligible.length<Math.abs(delta))throw Error('楼梯空间不足');
    const transitions=Array.from({length:Math.abs(delta)},(_,i)=>eligible[Math.floor((i+.5)*eligible.length/Math.abs(delta))]);
    const full=line.map((q,i)=>[q.x,cursor[1]+Math.sign(delta)*transitions.filter(t=>t<=i).length,q.z]);
    for(let i=0;i<full.length;i++){
      const [x,y,z]=full[i],prev=full[Math.max(0,i-1)],next=full[Math.min(full.length-1,i+1)];
      const dx=Math.sign(next[0]-prev[0]),dz=Math.sign(next[2]-prev[2]);
      if(corners.includes(i)){for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)put([x+a,y,z+b],6);}
      else for(let w=-1;w<=1;w++)put([x+dz*w,y,z+dx*w],6);
    }
    path.push(...full);safeLinks.push({from:zones.length-1,to,path:full,waypoints:corners.map(i=>full[i])});cursor=full.at(-1);
  }
  for(let i=0;i<rooms.length;i++){
    if(i){
      const prev=zones.at(-1).exit;
      if(recipe.layout==='ridge'){
        const nextX=prev[0]+9,nextZ=i%2?D:0;connect([[prev[0],prev[2]],[prev[0]+4,prev[2]],[prev[0]+4,nextZ],[nextX,nextZ]],i*H*trend,i);
      }else if(recipe.layout==='zigzag')connect([[prev[0],prev[2]],[i===1?A:0,prev[2]],[i===1?A:0,i*D]],i*H*trend,i);
      else if(recipe.layout==='courtyard'){
        connect([[prev[0],prev[2]],[A,0],[A,D+8],[0,D+8],[0,D]],H*trend,i,1);
      }else if(i===1&&recipe.layout==='weave'&&rooms.length===2)connect([[prev[0],prev[2]],[A,0],[A,D],[0,D],[0,0]],stack*trend,i);
      else if(i===1)connect(recipe.variety&&recipe.layout==='tower'?[[prev[0],prev[2]],[A+4,0],[A+4,D],[A,D]]:[[prev[0],prev[2]],[A,0],[A,D]],layer*trend,i);
      else connect(recipe.variety&&recipe.layout==='weave'?[[prev[0],prev[2]],[prev[0],D+8],[0,D+8],[0,0]]:[[prev[0],prev[2]],[0,D],[0,recipe.layout==='weave'?0:-18]],(recipe.variety&&recipe.layout==='weave'?stack:2*H)*trend,i);
    }
    const room=rooms[i],dir=i===1&&!['ridge','courtyard'].includes(recipe.layout)&&!(recipe.layout==='weave'&&rooms.length===2)?-1:1,[ax,base,az]=cursor;
    const transform=([x,y,z])=>[ax+dir*x,base+y,az+dir*z];
    for(const c of room.cells)put(transform(c.cell),c.color===4?plan.theme.index:c.color,c.cell[1]===0?(c.surfaceType==='ice'?'ice':'surface'):c.color===1?'trim':'frame');
    for(const c of room.preview)mechanismPreview.push({cell:transform(c.cell),color:c.color});
    for(let x=0;x<room.length;x++)path.push(transform([x,0,0]));
    for(const m of room.mechanisms){
      const copy={...m,u:ax+dir*(m.x-.5),y:base+m.y,v:az+dir*(m.z-.5),dir,zone:i};delete copy.x;delete copy.z;
      if(SECOND_PHASE_TYPES.includes(m.type))copy.phase=plan.phases[i]*(m.period||0);
      else if(m.type!=='collapse')copy.phase=plan.phases[i]*TAU;
      mechanisms.push(copy);
    }
    const exit=transform([room.length-1,0,0]);
    zones.push({index:i,kind:room.kind,...(recipe.variety?{variant:plan.variants[i]}:{}),entry:[ax,base,az],exit,dir,length:room.length,base,certificate:roomCertificate(room.kind,recipe.level,plan.variants[i])});cursor=exit;
  }
  const [ex,ey,ez]=cursor;
  if(recipe.layout==='courtyard')connect([[ex,ez],[ex,D-8],[endX,D-8],[endX,0]],ey,'exit');
  else if(['ridge','zigzag'].includes(recipe.layout)){
    if(ez!==0)connect([[ex,ez],[endX,ez],[endX,0]],ey,'exit');else connect([[ex,ez],[endX,0]],ey,'exit');
  }else if(ez>0)connect([[ex,ez],[0,ez],[0,-10],[endX,-10],[endX,0]],ey,'exit');
  else if(ez<0)connect([[ex,ez],[endX,ez],[endX,0]],ey,'exit');
  else connect([[ex,ez],[endX,0]],ey,'exit');
  // A landmark inside the loop makes the direction changes easy to read.
  if(recipe.layout==='tower'&&!recipe.biome){
    const cx=Math.floor(A/2),cz=Math.floor(D/2),bottom=Math.min(0,ey)-2,top=Math.max(0,ey)+10;
    for(let y=bottom;y<=top;y++)for(let x=cx-2;x<=cx+2;x++)for(let z=cz-2;z<=cz+2;z++)if(x===cx-2||x===cx+2||z===cz-2||z===cz+2)put([x,y,z],y%5===0?1:3);
    for(let x=cx-3;x<=cx+3;x++)for(let z=cz-3;z<=cz+3;z++)put([x,top+1,z],1);
  }
  for(const x of [0,endX])for(let z=-2;z<=2;z++)put([x,x===0?0:ey,z],plan.theme.index,'surface');
  const b={level:recipe.level,layout:recipe.layout,cells:[...cells.values()],mechanisms,mechanismPreview,path,zones,safeLinks,rise:ey,length:endX+1};
  decorateBiome(b,recipe);
  validateMixedBlueprint(b);
  const proofKey=`${recipe.seed}:${recipe.level}:${trend}:${recipe.layout}:${recipe.biome||'classic'}:${recipe.features||0}:${recipe.variety||0}:${recipe.terrain??0}`;
  if(!MIXED_PROOFS.has(proofKey)){
    const first=replayMixedBlueprint(b,0),late=replayMixedBlueprint(b,17.317,true);
    if(!first.ok||!late.ok)throw Error('立体路线回放失败 '+JSON.stringify({recipe,trend,first,late}));
    MIXED_PROOFS.set(proofKey,{verified:true,roomKinds:plan.kinds,layout:recipe.layout,...(recipe.biome?{biome:recipe.biome}:{}),...(recipe.features?{features:recipe.features}:{}),...(recipe.variety?{variety:recipe.variety,terrain:recipe.terrain}:{}),method:'full-physics-replay',steps:first.steps+late.steps});
  }
  b.certificate=MIXED_PROOFS.get(proofKey);return b;
}

// Replay a whole mixed segment through the same fixed-step collider used by
// the game. The witness waits on permanent pads for each certified time window.
export function replayMixedBlueprint(b,startTime=0,mirror=false){
  const blocks=new Set(b.cells.map(c=>mirror?key(-c.cell[0],c.cell[1],-c.cell[2]):key(...c.cell))),state=createMechanismState();
  const mechanisms=b.mechanisms.map((m,i)=>({...m,id:`mixed-proof-${i}`,x:m.u+.5,z:m.v+.5,dir:m.dir||1}));
  const physicalMechanisms=mirror?mechanisms.map(m=>({...m,x:1-m.x,z:1-m.z,dir:-m.dir})):mechanisms;
  const p={x:.5,y:1.01,z:.5,vx:0,vy:0,vz:0,grounded:false,supportId:null};let time=startTime,steps=0,failure=null;
  const lowest=Math.min(...b.path.map(q=>q[1]))-1;
  function advance(input){
    const physical=mirror?{...p,x:1-p.x,z:1-p.z,vx:-p.vx,vz:-p.vz}:p;
    const action=mirror?{...input,move:{x:-input.move.x,z:-input.move.z}}:input;
    const hit=stepDynamicPlayer(physical,DT,action,(x,y,z)=>blocks.has(key(x,y,z)),physicalMechanisms,time,state);
    if(mirror)Object.assign(p,physical,{x:1-physical.x,z:1-physical.z,vx:-physical.vx,vz:-physical.vz});time+=DT;steps++;
    if(hit||p.y<lowest||b.effects?.some(e=>touchesBiomeHazard(p,e)))failure=hit?.type||(p.y<lowest?'fall':'lava');
  }
  function moveTo(x,y,z=.5){
    for(let i=0;i<2400;i++){
      if(failure)return false;
      if(Math.hypot(p.x-x,p.z-z)<.015&&Math.hypot(p.vx,p.vz)<.06&&p.grounded&&Math.abs(p.y-y)<.06)return true;
      const dx=x-p.x,dz=z-p.z,scale=Math.max(1,Math.hypot(dx,dz)*2.5);
      advance({move:{x:dx*2.5/scale,z:dz*2.5/scale},jump:p.grounded&&y-p.y>.4});
    }
    failure='connector timeout';return false;
  }
  for(const zone of b.zones){
    const [ax,base,az]=zone.entry||[zone.start,zone.base,0],dir=zone.dir||1;
    const link=b.safeLinks.find(s=>s.to===zone.index);
    if(link)for(const q of link.waypoints)if(!moveTo(q[0]+.5,q[1]+1,q[2]+.5))return {ok:false,reason:failure,zone:zone.index,position:{...p}};
    if(!moveTo(ax+.5,base+1,az+.5))return {ok:false,reason:failure,zone:zone.index,position:{...p}};
    const room=challengeRoom(zone.kind,b.level,zone.variant||0),localMechanisms=mechanisms.filter(m=>m.zone===zone.index).map(m=>({...m,x:(m.x-ax-.5)*dir+.5,y:m.y-base,z:(m.z-az-.5)*dir+.5,dir:m.dir*dir}));
    const m=localMechanisms[0],proof=zone.certificate,period=proof.period;
    if(period){
      const shift=mechanismPhaseShift(m,period);
      const current=((time+shift)%period+period)%period,target=((proof.startTime%period)+period)%period;
      const wait=((target-current)%period+period)%period;
      for(let i=0;i<Math.ceil(wait/DT);i++)advance({move:{x:0,z:0}});
    }
    const policy=makePolicy({...room,mechanisms:localMechanisms});let completed=false;
    for(let i=0;i<1800;i++){
      const input=policy({...p,x:(p.x-ax-.5)*dir+.5,y:p.y-base,z:(p.z-az-.5)*dir+.5,vx:p.vx*dir,vz:p.vz*dir},time);
      advance({...input,move:{x:input.move.x*dir,z:input.move.z*dir}});
      if(failure||p.y<base+.2)return {ok:false,reason:failure||'lost support',zone:zone.index,position:{...p}};
      if((p.x-ax-.5)*dir+.5>=zone.length-1&&p.grounded){completed=true;break;}
    }
    if(!completed)return {ok:false,reason:'room timeout',zone:zone.index,position:{...p}};
  }
  const terminal=b.safeLinks.find(s=>s.to==='exit');
  if(terminal)for(const q of terminal.waypoints)if(!moveTo(q[0]+.5,q[1]+1,q[2]+.5))return {ok:false,reason:failure,position:{...p}};
  return {ok:!failure,reason:failure,duration:time-startTime,steps};
}
