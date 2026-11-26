import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const mats={
  oak:{kind:'wood',color:'#a67e58'}, plaster:{kind:'matte',color:'#d8cfc1'},
  black:{kind:'matte',color:'#3d454d'}, steel:{kind:'metal',color:'#a0aaad'},
  glass:{kind:'glass',color:'#9cb5ba'}, copper:{kind:'metal',color:'#b78268'},
  blue:{kind:'matte',color:'#657a90'}, linen:{kind:'matte',color:'#b8aa96'},
  ceramic:{kind:'matte',color:'#ab6854'}, paper:{kind:'matte',color:'#e0d8c7'},
};
const exhibits={
  'ceramics-with-dishes':(w,z)=>[
    ...[10,Math.floor(w/2),w-10].flatMap((x,i)=>[c(x,14,z,z+4+i,3,'ceramic'),
      c(x,14,z+5+i,z+7+i,2,'ceramic'),c(x,14,z+8+i,z+9+i,3,'ceramic')]),
    c(w-9,20,z,z+1,4,'plaster'),c(w-9,20,z+1,z+1,3,'blue')],
  'scale-building-model':(w,z)=>[
    b(6,7,z,w-7,24,z+1,'linen'),
    b(9,10,z+2,17,20,z+12,'plaster'),b(10,11,z+12,16,18,z+14,'blue'),
    b(w-16,10,z+2,w-10,18,z+9,'plaster'),b(w-13,13,z+10,w-11,15,z+15,'steel'),
    b(8,21,z+2,w-9,21,z+2,'black')],
  'mechanical-cutaway':(w,z)=>[
    b(7,8,z,w-8,23,z+4,'black'),c(12,15,z+5,z+14,4,'copper'),
    c(w-13,15,z+5,z+19,5,'steel'),c(w-13,15,z+20,z+23,2,'copper'),
    b(13,14,z+8,w-14,16,z+10,'steel'),b(10,11,z+15,14,19,z+17,'black')],
  'framed-print-stack':(w,z)=>[
    b(6,7,z,w-7,24,z+2,'oak'),b(8,8,z+3,w-9,11,z+25,'black'),
    b(9,11,z+4,w-10,11,z+24,'paper'),b(10,11,z+7,w-11,11,z+21,'blue'),
    b(10,13,z+3,w-11,16,z+18,'oak'),b(11,16,z+4,w-12,16,z+16,'paper'),
    l(12,16,z+7,w-13,16,z+14,'copper')],
  'specimen-drawers':(w,z)=>[
    b(6,7,z,w-7,24,z+12,'oak'),b(7,24,z+2,w-8,25,z+6,'linen'),
    b(7,24,z+8,w-8,25,z+11,'linen'),b(8,8,z+12,w-9,23,z+13,'glass'),
    ...[10,Math.floor(w/2),w-11].map((x,i)=>b(x,12+i,z+13,x+3,17+i,z+14,['steel','blue','copper'][i]))],
  'fabric-sample-fan':(w,z)=>[
    b(6,8,z,w-7,24,z+2,'oak'),b(8,8,z+2,w-9,10,z+23,'black'),
    b(10,10,z+19,w-11,16,z+21,'steel'),
    ...Array.from({length:Math.floor((w-20)/5)},(_,i)=>
      b(10+i*5,15-i%2,z+4+i%2,13+i*5,18-i%2,z+18,['linen','ceramic','blue','paper'][i%4]))],
  'artifact-on-cradle':(w,z)=>[
    b(7,8,z,w-8,24,z+3,'plaster'),
    ...[10,w-13].flatMap(x=>[l(x,10,z+4,x,15,z+12,'steel'),l(x,22,z+4,x,16,z+12,'steel')]),
    b(9,12,z+11,w-10,18,z+16,'copper'),c(w-12,15,z+16,z+20,3,'copper'),
    b(8,20,z+4,15,22,z+4,'paper')],
  'map-rolls-and-chart':(w,z)=>[
    b(6,7,z,w-7,24,z+2,'oak'),b(7,7,z+2,w-8,9,z+23,'oak'),
    b(8,9,z+5,w-9,9,z+21,'paper'),l(10,9,z+10,w-11,9,z+17,'blue'),
    l(11,9,z+18,w-13,9,z+13,'copper'),
    b(12,17,z+3,w-9,20,z+5,'linen'),b(10,20,z+2,w-12,22,z+4,'paper')],
};
const cases={
  'raised-plinth': w=>({z:12,ops:[b(4,6,0,w-5,25,10,'plaster'),b(3,5,10,w-4,26,11,'steel')]}),
  'glass-table': w=>({z:10,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,9,'black'))),
    b(4,5,8,w-5,25,9,'glass'),b(4,5,10,w-5,6,31,'glass'),
    b(4,6,10,5,25,30,'glass'),b(w-6,6,10,w-5,25,30,'glass'),
    b(4,25,10,w-5,25,30,'glass'),b(4,5,31,w-5,25,31,'steel')]}),
  'arched-backdrop': w=>({z:5,ops:[
    b(4,5,0,w-5,25,4,'plaster'),b(4,5,5,7,8,34,'plaster'),b(w-8,5,5,w-5,8,34,'plaster'),
    b(6,5,34,w-7,8,37,'plaster'),l(7,8,30,13,8,36,'steel'),l(w-8,8,30,w-14,8,36,'steel')]}),
  'road-transport-case': w=>({z:9,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
    b(4,6,4,w-5,25,8,'black'),b(4,6,7,w-5,25,8,'steel'),b(5,6,9,w-6,8,31,'black'),
    b(5,7,30,w-6,9,31,'steel')]}),
  'balustrade-seat': w=>({z:7,ops:[
    b(4,5,0,w-5,25,6,'oak'),b(4,6,7,6,24,19,'steel'),b(w-7,6,7,w-5,24,19,'steel'),
    b(4,22,18,w-5,24,19,'steel'),b(6,22,11,w-7,23,11,'steel')]}),
};
const designs=[];
for(const [subject,build] of Object.entries(exhibits)){
  for(const [layout,w] of [['single',31],['double',59]]){
    for(const [caseName,mount] of Object.entries(cases)){
      const {z,ops}=mount(w);
      designs.push({schemaVersion:1,id:`exhibit-${subject}-${layout}-${caseName}`,category:'museum',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials:mats,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('exhibition-fixtures',designs);
