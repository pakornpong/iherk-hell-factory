import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#a78363'}, ivory:{kind:'matte',color:'#ddd6c8'},
  gray:{kind:'metal',color:'#9aa4a7'}, slate:{kind:'metal',color:'#5e6975'},
  dark:{kind:'matte',color:'#424952'}, blue:{kind:'matte',color:'#677f94'},
  amber:{kind:'matte',color:'#bc9466'}, brick:{kind:'matte',color:'#a76757'},
  paper:{kind:'matte',color:'#d9c9ac'}, glass:{kind:'glass',color:'#91adb7'},
};
const prep=(w,z)=>({
  w,e:w-6,m:Math.floor(w/2),
  b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
});
const units={
  'amber-bottle-backstock':({b,c,e})=>[
    b(5,6,0,e,9,31,'ivory'),b(5,9,0,7,24,31,'ivory'),b(e-2,9,0,e,24,31,'ivory'),
    ...[2,11,20,30].map(h=>b(6,8,h,e-1,24,h+1,'gray')),
    ...[4,13,22].flatMap((h,i)=>Array.from({length:Math.floor((e-7)/5)},(_,j)=>[
      c(9+j*5,16,h,h+4,2,i%2?'ivory':'amber'),c(9+j*5,16,h+5,h+6,1,'gray')]).flat())],
  'cold-display-with-drawers':({b,e})=>[
    b(5,7,0,e,24,29,'ivory'),b(6,24,11,e-1,25,27,'glass'),b(6,24,2,e-1,25,9,'blue'),
    ...[14,18,22].map(h=>b(7,25,h,e-2,25,h,'gray')),
    b(7,25,6,e-2,26,6,'slate'),b(8,8,29,16,16,31,'gray')],
  'privacy-consultation-counter':({b,e})=>[
    b(4,6,0,e+1,25,4,'oak'),b(5,6,4,7,25,23,'glass'),b(e-2,6,4,e,25,23,'glass'),
    b(5,6,4,e,8,21,'glass'),b(6,6,1,e-1,7,19,'slate'),
    b(8,12,5,17,21,5,'paper'),b(e-9,11,5,e-4,17,8,'blue')],
  'prescription-pickup-cubby':({b,e})=>[
    b(5,6,0,e,9,32,'ivory'),b(5,8,0,7,24,32,'ivory'),b(e-2,8,0,e,24,32,'ivory'),
    ...[3,12,21,30].map(h=>b(7,8,h,e-2,24,h+1,'gray')),
    ...Array.from({length:Math.floor((e-7)/6)},(_,i)=>[5,14,23].flatMap(h=>[
      b(8+i*6,9,h,9+i*6,24,h+6,'ivory'),b(10+i*6,14,h,12+i*6,23,h+4,'paper'),
      b(10+i*6,23,h+2,12+i*6,23,h+3,'blue')])).flat()],
  'blood-pressure-kiosk-prop':({b,c,l,e,m})=>[
    b(5,7,0,e,24,4,'gray'),b(6,8,5,e-1,11,25,'ivory'),
    b(8,11,13,e-3,11,21,'glass'),b(10,11,15,e-5,11,17,'blue'),
    c(m,17,5,11,4,'blue'),c(m,17,11,11,3,'dark'),
    l(m,17,11,e-3,19,7,'dark'),l(e-3,19,7,e-4,13,11,'dark')],
  'counter-payment-and-bag':({b,e})=>[
    b(5,7,0,e,24,4,'oak'),b(7,8,5,19,19,8,'dark'),b(9,9,8,17,11,17,'slate'),
    b(9,11,12,17,11,16,'glass'),b(8,14,9,18,19,9,'gray'),
    b(e-8,11,5,e-1,22,16,'paper'),b(e-7,12,16,e-2,13,19,'amber')],
  'health-pamphlet-stand':({b,e})=>[
    b(5,7,0,e,24,4,'oak'),b(5,8,4,e,10,29,'ivory'),
    ...[5,12,19].flatMap((h,i)=>[b(6,10,h,e-1,22,h+1,'gray'),
      b(6,21,h+1,e-1,23,h+2,'blue'),b(9,17,h+2,17,20,h+6,'paper'),
      b(e-10,16,h+2,e-4,20,h+7,i%2?'brick':'blue')])],
  'sealed-supply-roller-shelf':({b,e})=>[
    b(5,7,0,e,24,3,'gray'),...([6,e-1].flatMap(x=>[8,22].map(y=>b(x,y,3,x+1,y+1,29,'slate')))),
    ...[4,12,20,28].map(h=>b(5,7,h,e,24,h+1,'gray')),
    ...[6,14,22].flatMap((h,i)=>[b(8,10,h,16,21,h+4,i%2?'blue':'ivory'),
      b(e-10,11,h,e-3,21,h+4,'paper')])],
  'label-and-bagging-bench':({b,e})=>[
    b(5,7,0,e,24,4,'oak'),b(8,8,5,20,18,12,'ivory'),b(9,18,8,19,19,9,'dark'),
    b(10,19,8,18,23,8,'paper'),b(e-9,10,5,e-3,20,16,'blue'),
    b(e-8,11,16,e-4,12,20,'paper'),b(e-8,18,16,e-4,19,20,'paper')],
  'pill-counter-display-prop':({b,c,e,m})=>[
    b(5,7,0,e,24,4,'gray'),b(6,8,5,e-1,12,15,'blue'),b(7,12,11,18,12,13,'glass'),
    b(8,14,5,m+4,22,7,'ivory'),...([10,14,18].map(x=>c(x,18,7,8,1,'paper'))),
    c(e-5,15,5,12,3,'amber'),c(e-5,15,13,14,2,'gray')],
  'otc-lockable-zone':({b,e})=>[
    b(5,7,0,e,24,27,'ivory'),b(6,24,4,e-1,25,25,'glass'),
    ...[7,15,22].map(h=>b(7,25,h,e-2,25,h,'gray')),
    b(e-7,25,11,e-5,26,16,'slate'),b(7,7,27,e-2,23,29,'blue')],
  'standalone-weighing-station':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'gray'),b(6,8,4,20,23,7,'slate'),
    c(13,15,8,9,6,'gray'),b(e-8,9,4,e-6,11,22,'slate'),
    b(e-13,8,21,e-3,12,25,'dark'),b(e-11,12,22,e-5,12,24,'glass'),
    l(e-8,11,4,e-10,18,6,'slate')],
};
const supports={
  inset:w=>({z:3,ops:[B(4,6,0,w-5,25,1,'dark'),B(5,7,1,w-6,24,2,'gray')]}),
  'clinical-island':w=>({z:13,ops:[B(4,6,0,w-5,25,2,'slate'),B(5,7,3,w-6,24,11,'ivory'),
    B(7,24,5,w-8,25,9,'blue'),B(4,6,11,w-5,25,12,'gray')]}),
  'wall-backbench':w=>({z:11,ops:[B(4,5,0,w-5,8,22,'ivory'),B(4,7,9,w-5,25,10,'gray'),
    L(6,8,3,6,22,9,'slate'),L(w-7,8,3,w-7,22,9,'slate')]}),
  'mobile-care-cart':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+3,y+2,3,'dark'))),
    B(4,6,4,w-5,25,7,'gray'),B(w-7,7,7,w-5,22,10,'slate')]}),
  'open-supply-trestle':w=>({z:14,ops:[...[5,w-8].flatMap(x=>[L(x,7,0,x,15,13,'slate'),L(x,23,0,x,15,13,'slate')]),
    B(4,6,12,w-5,25,13,'ivory'),B(6,8,5,w-7,24,6,'gray'),B(8,10,7,17,20,9,'paper')]}),
};
const models=[];
for(const [unit,build] of Object.entries(units)) for(const [size,w] of [['single',32],['wide',60]]){
  for(const [mount,base] of Object.entries(supports)){
    if(unit==='cold-display-with-drawers'&&mount==='open-supply-trestle')continue;
    const {z,ops}=base(w);
    models.push({schemaVersion:1,id:`pharmacy-${unit}-${size}-${mount}`,category:'pharmacy',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
      palette:'office-night',materials,ops:[...ops,...build(prep(w,z))]});
  }
}
await writeFamily('pharmacy-fixtures',models);
