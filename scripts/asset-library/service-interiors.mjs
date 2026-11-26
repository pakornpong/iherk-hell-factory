import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const colors={
  wood:['#a77c56','wood'], darkwood:['#755644','wood'], steel:['#9ba6aa','metal'],
  charcoal:['#49535c','matte'], cream:['#ddd5c3','matte'], linen:['#aa9a88','matte'],
  graphite:['#363e43','matte'], brass:['#bda16c','metal'], red:['#a65c50','matte'],
  blue:['#6b8090','matte'], glass:['#89a8b4','glass'], stone:['#a8a09a','matte'],
};
const materials=Object.fromEntries(Object.entries(colors).map(([name,[color,kind]])=>[name,{color,kind}]));
function context(w,z){
  return {
    w,mid:Math.floor(w/2),edge:w-5,
    b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
    c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  };
}
const stands={
  'countertop-insert':w=>({ z:3, ops:[B(4,6,0,w-5,25,1,'charcoal'),B(5,7,1,w-6,24,2,'steel')] }),
  'fixed-island':w=>({ z:14, ops:[
    B(5,7,0,w-6,24,2,'charcoal'),B(5,6,3,w-6,24,12,'wood'),
    B(7,24,5,w-8,25,11,'darkwood'),B(11,25,8,w-12,26,9,'brass'),
    B(4,5,12,w-5,25,13,'stone')] }),
  'mobile-trolley':w=>({ z:10, ops:[
    ...[5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,0,x+3,y+2,3,'graphite'))),
    ...[5,w-8].flatMap(x=>[7,23].map(y=>B(x,y,4,x+2,y+2,9,'steel'))),
    B(4,5,4,w-5,26,5,'blue'),B(4,5,8,w-5,26,9,'steel'),
    B(w-7,6,9,w-5,23,10,'charcoal')] }),
  'storage-trestle':w=>({ z:16, ops:[
    ...[5,w-8].flatMap(x=>[L(x,7,0,x,15,15,'charcoal'),L(x,24,0,x,15,15,'charcoal')]),
    B(4,6,14,w-5,25,15,'wood'),B(7,7,7,w-8,24,8,'wood'),
    B(9,9,9,16,20,11,'linen'),B(w-17,10,9,w-10,21,12,'cream')] }),
  'wall-console':w=>({ z:13, ops:[
    B(4,5,0,w-5,7,24,'steel'),B(4,7,11,w-5,26,12,'stone'),
    L(6,8,2,6,22,11,'steel'),L(w-7,8,2,w-7,22,11,'steel')] }),
};
const cleaning={
  'folding-linen-press':({b,l,edge})=>[
    b(5,8,0,edge,24,4,'steel'),b(5,8,4,edge,10,8,'blue'),b(5,10,4,8,24,7,'blue'),
    l(7,9,7,7,18,24,'steel'),l(edge-2,9,7,edge-2,18,24,'steel'),
    b(6,17,23,edge-1,22,25,'blue'),b(10,13,5,edge-5,23,5,'linen')],
  'housekeeping-bag-frame':({b,l,mid,edge})=>[
    b(5,7,0,edge,24,3,'blue'),b(7,8,4,mid,23,23,'linen'),b(6,7,22,mid+1,24,24,'charcoal'),
    b(mid+2,9,4,edge-1,22,8,'steel'),b(mid+3,11,8,edge-3,18,13,'cream'),
    l(edge-1,8,4,edge-1,8,27,'steel'),b(mid+2,8,26,edge-1,11,27,'steel')],
  'bucket-wringer-pair':({b,c,l,mid,edge})=>[
    b(5,7,0,edge,25,2,'charcoal'),c(11,17,3,13,5,'blue'),c(edge-7,17,3,12,5,'blue'),
    b(8,9,14,14,17,17,'steel'),b(9,10,17,13,16,18,'charcoal'),
    l(12,10,17,11,6,26,'steel'),b(10,6,25,13,7,27,'red'),
    c(edge-7,17,12,12,3,'glass')],
  'wet-floor-caddy':({b,l,mid,edge})=>[
    b(5,6,0,edge,25,4,'graphite'),b(6,7,4,mid+1,23,10,'blue'),
    l(7,10,10,14,10,29,'brass'),l(16,10,10,19,10,29,'brass'),b(13,9,28,19,11,30,'brass'),
    b(mid+3,8,4,edge,22,15,'linen'),b(mid+5,12,15,edge-2,20,16,'cream')],
  'wall-towel-dispenser':({b,mid,edge})=>[
    b(5,6,0,edge,10,31,'steel'),b(7,10,11,edge-2,22,28,'cream'),
    b(8,22,13,edge-3,23,17,'charcoal'),b(mid-4,23,10,mid+4,25,14,'linen'),
    b(9,22,23,edge-4,23,24,'steel')],
  'pressure-washer-hose-reel':({b,c,l,mid,edge})=>[
    b(5,6,0,edge,24,4,'charcoal'),b(6,8,4,mid,21,15,'blue'),
    b(mid+2,9,4,edge,22,17,'steel'),b(mid+3,11,8,edge-1,20,19,'graphite'),
    b(mid+4,12,10,edge-2,19,17,'blue'),c(10,13,15,17,2,'brass'),
    l(edge-2,20,12,edge-1,25,4,'graphite'),l(edge-1,25,4,edge,29,4,'graphite')],
  'supply-dilution-rack':({b,c,l,edge})=>[
    b(5,6,0,edge,10,31,'steel'),b(6,10,4,edge-1,24,5,'steel'),
    ...[10,19,edge-4].map((x,i)=>c(x,16,6,15+i%2,2,i%2?'glass':'cream')),
    b(6,10,24,edge-1,16,27,'blue'),l(10,14,22,10,15,16,'charcoal'),
    l(edge-5,14,22,edge-5,15,16,'charcoal')],
  'boot-wash-brush-tray':({b,l,edge})=>[
    b(5,6,0,edge,26,4,'stone'),b(6,7,4,edge-1,25,5,'steel'),
    ...[9,14,19,24].map(y=>b(8,y,5,edge-3,y+1,7,'graphite')),
    b(5,7,4,7,9,26,'steel'),l(6,8,25,15,8,25,'steel'),l(15,8,25,15,14,20,'steel')],
};
const catering={
  'rack-of-service-trays':({b,edge})=>[
    ...[5,edge-1].flatMap(x=>[7,23].map(y=>b(x,y,0,x+1,y+1,29,'steel'))),
    ...[5,11,17,23,28].map((h,i)=>b(5,7,h,edge,24,h+1,i%2?'charcoal':'steel')),
    b(9,11,29,edge-4,19,31,'cream')],
  'heated-carving-board':({b,l,c,edge})=>[
    b(5,7,0,edge,24,3,'steel'),b(6,8,4,edge-1,23,6,'wood'),
    b(11,12,7,edge-7,20,10,'red'),l(8,9,4,8,9,25,'brass'),
    l(8,9,25,16,11,24,'brass'),c(16,12,22,25,4,'steel'),b(18,23,7,edge-1,24,7,'steel')],
  'salad-bar-ice-well':({b,edge})=>[
    b(5,6,0,edge,24,7,'steel'),b(6,7,7,edge-1,23,7,'charcoal'),
    ...Array.from({length:Math.floor((edge-8)/6)},(_,i)=>
      b(8+6*i,9,8,12+6*i,22,8,['linen','red','cream','glass'][i%4])),
    b(5,7,7,6,8,22,'steel'),b(edge-1,7,7,edge,8,22,'steel'),
    b(5,8,21,edge,17,22,'glass')],
  'insulated-food-carriers':({b,edge,mid})=>[
    b(5,8,0,mid,23,12,'charcoal'),b(4,7,11,mid+1,24,13,'blue'),
    b(mid+2,9,0,edge,22,15,'charcoal'),b(mid+1,8,14,edge+1,23,16,'blue'),
    b(8,18,13,mid-3,20,15,'steel'),b(mid+4,17,16,edge-2,19,18,'steel'),
    b(7,23,6,mid-2,24,8,'cream')],
  'beverage-crate-rack':({b,c,edge})=>[
    b(5,6,0,edge,24,3,'wood'),b(5,6,4,edge,8,13,'wood'),
    b(5,22,4,edge,24,13,'wood'),
    ...Array.from({length:Math.floor((edge-7)/5)},(_,i)=>[12,18].flatMap(y=>[
      c(8+i*5,y,4,12,2,i%2?'glass':'cream'),c(8+i*5,y,13,17,1,'glass')])).flat()],
  'folding-banquet-sideboard':({b,l,edge})=>[
    b(4,6,0,edge,26,4,'wood'),b(5,7,5,edge-1,25,7,'linen'),
    b(5,8,8,edge-1,11,21,'steel'),b(6,10,19,edge-2,19,21,'glass'),
    l(7,8,17,7,20,20,'steel'),l(edge-2,8,17,edge-2,20,20,'steel')],
  'room-service-tray-stack':({b,c,edge})=>[
    ...[0,4,8].map(h=>b(5,7,h,edge,24,h+2,'wood')),
    c(12,15,11,15,6,'steel'),c(12,15,15,18,4,'steel'),c(12,15,19,20,1,'brass'),
    c(edge-6,18,11,14,2,'cream'),b(edge-7,17,14,edge-5,19,15,'cream')],
  'portable-induction-buffet':({b,c,edge})=>[
    b(5,6,0,edge,24,6,'steel'),b(6,7,6,edge-1,23,7,'graphite'),
    ...[11,edge-6].flatMap(x=>[c(x,15,7,7,4,'blue'),c(x,15,8,12,4,'steel'),
      c(x,15,13,13,3,'steel'),c(x,15,14,15,1,'charcoal')]),
    b(7,24,3,edge-2,24,4,'blue')],
};
const lounge={
  'umbrella-and-coat-stand':({b,c,l,mid,edge})=>[
    c(mid,15,0,2,8,'charcoal'),c(mid,15,3,39,1,'steel'),
    ...[[6,12],[edge-1,12],[mid,24]].map(([x,y])=>l(mid,15,34,x,y,38,'steel')),
    c(9,21,1,11,4,'blue'),l(9,21,1,11,22,27,'charcoal'),b(11,22,26,13,24,28,'red')],
  'waiting-area-magazine-desk':({b,edge})=>[
    b(5,7,0,edge,24,4,'wood'),b(6,7,5,edge-1,10,20,'wood'),
    ...[6,13].flatMap(h=>[b(6,9,h,edge-1,22,h+1,'wood'),
      b(8,13,h+2,15,19,h+3,'cream'),b(edge-10,12,h+2,edge-3,19,h+3,'blue')])],
  'window-ledge-reading-cushion':({b,edge})=>[
    b(5,6,0,edge,24,6,'wood'),b(6,7,6,edge-1,23,11,'linen'),
    b(7,7,11,13,11,17,'blue'),b(edge-9,8,11,edge-3,12,17,'red'),
    b(7,5,0,edge-2,7,30,'cream'),b(8,7,16,edge-3,7,28,'glass'),
    b(12,7,22,edge-7,8,23,'cream')],
  'luggage-rest-folding':({b,l,edge})=>[
    ...[7,edge-2].flatMap(x=>[l(x,7,0,x,22,16,'darkwood'),l(x,22,0,x,7,16,'darkwood')]),
    ...[8,12,16,20].map(y=>b(6,y,16,edge-1,y+1,17,'linen')),
    b(9,10,18,edge-4,21,29,'blue'),b(11,20,23,edge-6,22,25,'linen'),
    b(14,13,29,edge-8,15,30,'steel')],
  'courtesy-charging-cubby':({b,l,mid,edge})=>[
    b(5,7,0,edge,24,18,'wood'),b(6,24,2,edge-1,24,16,'charcoal'),
    b(5,6,18,edge,25,20,'stone'),b(7,10,20,14,16,21,'graphite'),
    b(mid+1,11,20,edge-4,18,21,'linen'),l(11,15,21,16,22,22,'steel'),
    l(16,22,22,edge-3,22,20,'steel')],
  'fountain-tray-and-vase':({b,c,l,mid,edge})=>[
    b(5,6,0,edge,24,5,'stone'),b(6,7,5,edge-1,23,5,'glass'),
    c(mid,15,5,11,7,'stone'),c(mid,15,11,12,6,'glass'),c(mid,15,12,21,2,'stone'),
    c(mid,15,21,23,4,'stone'),c(mid,15,23,23,3,'glass'),
    c(edge-5,19,6,11,2,'blue'),l(edge-5,19,11,edge-4,18,20,'brass')],
  'reading-privacy-lamp-bench':({b,c,l,edge})=>[
    b(5,7,0,edge,24,7,'wood'),b(5,7,7,edge,10,24,'linen'),
    b(6,9,8,edge-1,22,12,'blue'),b(5,9,10,8,21,16,'linen'),
    b(edge-3,9,10,edge,21,16,'linen'),c(edge-4,9,16,35,1,'brass'),
    l(edge-4,9,34,edge-8,14,32,'brass'),c(edge-8,14,29,32,4,'cream')],
  'tall-plant-book-niche':({b,c,l,mid,edge})=>[
    b(5,6,0,edge,24,4,'wood'),b(5,6,4,7,24,27,'wood'),b(edge-2,6,4,edge,24,27,'wood'),
    b(5,7,26,edge,24,28,'wood'),b(mid,8,7,edge-2,22,8,'wood'),
    b(mid+2,10,8,edge-3,18,11,'red'),b(mid+3,12,11,edge-3,20,13,'cream'),
    c(12,16,5,13,4,'stone'),l(12,16,13,12,16,24,'brass'),b(8,13,21,16,19,24,'linen')],
};
const configuration=[
  ['building-care','cleaning',cleaning,Object.keys(stands)],
  ['catering-service','catering',catering,Object.keys(stands)],
  ['waiting-lounges','lounge',lounge,['countertop-insert','fixed-island','storage-trestle','wall-console']],
];
await Promise.all(configuration.map(([family,category,forms,bases])=>{
  const designs=[];
  for(const [model,build] of Object.entries(forms)){
    for(const [size,w] of [['compact',32],['wide',59]]){
      for(const base of bases){
        if(category==='lounge'&&['luggage-rest-folding','window-ledge-reading-cushion','reading-privacy-lamp-bench'].includes(model)
          &&base==='storage-trestle')continue;
        const {z,ops}=stands[base](w);
        designs.push({schemaVersion:1,id:`${family}-${model}-${size}-${base}`,category,layer:'object',
          outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
          palette:'office-night',materials,ops:[...ops,...build(context(w,z))]});
      }
    }
  }
  return writeFamily(family,designs);
}));
