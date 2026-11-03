export const TERRAIN_TYPES={
  forest:['巨木林地','峡谷栈道','林间遗迹','树冠群岛'],
  snow:['冰峰雪岭','冰裂峡谷','冰晶群岛','冰洞回廊'],
  lava:['火山熔池','裂谷熔河','玄武岩柱','废弃熔炉'],
  desert:['阶梯金塔','砂岩峡谷','失落神庙','绿洲浮岛'],
};
function noise(x,z,seed){let n=Math.imul((seed^Math.imul(x+91,73856093)^Math.imul(z+51,19349663))>>>0,2246822507);n^=n>>>13;return (n>>>0)/4294967296;}
export function terrainDepth(recipe,x,z){
  const r=noise(x,z,recipe.seed);
  return recipe.terrain===1?3+Math.floor(r*4):recipe.terrain===2&&recipe.biome==='lava'?4+Math.floor(r*5):recipe.terrain===3?2+Math.floor(r*3):2;
}

// Choose scenery sites from unused space rather than assuming a central tower.
// Each solid is still filtered by the shared seven-wide route reservation.
export function buildTerrain(b,recipe,put,base){
  const footprint=[...new Map(b.path.map(p=>[`${p[0]},${p[2]}`,[p[0],p[2]]])).values()];
  const minZ=Math.min(...footprint.map(p=>p[1])),maxZ=Math.max(...footprint.map(p=>p[1])),candidates=[];
  for(let x=5;x<b.length-5;x+=2)for(let z=minZ+4;z<=maxZ-4;z+=2){
    const clearance=Math.min(...footprint.map(p=>Math.max(Math.abs(x-p[0]),Math.abs(z-p[1]))));
    if(clearance>=5)candidates.push({x,z,r:Math.min(4,clearance-4),score:clearance*1.2+noise(x,z,recipe.seed)*4});
  }
  candidates.sort((a,b)=>b.score-a.score);const sites=[];
  for(const q of candidates){if(sites.every(p=>Math.hypot(p.x-q.x,p.z-q.z)>p.r+q.r+3))sites.push(q);if(sites.length===5)break;}
  if(!sites.length)sites.push({x:Math.floor(b.length/2),z:Math.round((minZ+maxZ)/2),r:1});
  const q=sites[0],span=Math.max(...b.path.map(p=>p[1]))-Math.min(...b.path.map(p=>p[1])),kind=recipe.terrain;
  const random=(p,range)=>Math.floor(noise(p.x,p.z,recipe.seed)*range);
  function pillar(p,height,color,trim=color,r=0,y=base){
    for(let h=0;h<height;h++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)put(p.x+x,y+h,p.z+z,h%4===3?trim:color);
  }
  function island(p,height,cap,side){
    for(let d=0;d<4;d++){const r=Math.max(0,p.r-Math.floor(d/2));for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)+Math.abs(z)<=r+1)put(p.x+x,base+height-d,p.z+z,d?side:cap);}
  }
  function oak(p,height,y=base){
    pillar(p,height,14,14,0,y);
    for(let h=-1;h<=2;h++)for(let x=-p.r;x<=p.r;x++)for(let z=-p.r;z<=p.r;z++)if(Math.abs(x)+Math.abs(z)+Math.abs(h)<=p.r*2+1)put(p.x+x,y+height+h,p.z+z,noise(x+p.x,z+p.z,recipe.seed)>.3?12:13);
  }
  function mesa(p,height,cap,rock){
    for(let h=0;h<height;h++){const r=Math.max(1,p.r-(h<2?1:0));for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)+Math.abs(z)<=r+1)put(p.x+x,base+h,p.z+z,h===height-1?cap:h%4===0?15:rock);}
  }
  function peak(p,height,snow=true){
    for(let h=0;h<height;h++){const r=Math.max(0,Math.ceil(p.r*(1-h/height)));for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)+Math.abs(z)<=r+1)put(p.x+x,base+h,p.z+z,snow&&h>height*.55?16:noise(x,z,h)>.35?17:18);}
  }
  function arch(p,height,color,trim){
    const r=Math.max(1,p.r);pillar({...p,x:p.x-r},height,color,trim,0);pillar({...p,x:p.x+r},height,color,trim,0);
    for(let x=-r;x<=r;x++)for(let z=-1;z<=1;z++)put(p.x+x,base+height,p.z+z,trim);
  }
  if(recipe.biome==='forest'){
    if(kind===0){oak(q,span+9);sites.slice(1).forEach(p=>oak(p,5+random(p,4)));}
    if(kind===1){sites.slice(0,3).forEach((p,i)=>{mesa(p,5+i*3+random(p,3),11,19);oak({...p,r:Math.min(2,p.r)},4,base+5+i*3);});}
    if(kind===2){arch(q,7+random(q,3),19,7);sites.slice(1).forEach(p=>{pillar(p,4+random(p,5),19,7);put(p.x,base+3,p.z+1,12);});}
    if(kind===3)sites.forEach((p,i)=>{const h=3+(i%3)*3;island(p,h,11,15);oak({...p,r:Math.min(3,p.r)},4+random(p,3),base+h+1);});
  }else if(recipe.biome==='snow'){
    if(kind===0)sites.slice(0,3).forEach((p,i)=>peak(p,span+9-i*2+random(p,3)));
    if(kind===1)sites.forEach((p,i)=>{const h=7+random(p,8);for(let y=0;y<h;y++)for(let z=-p.r;z<=p.r;z++)put(p.x+Math.floor(y/5),base+y,p.z+z,y===h-1?16:y%3?17:18);});
    if(kind===2)sites.forEach((p,i)=>{island(p,2+i%3*2,16,18);for(const dx of [-1,1])pillar({...p,x:p.x+dx},7+random(p,6),17,18,0,base+3+i%3*2);});
    if(kind===3){arch(q,8,17,16);for(let h=0;h<3;h++)for(let x=-q.r;x<=q.r;x++)for(let z=-q.r;z<=q.r;z++)put(q.x+x,base+9+h,q.z+z,h===2?16:17);sites.slice(1).forEach(p=>peak(p,5+random(p,5)));}
  }else if(recipe.biome==='lava'){
    if(kind===0){const height=span+7;for(let h=0;h<height;h++){const r=Math.max(1,q.r-Math.floor(h*q.r/height));for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(h<height-3||Math.max(Math.abs(x),Math.abs(z))===r)put(q.x+x,base+h,q.z+z,h===height-1||h%5===0?22:20);}put(q.x,base+height-2,q.z,23);}
    if(kind===1)sites.forEach((p,i)=>{mesa(p,6+random(p,7),20,21);for(let z=-p.r;z<=p.r;z++)for(let h=2;h<7;h+=3)put(p.x+p.r+1,base+h,p.z+z,22);});
    if(kind===2)sites.forEach((p,i)=>{const h=7+random(p,12);pillar(p,h,20,21,Math.min(1,p.r));put(p.x,base+h,p.z,22);});
    if(kind===3){arch(q,9,20,10);for(let y=1;y<=6;y++)for(let x=-Math.max(1,q.r-1);x<=Math.max(1,q.r-1);x++)put(q.x+x,base+y,q.z+1,y%3===0?10:22);sites.slice(1).forEach(p=>pillar(p,10+random(p,7),20,22,Math.min(1,p.r)));}
  }else{
    if(kind===0){for(let h=0;h<9;h++){const r=Math.max(0,q.r-Math.floor(h/2));for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)put(q.x+x,base+h,q.z+z,h%3===2?25:24);}sites.slice(1).forEach(p=>pillar(p,5+random(p,6),25,24));}
    if(kind===1)sites.forEach((p,i)=>{mesa(p,5+random(p,8),24,25);put(p.x,base+7,p.z,26);});
    if(kind===2){arch(q,8,25,24);for(let x=-q.r;x<=q.r;x++)for(let z=-q.r;z<=q.r;z++)put(q.x+x,base+9,q.z+z,24);sites.slice(1).forEach(p=>{pillar(p,5+random(p,4),25,24);for(let x=-1;x<=1;x++)put(p.x+x,base+8,p.z,24);});}
    if(kind===3)sites.forEach((p,i)=>{const y=base+2+i%2;island(p,2+i%2,24,25);pillar(p,6+random(p,3),14,14,0,y);for(let d=-p.r;d<=p.r;d++){put(p.x+d,y+7,p.z,26);put(p.x,y+7,p.z+d,26);}put(p.x,y+8,p.z,13);});
  }
  b.terrain=kind;b.landmarks=sites.map(p=>[p.x,base,p.z]);
}
