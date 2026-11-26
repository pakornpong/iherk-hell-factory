import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  oak:{kind:'wood',color:'#ab8159'}, nut:{kind:'wood',color:'#745644'}, steel:{kind:'metal',color:'#9ea9af'},
  iron:{kind:'metal',color:'#596471'}, chalk:{kind:'matte',color:'#dbd2be'}, clay:{kind:'matte',color:'#a86550'},
  red:{kind:'matte',color:'#9d5553'}, blue:{kind:'matte',color:'#5e798a'}, soot:{kind:'matte',color:'#3a4046'},
  sand:{kind:'matte',color:'#a89779'}, buff:{kind:'matte',color:'#c7a969'}, pane:{kind:'glass',color:'#87a6b0'},
};
function ops(z){
  return {
    b:(x,y,a,X,Y,A,m)=>B(x,y,z+a,X,Y,z+A,m),
    c:(x,y,a,A,r,m)=>C(x,y,z+a,z+A,r,m),
    l:(x,y,a,X,Y,A,m)=>L(x,y,z+a,X,Y,z+A,m),
  };
}
const stations={
  'pottery-wheel': ({b,c})=>[
    b(6,7,0,38,26,3,'iron'),c(18,16,4,9,5,'steel'),c(18,16,10,12,10,'chalk'),
    c(18,16,12,14,6,'clay'),c(18,16,15,18,4,'clay'),
    c(18,16,18,18,2,'nut'),
    b(31,17,3,36,22,6,'soot')],
  'bookbinding-screw-press': ({b,c})=>[
    b(5,6,0,43,25,4,'nut'),b(7,7,5,10,24,27,'oak'),b(38,7,5,41,24,27,'oak'),
    b(7,9,25,41,22,28,'oak'),c(24,15,19,33,2,'steel'),b(17,14,32,31,16,33,'iron'),
    b(12,9,12,36,23,14,'steel'),b(15,11,5,33,21,10,'chalk'),b(14,11,10,34,22,11,'red')],
  'weavers-shuttle-loom': ({b,l})=>[
    b(4,6,0,44,25,3,'nut'),...([7,39].flatMap(x=>[
      b(x,7,3,x+2,9,26,'oak'),b(x,21,3,x+2,23,22,'oak'),l(x,7,25,x,22,21,'oak')])),
    b(8,8,25,39,10,26,'nut'),b(8,20,19,39,21,20,'nut'),
    ...Array.from({length:14},(_,i)=>l(10+i*2,9,25,10+i*2,20,20,i%2?'chalk':'sand')),
    b(14,14,22,31,16,23,'blue'),b(18,19,21,23,20,22,'nut')],
  'foot-treadle-leather-stitcher': ({b,c,l})=>[
    b(5,6,0,44,25,4,'nut'),b(8,9,4,40,22,6,'oak'),
    b(30,8,6,36,16,23,'soot'),b(17,9,21,36,16,25,'iron'),
    b(17,10,16,22,15,22,'iron'),b(18,12,11,19,13,16,'steel'),
    c(31,13,25,30,2,'red'),l(34,10,19,37,10,4,'soot'),b(21,9,6,30,17,7,'sand')],
  'jewelry-polishing-motor': ({b,c})=>[
    b(5,6,0,44,25,4,'iron'),c(24,14,4,15,7,'blue'),
    b(11,14,9,36,15,11,'steel'),b(8,10,7,11,19,14,'chalk'),
    b(36,10,6,40,19,15,'sand'),b(6,8,3,11,20,5,'soot'),b(36,8,3,42,21,5,'soot'),
    b(19,21,4,24,23,6,'red')],
  'screen-printing-hinge': ({b,l})=>[
    b(5,6,0,44,26,4,'oak'),b(8,7,5,40,9,8,'iron'),b(9,10,5,39,24,6,'chalk'),
    l(9,9,8,9,22,20,'oak'),l(39,9,8,39,22,20,'oak'),b(9,21,19,39,23,20,'oak'),
    l(10,9,8,38,9,8,'oak'),...Array.from({length:9},(_,i)=>l(12+i*3,10,9,12+i*3,21,19,'pane')),
    b(13,17,6,24,23,7,'red')],
  'enameling-kiln': ({b,c})=>[
    b(9,7,0,39,24,24,'iron'),b(10,24,4,38,25,20,'chalk'),
    b(13,25,6,35,25,18,'soot'),b(16,25,8,32,25,16,'clay'),
    b(35,25,10,38,27,12,'steel'),c(29,15,24,26,2,'buff')],
  'tilting-wood-lathe': ({b,c,l})=>[
    b(4,6,0,45,25,4,'iron'),b(6,11,4,43,13,7,'steel'),
    b(6,8,6,15,21,20,'blue'),b(37,8,6,43,21,18,'blue'),
    b(14,13,10,38,15,12,'steel'),b(17,12,9,35,16,13,'oak'),
    b(21,11,8,29,17,14,'nut'),l(29,21,6,31,16,14,'steel'),c(11,13,20,21,1,'red')],
  'ceramic-glaze-dipping': ({b,c})=>[
    b(5,5,0,44,26,4,'oak'),...[[13,'chalk'],[26,'blue'],[38,'clay']].flatMap(([x,m])=>[
      c(x,15,5,15,5,'steel'),c(x,15,15,15,4,m)]),
    b(9,6,5,41,8,18,'nut'),b(8,5,18,42,9,20,'oak')],
  'framers-miter-guillotine': ({b,l})=>[
    b(4,6,0,44,25,3,'iron'),b(5,8,4,43,23,6,'oak'),
    l(10,11,6,23,20,6,'steel'),l(37,11,6,23,20,6,'steel'),
    b(20,9,6,26,12,24,'iron'),b(20,12,17,26,17,22,'steel'),
    l(23,12,22,38,19,28,'steel'),b(36,17,27,41,21,29,'red')],
};
const bases={
  'counter-insert':{z:2,ops:[B(5,7,0,44,24,1,'soot')]},
  'industrial-trestle':{z:17,ops:[
    ...[7,42].flatMap(x=>[B(x,6,0,x+2,25,1,'iron'),L(x,8,1,x,15,16,'iron'),L(x,24,1,x,15,16,'iron')]),
    B(5,7,15,44,24,16,'steel')]},
  'craft-cabinet':{z:13,ops:[B(5,6,0,44,25,2,'iron'),B(6,7,3,43,24,11,'nut'),B(5,6,11,44,25,12,'oak'),
    B(7,24,4,23,25,10,'oak'),B(25,24,4,42,25,10,'oak'),B(12,25,8,18,26,8,'steel'),B(30,25,8,35,26,8,'steel')]},
  'rolling-bench':{z:10,ops:[...[7,42].flatMap(x=>[7,23].map(y=>B(x,y,0,x+3,y+2,3,'soot'))),
    B(5,6,4,44,25,6,'steel'),B(5,6,7,44,25,9,'iron'),B(7,5,10,42,6,15,'steel')]},
  'kneehole-desk':{z:15,ops:[B(5,6,0,14,24,14,'oak'),B(35,6,0,44,24,14,'oak'),
    B(4,5,13,45,26,14,'nut'),B(7,24,4,12,25,11,'nut'),B(37,24,4,42,25,11,'nut')]},
};
const designs=[];
for(const [craft,build] of Object.entries(stations)){
  for(const [base,{z,ops:mount}] of Object.entries(bases)){
    const equipment=build(ops(z));
    for(const sidecar of ['standalone','project-shelf']){
      const extras=sidecar==='project-shelf'?[B(45,8,0,60,23,2,'nut'),B(46,9,2,48,22,z+17,'oak'),
        B(58,9,2,60,22,z+17,'oak'),B(47,9,z+3,59,22,z+4,'oak'),
        B(47,9,z+15,59,22,z+17,'oak'),B(50,12,z+5,55,20,z+8,'sand'),
        B(49,10,z+18,57,20,z+21,'chalk')]:[];
      designs.push({schemaVersion:1,id:`craft-${craft}-${base}-${sidecar}`,category:'craft-workshop',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,1],palette:'office-night',materials,ops:[...mount,...equipment,...extras]});
    }
  }
}
await writeFamily('craft-workshops',designs);
