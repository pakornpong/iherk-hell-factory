import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  walnut:{kind:'wood',color:'#765746'}, oak:{kind:'wood',color:'#ad835e'},
  steel:{kind:'metal',color:'#9ca6a8'}, iron:{kind:'metal',color:'#57656d'},
  leather:{kind:'matte',color:'#825f49'}, rubber:{kind:'matte',color:'#3d464f'},
  fabric:{kind:'matte',color:'#a79885'}, sand:{kind:'matte',color:'#ba9f7b'},
  ivory:{kind:'matte',color:'#d8cdb7'}, brass:{kind:'metal',color:'#c0a16d'},
  red:{kind:'matte',color:'#a76454'}, blue:{kind:'matte',color:'#607b91'},
};
function form(w,z){
  return {e:w-6,m:Math.floor(w/2),w,
    b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
    c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m)};
}
function boot(x,y,z,b,color,height){
  return [b(x,y,z,x+4,y+10,z+2,'rubber'),b(x,y+1,z+3,x+4,y+10,z+5,color),
    b(x,y+1,z+6,x+4,y+5,z+height,color),b(x+1,y+3,z+height,x+3,y+4,z+height,'fabric')];
}
const stations={
  'boot-pull-and-bench':({b,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,7,4,e-1,23,6,'walnut'),
    b(8,8,6,14,23,8,'oak'),b(9,19,8,14,23,10,'walnut'),
    ...boot(e-7,9,7,b,'leather',15),b(12,7,6,e-3,10,12,'fabric')],
  'lasts-storage-wall':({b,e})=>[
    b(5,6,0,e,9,32,'oak'),b(5,9,0,7,24,32,'oak'),b(e-2,9,0,e,24,32,'oak'),
    ...[3,13,23,31].map(h=>b(6,9,h,e-1,24,h+1,'oak')),
    ...[5,15,25].flatMap(h=>[
      b(9,12,h,15,21,h+4,'sand'),b(e-8,13,h,e-3,22,h+5,'leather')])],
  'heel-sole-press':({b,c,l,e,m})=>[
    b(5,7,0,e,24,4,'iron'),b(6,7,5,8,22,24,'blue'),b(e-2,7,5,e,22,24,'blue'),
    b(6,8,23,e,22,25,'blue'),c(m,14,13,24,2,'steel'),b(m-4,12,11,m+4,19,13,'steel'),
    b(m-4,12,5,m+4,18,7,'rubber'),l(m,12,25,m+8,19,28,'iron')],
  'polish-and-brush-dispenser':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'walnut'),c(12,14,5,12,5,'iron'),b(16,12,7,e-2,16,11,'steel'),
    c(e-5,14,8,13,3,'sand'),
    c(10,21,5,8,2,'brass'),c(16,21,5,7,2,'red'),l(e-8,9,11,e-6,13,15,'iron')],
  'repair-stitcher-pedestal':({b,c,l,e})=>[
    b(5,6,0,e,25,4,'oak'),b(e-10,8,4,e-4,15,24,'iron'),
    b(10,9,21,e-4,15,25,'iron'),b(10,11,15,14,13,21,'iron'),
    l(12,12,12,12,12,15,'steel'),b(7,11,9,14,18,11,'steel'),
    c(e-9,12,25,30,2,'red'),b(8,16,4,17,23,6,'leather')],
  'laces-and-eyelet-cubby':({b,c,e})=>[
    b(5,6,0,e,9,27,'oak'),b(5,9,0,7,24,27,'oak'),b(e-2,9,0,e,24,27,'oak'),
    ...[4,13,22].flatMap((h,i)=>[b(6,9,h,e-1,24,h+1,'oak'),
      ...[10,17,e-5].map(x=>c(x,16,h+2,h+5,2,['ivory','red','blue'][i]))])],
  'sizing-foot-gauge':({b,e,m})=>[
    b(4,6,0,e+1,25,4,'steel'),b(5,7,4,e,24,5,'iron'),
    b(7,10,5,19,23,6,'steel'),b(8,10,6,18,12,8,'blue'),b(8,20,6,18,22,8,'blue'),
    ...[11,14,17,20].map(y=>b(9,y,6,17,y,6,'ivory')),b(m+3,12,5,e-2,18,7,'sand')],
  'shoe-shine-chair-fixture':({b,l,e,m})=>[
    b(4,6,0,e+1,25,3,'oak'),b(5,7,4,e,19,13,'oak'),b(6,8,13,e-1,18,17,'leather'),
    b(6,7,16,e-1,10,30,'leather'),b(6,10,16,8,20,22,'walnut'),
    b(e-3,10,16,e-1,20,22,'walnut'),b(m-5,20,4,m+6,25,7,'steel'),
    l(m-4,20,7,m-4,25,3,'iron'),l(m+4,20,7,m+4,25,3,'iron')],
  'retail-box-and-display':({b,e})=>[
    b(5,7,0,e,24,4,'oak'),b(5,7,4,e,10,17,'oak'),
    ...boot(8,11,4,b,'rubber',8),...boot(e-8,11,4,b,'leather',10),
    b(9,8,17,18,13,20,'sand'),b(e-9,7,17,e-2,12,22,'ivory')],
  'rubber-sole-cutter':({b,l,e,m})=>[
    b(5,6,0,e,24,5,'iron'),b(6,8,6,e-1,23,7,'steel'),
    b(8,10,7,e-3,21,8,'rubber'),b(m-5,9,8,m+5,13,17,'steel'),
    b(m-2,11,16,m+2,13,21,'iron'),l(m,12,19,e-2,18,25,'iron'),
    b(e-5,17,24,e-1,19,26,'red')],
};
const mounts={
  'counterpad':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'rubber'),B(5,7,1,w-6,24,2,'iron')]}),
  'retail-plinth':w=>({z:8,ops:[B(4,6,0,w-5,25,2,'walnut'),B(5,7,3,w-6,24,7,'oak'),
    B(7,24,5,15,25,6,'ivory')]}),
  'trade-trestle':w=>({z:14,ops:[
    ...[6,w-9].flatMap(x=>[L(x,7,0,x,15,13,'iron'),L(x,23,0,x,15,13,'iron')]),
    B(4,6,12,w-5,25,13,'oak'),B(6,8,5,w-7,24,6,'walnut')]}),
  'cobbler-drawers':w=>({z:15,ops:[
    B(5,7,0,w-6,24,13,'walnut'),B(6,24,4,w-7,25,8,'oak'),
    B(6,24,9,w-7,25,12,'oak'),B(9,25,6,15,26,7,'brass'),B(9,25,10,15,26,11,'brass'),
    B(4,6,13,w-5,25,14,'oak')]}),
  'mobile-service-base':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'rubber'))),
    B(4,6,4,w-5,25,7,'steel'),B(w-7,8,7,w-5,22,10,'iron')]}),
};
const designs=[];
for(const [process,build] of Object.entries(stations)){
  for(const [size,w] of [['single',32],['bench',60]]){
    for(const [fixture,support] of Object.entries(mounts)){
      if(['shoe-shine-chair-fixture','boot-pull-and-bench'].includes(process)&&fixture==='trade-trestle')continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`shoe-care-${process}-${size}-${fixture}`,category:'shoe-care',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials,ops:[...ops,...build(form(w,z))]});
    }
  }
}
await writeFamily('shoe-care',designs);
