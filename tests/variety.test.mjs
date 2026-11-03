import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TERRAIN_TYPES} from '../dist/terrain.js';
import {ROOM_KINDS,FEATURE_KINDS,BIOME_FEATURES,ROUTE_LAYOUTS,mixedPlan,mixedBlueprint,replayMixedBlueprint,challengeRoom,roomCertificate,replayRoom,isMixedRecipe} from '../dist/mixed-scenes.js';
import {makeRoute,moduleOffers,serializeRoute,validateRoute} from '../dist/segments.js';
const biomes=Object.keys(TERRAIN_TYPES),layouts=Object.keys(ROUTE_LAYOUTS);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const kind of [...ROOM_KINDS,...FEATURE_KINDS])for(const level of [1,2,3])for(const variant of [1,2]){
  const room=challengeRoom(kind,level,variant),proof=roomCertificate(kind,level,variant);
  assert(room.entryPad===variant&&room.length>challengeRoom(kind,level).length);
  for(const dt of [-.07,0,.07])assert(replayRoom(room,proof.startTime+dt).ok);
  if(['collapse','platform'].includes(kind))assert(!room.cells.some(c=>c.cell[0]===6+variant&&c.cell[1]===0&&c.cell[2]===0),'Padding must not fill a dynamic gap');
}
let checked=0;const positions=new Set(),variants=new Set(),orders=new Set();
for(const biome of biomes)for(const terrain of [0,1,2,3])for(const layout of layouts)for(const level of [1,2,3])for(const trend of [1,-1]){
  const recipe={kind:'mix',seed:1701+terrain*719+level*307,level,layout,biome,features:1,variety:1,terrain},b=mixedBlueprint(recipe,trend);
  assert(b.certificate.verified&&b.certificate.variety===1&&b.certificate.terrain===terrain);
  assert(b.sceneryCount>20&&b.landmarks.length>0);assert.equal(b.terrain,terrain);
  assert.deepEqual(b.path.at(-1),[b.length-1,b.rise,0]);
  const kinds=b.zones.map(z=>z.kind);assert.equal(new Set(kinds).size,kinds.length);assert(kinds.length>=2&&kinds.length<=3);
  positions.add(kinds.indexOf(BIOME_FEATURES[biome]));b.zones.forEach(z=>variants.add(z.variant));orders.add(kinds.join(','));checked++;
}
assert.deepEqual(positions,new Set([0,1,2]));assert.deepEqual(variants,new Set([0,1,2]));assert(orders.size>24);
for(const biome of biomes){
  const blueprints=[0,1,2,3].map(terrain=>mixedBlueprint({kind:'mix',seed:1701,level:2,layout:'tower',biome,features:1,variety:1,terrain}));
  assert.equal(new Set(blueprints.map(b=>digest(b.cells))).size,4,'Terrain choices change actual solid geometry');
  blueprints.forEach(b=>assert.deepEqual(b.path,blueprints[0].path,'Terrain is independent from route generation'));
}
const routeShapes=layouts.map(layout=>mixedBlueprint({kind:'mix',seed:1701,level:3,layout,biome:'forest',features:1,variety:1,terrain:0}).path);
assert.equal(new Set(routeShapes.map(digest)).size,6,'All six route families must have different geometry');

// Selected terrain cycles through all four forms before repeating. Candidate
// generation remains deterministic and presents four different route families.
const history=[],seen=new Map(biomes.map(b=>[b,new Set()]));
for(let round=0;round<8;round++){
  const state={routeSeed:736,modules:history},offers=moduleOffers(state);
  assert.equal(offers.length,4);assert.equal(new Set(offers.map(o=>o.recipe.biome)).size,4);assert.equal(new Set(offers.map(o=>o.recipe.layout)).size,4);
  assert.deepEqual(moduleOffers(state).map(o=>o.recipe),offers.map(o=>o.recipe));
  for(const offer of offers){
    const r=offer.recipe,past=history.filter(p=>p.biome===r.biome);
    assert(past.slice(-3).every(p=>p.terrain!==r.terrain));assert(past.at(-1)?.layout!==r.layout);
    if(past.length)assert.notDeepEqual(mixedPlan(past.at(-1)).kinds,offer.hazards);
    assert(offer.hazards.includes(BIOME_FEATURES[r.biome]));seen.get(r.biome).add(r.terrain);
  }
  history.push(...offers.map(o=>o.recipe));
}
for(const set of seen.values())assert.equal(set.size,4);

// Check every terrain in a complete 16-segment world, including neighbours,
// mirrored rows, tall/low decks, moving supports and lava pools.
const recipes=Array.from({length:16},(_,i)=>({kind:'mix',seed:1701+i*3719,level:i%3+1,layout:layouts[i%layouts.length],biome:biomes[i%4],features:1,variety:1,terrain:Math.floor(i/4)}));
const world=makeRoute(recipes,'十六种地形',76),cells=world.pieces.flatMap(p=>p.cells);
assert.deepEqual(validateRoute(serializeRoute(world)),world);
for(const s of world.segments){
  const b=mixedBlueprint(s.id,s.entry[1]>=20?-1:1),dir=s.dir;
  b.cells=cells.map(c=>({cell:[(c[0]-s.entry[0])*dir,c[1]-s.entry[1],(c[2]-s.entry[2])*dir],color:0}));
  b.mechanisms=world.mechanisms.map(m=>({...m,u:(m.x-.5-s.entry[0])*dir,v:(m.z-.5-s.entry[2])*dir,y:m.y-s.entry[1],dir:m.dir*dir,zone:m.segment===s.index?m.zone:-1}));
  b.effects=world.effects.map(e=>({...e,center:[(e.center[0]-s.entry[0])*dir,e.center[1]-s.entry[1],(e.center[2]-s.entry[2])*dir]}));
  const proof=replayMixedBlueprint(b,12.937+s.index*.21);assert(proof.ok,`Variety world segment ${s.index}: ${JSON.stringify(proof)}`);
}
for(const terrain of [-1,4,NaN])assert(!isMixedRecipe({...recipes[0],terrain}));
assert(!isMixedRecipe({...recipes[0],variety:2}));assert(!isMixedRecipe({...recipes[0],features:undefined}));
const legacy=makeRoute([{kind:'mix',seed:1701,level:2,layout:'tower',biome:'forest',features:1}]);
assert(!Object.hasOwn(serializeRoute(legacy).modules[0],'variety'));assert(!Object.hasOwn(serializeRoute(legacy).modules[0],'terrain'));
console.log(`Passed: 60 room variations with timing tolerance, 16 distinct terrains, six distinct route families, ${orders.size} mechanism orders with varying signature positions, ${checked} layouts / ${checked*2} physical witnesses, no immediate repeats, deterministic four-choice offers, and 16 complete assembled segments.`);
