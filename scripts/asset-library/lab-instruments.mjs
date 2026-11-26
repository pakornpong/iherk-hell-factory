import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  cream:{kind:'matte',color:'#dcdccc'}, black:{kind:'matte',color:'#303c4b'},
  steel:{kind:'metal',color:'#8c9eae'}, blue:{kind:'matte',color:'#4e748e'},
  red:{kind:'matte',color:'#af6556'}, glass:{kind:'glass',color:'#76b2bb'},
  solution:{kind:'glass',color:'#7aa589'}, amber:{kind:'glass',color:'#d5a365'},
  display:{kind:'emissive',color:'#82c7c3',glowRadius:1,glowIntensity:.12},
};
const display=(x,y,z)=>[b(x,y,z,x+8,y,z+3,'black'),b(x+1,y,z+1,x+6,y,z+2,'display')];

const instruments={
  'spectrometer-sample-tray': z=>[
    b(4,6,z,27,25,z+14,'cream'),b(4,6,z+15,27,20,z+18,'blue'),
    b(7,8,z+18,18,17,z+19,'black'),b(9,10,z+19,16,15,z+20,'steel'),
    b(18,19,z+15,26,23,z+19,'black'),...display(17,25,z+8),
    b(5,25,z+4,15,25,z+5,'blue')],
  'vacuum-desiccator': z=>[
    b(5,5,z,26,25,z+3,'steel'),c(15,15,z+4,z+6,10,'black'),
    c(15,15,z+7,z+13,9,'glass'),c(15,15,z+14,z+17,8,'glass'),c(15,15,z+18,z+19,6,'glass'),
    c(15,15,z+20,z+22,3,'steel'),b(16,14,z+21,24,16,z+22,'steel'),b(23,11,z+21,25,17,z+22,'red')],
  'orbital-flask-shaker': z=>[
    b(4,5,z,27,26,z+8,'blue'),b(5,6,z+9,26,25,z+11,'steel'),
    ...[[10,11],[21,11],[15,20]].flatMap(([x,y],i)=>[
      c(x,y,z+12,z+15,4,'glass'),c(x,y,z+12,z+13,3,i===2?'amber':'solution'),
      c(x,y,z+16,z+20,2,'glass'),c(x,y,z+20,z+21,2,'black')]),...display(13,26,z+4)],
  'heated-stir-plate': z=>[
    b(6,6,z,25,25,z+6,'blue'),b(7,7,z+7,24,24,z+8,'cream'),c(14,13,z+9,z+10,6,'steel'),
    c(14,13,z+11,z+16,5,'glass'),c(14,13,z+11,z+13,4,'solution'),
    b(22,7,z+8,23,8,z+26,'steel'),l(22,8,z+24,14,13,z+23,'steel'),l(14,13,z+23,14,13,z+14,'black'),
    ...display(8,25,z+2)],
  'slide-scanner': z=>[
    b(4,5,z,27,25,z+4,'black'),b(6,7,z+5,26,15,z+23,'cream'),b(5,13,z+6,11,24,z+11,'cream'),
    b(8,15,z+10,23,25,z+11,'steel'),b(11,18,z+12,21,22,z+12,'glass'),
    c(16,17,z+16,z+22,4,'blue'),c(16,17,z+13,z+16,2,'steel'),...display(10,15,z+19)],
  'dry-block-incubator': z=>[
    b(5,5,z,26,25,z+9,'cream'),b(7,7,z+10,24,23,z+14,'steel'),
    ...[10,16,21].flatMap(x=>[11,18].flatMap(y=>[
      c(x,y,z+14,z+21+(x%3),1,'glass'),c(x,y,z+21+(x%3),z+22+(x%3),2,'red')])),
    ...display(10,25,z+4)],
  'electrophoresis-tray': z=>[
    b(3,6,z,23,25,z+4,'blue'),b(4,7,z+5,22,24,z+8,'glass'),b(7,9,z+8,19,21,z+8,'amber'),
    ...[9,12,15,18].map(y=>b(8,y,z+8,18,y,z+8,'steel')),
    b(23,8,z,29,19,z+11,'cream'),b(24,19,z+7,28,19,z+9,'display'),
    l(6,8,z+9,14,6,z+13,'red'),l(14,6,z+13,26,8,z+9,'red')],
  'burette-stand': z=>[
    b(4,5,z,27,25,z+3,'black'),b(7,8,z+4,8,9,z+31,'steel'),b(8,8,z+26,18,9,z+27,'steel'),
    c(17,10,z+12,z+32,2,'glass'),c(17,10,z+19,z+26,1,'solution'),
    b(18,10,z+13,21,11,z+14,'red'),c(17,11,z+4,z+9,4,'glass'),c(17,11,z+4,z+5,3,'solution')],
  'compact-fume-enclosure': z=>[
    b(3,5,z,28,25,z+4,'steel'),b(4,5,z+5,27,7,z+28,'blue'),
    b(4,8,z+5,5,23,z+27,'glass'),b(26,8,z+5,27,23,z+27,'glass'),
    b(4,7,z+28,27,24,z+31,'steel'),b(5,23,z+18,26,24,z+26,'glass'),
    c(11,13,z+5,z+11,3,'glass'),c(20,17,z+5,z+12,2,'amber')],
  'photometer-tube-rack': z=>[
    b(5,5,z,26,25,z+13,'cream'),b(6,6,z+14,25,20,z+16,'blue'),
    c(10,11,z+16,z+26,2,'glass'),c(16,11,z+16,z+22,2,'amber'),
    b(20,7,z+16,24,14,z+20,'black'),b(20,14,z+18,24,14,z+19,'display'),
    ...display(9,25,z+7)],
};

const stands={
  'bench-unit': {z:1, ops:[b(6,8,0,25,24,0,'black')]},
  'mobile-rack': {z:15, ops:[
    ...[5,24].flatMap(x=>[6,23].flatMap(y=>[
      b(x,y,0,x+2,y+2,3,'black'),b(x,y,4,x+1,y+1,14,'steel')])),
    b(4,5,5,27,26,6,'blue'),b(4,5,13,27,26,14,'steel'),b(8,9,7,22,20,9,'cream')]},
  'pedestal-module': {z:12, ops:[
    b(5,5,0,26,26,2,'black'),b(9,8,3,22,23,10,'blue'),b(4,5,10,27,26,11,'steel'),
    b(11,23,6,20,24,7,'steel')]},
};
const designs=[];
for(const [instrument, build] of Object.entries(instruments)){
  for(const [stand,{z,ops}] of Object.entries(stands)){
    designs.push({schemaVersion:1,id:`instrument-${instrument}-${stand}`,category:'lab',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[1,1],palette:'office-night',materials,ops:[...ops,...build(z)]});
  }
}
await writeFamily('lab-instruments',designs);
