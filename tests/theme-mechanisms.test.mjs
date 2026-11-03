import assert from 'node:assert/strict';
import {stepDynamicPlayer,mechanismPose,touchesMechanism,createMechanismState} from '../dist/mechanisms.js';
import {FEATURE_KINDS,BIOME_FEATURES,challengeRoom,roomCertificate,replayRoom,mixedBlueprint,replayMixedBlueprint,isMixedRecipe} from '../dist/mixed-scenes.js';
import {makeRoute,moduleOffers,serializeRoute,validateRoute,appendModule} from '../dist/segments.js';
import {key} from '../dist/world.js';

const fresh=(x=.5)=>({x,y:1.01,z:.5,vx:0,vy:0,vz:0,grounded:false});
for(const kind of FEATURE_KINDS)for(const level of [1,2,3]){
  const room=challengeRoom(kind,level),proof=roomCertificate(kind,level);
  for(const delta of [-.07,0,.07])assert(replayRoom(room,proof.startTime+delta).ok);
  const p=fresh(),solid=new Set(room.cells.map(c=>key(...c.cell))),state=createMechanismState();
  for(let i=0;i<900;i++)assert.equal(stepDynamicPlayer(p,1/90,{move:{x:0,z:0}},(x,y,z)=>solid.has(key(x,y,z)),room.mechanisms,i/90,state),null,'Waiting pad stays safe for a whole cycle');
  assert(Math.abs(p.x-.5)<.01&&Math.abs(p.y-1)<.02);assert(!p.onIce);
}
const logRoom=challengeRoom('log',2),log=logRoom.mechanisms[0];
const rolling=mechanismPose(log,log.warning+.8);
assert(rolling.x<log.x&&rolling.active);assert(touchesMechanism({x:rolling.x,y:1,z:.5},rolling));
assert(!touchesMechanism({x:rolling.x,y:3,z:.5},rolling));
assert(!touchesMechanism({x:rolling.x,y:1,z:4},rolling));
assert(!mechanismPose(log,log.warning+log.rollDuration+.1).active);
const runner=fresh(),logFloor=new Set(logRoom.cells.map(c=>key(...c.cell)));let logHit=false;
for(let i=0;i<500;i++){if(stepDynamicPlayer(runner,1/90,{move:{x:1,z:0}},(x,y,z)=>logFloor.has(key(x,y,z)),logRoom.mechanisms,i/90)){logHit=true;break;}}
assert(logHit,'A moving log must hit a runner who never jumps');

// Measure actual stopping distance, countersteering and height isolation.
const ice={...challengeRoom('ice',2).mechanisms[0],width:60,id:'ice-test'};
function stopOn(iceEnabled,reverse=false,height=1){
  const p={...fresh(10),y:height,vx:6,grounded:true};let duration=0;
  const solid=(x,y,z)=>x>=-100&&x<100&&z>=-10&&z<10&&y===height-1;
  for(let i=0;i<800&&p.vx>.03;i++){stepDynamicPlayer(p,1/90,{move:{x:reverse?-1:0,z:0}},solid,iceEnabled?[ice]:[],i/90);duration+=1/90;}
  return {distance:p.x-10,duration,onIce:p.onIce};
}
const dry=stopOn(false),slippery=stopOn(true),braked=stopOn(true,true),upper=stopOn(true,false,13);
assert(slippery.distance>dry.distance*5&&slippery.duration>dry.duration*4);
assert(braked.distance<slippery.distance*.5,'Opposite input brakes more effectively than releasing controls');
assert(Math.abs(upper.distance-dry.distance)<.01&&!upper.onIce,'An ice layer must not affect a different deck');
const snowRoom=challengeRoom('ice',3),snowFloor=new Set(snowRoom.cells.map(c=>key(...c.cell))),slider={...fresh(10),y:1,vx:6.4,grounded:true};
for(let i=0;i<700;i++)stepDynamicPlayer(slider,1/90,{move:{x:0,z:0}},(x,y,z)=>snowFloor.has(key(x,y,z)),snowRoom.mechanisms,i/90);
assert(slider.grounded&&slider.x<15.5&&!slider.onIce,'Dry runout catches a released full-speed slide before the exit');

