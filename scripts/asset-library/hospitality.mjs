import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  oak:{kind:'wood',color:'#a77854'}, walnut:{kind:'wood',color:'#715443'},
  black:{kind:'matte',color:'#3d454d'}, steel:{kind:'metal',color:'#929ca2'},
  stone:{kind:'matte',color:'#b4aaa0'}, ivory:{kind:'matte',color:'#ded5c4'},
  linen:{kind:'matte',color:'#a3a098'}, bronze:{kind:'metal',color:'#ba9a61'},
  oxblood:{kind:'matte',color:'#9c6155'}, glass:{kind:'glass',color:'#90adb8'},
};
const bodies = {
  'fluted-oak': (w)=>[b(4,7,0,w-5,25,3,'walnut'),b(4,7,4,w-5,24,20,'oak'),
    ...Array.from({length:Math.floor((w-9)/3)},(_,i)=>b(5+3*i,25,4,5+3*i,25,20,'walnut')),
    b(3,6,20,w-4,26,22,'stone')],
  'industrial-open': (w)=>[
    ...[5,w-8].flatMap(x=>[8,23].map(y=>b(x,y,0,x+2,y+2,20,'black'))),
    b(4,7,4,w-5,25,6,'steel'),b(4,7,14,w-5,23,15,'steel'),b(3,6,20,w-4,26,22,'oak')],
  'linen-skirt': (w)=>[b(4,7,3,w-5,25,22,'linen'),b(4,7,0,5,8,8,'black'),b(w-6,23,0,w-5,24,8,'black'),
    ...Array.from({length:Math.floor((w-7)/5)},(_,i)=>b(5+5*i,25,3,6+5*i,26,21,'ivory')),
    b(3,6,21,w-4,26,22,'ivory')],
  'rounded-island': (w)=>[b(12,6,0,w-13,26,19,'walnut'),c(12,16,0,19,10,'walnut'),c(w-13,16,0,19,10,'walnut'),
    b(12,5,20,w-13,27,22,'stone'),c(12,16,20,22,11,'stone'),c(w-13,16,20,22,11,'stone')],
};
const stations={
  'reception-bell-ledger':(w)=>[
    b(4,6,23,w-5,10,34,'walnut'),b(3,5,34,w-4,11,35,'stone'),
    c(9,20,23,23,3,'black'),c(9,20,24,26,2,'bronze'),c(9,20,27,27,0,'bronze'),
    b(w-17,14,23,w-8,22,24,'oxblood'),b(w-16,14,24,w-9,21,24,'ivory'),
    b(w-9,16,25,w-8,21,25,'black')],
  'concierge-keyboard-rack':(w)=>[
    b(4,6,23,w-5,9,45,'walnut'),b(5,9,25,w-6,9,43,'oak'),
    ...[29,37].flatMap(z=>Array.from({length:Math.floor((w-12)/5)},(_,i)=>[
      b(7+i*5,10,z,8+i*5,11,z+1,'bronze'),b(7+i*5,11,z-3,7+i*5,11,z,'ivory')]).flat()),
    b(8,16,23,16,22,24,'black')],
  'buffet-chafing-pans':(w)=>[
    ...Array.from({length:Math.floor((w-9)/12)},(_,i)=>{
      const x=6+12*i;
      return [b(x,9,23,x+9,24,25,'black'),b(x,10,26,x+9,23,27,'steel'),
        b(x+1,12,28,x+8,21,29,'steel'),b(x+3,15,30,x+6,17,30,'bronze')];
    }).flat()],
  'water-glass-service':(w)=>[
    b(6,8,23,21,23,24,'walnut'),c(13,14,25,32,4,'glass'),c(13,14,33,36,2,'glass'),
    c(13,14,37,37,2,'bronze'),b(16,13,26,18,14,28,'glass'),
    ...[w-14,w-9].map(x=>c(x,18,23,27,2,'glass'))],
  'bar-service-taps':(w)=>[
    b(6,7,23,w-7,11,25,'black'),c(12,12,23,36,2,'bronze'),
    b(10,11,34,21,14,37,'bronze'),b(20,14,34,21,19,36,'bronze'),
    b(21,18,32,22,20,36,'steel'),b(7,18,23,23,23,23,'steel'),
    ...[9,13,17,21].map(x=>b(x,18,24,x,23,24,'black'))],
  'coat-check-hanger':(w)=>[
    b(4,8,23,6,10,43,'black'),b(w-8,8,23,w-6,10,43,'black'),b(4,8,43,w-6,10,45,'bronze'),
    ...Array.from({length:Math.floor((w-11)/7)},(_,i)=> {
      const x=7+7*i;
      return [l(x,9,43,x,9,40,'steel'),l(x,9,40,x,13,37,'steel'),
        b(x,8+i%2,28,x+2,14+i%2,37,['oxblood','linen','black'][i%3])];
    }).flat()],
  'room-service-coffee-urn':(w)=>[
    c(14,14,23,25,8,'black'),c(14,14,26,39,6,'steel'),c(14,14,40,41,6,'bronze'),
    c(14,14,42,43,2,'black'),b(13,20,29,15,25,30,'bronze'),b(13,25,28,15,26,29,'black'),
    c(w-9,18,23,26,3,'ivory')],
};
const designs=[];
for(const [usage,build] of Object.entries(stations)){
  for(const [body, support] of Object.entries(bodies)){
    for(const [size,w] of [['compact',31],['wide',61]]){
      designs.push({schemaVersion:1,id:`hospitality-${usage}-${body}-${size}`,category:'hospitality',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...support(w),...build(w)]});
    }
  }
}
await writeFamily('hospitality',designs);
