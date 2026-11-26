import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  steel:{kind:'metal',color:'#91a6b0'}, frame:{kind:'metal',color:'#4c6071'},
  rubber:{kind:'matte',color:'#283541'}, yellow:{kind:'matte',color:'#dea957'},
  blue:{kind:'matte',color:'#4c7e93'}, red:{kind:'matte',color:'#ac594a'},
  white:{kind:'matte',color:'#dbddcf'}, screen:{kind:'emissive',color:'#86bdd0',glowRadius:1,glowIntensity:.14},
};

const machines={
  'arbor-press': z=>[
    b(6,7,z,26,25,z+3,'frame'),b(7,8,z+4,24,11,z+23,'blue'),
    b(7,8,z+23,24,19,z+27,'blue'),b(12,15,z+13,18,18,z+25,'steel'),
    b(10,14,z+3,21,21,z+7,'steel'),l(20,18,z+22,28,18,z+30,'frame'),b(27,17,z+29,30,19,z+31,'red')],
  'pedestal-grinder': z=>[
    b(10,8,z,21,20,z+4,'frame'),c(15,14,z+4,z+12,4,'frame'),b(7,10,z+12,24,18,z+19,'blue'),
    b(4,9,z+13,8,19,z+21,'frame'),b(23,9,z+13,27,19,z+21,'frame'),
    b(5,17,z+14,7,21,z+20,'steel'),b(24,17,z+14,26,21,z+20,'steel'),
    b(4,21,z+13,9,23,z+14,'steel'),b(22,21,z+13,27,23,z+14,'steel')],
  'diagnostic-oscilloscope': z=>[
    b(4,5,z,27,23,z+17,'frame'),b(5,23,z+2,26,24,z+16,'white'),
    b(7,24,z+5,18,25,z+14,'rubber'),l(8,25,z+8,11,25,z+11,'screen'),
    l(11,25,z+11,14,25,z+7,'screen'),l(14,25,z+7,17,25,z+10,'screen'),
    ...[5,10,14].map(h=>b(21,24,z+h,23,25,z+h+1,'blue')),
    b(9,9,z+17,22,10,z+20,'frame')],
  'bench-belt-sander': z=>[
    b(4,6,z,27,25,z+6,'yellow'),b(8,7,z+7,21,23,z+9,'frame'),
    {op:'slope',from:[11,7,z+9],to:[21,21,z+28],axis:'-Y',material:'rubber'},
    b(10,9,z+9,11,19,z+22,'frame'),b(20,9,z+9,21,19,z+22,'frame'),
    b(7,20,z+14,25,24,z+15,'steel'),b(9,25,z+4,13,25,z+5,'red')],
  'fluid-evacuator': z=>[
    c(15,15,z,z+3,9,'rubber'),c(15,15,z+4,z+19,8,'red'),
    c(15,15,z+20,z+23,6,'red'),c(15,15,z+24,z+25,3,'steel'),
    c(15,15,z+26,z+32,1,'steel'),b(9,14,z+32,21,16,z+33,'rubber'),
    l(22,15,z+20,26,20,z+12,'rubber'),l(26,20,z+12,26,13,z+4,'rubber')],
  'desktop-parts-blaster': z=>[
    b(6,5,z,25,25,z+19,'blue'),b(6,6,z+19,25,21,z+25,'frame'),
    b(9,21,z+21,22,22,z+24,'screen'),b(7,25,z+4,24,26,z+18,'frame'),
    b(9,26,z+8,13,27,z+12,'rubber'),b(18,26,z+8,22,27,z+12,'rubber')],
  'oil-filter-crusher': z=>[
    b(6,6,z,25,25,z+3,'red'),b(6,6,z+4,8,24,z+24,'red'),b(23,6,z+4,25,24,z+24,'red'),
    b(6,6,z+24,25,24,z+28,'red'),c(15,15,z+15,z+24,3,'steel'),
    b(11,11,z+13,20,20,z+15,'steel'),c(15,15,z+4,z+12,4,'white'),
    b(14,13,z+27,16,15,z+33,'frame'),b(17,9,z+31,21,17,z+34,'yellow')],
  'small-drill-press': z=>[
    b(5,5,z,26,24,z+3,'frame'),c(15,9,z+4,z+27,2,'steel'),
    b(9,10,z+9,22,21,z+11,'frame'),b(9,7,z+26,22,18,z+31,'yellow'),
    c(15,16,z+20,z+26,2,'steel'),c(15,16,z+15,z+20,1,'steel'),
    l(22,12,z+28,26,18,z+24,'steel'),c(26,18,z+23,z+25,1,'red')],
  'battery-test-clamp-station': z=>[
    b(5,5,z,27,24,z+9,'red'),b(7,7,z+10,25,19,z+17,'frame'),
    b(9,19,z+12,19,19,z+15,'screen'),b(21,19,z+12,23,20,z+13,'yellow'),
    c(11,23,z+10,z+11,1,'steel'),c(23,21,z+10,z+11,1,'steel'),
    l(11,23,z+11,5,26,z+8,'rubber'),l(23,21,z+11,28,26,z+8,'red')],
  'power-spool': z=>[
    b(5,5,z,26,25,z+3,'frame'),b(7,12,z+4,9,16,z+21,'yellow'),
    b(22,12,z+4,24,16,z+21,'yellow'),b(9,14,z+14,22,15,z+15,'steel'),
    b(9,8,z+8,10,21,z+20,'rubber'),b(21,8,z+8,22,21,z+20,'rubber'),
    b(10,10,z+10,21,19,z+18,'blue'),l(17,19,z+10,23,27,z+4,'blue'),
    b(23,27,z+3,26,29,z+5,'yellow')],
};

const stations={
  bench:{z:1,ops:[b(5,7,0,26,23,0,'rubber')]},
  'wall-rail':{z:9,ops:[b(4,5,0,27,7,25,'frame'),b(4,6,7,27,26,8,'steel'),
    b(7,7,1,9,19,7,'frame'),b(22,7,1,24,19,7,'frame')]},
  'service-dolly':{z:8,ops:[
    ...[4,24].flatMap(x=>[5,22].map(y=>b(x,y,0,x+3,y+3,3,'rubber'))),
    b(3,4,4,28,26,7,'blue'),b(5,4,8,6,5,18,'steel'),b(24,4,8,25,5,18,'steel'),
    b(5,4,18,25,6,19,'rubber')]},
};
const designs=[];
for(const [name, build] of Object.entries(machines)){
  for(const [station,{z,ops}] of Object.entries(stations)){
    designs.push({schemaVersion:1,id:`garage-${name}-${station}`,category:'garage',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],palette:'office-night',
      materials,ops:[...ops,...build(z)]});
  }
}
await writeFamily('garage-machines',designs);