const fire=challengeRoom('fire',2).mechanisms[0],hot=mechanismPose(fire,fire.warning+.4);
assert(mechanismPose(fire,fire.warning/2).warning&&!mechanismPose(fire,fire.warning/2).active);
assert(touchesMechanism({x:fire.x,y:1,z:.5},hot));
assert(touchesMechanism({x:fire.x,y:2.49,z:.5},hot),'A full-height fire jet must require timing');
assert(!touchesMechanism({x:fire.x,y:1,z:.5},mechanismPose(fire,fire.warning+fire.burst+.1)));
const crusher=challengeRoom('crusher',2).mechanisms[0];
assert(touchesMechanism({x:crusher.x,y:1,z:.5},mechanismPose(crusher,0)));
assert(!touchesMechanism({x:crusher.x,y:1,z:.5},mechanismPose(crusher,2.5)));

let checked=0;
for(const biome of Object.keys(BIOME_FEATURES))for(const layout of ['bend','tower','weave'])for(const level of [1,2,3])for(const seed of [1,77,1701,9173])for(const trend of [1,-1]){
  const recipe={kind:'mix',seed,level,layout,biome,features:1},b=mixedBlueprint(recipe,trend);
  assert.equal(b.zones[0].kind,BIOME_FEATURES[biome]);assert(b.certificate.verified);assert.equal(b.certificate.features,1);checked++;
}
const recipes=Array.from({length:12},(_,i)=>({kind:'mix',seed:1701+i*3719,level:i%3+1,layout:['bend','tower','weave'][i%3],biome:Object.keys(BIOME_FEATURES)[i%4],features:1}));
const world=makeRoute(recipes,'主题机关冒险',76),cells=world.pieces.flatMap(p=>p.cells);
assert.deepEqual(validateRoute(serializeRoute(world)),world);
for(const s of world.segments){
  const b=mixedBlueprint(s.id,s.entry[1]>=20?-1:1),dir=s.dir;
  b.cells=cells.map(c=>({cell:[(c[0]-s.entry[0])*dir,c[1]-s.entry[1],(c[2]-s.entry[2])*dir],color:0}));
  b.mechanisms=world.mechanisms.map(m=>({...m,u:(m.x-.5-s.entry[0])*dir,v:(m.z-.5-s.entry[2])*dir,y:m.y-s.entry[1],dir:m.dir*dir,zone:m.segment===s.index?m.zone:-1}));
  b.effects=world.effects.map(e=>({...e,center:[(e.center[0]-s.entry[0])*dir,e.center[1]-s.entry[1],(e.center[2]-s.entry[2])*dir]}));
  const proof=replayMixedBlueprint(b,12.937+s.index*.21);assert(proof.ok,`Feature world segment ${s.index}: ${JSON.stringify(proof)}`);
}
const old={kind:'mix',seed:1701,level:2,layout:'tower',biome:'forest'},legacy=makeRoute([old]);
assert(!legacy.mechanisms.some(m=>FEATURE_KINDS.includes(m.type)));
const offers=moduleOffers(legacy);assert.equal(offers.length,4);
for(const offer of offers){assert(offer.hazards.includes(BIOME_FEATURES[offer.recipe.biome]));assert.equal(offer.recipe.features,1);}
const appended=appendModule(legacy,offers[0].recipe);assert.deepEqual(appended.segments[0],legacy.segments[0]);
assert(!Object.hasOwn(serializeRoute(legacy).modules[0],'features'));
assert(!isMixedRecipe({...old,features:2}));assert(!isMixedRecipe({kind:'mix',seed:1,level:1,features:1}));
console.log(`Passed: log motion/collision/jump, icy inertia/countersteering/dry runout, timed fire warning/contact/safe window, stone crushers, safe waiting pads, ${checked} themed-feature layouts / ${checked*2} full physics witnesses, 12 complete assembled segments, four deterministic choices and old recipe compatibility.`);
