import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const paint={
  galv:{color:'#a4a9a9',kind:'metal'}, slate:{color:'#647080',kind:'metal'},
  dark:{color:'#41484e',kind:'matte'}, cream:{color:'#cbc6b8',kind:'matte'},
  white:{color:'#ded9cd',kind:'matte'}, ochre:{color:'#bd9b5b',kind:'matte'},
  red:{color:'#a35d50',kind:'matte'}, glass:{color:'#8aa7b3',kind:'glass'},
  copper:{color:'#b58165',kind:'metal'}, rubber:{color:'#3b4145',kind:'matte'},
};
function shapes(z){
  return [
    (x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
    (x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
    (x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
  ];
}

const equipment={
  'hvac-air-handler': (w,b,c,l)=>[
    b(5,7,0,w-6,24,18,'galv'),b(6,24,2,w-7,25,16,'slate'),
    ...[4,7,10,13].map(z=>b(8,25,z,w-9,25,z,'dark')),
    b(9,9,18,18,22,22,'cream'),b(w-19,9,18,w-9,18,23,'galv'),
    b(w-17,10,23,w-11,16,29,'slate'),b(10,11,22,16,19,25,'slate')],
  'circulation-pump-bank': (w,b,c,l)=>[
    b(5,7,0,w-6,24,4,'slate'),...([12,w-13].flatMap(x=>[
      c(x,16,4,13,5,'red'),c(x,16,14,19,3,'galv'),b(x-4,12,8,x+4,21,11,'red'),
      c(x,17,19,24,1,'copper'),b(x-2,15,23,x+2,19,24,'ochre')])),
    b(10,7,19,w-11,9,21,'galv'),l(12,8,20,12,15,18,'galv'),l(w-13,8,20,w-13,15,18,'galv')],
  'expansion-tank-hydronic': (w,b,c,l)=>[
    c(12,15,0,21,7,'slate'),c(12,15,21,24,6,'slate'),c(12,15,25,27,2,'galv'),
    c(w-13,15,0,26,7,'red'),c(w-13,15,27,29,4,'red'),c(w-13,15,29,32,2,'galv'),
    l(12,15,27,12,9,31,'copper'),l(12,9,31,w-13,9,31,'copper'),l(w-13,9,31,w-13,15,32,'copper'),
    c(w-15,8,31,34,1,'ochre')],
  'solar-storage-inverter':(w,b,c,l)=>[
    b(5,6,0,w-6,23,23,'slate'),b(6,23,2,w-7,24,20,'cream'),
    b(8,24,11,25,24,17,'dark'),b(11,24,13,22,24,16,'glass'),
    ...[3,6,9].map(z=>b(w-21,25,z,w-9,25,z,'slate')),
    b(w-15,8,23,w-8,11,29,'galv'),b(w-12,10,29,w-8,18,30,'galv')],
  'booster-water-filter':(w,b,c,l)=>[
    b(4,6,0,w-5,25,4,'slate'),b(6,8,23,w-7,12,26,'galv'),
    ...[10,20,w-11].flatMap((x,i)=>[
      c(x,15,6,21,4,i%2?'glass':'cream'),
      c(x,15,21,23,5,'slate'),l(x,14,24,x,9,25,'copper')]),
    b(7,10,4,9,12,26,'slate'),b(w-10,10,4,w-8,12,26,'slate')],
  'fire-service-standpipe':(w,b,c,l)=>[
    b(5,7,0,w-6,25,3,'galv'),...([10,w-11].flatMap(x=>[
      c(x,12,3,36,2,'red'),c(x,12,35,37,3,'galv'),b(x-2,13,14,x+2,20,17,'red'),
      b(x-2,19,13,x+2,21,18,'galv'),c(x,19,18,20,2,'ochre')])),
    b(10,11,28,w-11,13,30,'red'),b(13,12,11,w-14,12,12,'galv')],
  'metered-distribution-panel':(w,b,c,l)=>[
    b(5,6,0,w-6,23,30,'slate'),b(6,23,2,w-7,24,28,'cream'),
    ...[9,19,w-10].flatMap(x=>[b(x-2,24,19,x+2,25,24,'dark'),b(x-1,25,20,x+1,25,23,'glass'),
      b(x-1,24,8,x+1,25,14,'slate')]),
    b(8,24,26,w-9,25,27,'ochre'),b(10,8,30,12,12,37,'galv'),b(w-13,8,30,w-11,12,37,'galv')],
  'commercial-exhaust-blower':(w,b,c,l)=>[
    b(5,6,0,w-6,24,4,'slate'),c(14,15,5,21,9,'galv'),c(14,15,21,23,6,'dark'),
    b(17,9,8,w-8,22,18,'galv'),b(w-12,10,18,w-8,21,23,'slate'),
    b(w-9,10,11,w-7,21,15,'dark'),c(14,15,23,24,3,'ochre')],
  'capped-manifold-loop':(w,b,c,l)=>[
    b(4,6,0,w-5,25,3,'slate'),b(5,7,4,w-6,9,34,'cream'),
    b(7,10,26,w-8,12,28,'copper'),b(7,10,13,w-8,12,15,'galv'),
    ...[9,17,25,w-9].flatMap(x=>[c(x,12,14,27,1,'copper'),b(x-1,12,22,x+1,16,24,'red'),
      b(x-2,15,23,x+2,16,24,'ochre')])],
  'wall-air-curtain':(w,b,c,l)=>[
    b(4,6,0,w-5,8,37,'cream'),b(4,8,29,w-5,18,37,'galv'),
    b(6,18,30,w-7,19,35,'dark'),
    ...Array.from({length:Math.floor((w-12)/4)},(_,i)=>b(7+i*4,19,30,7+i*4,19,35,'galv')),
    b(w-13,15,7,w-8,18,15,'slate'),l(w-11,12,15,w-11,10,29,'galv')],
};
const foundations={
  'vibration-pads':w=>({z:3,ops:[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+3,y+3,2,'rubber')))}),
  'concrete-curb':w=>({z:6,ops:[
    B(3,5,0,w-4,26,1,'slate'),B(4,6,2,w-5,25,5,'cream'),B(5,25,2,w-6,26,2,'slate')]}),
  'plant-skid':w=>({z:8,ops:[
    ...[6,23].map(y=>B(4,y,0,w-5,y+2,2,'slate')),B(5,7,3,w-6,25,7,'galv'),
    B(7,25,4,13,26,6,'dark'),B(w-15,25,4,w-8,26,6,'dark')]}),
  'subfloor-frame':w=>({z:12,ops:[
    ...[5,w-9].flatMap(x=>[7,23].map(y=>B(x,y,0,x+2,y+2,11,'slate'))),
    B(4,5,10,w-5,26,11,'galv'),L(7,24,1,w-8,24,10,'slate'),
    B(10,11,4,w-11,18,6,'ochre')]}),
};
const designs=[];
for(const [machine,form] of Object.entries(equipment)){
  for(const [size,w] of [['single',39],['paired',62]]){
    for(const [mount,base] of Object.entries(foundations)){
      if(machine==='wall-air-curtain'&&mount==='subfloor-frame')continue;
      const {z,ops}=base(w);
      designs.push({schemaVersion:1,id:`facilities-${machine}-${size}-${mount}`,category:'building-services',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,1],palette:'office-night',materials:paint,ops:[...ops,...form(w,...shapes(z))]});
    }
  }
}
await writeFamily('building-services',designs);
