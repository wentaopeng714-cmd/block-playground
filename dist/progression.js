import {key,occupancy} from './world.js?v=10.0';

// Automatic crafting costs 3, then 6, then 9 materials. Only the unique pickup
// ledger is persisted, so balance/level cannot disagree after import or merging.
export const GROWTH_THRESHOLDS=[0,3,9,18];
export const MAX_SHIELD_LEVEL=3;
function validateLedger(data){
  if(!data||data.version!==1||!Array.isArray(data.collected)||data.collected.length>100000||!data.collected.every(id=>typeof id==='string'&&/^[a-z0-9:._-]{1,100}$/.test(id)))throw Error('成长存档格式不正确');
  return new Set(data.collected);
}
function recompute(state){
  state.total=state.collected.size;state.level=GROWTH_THRESHOLDS.reduce((level,n,i)=>state.total>=n?i:level,0);
  state.materials=state.total-GROWTH_THRESHOLDS[state.level];
}
export function createGrowth(data=null){
  const state={collected:data?validateLedger(data):new Set(),level:0,materials:0,total:0,charges:0,protectedUntil:0};
  recompute(state);state.charges=state.level;return state;
}
export function serializeGrowth(state){return {version:1,collected:[...state.collected]};}
export function mergeGrowth(state,data){
  const incoming=validateLedger(data),old=state.level;
  for(const id of incoming)state.collected.add(id);recompute(state);
  if(state.level>old)state.charges=state.level;
  return incoming.size!==state.collected.size;
}
export function growthStatus(state){
  const max=state.level===MAX_SHIELD_LEVEL,cost=max?0:GROWTH_THRESHOLDS[state.level+1]-GROWTH_THRESHOLDS[state.level];
  return {level:state.level,materials:state.materials,charges:state.charges,cost,remaining:max?0:cost-state.materials,progress:max?1:state.materials/cost,max};
}
export function refillShield(state,time=0,grace=0){state.charges=state.level;state.protectedUntil=Math.max(state.protectedUntil,time+grace);}
export function shieldImpact(state,time){
  if(time<state.protectedUntil)return 'protected';
  if(!state.charges)return 'unprotected';
  state.charges--;state.protectedUntil=time+1.25;return 'blocked';
}
function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
export function resourcePickups(world){
  const solid=occupancy(world),items=[],used=new Set(),seed=(world.routeSeed??1701).toString(36);
  function add(id,x,y,z){
    const floor=Math.round(y-1),cell=key(Math.floor(x),floor,Math.floor(z)),position=key(x,y,z);
    if(used.has(position)||!solid.has(cell)||solid.has(key(Math.floor(x),floor+1,Math.floor(z)))||solid.has(key(Math.floor(x),floor+2,Math.floor(z))))return;
    used.add(position);items.push({id:`r${seed}:${id}`,x,y:floor+1.7,z,floorY:floor+1});
  }
  for(const [i,offset]of [0,1.4,2.8].entries())add(`start${i}`,world.spawn.x+offset,world.spawn.y,world.spawn.z);
  let prefix=seed;
  for(const s of world.segments){
    prefix=hash(`${prefix}:${JSON.stringify(world.modules[s.index])}`).toString(36);
    const zones=s.zones.length?s.zones:[{entry:s.entry,exit:s.exit,dir:s.dir}];
    zones.forEach((q,i)=>{
      const stem=`${prefix}:z${i}`,a=q.entry,b=q.exit;
      add(`${stem}:a`,a[0]+.5,a[1]+1,a[2]+.5);
      add(`${stem}:b`,a[0]+q.dir+.5,a[1]+1,a[2]+.5);
      add(`${stem}:c`,b[0]+.5,b[1]+1,b[2]+.5);
    });
  }
  return items;
}
export function collectNearby(state,pickups,player){
  const collected=[],oldLevel=state.level;
  for(const q of pickups){
    if(state.collected.has(q.id)||Math.hypot(player.x-q.x,player.z-q.z)>.8||Math.abs(player.y+.8-q.y)>2.1)continue;
    state.collected.add(q.id);collected.push(q);
  }
  if(collected.length){recompute(state);if(state.level>oldLevel)state.charges=state.level;}
  return {collected,oldLevel,level:state.level,upgraded:state.level>oldLevel,spent:GROWTH_THRESHOLDS[state.level]-GROWTH_THRESHOLDS[oldLevel]};
}
