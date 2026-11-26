import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  steel:{kind:'metal',color:'#94a0a9'}, black:{kind:'matte',color:'#323b45'},
  rubber:{kind:'matte',color:'#47535b'}, gray:{kind:'matte',color:'#65758a'},
  blue:{kind:'matte',color:'#4e697f'}, vinyl:{kind:'matte',color:'#354f65'},
  red:{kind:'matte',color:'#a3534b'}, brass:{kind:'metal',color:'#ba9d65'},
};

const programs={
  'adjustable-bench': z=>[
    b(11,13,z,49,16,z+8,'steel'),b(15,7,z+7,31,22,z+10,'vinyl'),
    {op:'slope',from:[31,7,z+8],to:[54,22,z+26],axis:'+X',material:'vinyl'},
    b(43,14,z+3,45,16,z+20,'steel')],
  'reformer-carriage': z=>[
    b(6,7,z,57,9,z+7,'steel'),b(6,22,z,57,24,z+7,'steel'),
    b(14,10,z+5,40,21,z+9,'vinyl'),b(10,10,z+6,14,21,z+13,'vinyl'),
    b(47,7,z+3,53,8,z+18,'black'),b(47,23,z+3,53,24,z+18,'black'),
    b(48,9,z+17,50,22,z+18,'rubber')],
  'strength-rack': z=>[
    ...[15,46].flatMap(x=>[7,23].map(y=>b(x,y,z,x+2,y+2,z+36,'steel'))),
    b(15,7,z+36,48,25,z+37,'black'),b(14,14,z+24,49,16,z+25,'steel'),
    b(15,11,z+20,18,19,z+29,'black'),b(44,11,z+20,47,19,z+29,'black'),
    b(25,10,z+1,38,22,z+6,'vinyl')],
  'incline-step': z=>[
    ...[8,18,28,38,48].map((x,i)=>b(x,8,z,x+9,23,z+3+i*3,'rubber')),
    l(9,7,z+12,57,7,z+30,'steel'),l(9,24,z+12,57,24,z+30,'steel'),
    l(12,7,z+2,12,7,z+13,'steel'),l(54,24,z+12,54,24,z+29,'steel')],
  'air-bike': z=>[
    b(21,14,z,40,16,z+4,'steel'),l(28,15,z+3,36,15,z+19,'steel'),
    b(33,11,z+18,43,19,z+21,'vinyl'),b(21,7,z+4,24,22,z+19,'rubber'),
    b(20,10,z+6,25,19,z+21,'black'),b(25,12,z+10,27,18,z+15,'gray'),
    l(23,15,z+16,19,15,z+28,'steel'),b(15,13,z+27,26,17,z+30,'black')],
  'water-rower': z=>[
    b(5,10,z,58,12,z+4,'gray'),b(5,20,z,58,22,z+4,'gray'),
    c(13,16,z+4,z+12,8,'blue'),c(13,16,z+13,z+13,7,'steel'),
    b(28,12,z+5,36,20,z+8,'vinyl'),b(23,10,z+5,25,13,z+10,'black'),
    b(23,19,z+5,25,22,z+10,'black'),l(14,16,z+13,26,16,z+14,'black')],
  'kettlebell-stand': z=>[
    b(7,8,z,56,24,z+4,'gray'),b(7,8,z+5,56,11,z+14,'gray'),
    ...[13,24,36,48].flatMap((x,i)=>[c(x,18,z+5,z+8+i%2,3+i%2,'black'),
      b(x-2,17,z+8,x-1,19,z+12,'black'),b(x+1,17,z+8,x+2,19,z+12,'black'),
      b(x-2,17,z+12,x+2,19,z+13,i%2?'brass':'red')])],
  'cable-pulley': z=>[
    ...[10,52].flatMap(x=>[b(x,11,z,x+2,19,z+39,'steel'),
      b(x-2,12,z+2,x+4,19,z+13,'black'),
      ...[4,7,10].map(h=>b(x-2,20,z+h,x+4,20,z+h,'gray'))]),
    b(10,11,z+39,54,19,z+41,'black'),l(14,16,z+37,22,19,z+19,'steel'),
    l(50,16,z+37,42,19,z+19,'steel'),b(20,18,z+18,24,20,z+19,'rubber'),
    b(40,18,z+18,44,20,z+19,'rubber')],
};

const floors={
  'steel-feet': {z:2,ops:[9,53].flatMap(x=>[b(x,5,0,x+2,26,1,'steel'),b(x-2,14,1,x+4,18,2,'steel')])},
  'platform-rubber': {z:3,ops:[b(3,5,0,59,26,2,'black'),b(4,6,2,58,7,2,'rubber')]},
  'wood-deck': {z:4,ops:[b(3,5,0,59,26,2,'black'),
    ...[6,10,14,18,22].map(y=>b(4,y,3,58,y+2,3,'brass'))]},
  'modular-track': {z:4,ops:[b(4,5,0,58,26,1,'rubber'),
    b(4,6,2,58,8,3,'steel'),b(4,23,2,58,25,3,'steel'),
    b(10,8,2,12,23,3,'black'),b(49,8,2,51,23,3,'black')]},
};
const designs=[];
for(const [equipment,build] of Object.entries(programs)){
  for(const [base,{z,ops}] of Object.entries(floors)){
    designs.push({schemaVersion:1,id:`gym-equipment-${equipment}-${base}`,category:'fitness',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[2,1],palette:'office-night',materials,ops:[...ops,...build(z)]});
  }
}
await writeFamily('fitness',designs);
