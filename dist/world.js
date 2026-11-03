export const COLORS = ['#f5849b', '#ffc94d', '#55cbbb', '#a98bea', '#6daaf5', '#f8a36d', '#eef1fa', '#79bca2', '#d2ab83', '#ef786e', '#354b69',
  '#569b58','#286346','#86b861','#815b3e','#a08059',
  '#f4fbff','#b5e5ef','#69b3d6','#8298b3',
  '#343845','#57424a','#ff742b','#ffd36a',
  '#e8c781','#ba945f','#438d71','#f4bf6d'];
export const SHAPES = [
  {id:'cube', name:'方块', cells:[[0,0,0]], color:4},
  {id:'I', name:'长条', cells:[[0,0,0],[1,0,0],[2,0,0],[3,0,0]], color:4},
  {id:'L', name:'L 形', cells:[[0,0,0],[0,1,0],[0,2,0],[1,0,0]], color:1},
  {id:'T', name:'T 形', cells:[[0,1,0],[1,1,0],[2,1,0],[1,0,0]], color:3},
  {id:'Z', name:'Z 形', cells:[[0,1,0],[1,1,0],[1,0,0],[2,0,0]], color:0},
  {id:'O', name:'方形', cells:[[0,0,0],[1,0,0],[0,1,0],[1,1,0]], color:2},
  {id:'stairs', name:'阶梯', cells:[[0,0,0],[1,0,0],[1,1,0],[2,0,0],[2,1,0],[2,2,0]], color:5},
];
export const key = (x,y,z) => `${x},${y},${z}`;
export const inBounds = ([x,y,z]) => Number.isInteger(x)&&Number.isInteger(y)&&Number.isInteger(z)&&x>=-40&&x<40&&z>=-40&&z<40&&y>=0&&y<64;
export function rotatedCells(cells, ry=0, rx=0) {
  const out=cells.map(c=>{let [x,y,z]=c; for(let i=0;i<rx%4;i++) [y,z]=[-z,y]; for(let i=0;i<ry%4;i++) [x,z]=[-z,x]; return [x,y,z];});
  const mins=[0,1,2].map(i=>Math.min(...out.map(c=>c[i])));
  return out.map(c=>c.map((n,i)=>n-mins[i]));
}
export function makeWorld(empty=false) {
  const w={version:1,name:'我的天空乐园',pieces:[],spawn:{x:-14.5,y:1.01,z:15.5},goal:{x:10.5,y:13.01,z:-21.5},nextId:1};
  const occupied=new Set();
  function add(cells,color) {
    cells=cells.filter(c=>inBounds(c)&&!occupied.has(key(...c)));
    if(!cells.length) return;
    cells.forEach(c=>occupied.add(key(...c)));
    w.pieces.push({id:w.nextId++,color,cells});
  }
  function rect(x,y,z,sx,sy,sz,color){let c=[];for(let a=0;a<sx;a++)for(let b=0;b<sy;b++)for(let d=0;d<sz;d++)c.push([x+a,y+b,z+d]);add(c,color);}
  rect(-18,0,12,8,1,7,2);
  if(empty){w.name='我的新场景';w.goal={x:-11.5,y:1.01,z:13.5};return w;}
  // A complete climb, with a short jump on the elevated bridge.
  for(let z=11;z>=-5;z--){let h=Math.floor((11-z)/3);rect(-16,0,z,5,h+1,1,0);}
  rect(-16,5,-8,5,1,4,3);
  for(let x=-11;x<=10;x++){
    if(x===-4||x===-3)continue;
    rect(x,5,-7,1,1,3,x<0?3:1);
    if(x%6===0)rect(x,0,-6,1,5,1,x<0?2:3);
  }
  for(let z=-8;z>=-20;z--){const h=6+Math.floor((-8-z)/2);rect(8,0,z,5,h+1,1,(z%4===0)?3:2);}
  rect(6,12,-24,9,1,5,1);
  // Side paths are open-ended playgrounds the player can extend.
  for(let x=-9;x<=22;x++){
    let h=Math.floor((x+9)/6);
    if(x===7||x===8||x===15)continue;
    rect(x,h,14,1,1,4,x<2?0:4);
    if(x%6===0)rect(x,0,15,1,h,1,1);
  }
  rect(21,5,10,5,1,8,4);
  for(let z=9;z>=-12;z--){let h=5+Math.floor((9-z)/7);if(z===3||z===2||z===-5)continue;rect(22,h,z,3,1,1,z>0?1:0);if(z%6===0)rect(23,0,z,1,h,1,3);}
  rect(20,8,-16,7,1,5,3);
  for(let x=14;x<=21;x++)rect(x,8,-15,1,1,2,2);
  for(let z=11;z>=-18;z--){let h=Math.floor((11-z)/5);if(z===1||z===0)continue;rect(-26,0,z,3,h+1,1,z>0?1:3);}
  for(let x=-25;x<=-18;x++)rect(x,0,12,1,1,3,2);
  rect(-28,5,-22,7,1,5,3);
  for(let x=-20;x<=-16;x++)rect(x,5,-20,1,1,2,0);
  for(let z=-19;z<=-9;z++)rect(-17,5,z,2,1,1,4);
  // Chunky arches and tetromino towers give the scene its construction-toy character.
  function arch(x,y,z,width,color,alongZ=false){
    for(let h=0;h<4;h++){rect(x,y+h,z,1,1,1,color);rect(x+(alongZ?0:width-1),y+h,z+(alongZ?width-1:0),1,1,1,color);}
    rect(x,y+4,z,alongZ?1:width,1,alongZ?width:1,color);
  }
  arch(-18,1,17,8,1);arch(-16,3,4,5,2);arch(-10,6,-7,3,0,true);
  arch(21,6,13,5,4);arch(22,8,-11,3,1);arch(-26,3,6,3,0);
  arch(-28,6,-21,7,2);arch(7,13,-23,7,3);
  for(const [x,y,z,c] of [[-8,0,10,1],[-5,0,5,3],[1,0,5,2],[6,0,9,1],[15,0,6,3],[18,0,-4,0],[-22,0,-4,2],[-20,0,5,4],[3,0,-15,1]]){
    const shape=SHAPES[2+(c%4)];add(shape.cells.map(p=>[x+p[0],y+p[1],z+p[2]]),c);
  }
  return w;
}
export function occupancy(world){const m=new Map();for(const p of world.pieces)for(const c of p.cells)m.set(key(...c),p.id);return m;}
export function validateWorld(w){
  if(!w||w.version!==1||!Array.isArray(w.pieces)||w.pieces.length>30000)throw Error('这不是有效的场景文件');
  const occupied=new Set(),ids=new Set();let count=0;
  for(const p of w.pieces){
    if(!Number.isInteger(p.id)||p.id<1||ids.has(p.id)||!Number.isInteger(p.color)||p.color<0||p.color>=COLORS.length||!Array.isArray(p.cells)||!p.cells.length)throw Error('积木数据不完整');
    ids.add(p.id);
    for(const c of p.cells){if(!Array.isArray(c)||c.length!==3||!inBounds(c)||occupied.has(key(...c)))throw Error('存在重叠或超出场地的积木');occupied.add(key(...c));if(++count>100000)throw Error('场景过大，请减少一些积木');}
  }
  for(const p of [w.spawn,w.goal]){
    if(!p||!['x','y','z'].every(a=>Number.isFinite(p[a]))||Math.abs(p.x)>40||Math.abs(p.z)>40||p.y<0||p.y>66)throw Error('起点或终点位置无效');
    const x=Math.floor(p.x),y=Math.round(p.y)-1,z=Math.floor(p.z);
    if(!occupied.has(key(x,y,z))||occupied.has(key(x,y+1,z))||occupied.has(key(x,y+2,z)))throw Error('请把起点和终点放在上方留空的平台上');
  }
  return {version:1,name:typeof w.name==='string'?w.name.slice(0,32):'我的场景',pieces:w.pieces.map(p=>({id:p.id,color:p.color,cells:p.cells.map(c=>[...c])})),spawn:{...w.spawn},goal:{...w.goal},nextId:Math.max(0,...ids)+1};
}
// Small voxel collider: deterministic fixed-step movement, gravity and jump.
export function stepPlayer(p,dt,input,solid){
  const radius=.27,height=1.55;
  const desired=input.move||{x:0,z:0};
  const lerp=1-Math.exp(-(p.grounded?(input.groundResponse??18):7)*dt),speed=input.surfaceSpeed??5.4;
  p.vx+=(desired.x*speed-p.vx)*lerp;p.vz+=(desired.z*speed-p.vz)*lerp;
  p.coyote=p.grounded?.11:Math.max(0,(p.coyote||0)-dt);
  p.jumpBuffer=input.jump?.13:Math.max(0,(p.jumpBuffer||0)-dt);
  if(p.coyote>0&&p.jumpBuffer>0){p.vy=8.6;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.didJump=true;}else p.didJump=false;
  p.vy-=24*dt;p.grounded=false;
  function move(axis,amount){
    p[axis]+=amount;
    const minX=Math.floor(p.x-radius+.0001),maxX=Math.floor(p.x+radius-.0001);
    const minY=Math.floor(p.y+.0001),maxY=Math.floor(p.y+height-.0001);
    const minZ=Math.floor(p.z-radius+.0001),maxZ=Math.floor(p.z+radius-.0001);
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++){
      if(!solid(x,y,z))continue;
      if(axis==='x')p.x=amount>0?Math.min(p.x,x-radius):Math.max(p.x,x+1+radius);
      if(axis==='z')p.z=amount>0?Math.min(p.z,z-radius):Math.max(p.z,z+1+radius);
      if(axis==='y'){
        if(amount<=0){p.y=Math.max(p.y,y+1);p.grounded=true;}else p.y=Math.min(p.y,y-height);
        p.vy=0;
      }
    }
  }
  move('x',p.vx*dt);move('z',p.vz*dt);move('y',p.vy*dt);
}
