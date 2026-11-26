import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#b0855d'}, walnut:{kind:'wood',color:'#745444'},
  black:{kind:'matte',color:'#38424c'}, steel:{kind:'metal',color:'#839099'},
  ivory:{kind:'matte',color:'#ded9c8'}, red:{kind:'matte',color:'#a75b50'},
  felt:{kind:'matte',color:'#526b83'}, brass:{kind:'metal',color:'#bb995d'},
};

const surfaces={
  'pool-six-pocket': z=>[
    b(3,5,z,60,26,z+4,'walnut'),b(6,8,z+4,57,23,z+4,'felt'),
    ...[[6,8],[31,7],[57,8],[6,23],[31,24],[57,23]]
      .map(([x,y])=>c(x,y,z+3,z+4,2,'black')),
    ...[[24,16,'ivory'],[37,14,'red'],[39,16,'brass'],[39,12,'ivory']]
      .map(([x,y,m])=>c(x,y,z+5,z+6,1,m)),
    l(10,13,z+5,23,15,z+5,'oak')],
  'foosball-rod-table': z=>[
    b(3,5,z,60,26,z+5,'walnut'),b(6,8,z+5,57,23,z+5,'felt'),
    ...[10,18,26,36,44,52].flatMap((x,i)=>[b(x,2,z+8,x,29,z+8,'steel'),
      b(x,28,z+7,x+1,30,z+8,'black'),
      ...[11,16,21].map(y=>b(x-1,y,z+6,x+1,y+1,z+9,i%2?'red':'ivory'))])],
  'shuffleboard-long': z=>[
    b(2,6,z,61,25,z+3,'walnut'),b(4,9,z+4,59,22,z+4,'oak'),
    ...[8,13,18,48,53,58].map(x=>b(x,10,z+4,x,21,z+4,'walnut')),
    ...[[22,14],[29,17],[47,13],[53,19]].map(([x,y],i)=>c(x,y,z+5,z+6,1,i%2?'red':'felt'))],
  'table-tennis-folding': z=>[
    b(2,4,z,61,27,z+2,'felt'),b(3,4,z+2,60,4,z+2,'ivory'),
    b(3,27,z+2,60,27,z+2,'ivory'),b(31,4,z+2,31,27,z+2,'ivory'),
    b(31,4,z+3,31,5,z+8,'steel'),b(31,26,z+3,31,27,z+8,'steel'),
    b(31,5,z+5,31,26,z+5,'ivory'),b(31,5,z+7,31,26,z+7,'black'),
    c(16,16,z+3,z+3,3,'red'),l(16,16,z+3,20,21,z+3,'oak'),c(47,15,z+3,z+4,1,'ivory')],
  'pinball-mini': z=>[
    b(3,5,z,60,26,z+4,'red'),
    {op:'slope',from:[5,6,z+4],to:[58,25,z+10],axis:'-X',material:'oak'},
    b(4,5,z+10,9,26,z+28,'black'),b(9,7,z+13,9,24,z+26,'felt'),
    b(9,11,z+17,9,20,z+22,'ivory'),b(4,5,z+5,60,6,z+9,'black'),
    b(4,25,z+5,60,26,z+9,'black'),c(19,16,z+9,z+10,2,'brass'),
    c(24,11,z+8,z+10,2,'red'),c(26,19,z+8,z+10,2,'red'),b(60,20,z+4,62,21,z+5,'steel')],
  'slot-car-raceway': z=>[
    b(3,5,z,60,26,z+4,'walnut'),b(5,7,z+4,58,24,z+4,'black'),b(12,12,z+4,51,19,z+4,'oak'),
    b(8,9,z+5,55,9,z+5,'ivory'),b(8,22,z+5,55,22,z+5,'ivory'),
    b(15,7,z+5,19,11,z+6,'red'),b(44,20,z+5,48,24,z+6,'felt'),
    b(30,8,z+5,32,9,z+12,'steel'),b(30,22,z+5,32,23,z+12,'steel'),
    b(30,8,z+11,32,23,z+12,'ivory')],
};
const bases={
  'club-turned': {z:19,ops:[7,56].flatMap(x=>[8,23].flatMap(y=>[
    c(x,y,0,4,3,'walnut'),c(x,y,4,13,2,'oak'),c(x,y,13,19,3,'walnut')]))},
  'tournament-trestle': {z:20,ops:[9,54].flatMap(x=>[
    b(x-2,6,0,x+2,26,2,'steel'),b(x-1,12,3,x+1,20,18,'black'),
    b(x-2,8,18,x+2,24,19,'steel')]).concat(b(10,15,6,53,17,8,'steel'))},
  'box-coinop': {z:18,ops:[
    b(9,8,1,54,23,17,'walnut'),b(8,6,17,55,24,18,'oak'),
    b(32,23,7,41,24,13,'black'),b(36,24,9,38,25,11,'brass'),
    b(12,12,0,22,20,1,'black'),b(44,12,0,54,20,1,'black')]},
  'steel-folding': {z:18,ops:[
    ...[7,55].flatMap(x=>[l(x,7,0,x,24,17,'steel'),l(x,24,0,x,7,17,'steel')]),
    b(7,7,17,55,7,17,'black'),b(7,24,17,55,24,17,'black')]},
  'lounge-low': {z:12,ops:[
    b(5,7,0,58,24,3,'walnut'),b(10,8,4,17,23,11,'oak'),b(46,8,4,53,23,11,'oak')]},
};
const designs=[];
for(const [name,surface] of Object.entries(surfaces)){
  for(const [base,{z,ops}] of Object.entries(bases)){
    designs.push({schemaVersion:1,id:`rec-${name}-${base}`,category:'recreation',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],palette:'office-night',
      materials,ops:[...ops,...surface(z)]});
  }
}
await writeFamily('recreation',designs);
