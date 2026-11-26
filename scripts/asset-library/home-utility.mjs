import { writeFamily } from './render.mjs';
const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  ivory:{kind:'matte',color:'#d9d4ca'}, stone:{kind:'matte',color:'#aaa39a'},
  steel:{kind:'metal',color:'#979fa2'}, gray:{kind:'metal',color:'#67727b'},
  black:{kind:'matte',color:'#3e454c'}, glass:{kind:'glass',color:'#8caab4'},
  oak:{kind:'wood',color:'#a37653'}, leather:{kind:'matte',color:'#89705d'},
  paper:{kind:'matte',color:'#e4ddc8'}, red:{kind:'matte',color:'#ad6555'},
  gold:{kind:'metal',color:'#bb9b62'},
};
function shape(config){
  const {width:w,height:h,bottom:z}=config;
  const b=(x,y,k,X,Y,K,m)=>B(x,y,k+z,X,Y,K+z,m);
  const c=(x,y,k,K,r,m)=>C(x,y,k+z,K+z,r,m);
  return {w,h,b,c};
}
function windowDisc(b,x,y,cy,rx,rz,material){
  return Array.from({length:rz*2+1},(_,i)=>{
    const dz=i-rz;
    const d=Math.floor(rx*Math.sqrt(1-(dz/rz)**2));
    return b(x-d,y,cy+dz,x+d,y,cy+dz,material);
  });
}
const features={
  'front-load-laundry': p=>{
    const {w,h,b}=shape(p), mid=Math.floor(w/2);
    return [b(4,5,0,w-5,25,h,'ivory'),...windowDisc(b,mid,25,14,9,9,'gray'),
      ...windowDisc(b,mid,26,14,7,7,'glass'),b(6,25,h-4,w-7,26,h-1,'black'),
      b(9,26,h-3,15,26,h-2,'steel'),b(w-11,26,h-3,w-9,27,h-1,'gold')];
  },
  'vented-tumble-dryer': p=>{
    const {w,h,b}=shape(p),mid=Math.floor(w/2);
    return [b(5,5,0,w-6,24,h,'steel'),b(6,24,6,w-7,25,22,'ivory'),
      ...windowDisc(b,mid,25,14,7,6,'black'),...windowDisc(b,mid,26,14,5,4,'glass'),
      ...[2,4,6].map(k=>b(7,25,k,w-8,25,k,'gray')),
      b(w-12,25,h-4,w-8,26,h-2,'black')];
  },
  'laundry-wringer': p=>{
    const {w,h,b}=shape(p);
    return [b(5,7,0,w-6,24,h-5,'ivory'),b(6,7,h-4,w-7,24,h-2,'gray'),
      b(6,8,h-2,8,23,h+9,'black'),b(w-9,8,h-2,w-7,23,h+9,'black'),
      b(8,12,h+2,w-9,18,h+6,'steel'),b(8,12,h+6,w-9,18,h+8,'paper'),
      b(w-9,17,h+4,w-5,19,h+6,'black')];
  },
  'heat-pump-water-heater': p=>{
    const {w,h,b,c}=shape(p),mid=Math.floor(w/2),radius=Math.min(10,Math.floor(w/2)-4);
    return [c(mid,15,0,h-5,radius,'ivory'),c(mid,15,h-4,h,radius-1,'gray'),
      b(mid-3,14+radius,h-10,mid+4,15+radius,h-6,'black'),
      b(mid-2,15+radius,h-9,mid+2,15+radius,h-8,'glass'),
      c(mid-4,14,h,h+5,1,'steel'),c(mid+4,15,h,h+4,1,'gold')];
  },
  'air-purifier-tower': p=>{
    const {w,h,b,c}=shape(p),mid=Math.floor(w/2),r=Math.min(9,Math.floor(w/2)-4);
    return [c(mid,15,0,h-4,r,'ivory'),c(mid,15,h-4,h,r-1,'black'),c(mid,15,h,h,r-3,'steel'),
      ...[4,7,10,13,16].map(k=>b(mid-3,14+r,k,mid+3,14+r,k,'gray')),
      b(mid-1,13,h+1,mid+1,16,h+1,'glass')];
  },
  'dehumidifier-tank': p=>{
    const {w,h,b}=shape(p);
    return [b(5,6,0,w-6,24,h,'ivory'),b(6,24,3,w-7,24,13,'glass'),
      ...[16,18,20,22].map(k=>b(8,24,k,w-8,25,k,'gray')),b(7,8,h-1,w-8,15,h,'black'),
      b(10,9,h,15,13,h,'steel'),b(w-11,24,5,w-9,25,11,'paper')];
  },
  'upright-vacuum-dock': p=>{
    const {w,h,b,c}=shape(p), mid=Math.floor(w/2);
    return [b(mid-7,13,0,mid+7,24,3,'black'),b(mid-3,13,4,mid+3,18,21,'gray'),
      c(mid,16,8,19,3,'glass'),b(mid-1,12,22,mid,13,h+6,'steel'),
      b(mid-2,11,h+6,mid+5,16,h+8,'black'),b(w-10,7,0,w-6,12,17,'steel'),
      b(w-11,10,16,w-6,18,18,'black')];
  },
  'shoe-dryer-rack': p=>{
    const {w,h,b,c}=shape(p);
    return [b(5,5,0,w-6,23,4,'gray'),b(6,5,4,w-7,9,h,'ivory'),
      ...[10,w-11].flatMap((x,i)=>[c(x,14,4,h-6,2,'steel'),b(x-2,12,h-6,x+2,21,h-3,'leather'),
        b(x-2,12,h-2,x+2,16,h+2,i?'oak':'leather')]),b(9,23,2,15,24,3,'black')];
  },
};
const baseModes={
  'leveling-feet': (w)=>({bottom:2,ops:[6,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,1,'black')))}),
  'utility-drawer': (w)=>({bottom:9,ops:[B(5,6,0,w-6,24,2,'black'),B(6,6,3,w-7,24,8,'ivory'),
    B(8,24,4,w-9,25,7,'stone'),B(10,25,6,w-11,26,6,'gray')]}),
  'drain-pan': (w)=>({bottom:4,ops:[B(4,5,0,w-5,26,2,'gray'),B(4,5,3,w-5,6,3,'steel'),
    B(4,25,3,w-5,26,3,'steel'),B(w-9,25,1,w-7,28,2,'steel')]}),
  'rolling-dock': (w)=>({bottom:5,ops:[...([6,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+3,3,'black')))),
    B(4,5,3,w-5,25,4,'steel'),B(4,5,5,6,6,15,'gray'),B(w-7,5,5,w-5,6,15,'gray')]}),
};
function fittings(port,w,z,h){
  if(port==='freestanding') return [B(w-6,6,z+h-7,w-5,11,z+h-5,'black')];
  if(port==='utility-hookup') return [B(w-8,4,z+4,w-7,5,z+h-2,'steel'),
    B(w-6,4,z+4,w-5,5,z+h+5,'steel'),B(w-11,4,z+h+3,w-5,7,z+h+5,'steel'),
    B(w-13,6,z+h+2,w-10,8,z+h+6,'gold')];
  return [B(4,6,z+1,6,24,z+2,'steel'),B(w-7,6,z+1,w-5,24,z+2,'steel'),
    B(2,4,z+h+10,w-3,28,z+h+12,'oak'),
    B(3,6,z+h-5,4,26,z+h+10,'oak'),B(w-5,6,z+h-5,w-4,26,z+h+10,'oak')];
}
const designs=[];
for(const [job,build] of Object.entries(features)){
  for(const [form,w,h] of [['compact',30,29],['heavy-duty',41,35]]){
    for(const [mount,mounting] of Object.entries(baseModes)){
      const {bottom,ops}=mounting(w);
      const modes=job.includes('water')||job.includes('laundry')?['freestanding','utility-hookup']:['freestanding','under-counter'];
      for(const connection of modes){
        designs.push({schemaVersion:1,id:`home-utility-${job}-${form}-${mount}-${connection}`,category:'home-appliance',
          layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
          palette:'office-night',materials,ops:[...ops,...build({width:w,height:h,bottom}),...fittings(connection,w,bottom,h)]});
      }
    }
  }
}
await writeFamily('home-utility',designs);
