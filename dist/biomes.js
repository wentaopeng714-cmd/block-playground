import {key,COLORS} from './world.js?v=10.0';
import {buildTerrain,terrainDepth} from './terrain.js?v=10.0';

export const BIOMES={
  forest:{name:'森林',title:'森间秘境',color:'#4d9265',surface:11,route:14,frame:14,trim:13,under:15,danger:'#cf9354',metal:'#365d48',deck:'#bc955d',accent:'#d9c581',sky:['#b6d5bf','#e8edcf'],fog:'#d8e5d0',sun:'#fff3d9',mote:'#edf0a0'},
  snow:{name:'雪地',title:'霜雪山谷',color:'#65a8cd',surface:16,route:17,frame:18,trim:16,under:19,danger:'#69a9d1',metal:'#507d9b',deck:'#98dbe9',accent:'#f5fdff',sky:['#b4d2ea','#edf6ff'],fog:'#e0effa',sun:'#e9f7ff',mote:'#ffffff'},
  lava:{name:'熔岩',title:'熔岩峡谷',color:'#dc783f',surface:20,route:21,frame:20,trim:22,under:20,danger:'#f37535',metal:'#302d3b',deck:'#62505c',accent:'#ffd06b',sky:['#806276','#e0ae92'],fog:'#c9a29c',sun:'#ffcca0',mote:'#ffce69'},
  desert:{name:'沙漠',title:'沙海遗迹',color:'#bf9654',surface:24,route:25,frame:25,trim:24,under:25,danger:'#b98054',metal:'#6b655a',deck:'#d6b072',accent:'#f8dfa2',sky:['#bcd5d9','#f4e2bc'],fog:'#eadcbf',sun:'#ffe5b7',mote:'#f1d59d'},
};
export const BIOME_KEYS=Object.keys(BIOMES);
const hash=(x,z,seed)=>((Math.imul(x+71,73856093)^Math.imul(z+113,19349663)^seed)>>>0);

