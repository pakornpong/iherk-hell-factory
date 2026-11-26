import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  tire:{kind:'matte',color:'#42494e'}, chrome:{kind:'metal',color:'#a2a9a9'},
  frame:{kind:'metal',color:'#627786'}, steel:{kind:'metal',color:'#737e86'},
  saddle:{kind:'matte',color:'#66574e'}, rust:{kind:'matte',color:'#a46755'},
  cream:{kind:'matte',color:'#d9d0be'}, blue:{kind:'matte',color:'#657d93'},
  oak:{kind:'wood',color:'#a9805e'}, concrete:{kind:'matte',color:'#a6a19b'},
  sand:{kind:'matte',color:'#b49b79'}, brass:{kind:'metal',color:'#bca16b'},
};
function wheel(x,y,z,r){
  const circle=(radius,material)=>Array.from({length:36},(_,i)=>{
    const a=i/36*Math.PI*2;
    const px=Math.round(x+radius*Math.cos(a)),pz=Math.round(z+radius*Math.sin(a));
    return b(px,y,pz,px,y+1,pz,material);
  });
  return [...circle(r,'tire'),...circle(r-1,'chrome'),
    ...[[x-r+2,z],[x+r-2,z],[x,z+r-2],[x,z-r+2]].map(([tx,tz])=>l(x,y,z,tx,y,tz,'steel')),
    b(x-1,y,z-1,x+1,y+1,z+1,'chrome')];
}
function ride(w,z,configuration){
  const {front,rear,crank,seat,head,r}=configuration;
  const y=15;
  const Z=z+r;
  return [
    ...wheel(front,y,Z,r),...wheel(rear,y,Z,r),
    l(rear,y,Z,crank,y,Z-1,'frame'),l(rear,y,Z,seat,y,Z+12,'frame'),
    l(seat,y,Z+12,crank,y,Z-1,'frame'),l(crank,y,Z-1,head,y,Z+11,'frame'),
    l(front,y,Z,head,y,Z+13,'chrome'),l(head,y,Z+13,head-1,y,Z+16,'chrome'),
    b(head-2,y-4,Z+16,head,y+5,Z+16,'steel'),
    l(seat,y,Z+12,seat-1,y,Z+16,'chrome'),b(seat-4,y-1,Z+16,seat+2,y+2,Z+17,'saddle'),
    b(crank-1,y-2,Z-2,crank+1,y+3,Z,'steel'),
  ];
}
const bikes={
  'road-dropbar': (w,z)=>[
    ...ride(w,z,{front:w-11,rear:10,crank:21,seat:19,head:w-17,r:7}),
    ...[11,20].map(y=>l(w-18,y,z+22,w-14,y,z+18,'steel'))],
  'commuter-front-basket':(w,z)=>[
    ...ride(w,z,{front:w-11,rear:10,crank:20,seat:19,head:w-17,r:7}),
    b(w-16,10,z+14,w-7,20,z+16,'sand'),b(w-16,10,z+17,w-7,11,z+21,'oak'),
    b(w-16,19,z+17,w-7,20,z+21,'oak'),b(w-8,11,z+17,w-7,19,z+21,'oak'),
    b(8,12,z+16,17,18,z+17,'steel')],
  'longtail-cargo':(w,z)=>[
    ...ride(w,z,{front:w-11,rear:10,crank:23,seat:22,head:w-17,r:6}),
    b(5,10,z+13,18,21,z+14,'steel'),b(6,11,z+14,16,15,z+21,'sand'),
    b(6,17,z+14,16,20,z+20,'blue'),b(5,9,z+15,17,10,z+16,'steel')],
  'electric-step-through':(w,z)=>[
    ...ride(w,z,{front:w-11,rear:10,crank:21,seat:19,head:w-17,r:7}),
    b(19,14,z+7,25,16,z+12,'blue'),b(10,12,z+15,16,18,z+16,'steel'),
    b(w-17,14,z+20,w-15,16,z+22,'cream')],
  'folding-mini-bike':(w,z)=>[
    ...ride(w,z,{front:w-12,rear:10,crank:20,seat:18,head:w-19,r:5}),
    b(18,14,z+9,21,16,z+12,'brass'),
    l(w-21,15,z+17,w-22,15,z+23,'steel'),b(w-24,11,z+23,w-21,19,z+23,'chrome')],
  'maintenance-wheel-jig':(w,z)=>[
    ...wheel(14,14,z+16,10),...wheel(w-13,15,z+17,9),
    b(6,8,z,23,23,z+3,'steel'),b(w-24,8,z,w-6,23,z+3,'steel'),
    l(7,23,z+3,14,15,z+16,'steel'),l(w-7,23,z+3,w-13,16,z+17,'steel')],
  'cycle-pump-and-repair':(w,z)=>[
    b(5,7,z,24,24,z+3,'steel'),c(12,12,z+4,z+32,2,'frame'),
    b(7,11,z+32,17,13,z+33,'steel'),l(13,13,z+8,19,19,z+5,'tire'),
    l(19,19,z+5,22,25,z+6,'tire'),
    b(w-13,9,z+4,w-11,11,z+31,'steel'),b(w-19,9,z+29,w-8,12,z+31,'frame')],
  'basket-replacement-rack':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'steel'),b(6,8,z+3,w-7,10,z+24,'frame'),
    ...[4,14].flatMap(h=>[b(7,9,z+h,w-8,23,z+h+1,'steel'),
      b(8,11,z+h+2,19,21,z+h+8,'oak'),b(w-18,11,z+h+2,w-9,22,z+h+8,'sand')])],
};
const docks={
  'street-ring':w=>({z:1,ops:[b(2,5,0,w-3,26,0,'concrete'),b(5,22,0,6,25,18,'steel'),
    b(w-7,22,0,w-6,25,18,'steel'),b(6,23,17,w-7,24,18,'steel')]}),
  'shop-display':w=>({z:6,ops:[b(3,5,0,w-4,26,3,'oak'),b(4,6,4,w-5,25,5,'concrete'),
    b(5,24,5,13,25,6,'blue')]}),
  'maintenance-platform':w=>({z:8,ops:[b(4,6,0,w-5,25,2,'frame'),b(5,7,3,w-6,24,7,'steel'),
    b(5,8,7,7,23,9,'rust'),b(w-8,8,7,w-6,23,9,'rust')]}),
  'cargo-deck':w=>({z:5,ops:[b(4,6,0,w-5,25,2,'frame'),b(4,7,3,w-5,24,4,'oak'),
    ...[7,w-9].flatMap(x=>[7,22].map(y=>b(x,y,4,x+2,y+2,7,'brass')))]}),
  'wheel-chock':w=>({z:3,ops:[b(4,6,0,w-5,25,2,'concrete'),b(7,12,2,15,18,5,'tire'),
    b(w-18,12,2,w-10,18,5,'tire')]}),
};
const designs=[];
for(const [bike,build] of Object.entries(bikes)){
  for(const [format,w] of [['small-wheelbase',48],['long-wheelbase',62]]){
    for(const [station,mount] of Object.entries(docks)){
      const {z,ops}=mount(w);
      designs.push({schemaVersion:1,id:`cycle-${bike}-${format}-${station}`,category:'bicycle',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('bicycle-equipment',designs);
