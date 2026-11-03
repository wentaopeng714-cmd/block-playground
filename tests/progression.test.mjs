import assert from 'node:assert/strict';
import {createGrowth,serializeGrowth,mergeGrowth,growthStatus,refillShield,shieldImpact,resourcePickups,collectNearby} from '../dist/progression.js';
import {makeRoute,appendModule,serializeRoute,validateRoute,MODULES} from '../dist/segments.js';
import {key,occupancy} from '../dist/world.js';
import {stepDynamicPlayer,mechanismPose,touchesMechanism,createMechanismState} from '../dist/mechanisms.js';
import {challengeRoom} from '../dist/mixed-scenes.js';

const state=createGrowth(),at={x:0,y:1,z:0},pickup=i=>({id:`test:${i}`,x:0,y:1.7,z:0});
for(let i=0;i<3;i++)collectNearby(state,[pickup(i)],at);
assert.equal(state.level,1);assert.equal(state.materials,0);assert.equal(state.charges,1);
assert.equal(collectNearby(state,[pickup(2)],at).collected.length,0,'Retry cannot award the same material twice');
let event;
for(let i=3;i<9;i++)event=collectNearby(state,[pickup(i)],at);
assert.equal(state.level,2);assert.equal(state.materials,0);assert.equal(state.charges,2);assert.equal(event.spent,6);
for(let i=9;i<18;i++)event=collectNearby(state,[pickup(i)],at);
assert.equal(state.level,3);assert.equal(state.materials,0);assert.equal(state.charges,3);assert.equal(event.spent,9);assert(growthStatus(state).max);
collectNearby(state,[pickup(18)],at);assert.equal(state.level,3);assert.equal(state.materials,1);
const restored=createGrowth(JSON.parse(JSON.stringify(serializeGrowth(state))));assert.equal(restored.total,19);assert.equal(restored.level,3);
const other=createGrowth({version:1,collected:['test:18','test:19']});mergeGrowth(restored,serializeGrowth(other));assert.equal(restored.total,20);
mergeGrowth(restored,serializeGrowth(other));assert.equal(restored.total,20,'Merging another tab/import must be idempotent');
assert.throws(()=>createGrowth({version:2,collected:[]}));assert.throws(()=>createGrowth({version:1,collected:['<bad>']}));

// A shield protects against a real fire collision without resetting the player.
const shield=createGrowth({version:1,collected:['s:0','s:1','s:2']}),room=challengeRoom('fire',1),fire=room.mechanisms[0],floor=new Set(room.cells.map(c=>key(...c.cell)));
const p={x:fire.x,y:1,z:fire.z,vx:0,vy:0,vz:0,grounded:true},time=fire.warning+.4;
const hit=stepDynamicPlayer(p,1/90,{move:{x:0,z:0}},(x,y,z)=>floor.has(key(x,y,z)),room.mechanisms,time,createMechanismState());
assert.equal(hit.type,'fire');assert.equal(shieldImpact(shield,time),'blocked');assert.equal(shield.charges,0);assert.equal(p.x,fire.x);
for(let i=1;i<60;i++)assert.equal(shieldImpact(shield,time+i/90),'protected','Continuous contact cannot spend multiple charges');
assert.equal(shieldImpact(shield,time+1.3),'unprotected');
refillShield(shield,time+2);assert.equal(shield.charges,1);assert.equal(shieldImpact(shield,time+2.1),'blocked');
assert.equal(createGrowth(serializeGrowth(shield)).charges,1,'Crafted upgrades survive reload and begin with full charges');
assert.equal(shieldImpact(createGrowth(),1),'unprotected','Uncrafted players retain the original challenge');

const recipe={kind:'mix',seed:1701,level:1,layout:'bend',biome:'forest',features:1,variety:1,terrain:0};
const world=makeRoute([recipe],'顺路采集',716),items=resourcePickups(world),solid=occupancy(world),beginner=createGrowth();
assert(items.length>=9);assert.equal(new Set(items.map(q=>q.id)).size,items.length);
const player={...world.spawn,vx:0,vy:0,vz:0,grounded:false};let upgradedAt=null;
for(let i=0;i<180;i++){
  stepDynamicPlayer(player,1/90,{move:{x:1,z:0}},(x,y,z)=>solid.has(key(x,y,z)),world.mechanisms,i/90,createMechanismState());
  const event=collectNearby(beginner,items,player);if(event.upgraded){upgradedAt=i/90;break;}
}
assert(upgradedAt!==null&&upgradedAt<2,'First upgrade requires only walking across the safe start area');
assert.equal(world.modules.length,1,'Gathering never changes the four-choice building recipe');
const same=createGrowth();collectNearby(same,[{id:'high:0',x:0,y:13.7,z:0}],at);assert.equal(same.total,0,'Pickups do not leak between stacked decks');
collectNearby(same,[{id:'far:0',x:5,y:1.7,z:0}],at);assert.equal(same.total,0,'Materials must be approached');
collectNearby(same,[{id:'jump:0',x:0,y:1.7,z:0}],{x:0,y:2.49,z:0});assert.equal(same.total,1,'A forgiving pickup field works while jumping');

const added=appendModule(world,{...recipe,seed:77,layout:'ridge',terrain:1});
const ids=new Set(resourcePickups(added).map(q=>q.id));for(const q of items)assert(ids.has(q.id),'Appending preserves collected pickup identities');
assert.deepEqual(resourcePickups(validateRoute(serializeRoute(added))),resourcePickups(added));
assert.deepEqual(resourcePickups({...world,name:'改个名字'}),items,'Renaming does not respawn materials');

// Every pickup sits on permanent floor with headroom and outside active hazards
// throughout their cycles, covering all old scene types and new route families.
const cases=MODULES.map(m=>makeRoute([m.id]));
for(const [i,biome]of ['forest','snow','lava','desert'].entries())for(const layout of ['bend','tower','weave','zigzag','ridge','courtyard'])cases.push(makeRoute([{...recipe,seed:1701+i*3719,level:3,biome,layout,terrain:i}]));
let checked=0;
for(const w of cases){
  const cells=occupancy(w);
  for(const q of resourcePickups(w)){
    const x=Math.floor(q.x),y=Math.round(q.floorY-1),z=Math.floor(q.z);
    assert(cells.has(key(x,y,z))&&!cells.has(key(x,y+1,z))&&!cells.has(key(x,y+2,z)));
    for(const m of w.mechanisms.filter(m=>Math.abs(m.x-q.x)<18&&Math.abs(m.z-q.z)<9)){
      const period=m.type==='sweeper'?Math.PI*2/m.speed:m.period||1;
      for(let sample=0;sample<33;sample++)assert(!touchesMechanism({x:q.x,y:q.floorY,z:q.z},mechanismPose(m,sample*period/33)),`Unsafe resource next to ${m.type}`);
    }
    checked++;
  }
}
console.log(`Passed: automatic 3/6/9-material crafting, persistent/idempotent collection, import merging, shield charges and contact grace, checkpoint refill, first upgrade in ${upgradedAt.toFixed(2)}s of walking, stacked-deck isolation, append/save identity and ${checked} safe pickup locations.`);
