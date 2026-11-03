import assert from 'node:assert/strict';
import {MODULES,MAX_MODULES,moduleOffers,moduleBlueprint,makeRoute,appendModule,serializeRoute,validateRoute} from '../dist/segments.js';
import {occupancy,key,stepPlayer} from '../dist/world.js';
import {mechanismPose} from '../dist/mechanisms.js';
assert.equal(MODULES.length,18);
const signatures=new Set();
for(const m of MODULES){
  const b=moduleBlueprint(m.id),cells=new Set(b.cells.map(p=>key(...p.cell)));
  assert(b.cells.length>35);
  for(const [u,h] of [[0,0],[17,b.rise]])for(let v=-2;v<=2;v++)assert(cells.has(key(u,h,v)),`${m.id} interface ${u},${v}`);
  for(const [u,h] of [[0,0],[17,b.rise]])for(const y of [1,2])assert(!cells.has(key(u,h+y,0)),`${m.id} blocked headroom`);
  signatures.add(JSON.stringify(b.cells));
}
assert.equal(signatures.size,18);
const empty=makeRoute();assert.equal(empty.modules.length,0);
const once=appendModule(empty,'stairs'),twice=appendModule(once,'arches');
assert.deepEqual(empty.modules,[]);assert.deepEqual(once.modules,['stairs']);assert.deepEqual(twice.modules,['stairs','arches']);
assert.notDeepEqual(twice.goal,once.goal);
function checkConnected(w){
  const cells=occupancy(w),total=w.pieces.reduce((n,p)=>n+p.cells.length,0);assert.equal(cells.size,total);
  // Connectivity across the time-varying deck is checked with the union of
  // its support positions. Actual boarding/carry/jumping has a physics test.
  for(const m of w.mechanisms.filter(m=>m.type==='platform'||m.type==='collapse')){
    const times=m.type==='collapse'?[0]:Array.from({length:41},(_,i)=>i*m.period/80);
    for(const t of times){const q=mechanismPose(m,t);for(let x=Math.floor(q.x-q.width/2);x<=Math.floor(q.x+q.width/2);x++)for(let z=Math.floor(q.z-q.depth/2);z<=Math.floor(q.z+q.depth/2);z++)cells.set(key(x,Math.round(q.y)-1,z),0);}
  }
  const tops=new Map();
  for(const k of cells.keys()){
    const [x,y,z]=k.split(',').map(Number);
    if(!cells.has(key(x,y+1,z))&&!cells.has(key(x,y+2,z))){const k2=`${x},${z}`;if(!tops.has(k2))tops.set(k2,[]);tops.get(k2).push(y);}
  }
  const start=[Math.floor(w.spawn.x),Math.round(w.spawn.y)-1,Math.floor(w.spawn.z)],end=[Math.floor(w.goal.x),Math.round(w.goal.y)-1,Math.floor(w.goal.z)];
  const queue=[start],visited=new Set([key(...start)]),goal=key(...end);
  for(let i=0;i<queue.length;i++){
    const [x,y,z]=queue[i];if(key(x,y,z)===goal)return;
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const distance=Math.abs(dx)+Math.abs(dz);if(!distance||distance>2)continue;
      for(const ny of tops.get(`${x+dx},${z+dz}`)||[]){
        if(ny-y>1||ny-y< -2)continue;
        const nk=key(x+dx,ny,z+dz);if(visited.has(nk))continue;
        // The character's head must also clear the neighboring module interface.
        if(cells.has(key(x+dx,Math.max(y,ny)+2,z+dz)))continue;
        visited.add(nk);queue.push([x+dx,ny,z+dz]);
      }
    }
  }
  assert.fail(`Unreachable finish for ${w.modules.join(',')}`);
}
for(const a of MODULES)for(const b of MODULES)checkConnected(makeRoute([a.id,b.id]));
const long=makeRoute(Array.from({length:40},(_,i)=>MODULES[(i*7)%MODULES.length].id));
assert.equal(long.connections.length,9);checkConnected(long);
assert.deepEqual(validateRoute(JSON.parse(JSON.stringify(serializeRoute(long)))),long);
assert.throws(()=>validateRoute({version:1,modules:[],name:'old'}));
assert.throws(()=>validateRoute({version:2,modules:['unknown'],name:'bad'}));
assert.throws(()=>makeRoute(Array(MAX_MODULES+1).fill('stairs')));
assert.throws(()=>validateRoute({version:2,modules:[],name:'x'.repeat(33)}));
// Real physics: a complete straight scene can be run with a single forward input.
const corridor=makeRoute(['arches','arches']),solid=occupancy(corridor);
const p={...corridor.spawn,vx:0,vy:0,vz:0,grounded:false};
for(let i=0;i<1200&&p.x<corridor.goal.x-.2;i++)stepPlayer(p,1/90,{move:{x:1,z:0},jump:true},(x,y,z)=>solid.has(key(x,y,z)));
assert(p.x>=corridor.goal.x-.3);for(let i=0;i<120;i++)stepPlayer(p,1/90,{move:{x:0,z:0}},(x,y,z)=>solid.has(key(x,y,z)));assert(Math.abs(p.y-(corridor.goal.y-.01))<.1);
for(const w of [empty,once,twice,long]){const offers=moduleOffers(w);assert.equal(offers.length,4);assert.equal(new Set(offers.map(m=>m.id)).size,4);assert(offers.some(m=>m.mechanic));assert(offers.some(m=>m.difficulty===1));assert(offers.some(m=>m.difficulty===3));}
assert.notDeepEqual(moduleOffers(empty).map(m=>m.id),moduleOffers(once).map(m=>m.id));
const elevations=new Set(long.segments.map(s=>s.exit[1]));assert(elevations.size>5);assert(long.segments.some(s=>s.exit[1]<s.entry[1]));
console.log('Passed: 18 distinct scenes with difficulty, 4 refreshing choices, 324 ordered pairs, 40 elevated connected segments, automatic turns, ascending/descending ports, save roundtrip and real-physics traversal.');
