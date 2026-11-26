import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const s=(x,y,z,X,Y,Z,axis,material)=>({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
const materials={
  oak:{kind:'wood',color:'#ad8663'}, walnut:{kind:'wood',color:'#755844'},
  linen:{kind:'matte',color:'#b9a891'}, tan:{kind:'matte',color:'#b99470'},
  navy:{kind:'matte',color:'#607183'}, cream:{kind:'matte',color:'#ded4c0'},
  rubber:{kind:'matte',color:'#495359'}, steel:{kind:'metal',color:'#9ca7a9'},
  clay:{kind:'matte',color:'#a97561'}, glass:{kind:'glass',color:'#8fadb8'},
  brass:{kind:'metal',color:'#bca475'},
};
const fixtures={
  'cat-climb-tree':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'walnut'),c(11,13,z+4,z+31,2,'tan'),c(w-10,17,z+4,z+23,2,'tan'),
    b(6,8,z+21,17,19,z+24,'linen'),b(w-16,10,z+24,w-5,24,z+26,'linen'),
    b(6,7,z+31,19,20,z+34,'linen'),b(8,8,z+33,17,18,z+35,'cream'),
    l(18,13,z+33,18,13,z+27,'tan'),c(18,13,z+25,z+27,1,'clay')],
  'covered-pet-bed':(w,z)=>[
    b(4,6,z,w-5,25,z+3,'oak'),b(5,7,z+4,w-6,10,z+23,'linen'),
    b(5,9,z+4,7,24,z+22,'linen'),b(w-8,9,z+4,w-6,24,z+22,'linen'),
    b(6,8,z+22,w-7,24,z+25,'navy'),b(8,11,z+4,w-9,22,z+7,'cream'),
    b(9,12,z+7,w-10,15,z+9,'tan')],
  'raised-food-water-bowls':(w,z)=>[
    ...[6,w-9].flatMap(x=>[8,21].map(y=>b(x,y,z,x+2,y+2,z+6,'oak'))),
    b(4,6,z+6,w-5,24,z+8,'oak'),
    ...[10,w-11].flatMap((x,i)=>[c(x,15,z+9,z+12,4,'steel'),c(x,15,z+12,z+12,3,i?'glass':'tan')])],
  'wire-travel-crate':(w,z)=>[
    b(4,6,z,w-5,25,z+3,'rubber'),b(4,6,z+21,w-5,25,z+23,'steel'),
    ...[6,24].flatMap(y=>Array.from({length:Math.floor((w-8)/4)},(_,i)=>
      b(5+i*4,y,z+4,5+i*4,y+1,z+21,'steel'))),
    b(4,7,z+4,5,24,z+20,'navy'),b(w-5,7,z+4,w-4,24,z+20,'steel'),
    b(w-4,17,z+11,w-3,21,z+12,'brass'),b(7,9,z+4,w-8,22,z+5,'linen')],
  'hooded-litter-box':(w,z)=>[
    b(4,6,z,w-5,25,z+6,'rubber'),b(5,7,z+7,w-6,10,z+22,'cream'),
    b(5,10,z+7,8,24,z+22,'cream'),b(w-9,10,z+7,w-6,24,z+22,'cream'),
    b(5,7,z+22,w-6,24,z+25,'cream'),b(8,11,z+7,w-9,24,z+8,'tan'),
    b(8,23,z+5,w-9,27,z+6,'navy'),b(10,24,z+6,w-11,27,z+6,'rubber')],
  'grooming-table-loop-arm':(w,z)=>[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,z,x+2,y+2,z+16,'steel'))),
    b(4,6,z+15,w-5,25,z+17,'rubber'),b(w-8,8,z+17,w-6,10,z+44,'steel'),
    b(w-18,8,z+42,w-6,10,z+44,'steel'),l(w-18,9,z+42,w-18,12,z+29,'navy'),
    b(w-20,11,z+26,w-16,13,z+28,'navy')],
  'agility-tunnel':(w,z)=>[
    ...Array.from({length:Math.floor((w-9)/4)},(_,i)=>{
      const x=5+i*4;
      return [b(x,8,z,x+2,22,z+3,'navy'),b(x,8,z+4,x+2,10,z+16,'navy'),
        b(x,20,z+4,x+2,22,z+16,'navy'),b(x,10,z+16,x+2,20,z+19,'navy'),
        b(x+2,9,z+18,x+3,21,z+19,i%2?'rubber':'steel')];
    }).flat()],
  'agility-balance-ramp':(w,z)=>[
    s(4,9,z,Math.floor(w/2),21,z+13,'+X','oak'),s(Math.floor(w/2),9,z,w-5,21,z+13,'-X','oak'),
    ...[9,14,19].map(x=>b(x,8,z+2,x+1,22,z+3,'rubber')),
    b(Math.floor(w/2)-1,8,z+12,Math.floor(w/2)+1,22,z+14,'navy')],
  'pump-pet-fountain':(w,z)=>[
    c(12,15,z,z+3,8,'navy'),c(12,15,z+4,z+5,7,'steel'),c(12,15,z+5,z+5,6,'glass'),
    c(12,15,z+5,z+11,3,'cream'),c(12,15,z+11,z+13,4,'cream'),
    c(w-9,16,z,z+2,4,'oak'),c(w-9,16,z+2,z+6,3,'clay')],
  'leash-and-toy-cubby':(w,z)=>[
    b(5,6,z,w-6,9,z+26,'oak'),b(5,9,z,w-6,23,z+3,'oak'),
    b(5,9,z+3,7,23,z+13,'oak'),b(w-8,9,z+3,w-6,23,z+13,'oak'),
    b(5,9,z+12,w-6,24,z+14,'oak'),
    ...[10,w-11].flatMap(x=>[b(x,9,z+20,x+1,12,z+22,'brass'),l(x,12,z+20,x,16,z+13,'navy')]),
    c(11,17,z+4,z+8,2,'clay'),c(w-10,18,z+4,z+6,3,'linen')],
  'aquarium-cabinet':(w,z)=>[
    b(5,6,z,w-6,24,z+10,'oak'),b(5,24,z+2,w-6,25,z+8,'walnut'),
    b(6,7,z+10,w-7,23,z+12,'navy'),b(6,7,z+12,w-7,8,z+31,'glass'),
    b(6,8,z+12,7,22,z+31,'glass'),b(w-8,8,z+12,w-7,22,z+31,'glass'),
    b(6,22,z+12,w-7,23,z+31,'glass'),b(6,7,z+31,w-7,23,z+32,'steel'),
    b(8,10,z+12,w-9,21,z+13,'tan'),c(11,15,z+14,z+17,2,'clay')],
};
const bases={
  'home-floor-mat': w=>({z:2,ops:[b(3,5,0,w-4,26,1,'linen'),b(5,7,1,w-6,25,1,'tan')]}),
  'washable-rubber':w=>({z:3,ops:[b(4,5,0,w-5,26,2,'rubber'),...([6,10,14,18,22].map(y=>b(5,y,2,w-6,y,2,'navy')))]}),
  'low-deck':w=>({z:5,ops:[b(4,6,0,w-5,25,2,'walnut'),...([6,11,16,21].map(y=>b(4,y,3,w-5,y+3,4,'oak')))]}),
  'mobile-grooming-base':w=>({z:7,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,3,'rubber'))),
    b(4,6,4,w-5,25,6,'steel'),b(5,6,6,7,8,11,'navy')]}),
  'stone-tile-tray':w=>({z:4,ops:[b(4,6,0,w-5,25,2,'steel'),b(4,6,3,w-5,25,3,'cream'),
    ...[10,20].map(y=>b(5,y,3,w-6,y,3,'tan'))]}),
};
function enclosureDetails(prop, mount, w, z) {
  if (mount==='home-floor-mat') return [];
  const x=w-10;
  const right=w-5;
  if (prop==='cat-climb-tree') {
    if (mount==='washable-rubber') return [s(6,19,z+3,17,25,z+20,'+X','oak'),b(11,20,z+16,16,24,z+17,'rubber')];
    if (mount==='low-deck') return [b(12,8,z+6,23,20,z+14,'walnut'),b(13,20,z+7,21,21,z+12,'rubber')];
    if (mount==='mobile-grooming-base') return [b(x-3,10,z+23,right,21,z+33,'navy'),
      b(x-2,20,z+24,right-1,21,z+30,'cream')];
    return [c(x,15,z+4,z+36,2,'tan'),b(x-6,10,z+35,right,21,z+37,'linen')];
  }
  if (prop==='covered-pet-bed') {
    if (mount==='washable-rubber') return [s(5,7,z+24,Math.floor(w/2),24,z+33,'+X','navy'),
      s(Math.floor(w/2),7,z+24,right-1,24,z+33,'-X','navy')];
    if (mount==='low-deck') return [b(8,23,z+4,14,27,z+13,'oak'),b(x-3,11,z+7,x+1,13,z+15,'linen')];
    if (mount==='mobile-grooming-base') return [b(9,24,z+7,right-3,25,z+20,'steel'),
      b(10,25,z+10,12,26,z+17,'brass')];
    return [b(7,24,z+5,15,26,z+10,'cream'),b(9,10,z+25,right-3,24,z+27,'linen')];
  }
  if (prop.includes('agility')) {
    if (mount==='washable-rubber') return [b(6,7,z+1,7,25,z+5,'navy'),b(right-2,7,z+1,right-1,25,z+5,'navy')];
    if (mount==='low-deck') return [b(6,23,z+2,8,24,z+20,'oak'),
      b(right-2,23,z+2,right-1,24,z+20,'oak'),b(8,23,z+18,right-2,24,z+19,'navy')];
    return [b(6,9,z+1,9,11,z+8,'cream'),b(right-4,19,z+1,right-1,21,z+8,'cream')];
  }
  if (prop==='grooming-table-loop-arm') {
    if (mount==='washable-rubber') return [b(5,7,z+17,7,25,z+20,'navy')];
    if (mount==='low-deck') return [b(7,8,z+4,right-2,22,z+5,'oak'),b(10,9,z+6,17,16,z+9,'linen')];
    if (mount==='mobile-grooming-base') return [b(6,8,z+16,8,23,z+24,'steel'),b(6,12,z+23,10,20,z+24,'steel')];
    return [b(7,8,z+4,right-2,22,z+6,'steel'),c(11,13,z+6,z+11,2,'cream')];
  }
  if (prop==='aquarium-cabinet') {
    if (mount==='washable-rubber') return [b(6,7,z+32,right-1,23,z+35,'navy')];
    if (mount==='low-deck') return [b(5,12,z+32,16,18,z+35,'oak'),b(9,10,z+3,12,13,z+8,'brass')];
    return [b(7,9,z+32,right-2,11,z+35,'steel'),c(11,15,z+12,z+18,2,'tan')];
  }
  if (mount==='washable-rubber') return [b(6,7,z+1,7,26,z+5,'navy'),b(6,25,z+1,15,26,z+4,'rubber')];
  if (mount==='low-deck') return [b(x-6,8,z,x+1,19,z+9,'oak'),b(x-5,8,z+9,x,19,z+11,'linen')];
  if (mount==='mobile-grooming-base') return [b(right-2,6,z+2,right,23,z+13,'steel'),
    b(x-1,6,z+12,right,8,z+13,'steel')];
  return [b(6,22,z+2,14,24,z+6,'cream'),c(10,22,z+6,z+9,2,'clay')];
}
const designs=[];
for(const [prop,build] of Object.entries(fixtures)){
  for(const [size,w] of [['compact',32],['wide',60]]){
    for(const [location,mount] of Object.entries(bases)){
      if(location==='mobile-grooming-base'&&['agility-tunnel','agility-balance-ramp','aquarium-cabinet'].includes(prop))continue;
      const {z,ops}=mount(w);
      designs.push({schemaVersion:1,id:`pet-fixture-${prop}-${size}-${location}`,category:'pet-care',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z),...enclosureDetails(prop,location,w,z)]});
    }
  }
}
await writeFamily('pet-interiors',designs);
