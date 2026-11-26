import { writeFamily } from './render.mjs';
const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  zinc:{kind:'metal',color:'#9ca5a7'}, iron:{kind:'metal',color:'#566470'},
  wood:{kind:'wood',color:'#a7805d'}, dark:{kind:'matte',color:'#3d454c'},
  paste:{kind:'matte',color:'#d4ccba'}, paper:{kind:'matte',color:'#dfd7be'},
  blue:{kind:'matte',color:'#627991'}, taupe:{kind:'matte',color:'#b09b84'},
  oxblood:{kind:'matte',color:'#9c5d52'}, glass:{kind:'glass',color:'#98aeb4'},
  brass:{kind:'metal',color:'#bea272'},
};
const tools=(w,z)=>({
  w,e:w-6,m:Math.floor(w/2),
  b:(x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m),
  c:(x,y,k,K,r,m)=>C(x,y,z+k,z+K,r,m),
  l:(x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,z+K,m),
});
const units={
  'paper-suction-table':({b,l,e})=>[
    b(5,7,0,e,24,4,'zinc'),b(6,8,4,e-1,23,5,'iron'),b(8,10,5,e-3,21,5,'paper'),
    ...[10,13,16,19].map(y=>b(8,y,5,e-3,y,5,'paste')),
    b(5,6,4,8,9,20,'iron'),l(7,9,18,14,14,17,'zinc'),b(13,14,16,16,15,18,'dark')],
  'wet-document-drying-rack':({b,e})=>[
    ...[5,e-1].flatMap(x=>[7,22].map(y=>b(x,y,0,x+1,y+1,31,'iron'))),
    ...[4,10,16,22,28].flatMap((z,i)=>[b(5,7,z,e,24,z+1,'zinc'),
      b(8,9,z+2,e-3,19,z+2,i%2?'paper':'taupe'),b(6,21,z+2,e-1,24,z+2,'iron')])],
  'oversize-map-mount':({b,l,e})=>[
    b(5,7,0,e,24,3,'wood'),b(6,7,4,e-1,10,25,'wood'),b(7,10,5,e-2,10,23,'paper'),
    l(10,10,10,e-5,10,19,'blue'),l(10,10,20,e-6,10,14,'oxblood'),
    b(8,13,4,e-3,21,5,'taupe'),b(9,16,5,e-4,20,6,'paper')],
  'flat-frame-humidification':({b,c,e})=>[
    b(5,6,0,e,24,4,'iron'),b(6,7,5,e-1,23,6,'glass'),b(6,7,6,e-1,8,15,'glass'),
    b(6,8,6,7,22,15,'glass'),b(e-2,8,6,e-1,22,15,'glass'),
    b(7,8,15,e-2,22,16,'glass'),b(9,10,6,e-5,19,6,'paper'),
    c(e-3,20,16,17,1,'brass')],
  'microfade-stand':({b,c,l,e,m})=>[
    b(5,7,0,e,24,4,'dark'),b(6,8,5,e-1,23,6,'zinc'),b(7,9,6,9,10,27,'iron'),
    l(8,9,26,m,11,24,'zinc'),l(m,11,24,m,16,19,'zinc'),
    c(m,16,14,19,2,'iron'),b(11,13,6,e-5,20,7,'paper'),b(e-5,9,7,e-2,13,10,'blue')],
  'hand-bound-book-cradle':({b,l,e,m})=>[
    b(5,7,0,e,24,3,'wood'),...([8,21].flatMap(y=>[
      l(6,y,13,m,y,3,'wood'),l(m,y,3,e-1,y,13,'wood')])),
    b(6,11,11,m,19,13,'taupe'),b(m,11,11,e-1,19,13,'taupe'),
    b(8,12,13,m-1,18,15,'paper'),b(m+1,12,13,e-3,18,15,'paper'),
    l(m-3,14,15,m-3,17,15,'blue'),l(m+4,14,15,m+4,17,15,'blue')],
  'digitization-overhead-copy':({b,c,l,e,m})=>[
    b(5,7,0,e,24,3,'dark'),b(7,9,4,e-2,21,5,'paper'),b(6,7,4,8,8,33,'iron'),
    l(7,8,32,m,13,30,'iron'),b(m-4,12,26,m+5,18,31,'dark'),c(m,15,24,26,2,'glass'),
    l(e-1,10,5,e-1,12,20,'zinc'),b(e-4,11,19,e-1,18,21,'paste')],
  'vacuum-thermal-screen':({b,l,e})=>[
    b(5,6,0,e,24,5,'zinc'),b(6,7,6,e-1,22,7,'dark'),b(8,9,7,e-3,20,7,'paper'),
    b(5,6,8,7,10,24,'iron'),b(e-2,6,8,e,10,24,'iron'),
    l(6,8,24,6,21,15,'iron'),l(e-1,8,24,e-1,21,15,'iron'),
    b(7,7,22,e-2,13,24,'glass'),b(7,19,14,e-2,21,16,'blue')],
  'quarantine-box-and-tags':({b,e,m})=>[
    b(5,7,0,e,24,3,'wood'),b(7,8,4,m,20,16,'paper'),b(6,7,16,m+1,21,18,'taupe'),
    b(m+3,11,4,e-1,23,23,'paste'),b(m+2,10,23,e,24,25,'taupe'),
    b(8,20,10,m-2,21,13,'oxblood'),b(m+4,23,14,e-3,24,17,'paper')],
  'pigment-and-swatches-drawer':({b,c,e})=>[
    b(5,7,0,e,24,11,'wood'),b(6,24,3,e-1,25,8,'blue'),
    b(7,23,8,e-2,28,9,'wood'),b(9,24,9,e-4,26,10,'paper'),
    ...Array.from({length:Math.floor((e-9)/5)},(_,i)=>c(9+i*5,13,12,16,2,['oxblood','blue','taupe'][i%3])),
    b(9,17,12,e-4,21,12,'paper')],
  'artifact-cushion-and-cradle':({b,l,e,m})=>[
    b(5,7,0,e,24,3,'wood'),b(7,8,4,e-2,23,7,'taupe'),
    l(8,11,7,m,15,12,'iron'),l(e-4,11,7,m,15,12,'iron'),
    l(8,20,7,m,17,12,'iron'),l(e-4,20,7,m,17,12,'iron'),
    b(m-6,14,10,m+6,18,17,'brass'),b(m-4,15,17,m+3,17,19,'brass')],
};
const baseMachines={
  'archive-table':w=>({z:13,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,12,'wood'))),
    B(4,6,11,w-5,25,12,'wood'),B(6,8,5,w-7,23,6,'taupe')]}),
  'lab-console':w=>({z:15,ops:[
    B(4,6,0,12,25,14,'paste'),B(w-13,6,0,w-5,25,14,'paste'),B(4,5,13,w-5,26,14,'zinc'),
    B(6,25,5,11,26,8,'blue'),B(w-12,25,5,w-6,26,8,'blue')]}),
  'mobile-pedestal':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'dark'))),
    B(4,6,4,w-5,25,7,'iron'),B(w-8,7,7,w-5,22,9,'zinc')]}),
  'integrated-backbench':w=>({z:12,ops:[
    B(4,5,0,w-5,7,30,'paste'),B(4,7,10,w-5,25,11,'zinc'),
    B(5,6,24,w-6,13,25,'iron'),L(6,7,4,6,22,10,'iron'),L(w-7,7,4,w-7,22,10,'iron')]}),
  'countertop-insert':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'dark'),B(5,7,1,w-6,24,2,'iron')]}),
};
const designs=[];
for(const [job,build] of Object.entries(units)){
  for(const [width,w] of [['bench-width',34],['double-width',60]]){
    for(const [station,form] of Object.entries(baseMachines)){
      if(job==='wet-document-drying-rack'&&station==='integrated-backbench')continue;
      const {z,ops}=form(w);
      designs.push({schemaVersion:1,id:`conservation-${job}-${width}-${station}`,category:'conservation',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(tools(w,z))]});
    }
  }
}
await writeFamily('conservation',designs);
