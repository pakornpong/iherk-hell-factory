import { writeFamily } from './render.mjs';
const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  zinc:{kind:'metal',color:'#9da7a8'}, iron:{kind:'metal',color:'#596670'},
  black:{kind:'matte',color:'#3e464b'}, oak:{kind:'wood',color:'#a6815f'},
  stone:{kind:'matte',color:'#aaa29b'}, ivory:{kind:'matte',color:'#ded2bd'},
  pastry:{kind:'matte',color:'#bd975e'}, toast:{kind:'matte',color:'#a5764f'},
  dough:{kind:'matte',color:'#cfb696'}, rust:{kind:'matte',color:'#a56856'},
  slate:{kind:'matte',color:'#647a8d'}, glass:{kind:'glass',color:'#8eaeb7'},
};
const make=(w,z)=>({
  w,m:Math.floor(w/2),e:w-6,
  b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
});
const equipment={
  'two-deck-stone-oven':({b,e})=>[
    b(5,7,0,e,24,31,'zinc'),...([5,17].flatMap(z=>[
      b(6,24,z,e-1,25,z+10,'iron'),b(8,25,z+1,e-3,25,z+8,'glass'),
      b(8,25,z+9,e-3,26,z+10,'black')])),
    b(e-10,20,30,e-2,23,32,'slate'),b(e-9,23,31,e-4,23,32,'ivory')],
  'bread-proofing-cabinet':({b,e})=>[
    b(5,7,0,e,24,35,'zinc'),b(7,24,4,e-2,25,31,'glass'),
    ...[6,13,20,27].flatMap(h=>[b(8,25,h,e-4,25,h,'iron'),
      b(9,25,h+1,e-6,25,h+2,'dough')]),b(e-3,25,14,e-2,26,21,'black')],
  'rolling-dough-sheeter':({b,c,e})=>[
    b(5,7,0,e,24,4,'zinc'),b(6,8,4,e-1,23,6,'black'),b(9,9,6,e-4,22,7,'dough'),
    b(10,7,6,12,9,21,'slate'),b(10,22,6,12,24,21,'slate'),
    b(11,8,19,13,23,21,'zinc'),b(11,8,13,13,23,16,'zinc'),
    c(11,9,21,22,2,'rust')],
  'divider-rounder':({b,c,m,e})=>[
    b(5,7,0,e,24,5,'iron'),b(6,8,6,e-1,23,8,'zinc'),
    c(m,15,8,14,8,'zinc'),c(m,15,14,15,7,'black'),
    ...[[m-4,15],[m,13],[m+4,16]].map(([x,y])=>c(x,y,15,17,2,'dough')),
    b(6,9,8,8,22,26,'iron'),b(7,10,23,m,19,26,'slate')],
  'bread-tray-cooling-rack':({b,c,e})=>[
    ...[5,e-1].flatMap(x=>[7,22].map(y=>b(x,y,0,x+1,y+1,34,'iron'))),
    ...[5,13,21,29].flatMap(h=>[b(5,7,h,e,24,h+1,'zinc'),
      ...Array.from({length:Math.floor((e-8)/5)},(_,i)=>c(8+i*5,15,h+2,h+4,2,'toast'))])],
  'flour-sifter-mill':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'iron'),c(13,14,5,10,5,'zinc'),c(13,14,10,17,7,'zinc'),
    c(13,14,18,18,6,'ivory'),c(13,14,19,23,2,'iron'),l(13,14,22,23,14,23,'zinc'),
    c(23,14,23,25,1,'black'),b(e-7,18,5,e-1,23,11,'dough')],
  'glaze-table-with-turntable':({b,c,e})=>[
    b(4,6,0,e+1,25,4,'oak'),c(13,15,5,8,7,'zinc'),c(13,15,9,13,5,'pastry'),
    c(13,15,13,14,5,'ivory'),b(e-9,10,5,e-2,18,8,'stone'),b(e-8,11,8,e-3,17,9,'dough'),
    b(e-8,20,5,e-2,22,5,'rust')],
  'baguette-fluted-pans':({b,e})=>[
    b(5,7,0,e,24,3,'zinc'),...([9,14,19].flatMap(y=>[
      b(6,y,4,e-1,y+3,6,'zinc'),b(8,y+1,6,e-4,y+2,8,'toast')])),
    b(5,7,3,6,24,8,'iron'),b(e-1,7,3,e,24,8,'iron')],
  'cake-finishing-light-box':({b,c,e,m})=>[
    b(5,6,0,e,24,4,'stone'),b(6,7,4,e-1,9,24,'ivory'),
    b(7,9,21,e-2,17,24,'ivory'),b(8,16,20,e-3,17,21,'glass'),
    c(m,15,5,6,7,'zinc'),c(m,15,7,11,6,'pastry'),c(m,15,12,13,6,'ivory'),
    c(m+5,14,13,15,1,'rust'),c(m-3,16,13,15,1,'rust')],
  'bread-slicer-feed-chute':({b,e})=>[
    b(5,7,0,e,24,5,'iron'),b(6,7,5,e-1,18,21,'zinc'),
    b(7,18,6,e-2,19,20,'black'),b(8,19,6,e-3,27,7,'zinc'),
    ...[8,12,16,20].map(x=>b(x,19,8,x,24,14,'zinc')),
    b(10,21,8,19,25,11,'toast'),b(e-7,18,17,e-4,19,19,'rust')],
  'ingredient-bin-bank':({b,c,e})=>[
    b(5,7,0,e,25,4,'iron'),...([10,e-6].flatMap((x,i)=>[
      b(x-4,9,5,x+4,23,14,i?'slate':'ivory'),b(x-5,8,15,x+5,24,16,'zinc'),
      b(x-3,23,8,x+3,24,10,'ivory'),c(x,15,16,17,2,'black')])),
    b(6,8,17,e-1,10,22,'iron'),b(7,10,20,e-2,13,22,'zinc')],
  'bag-sealing-packing-board':({b,e})=>[
    b(4,6,0,e+1,25,4,'oak'),b(6,7,5,e-1,11,7,'iron'),b(7,9,8,e-2,10,11,'zinc'),
    b(10,12,5,16,20,7,'dough'),b(e-9,14,5,e-3,22,9,'pastry'),
    b(e-10,14,9,e-2,22,10,'glass'),b(e-5,10,7,e-2,12,9,'rust')],
};
const mounts={
  'balance-feet': w=>({z:3,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,1,'black'))),
    B(4,6,2,w-5,25,2,'iron')]}),
  'washdown-stand':w=>({z:12,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,11,'zinc'))),
    B(4,6,10,w-5,25,11,'zinc'),B(5,9,4,w-6,23,5,'iron')]}),
  'mobile-baker-rack':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,7,'zinc'),B(w-7,6,7,w-5,23,10,'iron')]}),
  'stone-counter':w=>({z:14,ops:[
    B(4,6,0,w-5,25,2,'black'),B(5,7,3,w-6,24,12,'oak'),
    B(4,5,12,w-5,26,13,'stone'),B(7,24,7,w-8,25,10,'ivory')]}),
  'proofing-base':w=>({z:10,ops:[
    B(4,6,0,w-5,25,8,'iron'),B(5,24,2,w-6,25,7,'glass'),
    B(5,6,8,w-6,24,9,'zinc'),B(9,25,6,w-10,26,6,'zinc')]}),
};
const designs=[];
for(const [functionName,form] of Object.entries(equipment)){
  for(const [format,w] of [['compact',34],['production',61]]){
    for(const [mount,support] of Object.entries(mounts)){
      if(mount==='mobile-baker-rack'&&functionName==='two-deck-stone-oven')continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`bakery-${functionName}-${format}-${mount}`,category:'bakery',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...form(make(w,z))]});
    }
  }
}
await writeFamily('bakery-production',designs);
