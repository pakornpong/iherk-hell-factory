import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  oak:{kind:'wood',color:'#a07f60'}, darkwood:{kind:'wood',color:'#755943'},
  steel:{kind:'metal',color:'#929fa5'}, iron:{kind:'metal',color:'#505d66'},
  paved:{kind:'matte',color:'#ada99e'}, charcoal:{kind:'matte',color:'#444d52'},
  white:{kind:'matte',color:'#dbd7c8'}, blue:{kind:'matte',color:'#647d91'},
  brick:{kind:'matte',color:'#9f7060'}, sand:{kind:'matte',color:'#b29d7b'},
  glass:{kind:'glass',color:'#97b5bf'},
};

const furniture={
  'park-slatted-bench': (w,z)=>[
    ...[6,w-9].flatMap(x=>[b(x,9,z,x+2,11,z+10,'iron'),b(x,21,z,x+2,23,z+11,'iron'),
      b(x,8,z+9,x+2,23,z+10,'iron'),l(x,9,z+10,x,7,z+25,'iron')]),
    ...[10,14,18,22].map(y=>b(4,y,z+11,w-5,y+2,z+12,'oak')),
    ...[16,21,25].map(h=>b(4,7,z+h,w-5,9,z+h+2,'oak'))],
  'bus-shelter': (w,z)=>[
    ...[4,w-7].flatMap(x=>[b(x,5,z,x+2,7,z+40,'iron'),b(x,22,z,x+2,24,z+36,'iron')]),
    {op:'slope',from:[3,4,z+35],to:[w-4,26,z+42],axis:'-Y',material:'blue'},
    b(6,6,z+7,w-7,7,z+34,'glass'),b(7,8,z+7,w-8,13,z+9,'oak'),b(8,7,z,w-9,8,z+8,'iron'),
    b(w-12,7,z+17,w-8,8,z+29,'white')],
  'bicycle-u-rack': (w,z)=>[
    ...Array.from({length:Math.floor((w-7)/10)},(_,i)=>{
      const x=6+i*10;
      return [b(x,9,z,x+1,10,z+19,'iron'),b(x,21,z,x+1,22,z+19,'iron'),
        b(x,10,z+18,x+1,21,z+20,'steel'),b(x-1,8,z,x+2,11,z+1,'steel'),
        b(x-1,20,z,x+2,23,z+1,'steel')];
    }).flat()],
  'drinking-pair': (w,z)=>[
    b(8,9,z,w-9,22,z+4,'paved'),c(11,15,z+4,z+20,4,'steel'),
    c(w-12,16,z+4,z+16,4,'steel'),c(11,15,z+20,z+23,6,'steel'),
    c(w-12,16,z+16,z+19,6,'steel'),b(12,12,z+23,13,14,z+26,'iron'),
    b(w-12,11,z+19,w-11,13,z+22,'iron')],
  'waste-sort-bank': (w,z)=>[
    ...Array.from({length:Math.floor((w-6)/8)},(_,i)=>{
      const x=4+8*i;
      return [b(x,7,z,x+6,23,z+23,['iron','blue','paved'][i%3]),
        b(x,7,z+23,x+6,23,z+24,'steel'),b(x+1,23,z+16,x+5,24,z+19,'charcoal'),
        b(x+1,24,z+12,x+4,24,z+14,'white')];
    }).flat()],
  'notice-map-board': (w,z)=>[
    b(5,9,z,7,11,z+34,'iron'),b(w-8,9,z,w-6,11,z+34,'iron'),
    b(4,8,z+13,w-5,12,z+31,'oak'),b(6,12,z+15,w-7,12,z+29,'white'),
    b(3,7,z+32,w-4,14,z+34,'blue'),l(9,12,z+17,w-10,12,z+26,'blue'),
    l(9,12,z+25,w-11,12,z+20,'brick')],
  'parcel-collection-drop': (w,z)=>[
    b(5,8,z,w-6,24,z+25,'iron'),b(6,9,z+25,w-7,23,z+28,'blue'),
    b(7,24,z+16,w-8,25,z+21,'charcoal'),b(8,25,z+21,w-9,26,z+22,'steel'),
    b(9,24,z+6,w-10,24,z+13,'paved'),b(12,24,z+18,w-13,25,z+18,'white')],
};

