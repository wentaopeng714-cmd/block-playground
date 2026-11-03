import assert from 'node:assert/strict';
import {makeWorld,validateWorld,SHAPES,rotatedCells,occupancy,key,stepPlayer} from '../dist/world.js';
const demo=validateWorld(makeWorld()),empty=validateWorld(makeWorld(true));
assert(demo.pieces.length>100);assert(occupancy(demo).size>1500);
for(const shape of SHAPES) for(let ry=0;ry<4;ry++)for(let rx=0;rx<4;rx++){
  const cells=rotatedCells(shape.cells,ry,rx);
  assert.equal(new Set(cells.map(c=>c.join(','))).size,shape.cells.length);
  assert(cells.every(c=>c.every(v=>Number.isInteger(v)&&v>=0)));
}
assert.throws(()=>validateWorld({...demo,spawn:{x:39,y:4,z:39}}));
assert.throws(()=>validateWorld({...empty,pieces:[...empty.pieces,empty.pieces[0]]}));
const floor=(x,y,z)=>y===0&&x>=-8&&x<9&&z>=-8&&z<9;
const p={x:.5,y:3,z:.5,vx:0,vy:0,vz:0,grounded:false};
for(let i=0;i<180;i++)stepPlayer(p,1/90,{move:{x:0,z:0}},floor);
assert.equal(p.y,1);assert(p.grounded);
stepPlayer(p,1/90,{move:{x:0,z:0},jump:true},floor);assert(p.didJump);
let apex=p.y;for(let i=0;i<110;i++){stepPlayer(p,1/90,{move:{x:0,z:0}},floor);apex=Math.max(apex,p.y);}
assert(apex>2.45&&apex<2.6);assert.equal(p.y,1);
const wall=(x,y,z)=>floor(x,y,z)||(x===2&&y>=1&&y<4&&z===0);
for(let i=0;i<180;i++)stepPlayer(p,1/90,{move:{x:1,z:0}},wall);
assert(p.x<=1.731&&p.x>=1.72);assert.equal(p.y,1);
const occ=occupancy(demo),solid=(x,y,z)=>occ.has(key(x,y,z));
const runner={...demo.spawn,vx:0,vy:0,vz:0,grounded:false};
for(let i=0;i<40;i++)stepPlayer(runner,1/90,{move:{x:0,z:0}},solid);
assert.equal(runner.y,1);
// Actual demo: climb from the starting platform to its first elevated bridge.
for(let i=0;i<550&&runner.z> -5.5;i++)stepPlayer(runner,1/90,{move:{x:0,z:-1},jump:true},solid);
assert(runner.y>5&&runner.z< -4,JSON.stringify(runner));
console.log(JSON.stringify({sceneBlocks:occ.size,pieces:demo.pieces.length,orientations:SHAPES.length*16,jumpHeight:+(apex-1).toFixed(3),climbedTo:{y:runner.y,z:runner.z},checks:'passed'},null,2));
// Continue along the real sample course and make the two-cell bridge jump.
function aim(tx,tz,max=1800,jump=false){
  for(let i=0;i<max;i++){
    const dx=tx-runner.x,dz=tz-runner.z,d=Math.hypot(dx,dz);
    if(d<.11&&Math.hypot(runner.vx,runner.vz)<.25)return;
    const scale=Math.min(1,d*3);
    stepPlayer(runner,1/90,{move:{x:d?dx/d*scale:0,z:d?dz/d*scale:0},jump},solid);
    assert(runner.y> -2,'Route fell while aiming at '+tx+','+tz+' '+JSON.stringify(runner));
  }
  assert.fail('Route failed to reach waypoint '+tx+','+tz+' '+JSON.stringify(runner));
}
aim(-14.5,-5.5,600,false);
aim(-5.1,-5.5,600,false);
for(let i=0;i<110&&runner.x< -1;i++)stepPlayer(runner,1/90,{move:{x:1,z:0},jump:i===0},solid);
aim(10.5,-5.5,900,false);
aim(10.5,-21.5,1200,true);
for(let i=0;i<90;i++)stepPlayer(runner,1/90,{move:{x:0,z:0}},solid);
assert(Math.abs(runner.y-demo.goal.y)<.1);
assert(Math.hypot(runner.x-demo.goal.x,runner.z-demo.goal.z)<.5);
console.log('The full demo route is physically traversable, including the bridge jump and finish tower.');
