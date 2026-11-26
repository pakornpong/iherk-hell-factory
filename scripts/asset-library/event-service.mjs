import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  steel:{kind:'metal',color:'#99a4a7'}, frame:{kind:'metal',color:'#59656e'},
  dark:{kind:'matte',color:'#3f494f'}, wood:{kind:'wood',color:'#a8835e'},
  walnut:{kind:'wood',color:'#755945'}, linen:{kind:'matte',color:'#bcae9a'},
  offwhite:{kind:'matte',color:'#ddd4bf'}, blue:{kind:'matte',color:'#657c93'},
  terra:{kind:'matte',color:'#a66453'}, gold:{kind:'metal',color:'#bea16b'},
  display:{kind:'glass',color:'#92acba'},
};
const stageProps={
  'small-pa-riser':(w,z)=>[
    b(6,8,z,16,23,z+9,'dark'),b(w-17,8,z,w-7,23,z+9,'dark'),
    ...[11,w-12].flatMap(x=>[
      c(x,15,z+9,z+18,1,'steel'),b(x-4,10,z+17,x+4,21,z+31,'dark'),
      b(x-3,21,z+18,x+3,21,z+30,'frame'),b(x-2,21,z+20,x+2,22,z+25,'steel')])],
  'press-conference-lectern':(w,z)=>[
    b(6,9,z,w-7,23,z+3,'walnut'),b(10,10,z+4,w-11,19,z+21,'wood'),
    b(8,8,z+21,w-9,20,z+24,'wood'),b(12,20,z+10,w-13,20,z+17,'blue'),
    ...[13,w-14].flatMap(x=>[l(x,12,z+24,x,15,z+34,'frame'),b(x-1,15,z+33,x+1,17,z+34,'dark')])],
  'registration-terminal':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'wood'),b(6,7,z+4,w-7,11,z+16,'frame'),
    b(8,11,z+8,w-9,12,z+15,'display'),b(9,12,z+13,w-10,12,z+14,'offwhite'),
    b(9,14,z+4,19,22,z+5,'offwhite'),b(w-15,14,z+4,w-8,20,z+8,'dark'),
    b(w-13,20,z+6,w-10,24,z+6,'offwhite')],
  'trophy-ceremony-podium':(w,z)=>[
    b(5,7,z,14,24,z+10,'blue'),b(15,7,z,w-6,24,z+16,'blue'),
    b(5,7,z+10,14,24,z+11,'offwhite'),b(15,7,z+16,w-6,24,z+17,'offwhite'),
    c(w-11,15,z+18,z+20,2,'gold'),c(w-11,15,z+20,z+24,1,'gold'),
    c(w-11,15,z+24,z+28,3,'gold'),l(w-14,15,z+27,w-16,15,z+29,'gold'),
    l(w-8,15,z+27,w-6,15,z+29,'gold')],
  'portable-photo-wall':(w,z)=>[
    b(5,8,z,7,11,z+39,'steel'),b(w-8,8,z,w-6,11,z+39,'steel'),
    b(6,8,z+37,w-7,11,z+39,'steel'),b(7,9,z+7,w-8,10,z+37,'linen'),
    ...[11,19,27].flatMap((h,i)=>Array.from({length:Math.floor((w-11)/7)},(_,j)=>
      b(8+7*j,10,z+h,11+7*j,10,z+h+3,(i+j)%2?'terra':'blue')))],
  'flower-and-linen-arch':(w,z)=>[
    b(6,8,z,8,11,z+36,'wood'),b(w-9,8,z,w-7,11,z+36,'wood'),
    b(8,8,z+35,w-8,11,z+37,'wood'),b(9,8,z+28,11,12,z+36,'linen'),
    b(w-12,8,z+24,w-10,12,z+36,'linen'),
    ...[[9,33],[13,35],[w-12,34],[w-9,31]].map(([x,h],i)=>c(x,11,z+h,z+h+2,2,i%2?'terra':'offwhite'))],
  'crowd-queue-pair':(w,z)=>[
    ...[8,w-10].flatMap(x=>[c(x,12,z,z+2,4,'steel'),c(x,12,z+3,z+19,1,'steel'),
      c(x,12,z+20,z+22,2,'gold')]),
    l(8,12,z+20,Math.floor(w/2),12,z+16,'terra'),
    l(Math.floor(w/2),12,z+16,w-10,12,z+20,'terra'),
    b(6,22,z,w-7,23,z+1,'dark')],
  'merch-hat-and-shirt-display':(w,z)=>[
    b(5,7,z,w-6,24,z+4,'wood'),b(6,7,z+4,w-7,10,z+26,'frame'),
    b(6,10,z+21,w-7,21,z+22,'wood'),
    ...[10,17,w-10].flatMap((x,i)=>[
      c(x,15,z+23,z+23,3,'blue'),c(x,15,z+24,z+26,2,'blue'),
      b(x-2,15,z+6,x+2,22,z+8,i%2?'terra':'offwhite')])],
  'projection-screen-cart':(w,z)=>[
    b(5,6,z,7,9,z+43,'frame'),b(w-8,6,z,w-6,9,z+43,'frame'),
    b(7,7,z+12,w-8,9,z+42,'offwhite'),
    b(6,8,z+11,w-7,10,z+12,'frame'),b(6,8,z+42,w-7,10,z+43,'frame'),
    b(9,16,z,20,25,z+3,'dark'),b(10,24,z+1,13,25,z+3,'display')],
  'event-light-mast':(w,z)=>[
    ...[10,w-11].flatMap(x=>[c(x,12,z,z+2,5,'steel'),c(x,12,z+3,z+29,1,'frame')]),
    b(9,11,z+28,w-10,14,z+30,'steel'),
    ...[10,17,w-11].flatMap((x,i)=>[b(x-2,13,z+22+i,x+2,19,z+28+i,'dark'),
      b(x-1,19,z+23+i,x+1,19,z+27+i,i%2?'terra':'offwhite')])],
};
const decks={
  'indoor-riser':w=>({z:4,ops:[b(4,5,0,w-5,26,2,'dark'),b(5,6,3,w-6,25,3,'wood')]}),
  'road-case-platform':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,3,'dark'))),
    b(4,6,4,w-5,25,7,'frame'),b(5,25,5,14,26,6,'steel')]}),
  'courtyard-deck':w=>({z:5,ops:[
    b(4,6,0,w-5,25,1,'walnut'),...([6,10,14,18,22].map(y=>b(4,y,2,w-5,y+2,4,'wood')))]}),
  'cloth-skirt-module':w=>({z:9,ops:[
    b(4,6,0,w-5,25,7,'linen'),...Array.from({length:Math.floor((w-8)/4)},(_,i)=>b(5+i*4,25,1,6+i*4,26,7,'offwhite')),
    b(3,5,7,w-4,26,8,'wood')]}),
  'recessed-step':w=>({z:8,ops:[
    b(4,6,0,w-5,25,2,'frame'),b(5,7,3,w-6,24,4,'steel'),b(6,8,5,w-7,23,7,'wood'),
    b(6,23,3,w-7,28,4,'dark')]}),
};
const designs=[];
for(const [prop,build] of Object.entries(stageProps)){
  for(const [size,w] of [['small-stage',31],['function-room',59]]){
    for(const [base,mount] of Object.entries(decks)){
      const {z,ops}=mount(w);
      designs.push({schemaVersion:1,id:`event-${prop}-${size}-${base}`,category:'events',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('event-service',designs);
