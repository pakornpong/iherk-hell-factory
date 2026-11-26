import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  wood:{kind:'wood',color:'#a17f5c'}, steel:{kind:'metal',color:'#9ea9a8'},
  frame:{kind:'metal',color:'#606b73'}, soil:{kind:'matte',color:'#655142'},
  fern:{kind:'matte',color:'#627c58'}, leaf:{kind:'matte',color:'#809664'},
  slate:{kind:'matte',color:'#5d7388'}, clay:{kind:'matte',color:'#a76b56'},
  amber:{kind:'matte',color:'#c4a267'}, ivory:{kind:'matte',color:'#d8ccb6'},
  glass:{kind:'glass',color:'#91aeb9'}, black:{kind:'matte',color:'#424a4e'},
};
const farms={
  'propagation-seed-cells': (w,b,c,l)=>[
    b(4,7,0,w-5,24,3,'frame'),b(6,8,3,w-7,23,3,'soil'),
    ...[11,16,21].flatMap(y=>Array.from({length:Math.floor((w-10)/5)},(_,i)=>{
      const x=8+i*5;
      return [c(x,y,4,4,1,'soil'),l(x,y,4,x,y,7+i%3,'fern'),
        l(x,y,6,x+1,y+(i%2?1:-1),7,'leaf')];
    }).flat())],
  'tomato-vine-support':(w,b,c,l)=>[
    b(4,7,0,w-5,24,5,'wood'),b(6,9,5,w-7,22,5,'soil'),
    ...([7,w-8].map(x=>b(x,11,6,x+1,12,28,'wood'))),b(7,11,28,w-7,12,29,'wood'),
    ...Array.from({length:Math.floor((w-12)/8)},(_,i)=>{
      const x=9+8*i;
      return [l(x,16,6,x,12,28,'fern'),l(x,14,11,x+3,16,16,'leaf'),
        l(x,13,18,x-3,15,22,'leaf'),c(x+2,16,14,15,1,'clay')];
    }).flat()],
  'microgreen-rack':(w,b,c,l)=>[
    ...[5,w-7].flatMap(x=>[7,22].map(y=>b(x,y,0,x+1,y+1,32,'frame'))),
    ...[3,14,25].flatMap(h=>[b(5,7,h,w-6,23,h+1,'steel'),b(7,9,h+2,w-8,21,h+3,'soil'),
      ...Array.from({length:Math.floor((w-12)/4)},(_,i)=>b(8+i*4,10,h+4,9+i*4,19,h+4+i%2,'leaf'))])],
  'hydroponic-channel':(w,b,c,l)=>[
    ...[9,16,22].flatMap(y=>[b(5,y,5,w-6,y+2,7,'ivory'),
      ...Array.from({length:Math.floor((w-10)/6)},(_,i)=>c(8+i*6,y+1,7,10+i%2,1,'fern'))]),
    b(5,7,0,7,24,5,'frame'),b(w-8,7,0,w-6,24,5,'frame'),
    b(7,8,0,17,15,4,'slate'),l(8,10,4,5,10,6,'steel')],
  'potting-soil-bin':(w,b,c,l)=>[
    b(5,7,0,w-6,25,6,'wood'),b(6,8,6,w-7,24,6,'soil'),
    b(5,7,7,w-6,9,13,'wood'),b(5,10,7,7,24,12,'wood'),b(w-8,10,7,w-6,24,12,'wood'),
    b(5,23,7,w-6,25,9,'wood'),c(12,17,6,9,3,'clay'),l(19,15,6,25,24,15,'wood')],
  'produce-wash-trough':(w,b,c,l)=>[
    b(5,6,0,w-6,25,3,'steel'),b(5,7,4,w-6,24,10,'steel'),b(7,9,10,w-8,22,10,'glass'),
    ...[9,15,21].map(y=>b(7,y,11,w-8,y,11,'frame')),
    c(11,15,11,13,2,'amber'),c(w-11,14,11,14,2,'clay'),
    b(w-12,7,10,w-11,8,24,'steel'),l(w-12,8,24,w-12,15,23,'steel')],
  'irrigation-tap-manifold':(w,b,c,l)=>[
    b(5,6,0,w-6,24,3,'frame'),b(6,6,4,w-7,10,24,'wood'),b(8,10,19,w-9,13,21,'steel'),
    ...Array.from({length:Math.floor((w-14)/6)},(_,i)=>{
      const x=10+6*i;
      return [c(x,12,15,22,1,'steel'),b(x-1,11,22,x+1,13,23,i%2?'slate':'clay'),
        l(x,12,15,x,20,5,'slate')];
    }).flat()],
  'orchard-crate-scale':(w,b,c,l)=>[
    b(4,6,0,w-5,25,4,'frame'),b(6,8,5,23,23,7,'steel'),b(8,10,8,21,21,13,'wood'),
    ...[11,16,20].map((x,i)=>c(x,15,13,15,2,i%2?'amber':'clay')),
    b(w-11,7,4,w-9,9,20,'frame'),b(w-16,7,19,w-7,12,24,'black'),
    b(w-15,12,20,w-8,12,23,'glass')],
  'pot-storage-step':(w,b,c,l)=>[
    b(5,7,0,w-6,25,5,'wood'),b(5,7,5,w-6,18,11,'wood'),b(5,7,11,w-6,12,17,'wood'),
    ...[10,19,w-10].flatMap((x,i)=>[c(x,20,5,10,3,'clay'),c(x,14,11,15,2,'clay'),
      c(x,9,17,19+i,2,'ivory')])],
};
const foundations={
  'slatted-bench': w=>({z:12,ops:[
    ...([5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+2,y+2,10,'wood')))),
    ...[6,11,16,21].map(y=>B(4,y,10,w-5,y+3,11,'wood'))]}),
  'galvanized-cart':w=>({z:8,ops:[
    ...([5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+2,y+2,3,'black')))),
    B(4,5,4,w-5,26,7,'steel'),B(5,5,8,7,23,9,'frame')]}),
  'stone-station':w=>({z:5,ops:[
    B(4,5,0,w-5,26,3,'frame'),B(5,6,4,w-6,25,4,'ivory')]}),
  'earth-floor':w=>({z:4,ops:[
    B(3,4,0,w-4,27,1,'wood'),B(4,5,2,w-5,26,3,'soil'),B(4,5,3,w-5,7,3,'wood')]}),
};
const designs=[];
for(const [system,build] of Object.entries(farms)){
  for(const [size,w] of [['single',35],['long',62]]){
    for(const [mount,base] of Object.entries(foundations)){
      const {z,ops}=base(w);
      const b=(x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m);
      const c=(x,y,k,K,r,m)=>C(x,y,z+k,z+K,r,m);
      const l=(x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,z+K,m);
      designs.push({schemaVersion:1,id:`growhouse-${system}-${size}-${mount}`,category:'horticulture',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(w,b,c,l)]});
    }
  }
}
await writeFamily('growhouse',designs);
