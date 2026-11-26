import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  ink:{kind:'matte',color:'#3b444d'}, steel:{kind:'metal',color:'#9aa6a7'},
  red:{kind:'matte',color:'#9d6057'}, velvet:{kind:'matte',color:'#765157'},
  linen:{kind:'matte',color:'#b5a38e'}, offwhite:{kind:'matte',color:'#dcd0ba'},
  oak:{kind:'wood',color:'#a7805e'}, walnut:{kind:'wood',color:'#77594a'},
  gold:{kind:'metal',color:'#bda16c'}, glass:{kind:'glass',color:'#90a9b3'},
  blue:{kind:'matte',color:'#657d93'},
};
const fixtures={
  'recliner-row':(w,z)=>[
    b(4,6,z,w-5,25,z+3,'walnut'),
    ...Array.from({length:Math.floor((w-8)/11)},(_,i)=>{
      const x=5+i*11;
      return [b(x,10,z+4,x+9,23,z+7,'red'),b(x,8,z+6,x+9,11,z+22,'velvet'),
        b(x,10,z+7,x+1,22,z+12,'velvet'),b(x+8,10,z+7,x+9,22,z+12,'velvet'),
        b(x+3,23,z+6,x+6,27,z+8,'red')];
    }).flat()],
  'classic-flip-seats':(w,z)=>[
    b(5,7,z,w-6,24,z+2,'ink'),
    ...Array.from({length:Math.floor((w-8)/10)},(_,i)=>{
      const x=5+i*10;
      return [b(x,9,z+2,x+1,21,z+12,'ink'),b(x+8,9,z+2,x+9,21,z+12,'ink'),
        b(x+1,8,z+7,x+8,11,z+23,'red'),b(x+2,11,z+8,x+7,15,z+15,'velvet'),
        b(x+1,19,z+11,x+2,21,z+12,'gold')];
    }).flat()],
  'screening-projection-booth':(w,z)=>[
    b(5,7,z,w-6,24,z+4,'ink'),b(7,8,z+5,w-8,11,z+24,'blue'),
    b(9,11,z+10,w-10,12,z+20,'glass'),b(11,14,z+5,23,21,z+14,'ink'),
    b(11,21,z+8,16,23,z+12,'steel'),b(12,23,z+9,15,23,z+11,'glass'),
    c(14,17,z+14,z+16,2,'steel')],
  'analog-projector-rack':(w,z)=>[
    b(5,7,z,w-6,24,z+4,'ink'),b(8,9,z+5,24,21,z+15,'ink'),
    b(9,20,z+8,16,25,z+13,'steel'),b(10,25,z+9,15,25,z+12,'glass'),
    c(11,13,z+16,z+18,5,'steel'),c(21,13,z+16,z+18,4,'steel'),
    c(11,13,z+18,z+18,2,'ink'),c(21,13,z+18,z+18,2,'ink'),
    b(12,13,z+18,20,14,z+18,'ink')],
  'popcorn-kettle-display':(w,z)=>[
    b(5,7,z,w-6,24,z+5,'red'),b(5,7,z+5,7,24,z+28,'glass'),
    b(w-8,7,z+5,w-6,24,z+28,'glass'),b(5,7,z+5,w-6,8,z+28,'glass'),
    b(5,7,z+28,w-6,24,z+31,'red'),c(14,14,z+8,z+15,4,'steel'),
    b(13,13,z+15,15,15,z+22,'steel'),b(8,10,z+5,w-9,22,z+6,'offwhite'),
    b(7,24,z+28,w-8,24,z+30,'offwhite')],
  'ticket-machine-and-slip':(w,z)=>[
    b(6,7,z,w-7,24,z+3,'ink'),b(7,8,z+4,w-8,20,z+30,'red'),
    b(9,20,z+17,w-10,21,z+27,'ink'),b(10,21,z+18,w-11,21,z+26,'glass'),
    b(10,20,z+8,w-11,21,z+11,'ink'),b(12,21,z+9,19,25,z+9,'offwhite')],
  'poster-light-case':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'ink'),b(5,8,z+4,w-6,11,z+37,'steel'),
    b(7,11,z+6,w-8,12,z+34,'offwhite'),b(9,12,z+10,w-10,12,z+30,'red'),
    l(11,12,z+13,w-11,12,z+27,'gold'),b(9,12,z+8,w-10,12,z+9,'blue')],
  'screen-curtain-module':(w,z)=>[
    b(5,7,z,w-6,10,z+38,'ink'),b(6,10,z+4,w-7,11,z+33,'offwhite'),
    b(5,11,z+3,9,14,z+37,'velvet'),b(w-10,11,z+3,w-6,14,z+37,'velvet'),
    ...[6,9,w-10,w-7].map(x=>b(x,14,z+4,x,14,z+35,'red')),
    b(5,10,z+35,w-6,15,z+38,'velvet')],
  'media-library-snack-display':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'oak'),b(5,6,z+4,w-6,9,z+29,'walnut'),
    ...[6,15,24].flatMap((h,i)=>[b(6,9,z+h,w-7,23,z+h+1,'oak'),
      ...Array.from({length:Math.floor((w-11)/6)},(_,j)=>
        b(7+6*j,14,z+h+2,10+6*j,21,z+h+6,['red','blue','offwhite'][(i+j)%3]))])],
  'concession-soda-nozzles':(w,z)=>[
    b(5,7,z,w-6,24,z+4,'steel'),b(6,8,z+5,w-7,13,z+23,'ink'),
    b(7,12,z+18,w-8,17,z+22,'red'),
    ...[10,16,w-11].flatMap(x=>[
      b(x,16,z+14,x+1,18,z+19,'steel'),c(x,18,z+5,z+9,2,'offwhite')]),
    b(7,16,z+4,w-8,23,z+5,'steel')],
};
const floors={
  'aisle-carpet':w=>({z:2,ops:[b(3,5,0,w-4,26,1,'velvet'),b(5,6,1,w-6,7,1,'gold')]}),
  'stepped-riser':w=>({z:7,ops:[
    b(3,5,0,w-4,28,2,'ink'),b(4,6,3,w-5,25,4,'walnut'),b(5,7,5,w-6,23,6,'velvet')]}),
  'open-floor-polished':w=>({z:3,ops:[b(3,5,0,w-4,26,2,'walnut'),b(4,6,2,w-5,25,2,'linen')]}),
  'mobile-cinema-podium':w=>({z:7,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+3,3,'ink'))),
    b(4,6,4,w-5,25,6,'steel'),b(5,24,5,w-6,26,6,'red')]}),
  'back-wall-plinth':w=>({z:5,ops:[
    b(4,5,0,w-5,7,26,'ink'),b(4,7,3,w-5,25,4,'blue'),b(5,7,4,w-6,8,5,'gold')]}),
};
const designs=[];
for(const [piece,make] of Object.entries(fixtures)) for(const [size,w] of [['compact',34],['auditorium',60]]){
  for(const [stage,mount] of Object.entries(floors)){
    if((piece.includes('seats')||piece.includes('row'))&&stage==='mobile-cinema-podium')continue;
    const {z,ops}=mount(w);
    designs.push({schemaVersion:1,id:`cinema-${piece}-${size}-${stage}`,category:'cinema',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
      palette:'office-night',materials,ops:[...ops,...make(w,z)]});
  }
}
await writeFamily('cinema-interiors',designs);