const ground={
  paving:(w)=>({z:2,ops:[b(2,3,0,w-3,28,1,'paved'),
    ...[8,15,22].map(y=>b(3,y,1,w-4,y,1,'charcoal'))]}),
  'brick-island':(w)=>({z:4,ops:[b(2,4,0,w-3,27,2,'paved'),
    ...Array.from({length:Math.floor(w/5)},(_,i)=>[5,10,15,20].map(y=>
      b(2+5*i+(y%2),y,3,5+5*i+(y%2),y+3,3,'brick'))).flat()]}),
  'stone-curb':(w)=>({z:4,ops:[b(2,3,0,w-3,28,3,'paved'),b(2,3,3,w-3,5,3,'white'),
    b(2,27,3,w-3,28,3,'white'),b(4,6,3,w-5,26,3,'sand')]}),
  'wood-deck':(w)=>({z:3,ops:[b(3,4,0,w-4,27,1,'darkwood'),
    ...[5,10,15,20,25].map(y=>b(3,y,2,w-4,y+2,2,'oak'))]}),
};
// Each installation gets structural hardware appropriate to its site.
function siteHardware(item, surface, w, z) {
  if (surface === 'paving') return [];
  const alternate = surface === 'brick-island';
  const curb = surface === 'stone-curb';
  switch (item) {
    case 'park-slatted-bench':
      if (alternate) return [8, Math.floor(w/2), w-9].map(x => b(x, 11, z+12, x+1, 22, z+18, 'iron'));
      if (curb) return [b(5, 8, z+12, w-6, 10, z+15, 'oak'), b(4, 9, z, 8, 24, z+10, 'paved'),
        b(w-9, 9, z, w-5, 24, z+10, 'paved')];
      return [b(5, 22, z+11, w-6, 26, z+12, 'oak'), b(7, 13, z, w-8, 17, z+6, 'darkwood')];
    case 'bus-shelter':
      if (alternate) return [b(4, 8, z+8, 5, 22, z+33, 'glass'), b(w-6, 8, z+8, w-5, 22, z+33, 'glass')];
      if (curb) return [b(3, 22, z+36, w-4, 29, z+38, 'steel'), b(5, 27, z+31, w-6, 28, z+36, 'blue')];
      return [b(4, 8, z+6, 6, 22, z+16, 'oak'), b(w-7, 8, z+6, w-5, 22, z+16, 'oak')];
    case 'bicycle-u-rack':
      if (alternate) return [b(4, 5, z+4, w-5, 6, z+6, 'iron'), b(4, 24, z+4, w-5, 25, z+6, 'iron')];
      if (curb) return [b(4, 7, z, 6, 24, z+24, 'iron'), b(4, 8, z+24, w-6, 9, z+25, 'steel')];
      return Array.from({length:Math.floor((w-7)/10)}, (_,i) =>
        b(5+10*i, 9, z+7, 7+10*i, 22, z+8, 'oak'));
    case 'drinking-pair':
      if (alternate) return [b(6, 8, z+4, w-7, 10, z+18, 'brick'), b(8, 9, z+17, w-9, 12, z+18, 'steel')];
      if (curb) return [b(5, 6, z, 8, 22, z+29, 'steel'), b(6, 6, z+26, 15, 12, z+29, 'steel')];
      return [b(8, 10, z+4, w-9, 20, z+12, 'oak'), b(9, 20, z+12, w-10, 22, z+14, 'darkwood')];
    case 'waste-sort-bank':
      if (alternate) return [b(3, 6, z+25, w-4, 24, z+28, 'brick'), b(5, 7, z+29, w-6, 9, z+30, 'steel')];
      if (curb) return [b(3, 6, z, 5, 24, z+19, 'steel'), b(w-6, 6, z, w-4, 24, z+19, 'steel')];
      return [b(3, 23, z+6, w-4, 25, z+11, 'oak'), b(3, 6, z+5, w-4, 7, z+19, 'oak')];
    case 'notice-map-board':
      if (alternate) return [b(3, 8, z+31, 6, 14, z+39, 'brick'), b(w-7, 8, z+31, w-4, 14, z+39, 'brick'),
        b(4, 7, z+38, w-5, 14, z+40, 'blue')];
      if (curb) return [b(5, 8, z, w-6, 11, z+20, 'iron'), b(6, 12, z+5, w-7, 12, z+13, 'white')];
      return [l(5, 10, z+23, 5, 24, z, 'oak'), l(w-7, 10, z+23, w-7, 24, z, 'oak')];
    case 'parcel-collection-drop':
      if (alternate) return [b(6, 8, z+27, 12, 24, z+35, 'brick'), b(8, 23, z+31, 12, 24, z+33, 'steel')];
      if (curb) return [b(5, 8, z+27, w-6, 26, z+30, 'steel'), b(5, 8, z+30, w-6, 10, z+33, 'blue')];
      return [b(4, 7, z, w-5, 25, z+8, 'oak'), b(7, 25, z+3, 12, 26, z+5, 'iron')];
  }
  throw new Error(item);
}
const designs=[];
for(const [item,build] of Object.entries(furniture)){
  for(const [surface,buildBase] of Object.entries(ground)){
    for(const [size,w] of [['compact',31],['wide',61]]){
      const {z,ops}=buildBase(w);
      designs.push({schemaVersion:1,id:`street-${item}-${surface}-${size}`,category:'public-space',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z),...siteHardware(item,surface,w,z)]});
    }
  }
}
await writeFamily('public-spaces',designs);
