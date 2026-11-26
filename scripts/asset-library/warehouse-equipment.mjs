import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  zinc:{kind:'metal',color:'#9fa8aa'}, frame:{kind:'metal',color:'#586673'},
  black:{kind:'matte',color:'#3b444d'}, safety:{kind:'matte',color:'#bd9255'},
  timber:{kind:'wood',color:'#a78564'}, kraft:{kind:'matte',color:'#b29979'},
  white:{kind:'matte',color:'#d6d0bc'}, darkred:{kind:'matte',color:'#9b584a'},
  blue:{kind:'matte',color:'#5e7489'}, glass:{kind:'glass',color:'#8ba8b6'},
};
function coordinates(z){
  return {
    b:(x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m),
    c:(x,y,k,K,r,m)=>C(x,y,z+k,z+K,r,m),
    l:(x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,z+K,m),
  };
}
const equipment={
  'roller-conveyor': (w,{b})=>[
    b(4,6,0,w-5,25,2,'frame'),b(4,6,3,w-5,8,6,'zinc'),b(4,23,3,w-5,25,6,'zinc'),
    ...Array.from({length:Math.floor((w-10)/4)},(_,i)=>b(5+i*4,9,3,7+i*4,22,5,'zinc')),
    b(9,11,6,20,20,11,'kraft'),b(13,11,11,15,20,11,'white')],
  'belt-vision-sorter': (w,{b,l})=>[
    b(4,6,0,w-5,25,5,'blue'),b(5,8,5,w-6,23,6,'black'),
    ...[10,w-15].flatMap(x=>[b(x,7,6,x+2,8,24,'frame'),b(x,23,6,x+2,24,24,'frame'),
      b(x,7,23,x+2,24,25,'frame'),b(x,14,20,x+2,17,23,'glass')]),
    l(9,11,6,w-8,11,6,'safety'),b(16,12,7,24,20,11,'kraft')],
  'gravity-flow-picker':(w,{b,l})=>[
    ...[5,w-8].flatMap(x=>[b(x,6,0,x+2,8,28,'blue'),b(x,23,0,x+2,25,28,'blue')]),
    ...[4,12,20].flatMap(h=>[l(6,7,h+4,6,24,h,'frame'),l(w-7,7,h+4,w-7,24,h,'frame'),
      b(5,23,h,w-6,25,h+2,'safety'),b(8,12,h+1,21,22,h+5,'kraft')]),
    ...[9,16,23].map(x=>b(x,25,20,x+3,25,21,'white'))],
  'vertical-lift-carriage':(w,{b})=>[
    b(4,6,0,w-5,26,3,'frame'),b(5,7,3,8,25,36,'blue'),b(w-9,7,3,w-6,25,36,'blue'),
    b(5,7,36,w-6,25,38,'frame'),b(8,9,11,w-9,23,14,'zinc'),
    b(5,22,4,w-6,24,5,'safety'),b(12,10,14,24,21,20,'kraft'),b(17,10,20,18,21,20,'white')],
  'stacked-pallet-buffer':(w,{b})=>[
    ...[3,13,23].flatMap(h=>[
      ...[7,15,23].map(y=>b(5,y,h,w-6,y+2,h+1,'timber')),
      b(7,8,h+2,17,23,h+8,'kraft'),b(19,8,h+2,w-8,22,h+8,'kraft'),
      b(11,8,h+8,13,23,h+8,'white'),b(w-16,8,h+8,w-14,22,h+8,'white')])],
  'stretch-wrap-turntable':(w,{b,c})=>[
    b(4,6,0,w-5,25,3,'blue'),c(17,15,4,6,10,'zinc'),b(11,8,7,22,22,23,'kraft'),
    b(10,7,12,23,23,14,'glass'),b(10,7,18,23,23,20,'glass'),
    b(w-9,9,3,w-6,13,35,'frame'),c(w-10,15,15,26,2,'white'),
    b(w-11,10,28,w-6,13,31,'safety')],
  'dock-leveller':(w,{b,l})=>[
    b(4,6,0,w-5,25,3,'frame'),b(4,7,3,w-5,10,13,'blue'),
    ...[8,22].flatMap(x=>[l(x,9,12,x,24,4,'zinc'),l(x+1,9,12,x+1,24,4,'zinc')]),
    ...Array.from({length:12},(_,i)=>b(5,10+i,12-Math.floor(i/2),w-6,10+i,12-Math.floor(i/2),'zinc')),
    b(6,22,4,w-7,26,4,'safety')],
  'bulk-hopper-feed':(w,{b,l})=>[
    ...[6,w-9].flatMap(x=>[b(x,7,0,x+2,9,28,'blue'),b(x,22,0,x+2,24,28,'blue'),
      l(x,8,2,x,23,26,'frame')]),
    b(6,7,26,w-7,25,34,'frame'),b(8,9,34,w-9,23,35,'kraft'),
    b(9,10,22,w-10,22,26,'zinc'),b(12,12,16,w-13,20,22,'zinc'),
    b(15,13,13,w-16,18,17,'safety'),b(14,19,0,w-15,23,4,'blue')],
};
const mounts={
  'bolted-frame': w=>({z:5,ops:[...([5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+3,y+2,2,'black')))),
    B(4,5,3,w-5,26,4,'frame')]}),
  'caster-frame': w=>({z:8,ops:[...([5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+3,y+2,4,'black')))),
    B(4,5,5,w-5,26,7,'zinc'),B(w-7,6,8,w-5,25,10,'safety')]}),
  'raised-mezzanine': w=>({z:13,ops:[...([5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+2,y+2,12,'frame')))),
    B(4,5,11,w-5,26,12,'zinc'),L(w-7,8,1,w-7,24,12,'frame')]}),
  'low-skid': w=>({z:4,ops:[...([6,23].map(y=>B(4,y,0,w-5,y+2,2,'timber'))),
    B(4,6,2,w-5,25,3,'timber')]}),
};
const designs=[];
for(const [machine,build] of Object.entries(equipment)){
  for(const [size,w] of [['compact',34],['wide',62]]){
    for(const [mount,base] of Object.entries(mounts)){
      const {z,ops}=base(w);
      designs.push({schemaVersion:1,id:`warehouse-${machine}-${size}-${mount}`,category:'warehouse',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,1],palette:'office-night',materials,ops:[...ops,...build(w,coordinates(z))]});
    }
  }
}
await writeFamily('warehouse-equipment',designs);
