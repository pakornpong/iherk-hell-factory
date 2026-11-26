import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  wood:{kind:'wood',color:'#a6815e'}, walnut:{kind:'wood',color:'#775a48'},
  paint:{kind:'matte',color:'#a19d91'}, linen:{kind:'matte',color:'#c9baab'},
  slate:{kind:'matte',color:'#5e7182'}, ivory:{kind:'matte',color:'#dad5c9'},
  chrome:{kind:'metal',color:'#9da9ad'}, iron:{kind:'metal',color:'#54616d'},
  brass:{kind:'metal',color:'#b29c70'}, glass:{kind:'glass',color:'#a0b3b7'},
  rose:{kind:'matte',color:'#a87976'}, earth:{kind:'matte',color:'#9d6f58'},
};
function design(w,z){
  return {
    w,
    b:(x,y,h,X,Y,H,m)=>b(x,y,z+h,X,Y,z+H,m),
    c:(x,y,h,H,r,m)=>c(x,y,z+h,z+H,r,m),
    l:(x,y,h,X,Y,H,m)=>l(x,y,z+h,X,Y,z+H,m),
  };
}
const contents={
  'slatted-linen-tower':({w,b})=>[
    b(4,7,0,w-5,10,34,'wood'),b(4,9,0,7,23,34,'wood'),b(w-8,9,0,w-5,23,34,'wood'),
    ...[0,10,21,33].flatMap(h=>[...([9,13,17,21].map(y=>b(7,y,h,w-8,y+1,h+1,'walnut')))]),
    ...[2,12,23].flatMap((h,i)=>[b(8,10,h,17,20,h+2,i%2?'slate':'linen'),
      b(9,10,h+3,16,19,h+4,'ivory'),b(w-16,12,h,w-9,21,h+5,'rose')])],
  'flip-hamper':({w,b,l})=>[
    b(5,6,0,w-6,24,23,'paint'),b(6,24,3,w-7,25,19,'wood'),
    l(8,25,4,8,29,18,'walnut'),l(w-9,25,4,w-9,29,18,'walnut'),
    b(8,28,17,w-9,29,19,'wood'),b(9,26,16,w-10,27,19,'linen'),
    b(5,6,23,w-6,24,25,'ivory'),b(11,29,17,17,29,18,'chrome')],
  'mirror-medicine-stack':({w,b})=>[
    b(5,6,0,w-6,18,32,'wood'),b(7,18,7,w-8,19,30,'glass'),
    b(7,18,18,w-8,18,19,'ivory'),b(7,18,6,w-8,20,7,'chrome'),
    b(8,19,2,w-9,21,4,'iron'),b(11,20,3,16,22,4,'ivory'),
    b(w-8,19,13,w-7,20,17,'brass')],
  'open-towel-warmer':({w,b,c})=>[
    c(7,14,0,33,1,'chrome'),c(w-8,14,0,33,1,'chrome'),
    ...[5,10,15,20,25,30].map(h=>b(7,14,h,w-8,15,h+1,'chrome')),
    b(9,15,16,17,17,27,'linen'),b(10,16,13,16,18,18,'ivory'),
    b(w-16,15,6,w-10,18,17,'slate'),c(w-8,14,34,35,1,'brass')],
  'laundry-sorter-bins':({w,b})=>[
    b(4,6,0,w-5,26,3,'iron'),b(5,7,3,w-6,8,30,'chrome'),
    b(5,8,15,w-6,24,16,'chrome'),b(5,8,27,w-6,24,28,'chrome'),
    ...[9,w-14].flatMap((x,i)=>[b(x-2,10,4,x+3,23,13,i?'slate':'linen'),
      b(x-2,10,17,x+3,23,25,i?'linen':'slate'),b(x,23,10,x+1,24,11,'ivory')])],
  'open-toiletry-compartments':({w,b,c})=>[
    b(5,6,0,w-6,24,2,'wood'),b(5,7,3,w-6,9,27,'wood'),
    b(5,9,3,7,24,26,'wood'),b(w-8,9,3,w-6,24,26,'wood'),
    ...[9,17,25].map(z=>b(7,9,z,w-8,24,z+1,'ivory')),
    ...[4,11,19].flatMap(h=>[
      c(11,15,h,h+5,2,'glass'),c(19,17,h,h+4,2,'rose'),b(w-13,11,h,w-10,21,h+2,'linen')])],
  'folding-bath-seat':({w,b,l})=>[
    b(5,7,0,w-6,9,27,'paint'),b(6,9,11,w-7,22,13,'wood'),
    ...[7,w-8].map(x=>l(x,10,6,x,21,11,'chrome')),b(6,9,19,w-7,12,20,'chrome'),
    b(10,12,14,18,21,15,'linen'),b(w-12,15,14,w-9,19,16,'ivory')],
  'sliding-door-vanity-storage':({w,b})=>[
    b(4,6,0,w-5,24,20,'walnut'),b(5,24,3,w-6,25,17,'paint'),
    ...Array.from({length:Math.floor((w-10)/3)},(_,i)=>b(7+3*i,26,4,7+3*i,26,16,'wood')),
    b(Math.floor(w/2)-1,26,6,Math.floor(w/2)+1,27,12,'brass'),
    b(3,5,20,w-4,25,22,'ivory'),b(8,9,22,17,20,23,'linen'),
    b(w-13,10,23,w-9,14,26,'glass')],
  'linen-dresser-drawers':({w,b})=>[
    b(5,6,0,w-6,24,29,'wood'),...([2,8,14,21].flatMap(h=>[
      b(6,24,h,w-7,25,h+4,'paint'),b(10,25,h+3,w-11,26,h+3,'chrome')])),
    b(4,5,28,w-5,25,30,'ivory'),b(10,13,30,w-12,22,32,'linen')],
  'spa-towel-cart-rings':({w,b,c,l})=>[
    b(4,6,0,w-5,25,3,'chrome'),...[5,w-7].flatMap(x=>[7,23].map(y=>c(x,y,3,29,1,'chrome'))),
    b(5,7,10,w-6,24,11,'wood'),b(5,7,22,w-6,24,23,'wood'),
    ...[9,16,w-9].flatMap(x=>[c(x,14,12,17,3,'linen'),c(x,14,23,28,3,'ivory')]),
    l(w-7,8,28,w-7,24,28,'chrome')],
};
const mounts={
  'legged':w=>({z:7,ops:[4,w-7].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,6,'walnut')))}),
  'floor-plinth':w=>({z:4,ops:[b(5,6,0,w-6,24,2,'walnut'),b(4,5,3,w-5,25,3,'paint')]}),
  'wall-hung-frame':w=>({z:11,ops:[b(4,5,0,w-5,7,30,'ivory'),b(5,7,9,w-6,23,10,'chrome'),
    l(6,7,4,6,21,10,'iron'),l(w-7,7,4,w-7,21,10,'iron')]}),
  'service-caster':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+3,y+2,3,'iron'))),
    b(4,6,4,w-5,25,7,'chrome'),b(w-7,7,7,w-5,23,10,'iron')]}),
  'steel-stretcher':w=>({z:9,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+1,y+1,8,'iron'))),
    b(5,7,3,w-7,8,4,'iron'),b(5,22,3,w-7,23,4,'iron'),
    b(4,6,8,w-5,25,8,'chrome')]}),
};
const finishes=['#9c988c','#ada097','#68777f','#b4ab9d','#87847d','#978577'];
const designs=[];
for(const [kind,build] of Object.entries(contents)){
  for(const [size,w] of [['narrow',31],['room-width',59]]){
    for(const [mount,support] of Object.entries(mounts)){
      if(kind==='folding-bath-seat'&&mount==='service-caster')continue;
      const {z,ops}=support(w);
      const finish=finishes[(kind.length+7*size.length+3*mount.length)%finishes.length];
      designs.push({schemaVersion:1,id:`bath-storage-${kind}-${size}-${mount}`,category:'bathroom',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials:{...materials,paint:{...materials.paint,color:finish}},
        ops:[...ops,...build(design(w,z))]});
    }
  }
}
await writeFamily('bath-furniture',designs);
