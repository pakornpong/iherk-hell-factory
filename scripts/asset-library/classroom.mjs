import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  wood:{kind:'wood',color:'#ae7c50'}, cream:{kind:'matte',color:'#e2dbca'},
  frame:{kind:'metal',color:'#748892'}, black:{kind:'matte',color:'#354653'},
  teal:{kind:'matte',color:'#548578'}, red:{kind:'matte',color:'#b66653'},
  yellow:{kind:'matte',color:'#dfa958'}, blue:{kind:'matte',color:'#6c9cb4'},
  pink:{kind:'matte',color:'#c28387'},
};

const boards={
  'blackboard-tray': (z)=>[
    b(3,11,z,28,14,z+18,'wood'),b(4,14,z+1,27,14,z+17,'teal'),
    b(3,14,z,28,16,z+1,'wood'),b(6,16,z+2,9,16,z+2,'cream'),
    l(7,14,z+7,12,14,z+12,'cream'),l(12,14,z+12,16,14,z+7,'cream'),
    b(20,14,z+10,24,14,z+10,'yellow')],
  'whiteboard-grid': (z)=>[
    b(1,11,z+2,30,14,z+15,'frame'),b(2,14,z+3,29,14,z+14,'cream'),
    ...[7,11,15,19,23].map(x=>b(x,14,z+3,x,14,z+14,'blue')),
    ...[4,8,12].map(y=>b(6,14,z+y,24,14,z+y,'blue')),
    l(7,15,z+4,14,15,z+10,'red'),l(14,15,z+10,22,15,z+7,'red')],
  'felt-storyboard': (z)=>[
    b(4,11,z,27,15,z+14,'wood'),b(8,11,z+14,23,15,z+18,'wood'),b(5,15,z+1,26,15,z+13,'blue'),b(9,15,z+14,22,15,z+17,'blue'),
    b(8,16,z+4,12,16,z+9,'yellow'),b(14,16,z+9,19,16,z+13,'red'),
    b(20,16,z+5,24,16,z+9,'teal')],
  'flipchart-paper-pad': (z)=>[
    b(6,11,z,25,13,z+21,'frame'),b(7,14,z+1,24,14,z+20,'cream'),
    b(6,14,z+20,25,15,z+21,'black'),b(8,14,z,23,15,z+2,'yellow'),
    ...[6,10,12,15].map(y=>b(10,15,z+y,19+y%3,15,z+y,'teal'))],
  'science-concept-slat': (z)=>[
    b(3,11,z,28,13,z+17,'wood'),b(4,13,z+1,27,13,z+16,'cream'),
    b(3,13,z,28,22,z+1,'wood'),c(9,19,z+2,z+6,2,'blue'),c(16,19,z+2,z+8,2,'yellow'),
    ...[[7,6],[12,11],[21,10],[24,4]].map(([x,y])=>b(x-1,14,z+y-1,x+1,14,z+y+1,'red')),
    l(7,14,z+6,12,14,z+11,'black'),l(12,14,z+11,21,14,z+10,'black'),
    l(21,14,z+10,24,14,z+4,'black')],
  'magnetic-number-tile': (z)=>[
    b(4,11,z,27,14,z+19,'frame'),b(5,14,z+1,26,14,z+18,'cream'),
    b(1,12,z+3,4,18,z+16,'teal'),b(27,12,z+3,30,18,z+16,'teal'),
    ...[7,13,19].flatMap((x,i)=>[b(x,15,z+7+i%2,x+4,15,z+13+i%2,'teal'),
      b(x+1,16,z+9+i%2,x+3,16,z+11+i%2,'yellow')])],
};

const stands={
  tripod: {z:18,ops:[l(15,12,32,5,18,0,'wood'),l(15,12,32,25,18,0,'wood'),
    l(15,12,32,15,6,0,'wood'),b(6,16,14,25,18,15,'wood')]},
  'double-column': {z:16,ops:[5,25].flatMap(x=>[b(x,6,0,x+1,25,1,'frame'),
    b(x,12,1,x+1,13,37,'frame')]).concat(b(5,12,7,26,13,8,'frame'))},
  'cart-shelf': {z:16,ops:[5,24].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,3,'black')))
    .concat([5,24].map(x=>b(x,12,4,x+1,13,36,'frame')),b(4,6,3,27,25,5,'teal'),
      b(5,8,10,26,24,11,'teal'),b(9,16,12,13,20,14,'cream'))},
  'desktop-tilt': {z:8,ops:[b(5,6,0,26,24,2,'wood'),l(6,9,2,6,13,28,'wood'),
    l(25,9,2,25,13,28,'wood'),b(5,12,6,26,15,7,'wood')]},
  'swing-pedestal': {z:15,ops:[c(15,13,0,2,9,'frame'),c(15,13,3,21,2,'frame'),
    b(4,12,19,27,13,21,'frame'),b(3,12,18,5,14,22,'yellow'),b(26,12,18,28,14,22,'yellow')]},
};

const designs=[];
for(const [board,panel] of Object.entries(boards)){
  for(const [stand,{z,ops}] of Object.entries(stands)){
    designs.push({schemaVersion:1,id:`classroom-${board}-${stand}`,category:'education',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],palette:'office-night',
      materials,ops:[...ops,...panel(z)]});
  }
}
await writeFamily('classroom',designs);
