import assert from 'node:assert/strict';
import {mixedBlueprint,replayMixedBlueprint,ROUTE_LAYOUTS,isMixedRecipe} from '../dist/mixed-scenes.js';
import {makeRoute,moduleOffers,serializeRoute,validateRoute} from '../dist/segments.js';
import {key} from '../dist/world.js';
import {stepDynamicPlayer,createMechanismState} from '../dist/mechanisms.js';

let layouts=0;const hazards=new Set();
for(const layout of ['bend','tower','weave'])for(const level of [1,2,3])for(let seed=0;seed<16;seed++)for(const trend of [1,-1]){
  const b=mixedBlueprint({kind:'mix',seed:Math.imul(seed+1,2654435761)>>>0,level,layout},trend);
  assert.equal(b.certificate.method,'full-physics-replay');
  assert.equal(b.certificate.layout,layout);assert.equal(b.safeLinks.length,b.zones.length);
  assert(b.path.some(p=>p[2]!==0));assert(Math.abs(b.rise)>=4);
  assert.deepEqual(b.path.at(-1),[b.length-1,b.rise,0]);
  for(const link of b.safeLinks){
    assert(link.waypoints.length>=2);
    for(let i=1;i<link.path.length;i++){
      const a=link.path[i-1],c=link.path[i];
      assert.equal(Math.abs(a[0]-c[0])+Math.abs(a[2]-c[2]),1);
      assert(Math.abs(a[1]-c[1])<=1);
    }
  }
  b.zones.forEach(z=>hazards.add(z.kind));
  if(layout==='weave'){const first=b.zones[0],last=b.zones.at(-1);assert.equal(first.entry[2],last.entry[2]);assert.equal(Math.abs(first.base-last.base),12);}
  layouts++;
}
assert.equal(hazards.size,6);assert(!isMixedRecipe({kind:'mix',seed:1,level:1,layout:'broken'}));
const offers=moduleOffers(makeRoute([],undefined,76));assert.equal(offers.length,4);
assert.equal(new Set(offers.map(o=>o.recipe.layout)).size,4);assert(offers.every(o=>Object.hasOwn(ROUTE_LAYOUTS,o.recipe.layout)));

// Replay in the fully assembled world's colliders and all moving hazards,
// so an adjacent or overlapping deck cannot invalidate an isolated proof.
const recipes=Array.from({length:12},(_,i)=>({kind:'mix',seed:(1701+i*7921)>>>0,level:1+i%3,layout:['bend','tower','weave'][i%3]}));
const w=makeRoute(recipes,'立体路线',76),allCells=w.pieces.flatMap(p=>p.cells);
assert.deepEqual(validateRoute(serializeRoute(w)),w);
for(const s of w.segments){
  const trend=s.entry[1]>=20?-1:1,b=mixedBlueprint(s.id,trend),dir=s.dir;
  b.cells=allCells.map(c=>({cell:[(c[0]-s.entry[0])*dir,c[1]-s.entry[1],(c[2]-s.entry[2])*dir],color:0}));
  b.mechanisms=w.mechanisms.map(m=>({...m,u:(m.x-.5-s.entry[0])*dir,v:(m.z-.5-s.entry[2])*dir,y:m.y-s.entry[1],dir:m.dir*dir,zone:m.segment===s.index?m.zone:-1}));
  const proof=replayMixedBlueprint(b,9.731+s.index*.33);
  assert(proof.ok,`Global route segment ${s.index}: ${JSON.stringify(proof)}`);
}

// Whole-row U turns also run through the actual combined static and dynamic
// world, with no teleporting at corners or gaps between wide scene footprints.
const solid=new Set(allCells.map(c=>key(...c))),state=createMechanismState();
for(const c of w.connections){
  const start=w.segments[c.from].exit,end=w.segments[c.to].entry;
  const p={x:start[0]+.5,y:start[1]+1.01,z:start[2]+.5,vx:0,vy:0,vz:0,grounded:false};
  const targets=[...c.path,end].filter((q,i,a)=>i===0||i===a.length-1||(i>0&&i<a.length-1&&(q[0]-a[i-1][0]!==a[i+1][0]-q[0]||q[2]-a[i-1][2]!==a[i+1][2]-q[2])));
  let time=0;
  for(const q of targets){
    let reached=false;
    for(let j=0;j<2400;j++){
      const dx=q[0]+.5-p.x,dz=q[2]+.5-p.z;
      if(Math.hypot(dx,dz)<.03&&Math.hypot(p.vx,p.vz)<.1&&p.grounded){reached=true;break;}
      const scale=Math.max(1,Math.hypot(dx,dz)*2.5);
      const hit=stepDynamicPlayer(p,1/90,{move:{x:dx*2.5/scale,z:dz*2.5/scale}},(x,y,z)=>solid.has(key(x,y,z)),w.mechanisms,time,state);time+=1/90;
      assert(!hit&&p.y>start[1]-.1,'Row connector must stay safe');
    }
    assert(reached,'Row connector must reach each corner');
  }
}
const legacy=makeRoute([{kind:'mix',seed:1701,level:2}]);assert.equal(legacy.segments[0].layout,null);
assert(!Object.hasOwn(serializeRoute(legacy).modules[0],'layout'),'Existing saved recipes retain their old geometry');
console.log(`Passed: ${layouts} turning, tower and stacked layouts / ${layouts*2} physics witnesses; all 6 hazard types; 12 fully assembled segments and row turns; three layout choices; persistent recipe compatibility.`);