// All solid scenery stays outside a seven-wide reservation around every route
// level, including the gaps crossed by dynamic platforms. Ports stay unchanged.
export function decorateBiome(b,recipe){
  const theme=BIOMES[recipe.biome];if(!theme)return b;
  const occupied=new Map(),reserved=new Set(),decor=[];
  for(const [x,,z]of b.path)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)reserved.add(`${x+dx},${z+dz}`);
  for(const c of b.cells){
    const role=c.part||'frame',h=hash(c.cell[0],c.cell[2],recipe.seed);
    const color=role==='ice'?17:role==='surface'?(recipe.biome==='lava'&&h%6===0?21:theme.surface):role==='route'?(recipe.features&&recipe.biome==='snow'?16:theme.route):role==='trim'?theme.trim:theme.frame;
    occupied.set(key(...c.cell),{cell:[...c.cell],color});
  }
  // Thickness is added only beneath existing permanent route cells. It never
  // bridges a moving/collapsing gap or occupies another level's jump clearance.
  const clearBody=new Set();
  for(const [x,y,z]of b.path)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=1;dy<=4;dy++)clearBody.add(key(x+dx,y+dy,z+dz));
  for(const c of b.cells)if(['surface','route','ice'].includes(c.part)){
    const depth=recipe.variety&&c.part!=='route'?terrainDepth(recipe,c.cell[0],c.cell[2]):1;
    for(let d=1;d<=depth;d++){
      const q=[c.cell[0],c.cell[1]-d,c.cell[2]],k=key(...q);if(clearBody.has(k))break;
      if(!occupied.has(k))occupied.set(k,{cell:q,color:theme.under});
    }
  }
  function put(x,y,z,color){
    if(reserved.has(`${x},${z}`)||x<3||x>b.length-4)return;
    const k=key(x,y,z);if(occupied.has(k))return;
    const c={cell:[x,y,z],color};occupied.set(k,c);decor.push(c);
  }
  const low=Math.min(...b.path.map(p=>p[1])),high=Math.max(...b.path.map(p=>p[1]));
  const A=b.length-7,D=Math.max(...b.path.map(p=>p[2])),cx=Math.floor(A/2),cz=Math.floor(D/2),base=low-1;
  function tree(x,z,y,height,large=false){
    for(let h=0;h<height;h++)for(let a=0;a<(large?2:1);a++)put(x+a,y+h,z,14);
    const radius=large?4:2;
    for(let h=-2;h<=2;h++)for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
      if(Math.abs(dx)+Math.abs(dz)+Math.abs(h)*2>radius*2+1)continue;
      put(x+dx,y+height+h,z+dz,hash(x+dx,z+dz,recipe.seed+h)%4?12:13);
    }
  }
  if(recipe.variety)buildTerrain(b,recipe,put,base);
  else if(recipe.biome==='forest'){
    tree(cx,cz,base,high-low+8,true);
    for(const [x,z]of [[5,5],[A-5,5],[5,D-5],[A-5,D-5]])tree(x,z,base,4+hash(x,z,recipe.seed)%3);
    for(let x=5;x<A-3;x+=3)for(let z=5;z<D-3;z+=4){put(x,base,z,11);put(x,base+1,z,hash(x,z,recipe.seed)%2?13:27);}
  }else if(recipe.biome==='snow'){
    const height=high-low+9;
    for(let h=0;h<height;h++){
      const r=Math.max(0,Math.ceil(4*(1-h/height)));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.abs(x)+Math.abs(z)<=r+1)put(cx+x,base+h,cz+z,h>height*.55?16:(hash(x,z,h)%3?17:18));
    }
    for(const [x,z]of [[5,5],[A-5,5],[5,D-5],[A-5,D-5]])for(let h=0;h<4+hash(x,z,recipe.seed)%4;h++){put(x,base+h,z,h<3?18:17);if(h<2)for(const d of [-1,1])put(x+d,base+h,z,17);}
  }else if(recipe.biome==='lava'){
    const height=high-low+6;
    for(let h=0;h<height;h++){
      const r=Math.max(2,4-Math.floor(h*3/height));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(Math.max(Math.abs(x),Math.abs(z))<r-1&&h>height-4)continue;
        put(cx+x,base+h,cz+z,h===height-1?22:hash(x+h,z,recipe.seed)%11===0?22:20);
      }
    }
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)put(cx+x,base+height-3,cz+z,23);
    for(const [x,z]of [[5,5],[A-5,5],[5,D-5],[A-5,D-5]])for(let h=0;h<3+hash(x,z,recipe.seed)%5;h++)put(x,base+h,z,h%3===2?22:20);
  }else{
    const height=recipe.layout==='tower'?high-low+10:7;
    for(let h=0;h<height;h++){
      const r=recipe.layout==='tower'?1:Math.max(0,4-Math.floor(h/2));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)put(cx+x,base+h,cz+z,h%4===3?24:25);
    }
    for(const [x,z]of [[5,5],[A-5,5],[5,D-5],[A-5,D-5]]){
      if(hash(x,z,recipe.seed)%2){for(let h=0;h<5;h++)put(x,base+h,z,26);put(x-1,base+2,z,26);put(x-2,base+2,z,26);put(x-2,base+3,z,26);}
      else{for(let h=0;h<4;h++)put(x,base+h,z,25);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)put(x+dx,base+4,z+dz,24);}
    }
  }
  b.cells=[...occupied.values()];b.biome=recipe.biome;b.sceneryCount=decor.length;
  b.mechanisms=b.mechanisms.map(m=>({...m,biome:recipe.biome}));
  b.mechanismPreview=b.mechanismPreview.map(c=>({...c,color:[22,23].includes(c.color)?c.color:c.color===9?theme.trim:c.color===10?theme.frame:theme.route}));
  const minZ=recipe.variety?Math.min(...b.path.map(p=>p[2])):0,maxZ=D;
  b.effects=[{biome:recipe.biome,center:[cx,low-2,recipe.variety?(minZ+maxZ)/2:cz],width:Math.max(4,A-8),depth:Math.max(4,maxZ-minZ-8),height:high-low+15,seed:recipe.seed,...(recipe.variety&&recipe.biome==='desert'&&recipe.terrain===3?{water:true}:{})}];
  return b;
}

export function biomeMaterialColors(id){const t=BIOMES[id];return t?{...t,frameColor:COLORS[t.frame]}:null;}

export function touchesBiomeHazard(player,effect){
  return effect.biome==='lava'&&player.y<=effect.center[1]+.25&&player.y>=effect.center[1]-3&&Math.abs(player.x-effect.center[0]-.5)<effect.width/2&&Math.abs(player.z-effect.center[2]-.5)<effect.depth/2;
}
