import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  steel:{kind:'metal',color:'#9da5a8'}, iron:{kind:'metal',color:'#535a60'},
  oak:{kind:'wood',color:'#ad825d'}, kraft:{kind:'matte',color:'#b89775'},
  black:{kind:'matte',color:'#34383d'}, chalk:{kind:'matte',color:'#d9d3c4'},
  red:{kind:'matte',color:'#a55b50'}, amber:{kind:'matte',color:'#c4a167'},
  blue:{kind:'matte',color:'#63798c'}, glass:{kind:'glass',color:'#8eacb6'},
};

const fixtures={
  'bakery-tier': (w,z)=>[
    b(4,6,z,w-5,24,z+3,'oak'),b(4,6,z+4,w-5,17,z+11,'oak'),b(4,6,z+12,w-5,10,z+19,'oak'),
    ...[8,17,w-9].flatMap((x,i)=>[c(x,21,z+4,z+5,2,'amber'),
      b(x-2,12,z+12,x+2,16,z+13,i===1?'chalk':'amber'),c(x,8,z+20,z+22,2,'kraft')])],
  'clothing-rail': (w,z)=>[
    b(4,10,z,6,12,z+35,'iron'),b(w-7,10,z,w-5,12,z+35,'iron'),b(4,10,z+34,w-5,12,z+36,'steel'),
    ...Array.from({length:Math.floor((w-10)/4)},(_,i)=>[
      b(7+4*i,11,z+31,8+4*i,12,z+34,'steel'),
      b(7+4*i,8,z+18,8+4*i,16,z+30,['blue','chalk','red','black'][i%4])]).flat()],
  'produce-crate-tier': (w,z)=>[
    ...[5,w-8].flatMap(x=>[b(x,7,z,x+2,9,z+25,'oak'),b(x,22,z,x+2,24,z+18,'oak')]),
    ...[5,19].flatMap(h=>[b(4,7,z+h,w-5,24,z+h+1,'oak'),b(4,22,z+h+1,w-5,24,z+h+4,'kraft'),
      ...Array.from({length:Math.floor((w-12)/7)},(_,i)=>c(9+7*i,16,z+h+2,z+h+5,3,i%2?'amber':'red'))])],
  'jewelry-glass-case': (w,z)=>[
    b(4,6,z,w-5,25,z+8,'oak'),b(4,6,z+9,w-5,7,z+23,'glass'),b(4,7,z+9,5,24,z+23,'glass'),
    b(w-6,7,z+9,w-5,24,z+23,'glass'),b(4,24,z+9,w-5,25,z+23,'glass'),
    b(4,6,z+23,w-5,25,z+24,'steel'),b(6,8,z+24,w-7,23,z+24,'glass'),
    ...[9,17,w-10].map((x,i)=>c(x,17,z+9,z+11+i,2,'amber'))],
  'news-rack': (w,z)=>[
    b(4,6,z,w-5,8,z+30,'iron'),
    ...[6,15,24].flatMap((h,i)=>[b(4,8,z+h,w-5,18,z+h+1,'steel'),
      b(4,16,z+h+1,w-5,19,z+h+3,'iron'),
      ...Array.from({length:Math.floor((w-11)/8)},(_,j)=>
        b(7+8*j,9,z+h+2,11+8*j,12,z+h+7,['chalk','red','blue'][(i+j)%3]))])],
  'footwear-stepped': (w,z)=>[
    b(4,6,z,w-5,25,z+5,'oak'),b(4,6,z+6,w-5,11,z+15,'oak'),
    ...[7,16,w-12].flatMap((x,i)=>[b(x,17,z+6,x+4,24,z+7,i%2?'chalk':'black'),
      b(x,21,z+8,x+4,24,z+10,i%2?'chalk':'black'),b(x,7,z+16,x+4,11,z+19,'kraft')])],
  'pharmacy-cubby': (w,z)=>[
    b(4,5,z,w-5,7,z+32,'chalk'),b(4,7,z,6,22,z+32,'chalk'),b(w-7,7,z,w-5,22,z+32,'chalk'),
    ...[3,13,23,31].map(h=>b(5,7,z+h,w-6,21,z+h+1,'chalk')),
    ...[5,15,25].flatMap((h,i)=>Array.from({length:Math.floor((w-10)/5)},(_,j)=>
      i===1?c(7+j*5,14,z+h,z+h+4,1,'amber'):b(7+j*5,13,z+h,9+j*5,17,z+h+4,j%2?'blue':'chalk')))],
  'electronic-demo-riser': (w,z)=>[
    b(4,6,z,w-5,24,z+4,'oak'),b(4,7,z+4,w-5,11,z+13,'iron'),
    ...[8,17,w-10].flatMap((x,i)=>[b(x-2,12,z+5,x+2,20,z+6,'steel'),
      l(x,14,z+6,x,13,z+11,'iron'),b(x-2,12,z+10,x+2,14,z+17,'black'),
      b(x-1,14,z+11,x+1,14,z+16,i===2?'glass':'blue')])],
};
const stands={
  aisle:(w)=>({z:6,ops:[b(3,5,0,w-4,26,2,'iron'),b(4,5,3,w-5,24,5,'chalk')]}),
  'caster-rail':(w)=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[6,22].map(y=>b(x,y,0,x+3,y+3,3,'black'))),
    b(3,5,4,w-4,26,7,'iron'),b(w-8,5,8,w-5,6,14,'steel')]}),
  'solid-plinth':(w)=>({z:13,ops:[b(3,5,0,w-4,26,2,'iron'),b(4,6,3,w-5,24,12,'oak'),
    b(7,24,6,w-8,25,9,'chalk')]}),
  'open-trestle':(w)=>({z:14,ops:[
    ...[5,w-8].flatMap(x=>[b(x,6,0,x+2,25,1,'iron'),l(x,7,0,x,12,13,'iron'),l(x,24,0,x,18,13,'iron')]),
    b(4,6,12,w-5,26,13,'oak')]}),
};
const designs=[];
for(const [fixture, build] of Object.entries(fixtures)){
  for(const [size,w] of [['endcap',30],['wide',62]]){
    for(const [stand, buildStand] of Object.entries(stands)){
      const {z,ops}=buildStand(w);
      designs.push({schemaVersion:1,id:`retail-${fixture}-${size}-${stand}`,category:'retail',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('retail-fixtures',designs);
