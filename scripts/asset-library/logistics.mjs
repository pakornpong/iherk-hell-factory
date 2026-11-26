import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  steel:{kind:'metal',color:'#a5afb0'}, frame:{kind:'metal',color:'#556471'},
  black:{kind:'matte',color:'#303841'}, wood:{kind:'wood',color:'#a07750'},
  cardboard:{kind:'matte',color:'#ae8e65'}, paper:{kind:'matte',color:'#d9d0bc'},
  blue:{kind:'matte',color:'#637589'}, yellow:{kind:'matte',color:'#c49f56'},
  red:{kind:'matte',color:'#a95c4c'}, film:{kind:'glass',color:'#a2b6b9'},
};

const chassis={
  'flat-platform': (w)=>[
    ...[5,w-8].flatMap(x=>[6,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
    b(3,4,4,w-4,27,6,'frame'),b(4,5,7,w-5,26,7,'wood')],
  'deep-cage': (w)=>[
    ...[5,w-8].flatMap(x=>[6,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
    b(3,4,4,w-4,27,7,'frame'),
    ...[3,w-5].flatMap(x=>[b(x,4,8,x+1,26,9,'steel'),b(x,4,19,x+1,26,20,'steel'),
      ...[4,10,16,22,26].map(y=>b(x,y,8,x+1,y,20,'steel'))]),
    b(3,4,19,w-4,5,20,'frame'),b(3,4,8,w-4,5,9,'frame'),
    ...Array.from({length:Math.floor(w/7)},(_,i)=>b(5+i*7,4,8,5+i*7,4,20,'steel'))],
  'runner-skid': (w)=>[
    ...[7,16,24].map(y=>b(3,y,0,w-4,y+1,2,'wood')),
    ...[4,w-7].map(x=>b(x,4,2,x+2,27,6,'wood')),b(3,4,6,w-4,27,7,'wood')],
  'tug-trailer': (w)=>[
    ...[6,w-10].flatMap(x=>[5,23].map(y=>b(x,y,0,x+4,y+3,5,'black'))),
    b(3,4,5,w-5,27,7,'frame'),b(w-5,13,3,w-1,17,5,'yellow'),
    b(w-2,14,5,w-1,16,6,'steel')],
  'deck-with-ramps': (w)=>[
    b(3,4,3,w-4,27,7,'blue'),...([5,w-8].flatMap(x=>[6,23].map(y=>b(x,y,0,x+2,y+2,3,'black')))),
    {op:'slope',from:[3,26,0],to:[w-4,31,7],axis:'-Y',material:'steel'}],
};

const loads={
  'flat-parcel-stacks': (w)=>[
    ...Array.from({length:Math.floor((w-7)/9)},(_,i)=>[
      b(5+9*i,8,8,12+9*i,24,11+(i%3)*2,'cardboard'),
      b(7+9*i,9,11+(i%3)*2,8+9*i,23,11+(i%3)*2,'paper'),
      b(6+9*i,12,12+(i%3)*2,10+9*i,16,13+(i%3)*2,'paper')]).flat()],
  'nested-totes': (w)=>[
    ...Array.from({length:Math.floor((w-9)/11)},(_,i)=>[
      b(5+i*11,7,8,14+i*11,24,18-i%2*3,'blue'),
      b(4+i*11,6,17-i%2*3,15+i*11,25,18-i%2*3,'frame'),
      b(6+i*11,8,18-i%2*3,13+i*11,23,18-i%2*3,'black'),
      b(8+i*11,24,13-i%2*3,11+i*11,25,14-i%2*3,'paper')]).flat()],
  'rolled-material': (w)=>[
    b(5,7,8,w-6,24,9,'frame'),
    ...[10,16,22].flatMap((y,i)=>[b(5,y-2,10,w-7,y+2,14+i%2,'paper'),
      b(w-6,y-1,11,w-6,y+1,13,'cardboard')]),
    ...[9,w-10].flatMap(x=>[b(x,7,14,x+1,24,15,'red'),b(x,7,9,x+1,8,14,'red')])],
  'cylinder-bank': (w)=>[
    ...Array.from({length:Math.floor((w-8)/8)},(_,i)=>
      [11,21].flatMap(y=>[c(7+i*8,y,8,26+i%2*3,3,i%2?'blue':'steel'),
        c(7+i*8,y,27+i%2*3,29+i%2*3,1,'red')])).flat(),
    b(4,6,18,w-5,6,20,'frame'),b(4,25,18,w-5,25,20,'frame')],
  'parcel-lockbox': (w)=>[
    b(5,7,8,w-6,24,29,'frame'),b(5,7,29,w-6,24,30,'steel'),
    ...Array.from({length:Math.floor((w-8)/9)},(_,i)=>[
      b(6+i*9,24,10,12+i*9,25,20,'blue'),b(6+i*9,24,22,12+i*9,25,27,'steel'),
      b(9+i*9,26,16,11+i*9,26,17,'yellow')]).flat()],
  'strapped-shipping-crate': (w)=>[
    b(5,7,8,w-6,24,24,'cardboard'),b(4,6,8,w-5,25,10,'wood'),
    b(4,6,23,w-5,25,25,'wood'),
    ...[8,w-11].flatMap(x=>[b(x,6,10,x+1,6,24,'red'),b(x,6,25,x+1,25,25,'red')]),
    b(12,25,15,17,25,19,'paper')],
  'upright-appliance': (w)=>[
    b(6,8,8,w-7,23,10,'wood'),b(7,9,11,w-8,22,32,'steel'),
    b(8,22,14,w-9,23,30,'paper'),b(w-13,23,14,w-12,24,25,'frame'),
    b(6,8,27,w-7,23,28,'film'),b(6,8,17,w-7,23,18,'film')],
};

const designs=[];
for(const [load, payload] of Object.entries(loads)){
  for(const [platform, build] of Object.entries(chassis)){
    for(const [size,w] of [['compact',30],['double-deck',62]]){
      designs.push({schemaVersion:1,id:`cargo-${load}-${platform}-${size}`,category:'logistics',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...build(w),...payload(w)]});
    }
  }
}
await writeFamily('logistics',designs);
