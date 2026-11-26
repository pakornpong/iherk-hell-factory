import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#aa805a'}, walnut:{kind:'wood',color:'#745844'},
  steel:{kind:'metal',color:'#99a6a7'}, brass:{kind:'metal',color:'#bda174'},
  frame:{kind:'metal',color:'#56626c'}, ivory:{kind:'matte',color:'#dad0bd'},
  cloth:{kind:'matte',color:'#ad9b87'}, blue:{kind:'matte',color:'#627c92'},
  charcoal:{kind:'matte',color:'#465056'}, red:{kind:'matte',color:'#a16357'},
  mirror:{kind:'glass',color:'#9db1b9'},
};
const context=(w,z)=>({
  w,mid:Math.floor(w/2),e:w-6,
  b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
});
const fixtures={
  'shoe-bench-with-cubbies':({b,e,mid})=>[
    b(5,7,0,e,24,2,'oak'),b(5,7,2,7,24,15,'oak'),b(e-2,7,2,e,24,15,'oak'),
    b(mid,8,2,mid+1,24,14,'oak'),b(5,7,14,e,24,16,'oak'),b(6,8,16,e-1,23,19,'cloth'),
    b(8,13,3,14,22,6,'blue'),b(e-8,12,3,e-3,22,7,'charcoal')],
  'full-length-swivel-mirror':({b,l,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,8,12,43,'brass'),b(e-2,8,4,e,12,43,'brass'),
    b(8,9,5,e-2,13,42,'walnut'),b(9,13,7,e-3,13,40,'mirror'),
    l(11,13,23,e-5,13,38,'ivory'),b(7,12,22,9,14,24,'steel'),b(e-3,12,22,e-1,14,24,'steel')],
  'valet-stand-and-trouser-rail':({b,c,l,e,mid})=>[
    b(5,7,0,e,24,3,'walnut'),c(mid,13,4,33,1,'brass'),
    l(mid,13,32,mid-7,14,29,'oak'),l(mid,13,32,mid+7,14,29,'oak'),
    b(mid-7,14,29,mid+7,15,30,'oak'),
    b(mid-6,16,22,mid+6,17,23,'brass'),b(mid+2,16,13,mid+5,18,22,'blue')],
  'double-tier-hanger-rail':({b,l,e})=>[
    b(5,7,0,e,24,3,'frame'),b(6,9,4,7,11,37,'steel'),b(e-2,9,4,e-1,11,37,'steel'),
    b(6,9,36,e-1,11,37,'steel'),b(6,9,20,e-1,11,21,'steel'),
    ...Array.from({length:Math.floor((e-9)/4)},(_,i)=>{
      const x=8+4*i;
      return [l(x,10,36,x,13,32,'steel'),b(x,11,24,x+1,15,32,i%2?'ivory':'blue'),
        b(x,11,12,x+1,15,18,i%2?'red':'cloth')];
    }).flat()],
  'cosmetic-vanity-and-light-strip':({b,c,e,mid})=>[
    b(5,7,0,10,23,11,'oak'),b(e-5,7,0,e,23,11,'oak'),b(5,7,10,e,24,12,'ivory'),
    b(8,8,13,e-3,10,31,'walnut'),b(9,10,14,e-4,10,29,'mirror'),
    ...[15,19,23,27].flatMap(h=>[b(8,10,h,9,11,h,'ivory'),b(e-4,10,h,e-3,11,h,'ivory')]),
    c(10,17,13,17,2,'red'),c(mid+4,18,13,16,2,'brass')],
  'theater-costume-trunk':({b,e,mid})=>[
    b(5,6,0,e,25,16,'walnut'),b(5,7,16,e,10,28,'blue'),
    b(6,24,2,e-1,25,14,'oak'),b(6,6,15,e-1,6,17,'steel'),
    b(mid-4,25,9,mid+4,26,11,'brass'),b(6,6,16,8,25,20,'steel'),
    b(e-2,6,16,e,25,20,'steel')],
  'slim-bag-lockers':({b,e})=>[
    b(5,6,0,e,24,30,'steel'),...Array.from({length:Math.floor((e-7)/7)},(_,i)=>{
      const x=6+i*7;
      return [b(x,24,3,x+5,25,14,'blue'),b(x,24,16,x+5,25,27,'blue'),
        b(x+4,25,8,x+5,26,9,'brass'),b(x+4,25,20,x+5,26,21,'brass')];
    }).flat(),b(4,5,29,e+1,25,31,'frame')],
  'curtained-changing-booth':({b,e})=>[
    b(5,6,0,7,9,38,'steel'),b(e-2,6,0,e,9,38,'steel'),
    b(5,21,0,7,24,38,'steel'),b(e-2,21,0,e,24,38,'steel'),
    b(5,6,37,e,9,38,'steel'),b(5,23,37,e,24,38,'steel'),
    ...Array.from({length:Math.floor((e-7)/3)},(_,i)=>b(7+3*i,8,4,8+3*i,10,37,i%2?'cloth':'ivory')),
    b(e-1,9,6,e,22,37,'cloth'),b(7,20,0,16,23,4,'oak')],
  'folded-knit-display':({b,e})=>[
    b(5,6,0,e,9,27,'oak'),b(5,8,0,7,24,27,'oak'),b(e-2,8,0,e,24,27,'oak'),
    ...[3,11,20].flatMap((h,i)=>[b(6,8,h,e-1,23,h+1,'oak'),
      b(8,11,h+2,16,21,h+5,i%2?'blue':'cloth'),b(e-10,11,h+2,e-3,20,h+6,i%2?'red':'ivory')])],
  'hat-and-accessory-tree':({b,c,l,mid,e})=>[
    c(mid,15,0,3,7,'oak'),c(mid,15,4,37,1,'steel'),
    ...[[8,11,25],[e-4,14,21],[mid,21,31]].flatMap(([x,y,z],i)=>[
      l(mid,15,z-3,x,y,z,'steel'),c(x,y,z,z,4,'oak'),c(x,y,z+1,z+3,3,i%2?'blue':'cloth')]),
    b(8,20,2,15,24,7,'red')],
};
const bases={
  'toe-kick': w=>({z:4,ops:[B(4,6,0,w-5,25,2,'walnut'),B(5,7,3,w-6,24,3,'oak')]}),
  'brass-legs':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,7,'brass'))),B(4,6,7,w-5,25,7,'oak')]}),
  'wardrobe-casters':w=>({z:7,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'charcoal'))),
    B(4,6,4,w-5,25,6,'steel'),B(w-7,8,6,w-5,22,10,'brass')]}),
  'wall-cleat':w=>({z:11,ops:[
    B(4,5,0,w-5,8,27,'ivory'),B(4,8,9,w-5,25,10,'oak'),
    L(6,8,3,6,20,9,'steel'),L(w-7,8,3,w-7,20,9,'steel')]}),
  'fitting-room-riser':w=>({z:6,ops:[
    B(3,5,0,w-4,26,3,'walnut'),B(4,6,4,w-5,25,5,'cloth'),B(6,24,4,14,27,5,'oak')]}),
};
const designs=[];
for(const [item,build] of Object.entries(fixtures)){
  for(const [width,w] of [['personal',32],['wardrobe-span',60]]){
    for(const [option,support] of Object.entries(bases)){
      if(option==='wall-cleat'&&['curtained-changing-booth','hat-and-accessory-tree','valet-stand-and-trouser-rail'].includes(item))continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`dressing-${item}-${width}-${option}`,category:'dressing-room',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(context(w,z))]});
    }
  }
}
await writeFamily('dressing-rooms',designs);
