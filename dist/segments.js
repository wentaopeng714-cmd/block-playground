import {key} from './world.js?v=10.0';
import {isMixedRecipe,canonicalMixed,mixedBlueprint,mixedOffers,mixedMeta} from './mixed-scenes.js?v=10.0';

export const MODULES = [
  {id:'tower',name:'盘旋高塔',hint:'绕着高塔，爬上云端',color:'#a98bea'},
  {id:'bridge',name:'云端吊桥',hint:'跨过高空中的断口',color:'#ffc94d'},
  {id:'ridge',name:'山脊天梯',hint:'翻越层层叠叠的山峰',color:'#6daaf5'},
  {id:'islands',name:'浮岛连跳',hint:'一座比一座更高',color:'#55cbbb'},
  {id:'stairs',name:'云上阶梯',hint:'沿着彩色台阶往上走',color:'#f5849b'},
  {id:'arches',name:'彩虹拱廊',hint:'穿过高低错落的拱门',color:'#6daaf5'},
  {id:'garden',name:'空中花园',hint:'在树梢和花台间穿行',color:'#55cbbb'},
  {id:'ruins',name:'巨石遗迹',hint:'登上古老的悬空神殿',color:'#f8a36d'},
  {id:'canyon',name:'峡谷栈道',hint:'从陡峭石壁间穿过',color:'#f8a36d'},
  {id:'loop',name:'回旋天路',hint:'沿着环形路线盘旋',color:'#a98bea'},
  {id:'terraces',name:'叠层云台',hint:'在多层平台间升降',color:'#f5849b'},
  {id:'skyrail',name:'穿云长桥',hint:'穿行于巨型门架之间',color:'#ffc94d'},
  {id:'gate',name:'节奏闸门',hint:'等绿灯，再穿过闸门',color:'#f8a36d',difficulty:2,mechanic:true},
  {id:'sweeper',name:'旋转风车',hint:'看准时机，跳过横杆',color:'#ef786e',difficulty:3,mechanic:true},
  {id:'moving',name:'漂移浮台',hint:'登上移动平台，跨越断口',color:'#6daaf5',difficulty:3,mechanic:true},
  {id:'collapse',name:'塌陷栈桥',hint:'踩上会塌，连续向前跑',color:'#f8a36d',difficulty:3,mechanic:true,fresh:true},
  {id:'pendulum',name:'摆锤走廊',hint:'等摆锤荡开，再穿过去',color:'#a98bea',difficulty:3,mechanic:true,fresh:true},
  {id:'spikes',name:'尖刺节拍',hint:'起跳越过，或等尖刺收起',color:'#ef786e',difficulty:2,mechanic:true,fresh:true},
];
const LEVELS={tower:3,bridge:2,ridge:2,islands:2,stairs:1,arches:1,garden:1,ruins:2,canyon:2,loop:3,terraces:2,skyrail:1};
for(const m of MODULES){m.difficulty??=LEVELS[m.id];m.mechanic??=false;}
export const DIFFICULTIES={1:'简单',2:'普通',3:'困难'};
export const MAX_MODULES=256;
export const MODULE_LENGTH=18;
const isModule=id=>isMixedRecipe(id)||MODULES.some(m=>m.id===id);
export function moduleMeta(id){return isMixedRecipe(id)?mixedMeta(id):MODULES.find(m=>m.id===id);}
export function moduleOffers(world){return mixedOffers(world);}
function linePath(points){
  const result=[points[0]];
  for(let i=1;i<points.length;i++){let [u,v]=result.at(-1);const [tu,tv]=points[i];while(u!==tu||v!==tv){if(u!==tu)u+=Math.sign(tu-u);else v+=Math.sign(tv-v);result.push([u,v]);}}
  return result;
}
function interpolate(u,knots){
  for(let i=1;i<knots.length;i++)if(u<=knots[i][0]){const [a,ha]=knots[i-1],[b,hb]=knots[i];return Math.floor(ha+(hb-ha)*(u-a)/(b-a)+.0001);}
  return knots.at(-1)[1];
}
// Every piece has a five-wide port. Height is carried into the next piece.
export function moduleBlueprint(id,variant=0,trend=1){
  if(isMixedRecipe(id))return mixedBlueprint(id,trend);
  if(!isModule(id))throw Error('没有这种场景');
  const cells=new Map(),path=[],mechanisms=[],mechanismPreview=[];
  const put=(u,y,v,c)=>cells.set(key(u,y,v),{cell:[u,y,v],color:c});
  const rect=(u,y,v,su,sy,sv,c)=>{for(let a=0;a<su;a++)for(let b=0;b<sy;b++)for(let d=0;d<sv;d++)put(u+a,y+b,v+d,c);};
  const rises={tower:8,bridge:4,ridge:4,islands:4,stairs:6,arches:3,garden:4,ruins:6,canyon:3,loop:7,terraces:6,skyrail:5,gate:2,sweeper:2,moving:2,collapse:0,pendulum:2,spikes:2};
  const rise=rises[id]*trend,bottom=Math.min(0,rise)-2;
  let route=Array.from({length:18},(_,u)=>[u,0]);
  if(id==='tower'||id==='loop')route=linePath([[0,0],[3,0],[3,-5],[12,-5],[12,5],[16,5],[16,0],[17,0]]);
  if(id==='garden')route=Array.from({length:18},(_,u)=>[u,[0,0,1,2,3,4,4,4,3,2,1,0,0,-1,-2,-1,0,0][u]]);
  if(id==='canyon')route=Array.from({length:18},(_,u)=>[u,[0,0,-1,-2,-3,-3,-3,-2,-1,0,1,2,2,2,1,0,0,0][u]]);
  const height=(u,index)=>{
    if(id==='moving')return (u<=5?0:u>=13?2:Math.floor((u-5)/4))*trend;
    if(id==='collapse')return 0;
    if(id==='sweeper'||id==='pendulum')return interpolate(u,[[0,0],[4,1],[13,1],[17,2]])*trend;
    if(id==='ridge')return interpolate(u,[[0,0],[2,0],[9,7],[12,7],[17,4]])*trend;
    if(id==='terraces')return interpolate(u,[[0,0],[2,0],[6,4],[8,4],[11,2],[13,2],[17,6]])*trend;
    if(id==='bridge')return interpolate(u,[[0,0],[4,2],[13,2],[17,4]])*trend;
    if(id==='islands')return Math.floor(u/4)*trend;
    return Math.floor(index/(route.length-1)*rises[id])*trend;
  };
  const pathColor={tower:3,bridge:1,ridge:4,islands:2,stairs:0,arches:4,garden:2,ruins:5,canyon:5,loop:3,terraces:0,skyrail:1,gate:4,sweeper:1,moving:4,collapse:5,pendulum:3,spikes:6}[id];
  for(let i=0;i<route.length;i++){
    const [u,v]=route[i],h=height(u,i);
    if(id==='islands'&&[3,7,11,15].includes(u))continue;
    if(id==='bridge'&&u===9)continue;
    if(id==='collapse'&&u>=4&&u<=13){path.push([u,h,v]);continue;}
    if(id==='moving'&&u>=6&&u<=12){path.push([u,h,v]);continue;}
    const width=u<2||u>15?5:3;
    for(let a=-Math.floor(width/2);a<=Math.floor(width/2);a++)put(u,h,v+a,id==='islands'?(Math.floor(u/4)+variant)%5:pathColor);
    if(['stairs','ridge','terraces','ruins'].includes(id)){
      for(let y=bottom;y<h;y++)for(let a=-1;a<=1;a++)put(u,y,v+a,(Math.floor((h-y)/3)+pathColor)%6);
    }else if(i%6===0&&id!=='islands')rect(u,bottom,v,1,Math.max(0,h-bottom),1,(pathColor+1)%6);
    path.push([u,h,v]);
  }
  // Ports stay clear and consistent, including both ascending and descending pieces.
  for(const [u,h]of [[0,0],[17,rise]])for(let v=-2;v<=2;v++)put(u,h,v,pathColor);
  const hAt=u=>path.find(p=>p[0]===u)?.[1]||0;
  function arch(u,base,half=3,color=1,tall=7){rect(u,base+1,-half,1,tall,1,color);rect(u,base+1,half,1,tall,1,color);rect(u,base+tall+1,-half,1,1,half*2+1,color);}
  if(id==='tower'){
    rect(7,bottom,-1,3,13,3,3);rect(6,bottom+9,-2,5,1,5,1);rect(7,bottom+10,-1,3,4,3,4);rect(8,bottom+14,0,1,2,1,1);
    for(const [u,h,v]of path)if((u+v)%5===0)rect(u,h+1,v+2,1,2,1,6);
  }else if(id==='bridge'){
    for(const u of [3,14])arch(u,hAt(u),3,(variant+u)%5,8);
    for(let u=2;u<16;u++){const cable=Math.floor(5+Math.abs(u-8)*.4)+Math.max(0,rise);for(const v of [-2,2]){put(u,cable,v,1);if(u%3===0)rect(u,hAt(u)+1,v,1,Math.max(1,cable-hAt(u)-1),1,6);}}
  }else if(id==='ridge'){
    for(const u of [5,11])for(let y=bottom;y<bottom+13;y++){const radius=Math.max(0,3-Math.floor((y-bottom)/4));rect(u-radius,y,5-radius,radius*2+1,1,radius*2+1,y>bottom+10?6:(u+variant)%5);}
  }else if(id==='islands'){
    for(const [u,h,v]of path)if(u%4===0){for(let d=1;d<=3;d++)rect(u,h-d,-1,2,1,3-d,3);put(u,h+1,3,1);}
  }else if(id==='arches'||id==='skyrail'){
    for(const [i,u]of [3,8,13].entries())arch(u,hAt(u),id==='skyrail'?4:3,(i+variant)%4,id==='skyrail'?10:6);
    if(id==='skyrail')for(const u of [5,11])rect(u,bottom,4,2,11,2,4);
  }else if(id==='garden'){
    for(const u of [3,8,13]){const h=hAt(u);rect(u-1,h,-5,3,1,3,2);rect(u,h+1,-4,1,3,1,8);rect(u-1,h+4,-5,3,2,3,7);put(u,h+6,-4,variant%2?0:1);}
    for(const [u,h,v]of path)if(u%3===0){put(u,h+1,v+3,1);put(u,h+2,v+3,(u+variant)%4);}
  }else if(id==='ruins'){
    for(const u of [4,12]){rect(u,bottom,-5,2,12,2,5);rect(u,bottom,4,2,9,2,6);rect(u-1,bottom+11,-6,4,1,4,1);}
    arch(10,Math.max(0,rise),4,5,7);
  }else if(id==='canyon'){
    for(let u=1;u<17;u++)for(const v of [-6,6]){const top=9+(u%4);rect(u,bottom,v,1,top,1,(Math.floor(u/4)+variant)%2?5:0);put(u,bottom+top,v,1);}
  }else if(id==='loop'){
    for(const [u,h,v]of path)if((u+v)%4===0)rect(u,bottom,v,1,Math.max(0,h-bottom),1,4);
    rect(7,bottom,-1,2,13,2,2);rect(6,bottom+12,-2,4,1,4,1);
  }else if(id==='terraces'){
    for(const u of [4,8,12]){const h=hAt(u);rect(u-1,h,-5,4,1,3,variant%2?3:2);rect(u,h+1,-4,1,4,1,4);rect(u-1,h+4,-5,3,1,3,1);}
  }else if(id==='sweeper'){
    for(let u=4;u<=13;u++)for(let v=-2;v<=2;v++)put(u,hAt(u),v,Math.abs(v)===2?(u%2?1:9):1);
    arch(3,hAt(3),3,4,5);
    mechanisms.push({type:'sweeper',u:9,y:hAt(9)+1.55,v:0,speed:1.55,phase:variant*.7});
    for(let u=6;u<=12;u++)mechanismPreview.push({cell:[u,hAt(9)+1,0],color:9});
  }else if(id==='gate'){
    for(const [i,u]of [5,12].entries()){
      arch(u,hAt(u),3,4,6);mechanisms.push({type:'gate',u,y:hAt(u)+1,v:0,period:4.8,phase:i*2.2});
      for(let y=1;y<=3;y++)for(let v=-2;v<=2;v++)mechanismPreview.push({cell:[u,hAt(u)+y,v],color:9});
      for(let v=-2;v<=2;v++)put(u-1,hAt(u-1),v,1);
    }
  }else if(id==='moving'){
    for(const u of [4,14])arch(u,hAt(u),4,4,7);
    mechanisms.push({type:'platform',u:6,y:1,v:0,range:6,lift:2*trend,period:6.4,phase:0});
    for(let u=5;u<=8;u++)for(let v=-1;v<=1;v++)mechanismPreview.push({cell:[u,0,v],color:Math.abs(v)===1?1:4});
  }else if(id==='collapse'){
    for(const u of [2,15])arch(u,0,4,5,7);
    for(let u=4;u<=12;u+=2){
      mechanisms.push({type:'collapse',u:u+.5,y:1,v:0,delay:.68-(variant%3)*.06});
      for(let a=0;a<2;a++)for(let v=-1;v<=1;v++)mechanismPreview.push({cell:[u+a,0,v],color:(u+a)%2?5:1});
    }
  }else if(id==='pendulum'){
    for(const [i,u]of [6,12].entries()){
      arch(u,hAt(u),7,3,9);
      mechanisms.push({type:'pendulum',u,y:hAt(u)+11,v:0,length:9.2,amplitude:.64,period:4.2+i*.6+(variant%3)*.15,phase:i*Math.PI/2});
      for(let y=3;y<11;y++)mechanismPreview.push({cell:[u,hAt(u)+y,0],color:10});
      for(let v=-1;v<=1;v++)mechanismPreview.push({cell:[u,hAt(u)+1,v],color:9});
    }
  }else if(id==='spikes'){
    for(const [i,u]of [5,9,13].entries()){
      mechanisms.push({type:'spikes',u,y:hAt(u)+1,v:0,period:i?3.2:0,phase:i*1.3+(variant%3)*.25});
      for(let v=-1;v<=1;v++)mechanismPreview.push({cell:[u,hAt(u)+1,v],color:9});
      for(let v=-1;v<=1;v++)put(u-1,hAt(u-1),v,1);
    }
    for(const u of [3,15])for(const v of [-4,4])rect(u,hAt(u),v,1,4,1,9);
  }else{
    for(const u of [3,8,13]){const h=hAt(u);rect(u,h+1,-5,3,1,2,6);rect(u,h+2,-5,2,1,2,6);rect(u,h+1,4,2,1,2,6);}
  }
  return {cells:[...cells.values()],path,rise,mechanisms,mechanismPreview};
}
export function makeRoute(modules=[],name='我的拼接乐园',routeSeed=1701){
  if(!Array.isArray(modules)||modules.length>MAX_MODULES||!modules.every(isModule))throw Error('请选择场景卡片，最多可以连接 256 段');
  if(!Number.isInteger(routeSeed)||routeSeed<0||routeSeed>4294967295)throw Error('路线参数不正确');
  modules=modules.map(m=>isMixedRecipe(m)?canonicalMixed(m):m);
  const w={version:2,name,routeSeed,modules:[...modules],pieces:[],spawn:{x:-39.5,y:1.01,z:20.5},goal:{x:-37.5,y:1.01,z:20.5},nextId:1,segments:[],connections:[],mechanisms:[],effects:[]};
  const occupied=new Set();
  function add(items){const byColor=new Map();for(const {cell,color}of items){const k=key(...cell);if(occupied.has(k))continue;occupied.add(k);if(!byColor.has(color))byColor.set(color,[]);byColor.get(color).push(cell);}for(const [color,cells]of byColor)w.pieces.push({id:w.nextId++,color,cells});}
  const floor=(x,y,z,color=6)=>{const out=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)out.push({cell:[x+a,y,z+b],color});add(out);};
  const start=[];for(let x=-42;x< -36;x++)for(let z=18;z<=22;z++)start.push({cell:[x,0,z],color:2});add(start);
  const counts=new Map();let altitude=0,cursorX=-36,cursorZ=20,direction=1;
  for(let i=0;i<modules.length;i++){
    if(i>0&&i%4===0){
      const rich=m=>typeof m==='object'&&!!m.layout;
      const roomy=modules.slice(i-4,i+4).some(rich);
      const previous=w.segments[i-1].exit,outer=previous[0]+direction*8,centerline=[];cursorX=previous[0];cursorZ-=roomy?72:26;
      for(let a=previous[0];a!==outer;a+=direction){floor(a,altitude,previous[2]);centerline.push([a,altitude,previous[2]]);}
      for(let b=previous[2];b>=cursorZ;b--){floor(outer,altitude,b);centerline.push([outer,altitude,b]);}
      for(let a=outer;a!==cursorX;a-=direction){floor(a,altitude,cursorZ);centerline.push([a,altitude,cursorZ]);}
      w.connections.push({from:i-1,to:i,path:centerline});direction=-direction;
    }
    const x=cursorX,z=cursorZ,dir=direction,id=modules[i],countKey=typeof id==='string'?id:JSON.stringify(id),variant=counts.get(countKey)||0;counts.set(countKey,variant+1);
    const trend=altitude>=20?-1:1,blueprint=moduleBlueprint(id,variant,trend),length=blueprint.length||18;
    const transform=([u,y,v])=>[x+dir*u,altitude+y,z+dir*v];add(blueprint.cells.map(p=>({cell:transform(p.cell),color:p.color})));
    blueprint.mechanisms.forEach((m,j)=>w.mechanisms.push({...m,id:`${i}-${m.type}-${j}`,segment:i,x:x+dir*m.u+.5,y:altitude+m.y,z:z+dir*m.v+.5,dir:dir*(m.dir||1)}));
    w.effects.push(...(blueprint.effects||[]).map(e=>({...e,segment:i,center:transform(e.center)})));
    const zones=(blueprint.zones||[]).map(q=>({...q,dir:dir*(q.dir||1),entry:transform(q.entry||[q.start,q.base,0]),exit:transform(q.exit||[q.start+q.length-1,q.base,0])}));
    const guides=[];
    for(const link of blueprint.safeLinks||[])if(link.path)for(let j=2;j<link.path.length-2;j+=6){const a=link.path[j],b=link.path[j+1];if(a[1]===b[1])guides.push({at:transform(a),dx:dir*(b[0]-a[0]),dz:dir*(b[2]-a[2])});}
    const segment={id,index:i,variant,dir,length,mixed:isMixedRecipe(id),layout:blueprint.layout||null,biome:blueprint.biome||null,zones,guides,certificate:blueprint.certificate||null,entry:[x,altitude,z],exit:[x+dir*(length-1),altitude+blueprint.rise,z],path:blueprint.path.map(transform)};
    w.segments.push(segment);cursorX=segment.exit[0]+dir;altitude+=blueprint.rise;w.goal={x:segment.exit[0]+.5,y:altitude+1.01,z:segment.exit[2]+.5};
  }
  return w;
}
export function appendModule(world,id){return makeRoute([...world.modules,id],world.name,world.routeSeed);}
export function serializeRoute(world){return {version:2,name:world.name,routeSeed:world.routeSeed,modules:world.modules.map(m=>isMixedRecipe(m)?canonicalMixed(m):m)};}
export function validateRoute(data){if(!data||data.version!==2||typeof data.name!=='string'||data.name.length>32||!Array.isArray(data.modules))throw Error('请选择“场景拼接版”导出的路线文件');return makeRoute(data.modules,data.name||'我的拼接乐园',data.routeSeed??1701);}
