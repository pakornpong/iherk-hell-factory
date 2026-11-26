import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  steel:{kind:'metal',color:'#9ea7a8'}, frame:{kind:'metal',color:'#565f67'},
  black:{kind:'matte',color:'#3c454b'}, blue:{kind:'matte',color:'#61778c'},
  copper:{kind:'metal',color:'#b78262'}, red:{kind:'matte',color:'#a45e50'},
  amber:{kind:'matte',color:'#c2a066'}, cream:{kind:'matte',color:'#d9d0bb'},
  wood:{kind:'wood',color:'#9d7a5c'}, glass:{kind:'glass',color:'#8daab4'},
};
const area=(w,z)=>({
  e:w-6,m:Math.floor(w/2),
  b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
});
const machines={
  'flat-vise-fabrication':({b,c,e})=>[
    b(5,7,0,e,24,4,'steel'),b(8,9,5,21,21,7,'frame'),
    b(9,10,8,13,20,14,'blue'),b(17,10,8,21,20,14,'blue'),
    b(10,11,13,13,19,15,'steel'),b(17,11,13,20,19,15,'steel'),
    b(12,14,8,24,16,10,'steel'),c(23,16,10,12,1,'black'),b(e-10,16,5,e-3,20,7,'copper')],
  'sheet-metal-brake':({b,l,e})=>[
    b(5,7,0,e,24,6,'blue'),b(6,8,7,e-1,20,10,'steel'),
    b(7,10,10,e-2,12,13,'frame'),b(8,12,10,e-3,24,11,'steel'),
    b(8,22,11,e-3,23,15,'steel'),l(7,12,11,7,25,20,'frame'),l(e-2,12,11,e-2,25,20,'frame')],
  'bench-metal-lathe':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,11,5,e-1,14,7,'steel'),
    b(6,9,8,13,20,22,'blue'),b(e-8,9,8,e-1,20,16,'blue'),
    b(12,13,13,e-6,16,15,'steel'),b(14,12,12,e-9,17,16,'copper'),
    b(15,17,8,21,21,12,'black'),c(19,20,12,14,1,'steel'),l(11,10,21,14,8,22,'black')],
  'welding-screen-and-bench':({b,c,l,e})=>[
    b(5,7,0,e,24,5,'frame'),b(5,7,5,7,9,35,'steel'),b(e-2,7,5,e,9,35,'steel'),
    b(5,7,33,e,9,35,'steel'),b(7,8,8,e-2,9,33,'amber'),
    b(8,13,5,16,20,8,'steel'),b(16,18,5,e-5,20,6,'copper'),
    c(e-5,12,5,15,3,'blue'),l(e-4,14,12,e-2,21,6,'black')],
  'workshop-belt-grinder':({b,l,e})=>[
    b(5,7,0,e,24,4,'frame'),b(8,8,5,21,14,16,'blue'),
    b(9,10,16,20,18,25,'frame'),b(9,15,12,20,18,25,'black'),
    b(7,19,12,22,23,13,'steel'),l(10,9,23,10,19,12,'steel'),b(21,12,10,24,13,13,'amber')],
  'portable-mig-case-prop':({b,c,l,e})=>[
    b(6,8,0,23,22,18,'blue'),b(7,8,18,22,11,20,'black'),b(10,8,20,19,10,21,'black'),
    b(7,22,4,22,24,15,'frame'),b(8,24,11,15,24,13,'glass'),
    c(19,23,13,15,1,'red'),l(10,24,4,e-5,26,3,'black'),l(e-5,26,3,e-3,23,3,'black')],
  'horizontal-bandsaw':({b,l,e})=>[
    b(5,7,0,e,24,5,'frame'),b(6,8,5,e-1,23,7,'steel'),
    b(7,9,7,13,19,20,'blue'),b(e-9,9,8,e-2,19,17,'blue'),
    l(12,11,18,e-9,11,16,'steel'),b(8,9,18,e-2,19,22,'blue'),
    b(12,19,16,e-7,20,18,'black'),b(9,18,8,16,21,10,'copper')],
  'drill-vise-pillar':({b,c,e})=>[
    b(5,7,0,e,24,3,'frame'),c(11,10,4,29,2,'steel'),b(9,10,25,21,18,31,'blue'),
    c(18,16,18,25,2,'black'),c(18,16,14,18,1,'steel'),
    b(10,10,10,23,22,12,'steel'),b(14,13,13,21,20,15,'frame')],
  'ring-roller-and-bender':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'steel'),...([9,16,23].map((x,i)=>c(x,15,5,9+i%2,3,'frame'))),
    b(6,10,5,e-1,11,14,'blue'),b(8,10,13,e-3,16,15,'blue'),
    l(16,13,15,19,18,25,'steel'),b(18,17,24,23,19,26,'black'),
    l(9,16,10,16,19,10,'copper'),l(16,19,10,24,21,11,'copper')],
  'swarf-separation-cart':({b,c,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,8,5,e-1,23,13,'blue'),
    b(7,9,13,e-2,22,14,'black'),...([9,13,17,21].map(y=>b(8,y,14,e-3,y,14,'steel'))),
    c(12,15,14,18,3,'steel'),c(e-6,14,14,17,2,'copper'),
    b(8,24,7,17,24,10,'cream')],
};
const mounts={
  'steel-trestle':w=>({z:14,ops:[
    ...[5,w-8].flatMap(x=>[L(x,7,0,x,15,13,'frame'),L(x,23,0,x,15,13,'frame')]),
    B(4,6,12,w-5,25,13,'steel'),B(7,8,4,w-8,23,5,'wood')]}),
  'shop-drawers':w=>({z:13,ops:[
    B(5,7,0,w-6,24,11,'blue'),...([4,8].map(z=>B(6,24,z,w-7,25,z+2,'frame'))),
    B(4,6,11,w-5,25,12,'steel'),B(9,25,7,w-10,26,7,'steel')]}),
  'anti-vibration-pad':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'black'),B(5,7,3,w-6,24,3,'frame')]}),
  'field-service-caster':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,7,'frame'),B(5,25,5,14,26,6,'amber')]}),
  'back-wall-rail':w=>({z:11,ops:[
    B(4,5,0,w-5,7,24,'steel'),B(4,7,9,w-5,25,10,'frame'),
    L(6,7,3,6,22,9,'steel'),L(w-7,7,3,w-7,22,9,'steel')]}),
};
const designs=[];
for(const [task,make] of Object.entries(machines)) for(const [size,w] of [['small-shop',34],['shop-span',60]]){
  for(const [mount,base] of Object.entries(mounts)){
    const {z,ops}=base(w);
    designs.push({schemaVersion:1,id:`metalshop-${task}-${size}-${mount}`,category:'metalworking',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
      palette:'office-night',materials,ops:[...ops,...make(area(w,z))]});
  }
}
await writeFamily('metal-shops',designs);
