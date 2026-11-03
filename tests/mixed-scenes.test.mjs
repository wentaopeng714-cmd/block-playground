import assert from 'node:assert/strict';
import {ROOM_KINDS,roomCertificate,challengeRoom,replayRoom,mixedPlan,mixedBlueprint,mixedMeta,validateMixedBlueprint,replayMixedBlueprint} from '../dist/mixed-scenes.js';
import {makeRoute,moduleOffers,appendModule,serializeRoute,validateRoute} from '../dist/segments.js';
import {key,occupancy} from '../dist/world.js';
for(const level of [1,2,3])for(const kind of ROOM_KINDS){const p=roomCertificate(kind,level);assert(p.verified);for(const delta of [-.07,0,.07])assert(replayRoom(challengeRoom(kind,level),p.startTime+delta).ok);}
const combinations=new Set(),seenKinds=new Set();let checked=0;
for(const level of [1,2,3])for(let i=0;i<32;i++)for(const trend of [1,-1]){
  const recipe={kind:'mix',seed:(Math.imul(i+1,2654435761)+9001)>>>0,level},b=mixedBlueprint(recipe,trend);
  assert(b.certificate.verified&&b.certificate.method==='full-physics-replay');assert.equal(b.zones.length,level===3?3:2);
  assert.equal(new Set(b.zones.map(z=>z.kind)).size,b.zones.length);assert.equal(b.safeLinks.length,b.zones.length-1);
  assert(b.safeLinks.every(s=>s.end-s.start>=6));assert(validateMixedBlueprint(b));
  combinations.add(b.zones.map(z=>z.kind).join(','));b.zones.forEach(z=>seenKinds.add(z.kind));checked++;
}
assert(combinations.size>=12);assert.equal(seenKinds.size,6);
const ordered=mixedBlueprint({kind:'mix',seed:1,level:2});assert.deepEqual(ordered.zones.map(z=>z.kind),['collapse','gate']);
const lastCrumble=Math.max(...ordered.mechanisms.filter(m=>m.type==='collapse').map(m=>m.u+1));
assert(ordered.mechanisms.find(m=>m.type==='gate').u-lastCrumble>6,'Waiting gate must be separated from collapsing floor');
const bad=structuredClone(ordered);bad.mechanisms[0].u=bad.safeLinks[0].start+1;assert.throws(()=>validateMixedBlueprint(bad));
const blocked=structuredClone(ordered);for(let z=-2;z<=2;z++)for(let y=1;y<=4;y++)blocked.cells.push({cell:[1,y,z],color:10});
assert(!replayMixedBlueprint(blocked).ok,'A blocked path must fail the real physics replay');
const empty=makeRoute([],'可复现路线',91637),offers=moduleOffers(empty);assert.equal(offers.length,4);assert.deepEqual(offers.map(m=>m.difficulty),[1,2,2,3]);
assert(offers.every(o=>o.verified&&o.mixed&&o.hazards.length>=2));assert.equal(new Set(offers.map(o=>o.id)).size,4);
assert.deepEqual(moduleOffers(empty).map(o=>o.recipe),offers.map(o=>o.recipe));
let w=empty;for(const offer of offers){
  const single=appendModule(empty,offer.recipe),actual=single.segments[0],preview=mixedBlueprint(offer.recipe);
  assert.deepEqual(actual.zones.map(z=>z.kind),offer.hazards);assert.deepEqual(single.mechanisms.map(m=>[m.type,m.phase]),preview.mechanisms.map(m=>[m.type,m.phase]));
  w=appendModule(w,offer.recipe);
}
w=appendModule(w,'garden');w=appendModule(w,offers[3].recipe);
for(let i=1;i<w.segments.length;i++){const a=w.segments[i-1],b=w.segments[i];assert.equal(a.exit[1],b.entry[1]);if(i%4)assert.equal(b.entry[0],a.exit[0]+a.dir);else{assert.equal(b.entry[0],a.exit[0]);assert.equal(b.dir,-a.dir);}}
assert.deepEqual(validateRoute(JSON.parse(JSON.stringify(serializeRoute(w)))),w);
assert.deepEqual(moduleOffers(validateRoute(serializeRoute(w))).map(o=>o.recipe),moduleOffers(w).map(o=>o.recipe));
assert.throws(()=>validateRoute({version:2,name:'bad',modules:[{kind:'mix',seed:-1,level:2}]}));
assert.throws(()=>makeRoute([],'bad',NaN));
console.log(`Passed: ${checked} mixed layouts, ${checked*2} complete physics witnesses including reversed travel, ${combinations.size} distinct orders, stable waiting areas, reject blocked paths, preview/placement identity, variable-length seams and deterministic saves.`);
