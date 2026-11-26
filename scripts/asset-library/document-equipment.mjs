import { writeFamily } from './render.mjs';

const box=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const line=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const cylinder=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  gray:{kind:'metal',color:'#9da6aa'}, black:{kind:'matte',color:'#343d46'},
  oak:{kind:'wood',color:'#ab815d'}, offwhite:{kind:'matte',color:'#d6d2c6'},
  paper:{kind:'matte',color:'#e5deca'}, kraft:{kind:'matte',color:'#b0926e'},
  blue:{kind:'matte',color:'#657f91'}, red:{kind:'matte',color:'#a66456'},
  glass:{kind:'glass',color:'#8babb9'},
};

const machines={
  'flatbed-document-scanner':(b,c,l)=>[
    b(4,6,0,27,25,5,'gray'),b(5,6,6,26,23,7,'black'),b(7,8,7,24,20,7,'glass'),
    b(8,12,8,19,19,8,'paper'),b(6,6,8,25,9,18,'offwhite'),
    l(6,8,18,6,13,20,'gray'),l(25,8,18,25,13,20,'gray'),b(6,9,17,25,13,18,'offwhite')],
  'sheet-feed-scanner':(b,c,l)=>[
    b(5,7,0,26,24,6,'black'),b(6,8,7,25,19,14,'offwhite'),
    l(7,8,14,7,4,26,'gray'),l(24,8,14,24,4,26,'gray'),
    b(8,5,16,23,8,25,'paper'),b(8,20,5,23,28,6,'gray'),
    b(10,21,7,21,26,7,'paper'),b(9,19,8,23,19,9,'black')],
  'binding-comb-punch':(b,c,l)=>[
    b(4,6,0,27,25,4,'blue'),b(6,7,5,25,12,10,'black'),
    ...[8,11,14,17,20,23].map(x=>b(x,12,8,x,14,9,'gray')),
    b(7,14,5,22,22,5,'paper'),l(24,9,10,27,18,21,'gray'),
    b(24,16,21,29,19,22,'black')],
  'envelope-inserter':(b,c,l)=>[
    b(4,5,0,28,25,5,'gray'),b(5,7,5,27,19,10,'blue'),
    b(7,8,11,23,11,21,'gray'),b(8,10,11,22,14,18,'paper'),
    b(6,20,5,25,28,7,'gray'),b(9,21,8,21,26,8,'kraft'),
    b(14,27,6,22,28,6,'paper'),b(22,19,8,25,20,9,'red')],
  'thermal-label-dispenser':(b,c,l)=>[
    b(6,7,0,25,25,9,'offwhite'),b(7,8,10,24,19,15,'blue'),
    b(8,25,5,23,25,8,'black'),b(11,25,6,20,29,6,'paper'),
    b(11,8,16,20,10,16,'gray'),c(20,15,16,17,2,'red')],
  'desktop-guillotine-cutter':(b,c,l)=>[
    b(4,6,0,27,25,3,'oak'),b(6,8,4,25,22,4,'paper'),
    ...[9,13,17,21].map(x=>b(x,8,4,x,20,4,'gray')),
    l(24,7,4,24,24,14,'gray'),b(24,22,14,26,28,16,'black'),
    b(7,8,4,8,23,5,'blue')],
  'microfilm-reader':(b,c,l)=>[
    b(5,6,0,26,25,5,'gray'),b(6,7,5,25,15,27,'offwhite'),
    b(7,15,10,24,15,25,'black'),b(9,15,12,22,15,23,'glass'),
    b(8,16,5,23,23,7,'gray'),c(11,20,8,8,2,'black'),c(20,20,8,8,2,'black'),
    b(13,20,8,18,21,8,'paper')],
  'mail-sorting-pigeonholes':(b,c,l)=>[
    b(4,5,0,27,8,27,'oak'),b(4,8,0,6,24,27,'oak'),b(25,8,0,27,24,27,'oak'),
    ...[2,10,18,26].map(z=>b(6,8,z,25,24,z+1,'oak')),b(15,8,3,16,24,26,'oak'),
    ...[4,12,20].flatMap(z=>[b(8,10,z,13,20,z+1,'paper'),b(18,13,z,23,22,z+2,'kraft')])],
  'return-slot-with-scan-head':(b,c,l)=>[
    b(5,6,0,26,24,26,'blue'),b(6,24,17,25,25,22,'black'),
    b(8,25,17,23,28,17,'gray'),b(7,24,3,24,24,10,'offwhite'),
    b(20,9,26,24,11,37,'gray'),b(15,10,36,24,14,39,'black'),b(16,12,35,22,14,36,'glass')],
};
const supports={
  'countertop':{z:2,ops:[box(5,7,0,26,24,1,'black')]},
  'document-cart':{z:10,ops:[
    ...[5,24].flatMap(x=>[7,23].map(y=>box(x,y,0,x+2,y+2,3,'black'))),
    ...[5,24].map(x=>box(x,8,4,x+1,9,8,'gray')),box(4,6,4,27,25,5,'blue'),
    box(4,6,8,27,25,9,'gray')]},
  'office-credenza':{z:14,ops:[
    box(4,6,0,27,25,2,'black'),box(5,6,3,26,24,12,'oak'),box(4,5,12,27,26,13,'offwhite'),
    box(6,24,5,25,25,10,'blue'),box(11,25,8,20,26,8,'gray')]},
  'shelved-bench':{z:15,ops:[
    ...[5,24].flatMap(x=>[7,23].map(y=>box(x,y,0,x+1,y+1,14,'gray'))),
    box(4,6,13,27,25,14,'oak'),box(5,7,5,26,24,6,'gray'),
    box(8,13,7,14,20,10,'paper'),box(17,9,7,24,20,9,'kraft')]},
};
const designs=[];
for(const [job, build] of Object.entries(machines)){
  for(const [support,{z,ops}] of Object.entries(supports)){
    const b=(x,y,k,X,Y,K,m)=>box(x,y,z+k,X,Y,z+K,m);
    const c=(x,y,k,K,r,m)=>cylinder(x,y,z+k,z+K,r,m);
    const l=(x,y,k,X,Y,K,m)=>line(x,y,z+k,X,Y,z+K,m);
    designs.push({schemaVersion:1,id:`document-${job}-${support}`,category:'office-equipment',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[1,1],palette:'office-night',materials,ops:[...ops,...build(b,c,l)]});
  }
}
await writeFamily('document-equipment',designs);
