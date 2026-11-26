import { writeFamily } from './render.mjs';

const box = (x, y, z, X, Y, Z, material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const tube = (x, y, zFrom, zTo, radius, material) => ({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const beam = (x, y, z, X, Y, Z, material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const paint = {
  iron: ['#4c5962','metal'], steel:['#9aa8ac','metal'], brass:['#bda16d','metal'],
  oak:['#a97d56','wood'], ivory:['#dad6c9','matte'], black:['#303943','matte'],
  slate:['#677887','matte'], sand:['#b49a79','matte'], red:['#ab5f50','matte'],
  amber:['#d1ab5d','matte'], textile:['#8d8074','matte'], glass:['#88aaba','glass'],
};
const materials = Object.fromEntries(Object.entries(paint).map(([key,[color,kind]])=>[key,{color,kind}]));

function tools(z){
  const b=(x,y,Z,X,Y,h,m)=>box(x,y,z+Z,X,Y,z+h,m);
  const c=(x,y,Z,h,r,m)=>tube(x,y,z+Z,z+h,r,m);
  const l=(x,y,Z,X,Y,h,m)=>beam(x,y,z+Z,X,Y,z+h,m);
  return {b,c,l};
}
function platform(kind,w){
  const b=box, c=tube, l=beam;
  const feet=[6,w-9];
  switch(kind){
    case 'service-cart': return {z:9, ops:[
      ...feet.flatMap(x=>[7,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
      ...feet.flatMap(x=>[7,23].map(y=>b(x,y,4,x+1,y+1,8,'iron'))),
      b(4,5,4,w-5,26,5,'slate'),b(4,5,7,w-5,26,8,'steel'),
      b(4,5,9,5,6,14,'steel'),b(4,24,9,5,25,14,'steel'),b(4,5,14,5,25,15,'steel')]};
    case 'cabinet-base': return {z:14, ops:[b(4,6,0,w-5,25,2,'black'),b(5,6,3,w-6,24,12,'ivory'),
      b(4,5,12,w-5,26,13,'steel'), b(8,24,5,w-9,25,10,'slate'),
      b(11,25,8,w-12,26,8,'steel')]};
    case 'lift-column': return {z:13, ops:[
      b(6,7,0,w-7,24,2,'iron'),b(Math.floor(w/2)-4,11,3,Math.floor(w/2)+4,19,11,'steel'),
      b(4,5,11,w-5,26,12,'iron'),b(7,20,3,10,23,5,'amber')]};
    case 'built-in-bench': return {z:11, ops:[
      b(4,5,0,w-5,7,18,'ivory'),b(4,6,8,w-5,26,10,'slate'),
      ...feet.map(x=>[l(x,7,1,x,21,8,'steel'),b(x,10,8,x+2,25,9,'steel')]).flat()]};
    case 'tripod-trestle': return {z:15, ops:[
      ...feet.flatMap(x=>[l(x,16,13,x,7,0,'iron'),l(x,16,13,x,24,0,'iron'),b(x-1,13,12,x+2,19,14,'iron')]),
      b(4,7,13,w-5,24,14,'steel')]};
    case 'plumbed-plinth': return {z:3, ops:[b(5,7,0,w-6,25,2,'slate'),
      b(8,7,1,10,16,3,'steel'),b(w-12,7,1,w-10,16,3,'steel')]};
    case 'floor-pedestal': return {z:2, ops:[c(15,15,0,1,10,'steel')]};
    case 'caster-cradle': return {z:6, ops:[
      ...feet.flatMap(x=>[7,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
      b(4,6,3,w-5,25,5,'iron')]};
    case 'reinforced-sled': return {z:3, ops:[
      b(5,7,0,w-6,9,2,'iron'),b(5,22,0,w-6,24,2,'iron'),b(6,7,2,w-7,24,2,'steel')]};
    case 'rubber-platform': return {z:2, ops:[b(5,5,0,w-6,26,1,'black'),
      b(7,7,1,w-8,8,1,'amber')]};
    case 'bench-insert': return {z:3, ops:[b(4,6,0,w-5,25,1,'iron'),b(6,7,1,w-7,24,2,'slate')]};
  }
  throw new Error(kind);
}

const clinical = {
  'sterile-instrument-trays': ({b,c})=>[
    b(5,7,0,26,24,2,'slate'),b(6,8,2,25,23,3,'steel'),
    ...[8,12,16,20].map((x,i)=>b(x,13,3,x+1,20+i%2,4,'ivory')),
    b(8,7,3,23,8,14,'iron'),b(8,8,12,23,14,14,'steel'),c(13,10,15,19,2,'ivory')],
  'suction-canister-unit': ({b,c,l})=>[
    b(6,6,0,25,23,7,'ivory'),b(7,20,6,24,23,10,'slate'),c(11,14,7,19,4,'glass'),
    c(20,14,7,17,3,'glass'),b(10,12,19,12,16,21,'steel'),l(12,14,21,19,14,18,'black'),c(22,21,11,12,1,'red')],
  'infusion-monitor-mast': ({b,c,l})=>[
    c(15,15,0,2,8,'iron'),c(15,15,3,36,1,'steel'),b(9,12,36,22,15,37,'steel'),
    b(9,15,27,12,16,34,'glass'),b(19,15,26,22,16,33,'glass'),
    b(14,16,15,22,20,22,'ivory'),b(15,20,17,20,20,21,'slate'),l(10,15,27,16,20,22,'ivory')],
  'portable-ultrasound-bay': ({b,c,l})=>[
    b(5,7,0,26,23,9,'ivory'),b(8,7,10,23,10,26,'slate'),b(10,10,13,21,10,24,'glass'),
    b(8,12,10,24,21,11,'iron'),...[10,14,18,22].map(x=>b(x,16,12,x+1,17,12,'ivory')),
    l(23,18,12,26,23,9,'black'),b(24,23,8,26,26,10,'ivory'),c(19,20,12,13,1,'amber')],
  'medication-dispensing-pigeonholes': ({b,c})=>[
    b(5,6,0,26,10,29,'slate'),b(5,10,0,6,24,29,'ivory'),b(25,10,0,26,24,29,'ivory'),
    ...[1,10,19,28].map(h=>b(6,10,h,25,23,h+1,'ivory')),
    ...[3,12,21].flatMap(h=>[9,15,21].map(x=>c(x,17,h,h+4,2,h===12?'amber':'steel')))],
  'therapy-heat-console': ({b,c,l})=>[
    b(7,7,0,24,24,11,'ivory'),b(9,8,11,22,13,22,'slate'),b(11,13,14,20,13,20,'glass'),
    c(14,18,11,14,2,'iron'),c(20,18,11,13,1,'red'),
    l(23,15,8,27,20,17,'iron'),b(24,19,16,29,24,18,'ivory')],
  'specimen-pass-through': ({b,c})=>[
    b(6,6,0,25,24,4,'steel'),b(6,6,5,25,8,26,'ivory'),
    b(6,8,5,8,23,25,'glass'),b(23,8,5,25,23,25,'glass'),
    b(6,6,25,25,23,27,'steel'),b(7,23,16,24,24,25,'glass'),
    c(12,15,5,15,2,'glass'),c(18,17,5,12,2,'amber')],
  'eyewash-twin-nozzle': ({b,c,l})=>[
    b(6,6,0,25,25,3,'iron'),c(15,15,4,22,3,'steel'),c(15,15,22,25,8,'ivory'),
    c(15,15,25,25,6,'glass'),l(12,15,25,11,13,30,'steel'),l(18,15,25,19,13,30,'steel'),
    b(10,12,29,12,14,30,'amber'),b(18,12,29,20,14,30,'amber')],
};

const field = {
  'pipe-threader': ({b,c})=>[
    b(4,8,0,27,23,5,'red'),b(6,9,6,17,21,16,'iron'),b(17,12,7,27,17,12,'steel'),
    b(17,10,7,20,19,14,'black'),c(10,13,17,18,2,'amber')],
  'wall-scan-console': ({b,l})=>[
    b(8,7,0,22,23,5,'iron'),b(11,9,5,20,13,29,'steel'),b(6,12,20,25,16,34,'black'),
    b(8,16,23,23,16,31,'glass'),l(6,11,22,4,7,38,'steel'),l(25,11,22,27,7,38,'steel')],
  'winch-cable-spool': ({b,c,l})=>[
    b(5,6,0,26,24,5,'iron'),b(7,7,6,9,23,20,'red'),b(22,7,6,24,23,20,'red'),
    b(9,10,8,22,20,18,'black'),b(11,11,9,20,19,17,'steel'),
    c(16,15,18,19,5,'black'),l(18,18,12,27,26,3,'black'),b(26,25,3,29,27,4,'amber')],
  'site-level-laser': ({b,c,l})=>[
    ...[[6,23],[25,23],[15,5]].map(([x,y])=>l(15,14,22,x,y,0,'amber')),
    c(15,14,21,26,4,'iron'),b(10,9,26,21,18,36,'red'),b(11,18,29,20,18,34,'black'),
    b(13,18,30,18,18,33,'glass'),b(12,10,36,19,10,37,'steel')],
  'portable-generator-rollframe': ({b,c})=>[
    b(5,6,0,26,24,3,'black'),b(6,7,3,25,22,15,'iron'),
    b(6,7,15,25,22,18,'red'),c(16,12,18,19,2,'steel'),
    ...[6,25].flatMap(x=>[b(x,6,3,x+1,7,23,'black'),b(x,22,3,x+1,23,23,'black'),
      b(x,6,23,x+1,23,24,'black')]),b(8,22,6,23,24,12,'slate')],
  'survey-prism-mast': ({b,c,l})=>[
    ...[[6,22],[24,22],[15,6]].map(([x,y])=>l(15,14,16,x,y,0,'iron')),
    c(15,14,15,40,1,'amber'),b(11,12,36,20,16,44,'red'),
    b(12,16,38,19,16,42,'black'),b(14,16,39,17,16,41,'glass')],
  'site-tool-locker': ({b})=>[
    b(5,6,0,26,24,29,'iron'),b(6,24,2,25,25,15,'slate'),b(6,24,17,25,25,27,'slate'),
    b(12,25,8,19,26,9,'steel'),b(12,25,22,19,26,23,'steel'),
    b(5,6,29,26,24,30,'black'),b(9,8,30,12,18,32,'red'),b(19,12,30,23,21,32,'amber')],
  'folding-measurement-stand': ({b,l})=>[
    ...[7,24].flatMap(x=>[l(x,7,0,x,24,16,'iron'),l(x,24,0,x,7,16,'iron')]),
    b(5,6,15,27,25,17,'steel'),b(8,8,17,24,16,18,'amber'),
    ...[9,12,15,18,21].map(x=>b(x,11,18,x,13,18,'black'))],
};
const salon = {
  'hydraulic-barber-chair': ({b,c,l})=>[
    c(15,15,0,2,9,'steel'),c(15,15,3,10,3,'iron'),b(7,8,10,24,22,14,'black'),
    b(7,7,14,24,10,26,'black'),b(10,7,26,21,10,29,'textile'),
    b(7,10,15,9,22,19,'steel'),b(22,10,15,24,22,19,'steel'),l(15,20,10,15,26,3,'steel'),b(11,25,3,19,27,4,'iron')],
  'nail-dryer-manicure': ({b,c})=>[
    b(4,6,0,27,25,5,'oak'),b(5,8,5,16,18,10,'ivory'),
    b(6,9,10,15,17,12,'ivory'),b(7,17,6,14,18,8,'black'),
    ...[19,22,25].map((x,i)=>c(x,10+i*3,5,8,1,i%2?'red':'slate')),b(8,20,5,23,23,8,'textile')],
  'towel-steamer-stack': ({b,c})=>[
    b(6,7,0,25,24,20,'ivory'),b(7,24,3,24,25,17,'steel'),b(8,25,4,23,25,15,'glass'),
    b(8,24,18,15,25,19,'black'),c(20,22,20,21,1,'red'),
    b(8,8,20,23,19,22,'textile'),b(9,9,23,22,18,25,'ivory')],
  'shampoo-tilt-basin': ({b,c})=>[
    c(15,15,0,3,8,'black'),c(15,15,4,13,3,'steel'),b(6,6,13,24,24,17,'ivory'),
    b(7,7,17,23,9,20,'ivory'),b(6,9,17,8,22,19,'ivory'),
    b(22,9,17,24,22,19,'ivory'),b(7,22,17,23,24,19,'ivory'),c(15,15,18,18,2,'steel'),
    b(14,7,20,16,8,25,'steel'),b(14,8,24,16,12,25,'steel')],
  'standing-mirror-ledge': ({b})=>[
    b(6,8,0,25,24,2,'oak'),b(7,8,3,9,10,37,'oak'),b(22,8,3,24,10,37,'oak'),
    b(7,8,16,24,11,37,'oak'),b(9,11,18,22,11,35,'glass'),
    b(6,10,12,25,19,14,'oak'),b(17,16,14,19,18,19,'red')],
  'hot-tool-holster': ({b,c,l})=>[
    b(6,7,0,25,24,4,'iron'),b(8,8,4,24,13,22,'steel'),c(11,16,5,16,3,'black'),
    c(18,16,5,16,3,'black'),b(10,15,16,12,17,25,'red'),b(17,15,16,19,17,22,'ivory'),
    l(12,16,23,24,21,9,'black'),b(19,21,5,24,24,7,'textile')],
  'foot-spa-pedestal': ({b,c})=>[
    b(5,6,0,26,25,10,'ivory'),b(6,7,10,25,24,12,'steel'),b(8,9,12,23,22,12,'glass'),
    b(7,8,13,9,23,14,'ivory'),b(22,8,13,24,23,14,'ivory'),
    c(14,15,13,13,2,'steel'),c(19,15,13,13,2,'steel'),b(11,7,14,19,10,16,'black')],
};
const configurations = [
  { name:'clinical-equipment', category:'medical', shapes:clinical,
    mounts:['service-cart','cabinet-base','lift-column','built-in-bench','bench-insert'] },
  { name:'field-trade', category:'trades', shapes:field,
    mounts:['service-cart','cabinet-base','tripod-trestle','built-in-bench','bench-insert'] },
  { name:'salon-equipment', category:'personal-care', shapes:salon,
    mounts:['service-cart','cabinet-base','lift-column','built-in-bench','bench-insert'] },
];
await Promise.all(configurations.map(({name,category,shapes,mounts})=>{
  const family=[];
  for(const [application,design] of Object.entries(shapes)){
    const integrated = ['infusion-monitor-mast','eyewash-twin-nozzle','site-level-laser',
      'survey-prism-mast','site-tool-locker','folding-measurement-stand','hydraulic-barber-chair',
      'shampoo-tilt-basin','standing-mirror-ledge','foot-spa-pedestal'];
    const mountOptions = integrated.includes(application)
      ? ['bench-insert','floor-pedestal','reinforced-sled','rubber-platform',
        ['eyewash-twin-nozzle','shampoo-tilt-basin','foot-spa-pedestal'].includes(application)
          ? 'plumbed-plinth' : 'caster-cradle']
      : mounts;
    for(const mount of mountOptions){
      const {z,ops}=platform(mount,32);
      family.push({
        schemaVersion:1,id:`${name}-${application}-${mount}`,category,layer:'object',
        outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[1,1],palette:'office-night',materials,
        ops:[...ops,...design(tools(z))],
      });
    }
  }
  return writeFamily(name,family);
}));
