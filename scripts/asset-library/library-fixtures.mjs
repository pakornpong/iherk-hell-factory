import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  oak:{kind:'wood',color:'#ae8258'}, walnut:{kind:'wood',color:'#795c48'},
  steel:{kind:'metal',color:'#9dabab'}, black:{kind:'matte',color:'#44515b'},
  linen:{kind:'matte',color:'#cec0ac'}, paper:{kind:'matte',color:'#e2dac6'},
  red:{kind:'matte',color:'#a0645a'}, blue:{kind:'matte',color:'#667990'},
  amber:{kind:'matte',color:'#c3a371'}, glass:{kind:'glass',color:'#92adb9'},
};
const covers=['blue','red','linen','amber','black'];
function books(x,X,y,z,depth){
  return Array.from({length:Math.floor((X-x+1)/3)},(_,i)=>
    b(x+3*i,y,z,x+3*i+1+(i%4===0?1:0),y+depth,z+3+(i*7%5),covers[(i*3+4)%covers.length]));
}
const designsByUse={
  'reference-stack': (w,z)=>[
    b(4,6,z,w-5,7,z+41,'walnut'),b(4,7,z,6,24,z+41,'oak'),b(w-7,7,z,w-5,24,z+41,'oak'),
    ...[2,13,24,36,41].map(h=>b(6,7,z+h,w-7,24,z+h+1,'oak')),
    ...[4,15,26].flatMap(h=>books(7,w-8,12,z+h,11))],
  'picture-book-tier':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'oak'),b(5,6,z+4,w-6,9,z+26,'oak'),
    ...[5,13,21].flatMap((h,i)=>[
      b(5,8+i*2,z+h,w-6,24-i*4,z+h+1,'oak'),b(6,23-i*4,z+h+1,w-7,24-i*4,z+h+3,'walnut'),
      ...Array.from({length:Math.floor((w-11)/7)},(_,j)=>b(7+j*7,17-i*4,z+h+2,11+j*7,18-i*4,z+h+7,covers[(i+2*j)%5]))])],
  'archive-flat-files':(w,z)=>[
    b(5,6,z,w-6,24,z+23,'walnut'),
    ...[2,6,10,14,18].flatMap(h=>[b(7,24,z+h,w-8,25,z+h+2,'oak'),
      b(Math.floor(w/2)-3,25,z+h+1,Math.floor(w/2)+3,26,z+h+1,'steel')]),
    b(4,5,z+23,w-5,25,z+25,'oak'),b(9,10,z+26,26,18,z+27,'paper')],
  'returns-sort-cart':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'steel'),
    b(5,8,z+3,7,22,z+29,'black'),b(w-8,8,z+3,w-6,22,z+29,'black'),
    b(7,8,z+12,w-8,24,z+14,'blue'),b(7,8,z+22,w-8,24,z+24,'blue'),
    ...books(8,w-9,11,z+14,10),b(9,11,z+24,21,21,z+25,'paper'),b(w-17,10,z+24,w-9,20,z+27,'linen')],
  'quiet-study-carrel':(w,z)=>[
    b(5,7,z,w-6,10,z+31,'linen'),b(5,9,z+1,7,24,z+31,'linen'),
    b(w-8,9,z+1,w-6,24,z+31,'linen'),b(7,9,z+16,w-8,24,z+18,'oak'),
    c(10,13,z+18,z+19,3,'steel'),b(9,12,z+19,10,13,z+28,'steel'),
    b(9,12,z+27,15,14,z+29,'blue'),b(15,15,z+19,23,21,z+20,'paper')],
  'display-case-manuscript':(w,z)=>[
    b(5,6,z,w-6,24,z+10,'walnut'),b(5,6,z+10,w-6,24,z+12,'oak'),
    b(5,6,z+14,w-6,7,z+24,'glass'),b(5,7,z+14,6,23,z+24,'glass'),
    b(w-7,7,z+14,w-6,23,z+24,'glass'),b(5,23,z+14,w-6,24,z+24,'glass'),
    b(5,6,z+24,w-6,24,z+24,'steel'),b(6,7,z+25,w-7,23,z+25,'glass'),
    b(10,11,z+13,w-11,19,z+14,'paper'),l(13,13,z+15,w-14,13,z+15,'black')],
  'magazine-face-out':(w,z)=>[
    b(5,6,z,w-6,8,z+32,'oak'),b(5,7,z,7,24,z+30,'oak'),b(w-8,7,z,w-6,24,z+30,'oak'),
    ...[3,13,23].flatMap((h,j)=>[
      b(7,7,z+h,w-8,22,z+h+1,'oak'),b(7,21,z+h+1,w-8,23,z+h+3,'walnut'),
      ...Array.from({length:Math.floor((w-13)/8)},(_,i)=>b(8+i*8,16,z+h+2,13+i*8,17,z+h+9,covers[(i+j)%5]))])],
  'catalog-card-bank':(w,z)=>[
    b(5,6,z,w-6,24,z+29,'oak'),
    ...[3,9,15,21].flatMap(h=>Array.from({length:Math.floor((w-10)/8)},(_,i)=>{
      const x=6+i*8;
      return [b(x,24,z+h,x+6,25,z+h+4,'walnut'),b(x+1,25,z+h+1,x+4,25,z+h+2,'paper'),
        b(x+2,26,z+h+3,x+4,26,z+h+3,'steel')];
    }).flat()),
    b(4,5,z+29,w-5,25,z+30,'oak')],
};
const bases={
  'low-plinth':w=>({z:4,ops:[b(4,6,0,w-5,24,1,'black'),b(5,7,2,w-6,23,3,'walnut')]}),
  'mobile-rail':w=>({z:7,ops:[
    ...[6,w-9].flatMap(x=>[7,22].map(y=>b(x,y,0,x+3,y+3,3,'black'))),
    b(5,6,4,w-6,24,6,'steel'),b(w-7,6,7,w-5,8,13,'steel'),b(w-7,22,7,w-5,24,13,'steel')]}),
  'raised-legs':w=>({z:9,ops:[
    ...[6,w-9].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,7,'walnut'))),
    b(4,6,7,w-5,24,8,'oak')]}),
  'ledge-cabinet':w=>({z:12,ops:[
    b(4,6,0,w-5,25,10,'walnut'),b(3,5,10,w-4,26,11,'oak'),
    b(7,25,3,w-8,25,8,'linen'),b(11,25,7,17,26,7,'steel')]}),
};
const designs=[];
for(const [fixture,build] of Object.entries(designsByUse)){
  for(const [format,w] of [['study-bay',31],['room-span',61]]){
    for(const [mount,base] of Object.entries(bases)){
      const {z,ops}=base(w);
      designs.push({schemaVersion:1,id:`library-${fixture}-${format}-${mount}`,category:'library',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('library-fixtures',designs);
