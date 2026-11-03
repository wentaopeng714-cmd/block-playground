import assert from 'node:assert/strict';
import {BIOME_KEYS,BIOMES,touchesBiomeHazard} from '../dist/biomes.js';
import {mixedBlueprint,replayMixedBlueprint,isMixedRecipe} from '../dist/mixed-scenes.js';
import {makeRoute,moduleOffers,serializeRoute,validateRoute} from '../dist/segments.js';
import {COLORS,key} from '../dist/world.js';

let layouts=0;
for(const biome of BIOME_KEYS)for(const layout of ['bend','tower','weave'])for(const level of [1,2,3])for(const seed of [1,77,1701,9173])for(const trend of [1,-1]){
  const recipe={kind:'mix',seed,level,layout,biome},b=mixedBlueprint(recipe,trend),solid=new Set(b.cells.map(c=>key(...c.cell)));
  assert.equal(b.certificate.biome,biome);assert.equal(b.certificate.method,'full-physics-replay');
  assert(b.sceneryCount>100,'Each biome has actual landmark geometry');
  assert(b.cells.some(c=>c.color===BIOMES[biome].surface));
  assert(b.cells.every(c=>Number.isInteger(c.color)&&c.color>=0&&c.color<COLORS.length));
  assert(b.mechanisms.every(m=>m.biome===biome));assert.equal(b.effects[0].biome,biome);
  for(const [x,y,z]of b.path)for(const dy of [1,2])assert(!solid.has(key(x,y+dy,z)),'Scenery must leave standing headroom on every tier');
  layouts++;
}
for(const seed of [1,736,9173]){
  const w=makeRoute([],undefined,seed),offers=moduleOffers(w);assert.equal(offers.length,4);
  assert.deepEqual(new Set(offers.map(o=>o.recipe.biome)),new Set(BIOME_KEYS));
  assert.deepEqual(moduleOffers(w).map(o=>o.recipe),offers.map(o=>o.recipe));
}

// Full-world replay includes neighbouring solids, dynamic mechanisms, and lava
// pools after the same coordinate transforms used by the browser game.
const recipes=Array.from({length:12},(_,i)=>({kind:'mix',seed:1701+i*3719,level:i%3+1,layout:['bend','tower','weave'][i%3],biome:BIOME_KEYS[i%4]}));
const world=makeRoute(recipes,'四季冒险',76),cells=world.pieces.flatMap(p=>p.cells);
assert.equal(world.effects.length,12);assert.deepEqual(validateRoute(serializeRoute(world)),world);
for(const s of world.segments){
  const b=mixedBlueprint(s.id,s.entry[1]>=20?-1:1),dir=s.dir;
  b.cells=cells.map(c=>({cell:[(c[0]-s.entry[0])*dir,c[1]-s.entry[1],(c[2]-s.entry[2])*dir],color:0}));
  b.mechanisms=world.mechanisms.map(m=>({...m,u:(m.x-.5-s.entry[0])*dir,v:(m.z-.5-s.entry[2])*dir,y:m.y-s.entry[1],dir:m.dir*dir,zone:m.segment===s.index?m.zone:-1}));
  b.effects=world.effects.map(e=>({...e,center:[(e.center[0]-s.entry[0])*dir,e.center[1]-s.entry[1],(e.center[2]-s.entry[2])*dir]}));
  const proof=replayMixedBlueprint(b,8.713+s.index*.21);assert(proof.ok,`Themed world segment ${s.index}: ${JSON.stringify(proof)}`);
}
const pool={biome:'lava',center:[4,-2,5],width:4,depth:6};
assert(touchesBiomeHazard({x:4.5,y:-2,z:5.5},pool));
assert(!touchesBiomeHazard({x:4.5,y:1,z:5.5},pool));
assert(!touchesBiomeHazard({x:9,y:-2,z:5.5},pool));
assert(!touchesBiomeHazard({x:4.5,y:-2,z:5.5},{...pool,biome:'snow'}));
assert(!isMixedRecipe({kind:'mix',seed:1,level:1,layout:'bend',biome:'unknown'}));
assert(!isMixedRecipe({kind:'mix',seed:1,level:1,biome:'forest'}));
const legacy=makeRoute([{kind:'mix',seed:9173,level:2,layout:'tower'}]);
assert.equal(legacy.effects.length,0);assert(legacy.pieces.every(p=>p.color<11));
assert(!Object.hasOwn(serializeRoute(legacy).modules[0],'biome'));
console.log(`Passed: ${layouts} biome layouts / ${layouts*2} physical witnesses, all four styles in each offer, clear landings and headroom, 12 assembled themed segments, lava contact bounds, deterministic saves and original-route compatibility.`);
