import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, round as C, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#a9805a','wood'],walnut:['#745746','wood'],steel:['#9ca9ab','metal'],
  frame:['#576570','metal'],ivory:['#dbd3bf'],marble:['#b7afa5'],linen:['#b1a18b'],
  red:['#a16458'],blue:['#657e92'],amber:['#b29970'],dark:['#414b53'],glass:['#90acb8','glass'],
});
const tops={
  'split-leaf':({b,l,e,m})=>[
    b(4,5,0,e+1,26,3,'oak'),b(m-1,5,3,m+1,26,3,'walnut'),
    b(5,5,0,13,26,3,'walnut'),b(e-9,5,0,e,26,3,'walnut'),
    l(12,7,4,13,22,4,'steel'),l(e-9,7,4,e-8,22,4,'steel')],
  'stone-oval':({b,c,e})=>[
    b(13,4,0,e-7,27,3,'marble'),c(13,15,0,3,11,'marble'),c(e-7,15,0,3,11,'marble'),
    b(13,7,3,e-7,9,3,'ivory'),b(11,18,3,e-5,19,3,'ivory')],
  'glass-frame':({b,e})=>[
    b(4,5,0,e+1,26,2,'glass'),b(4,5,2,e+1,6,3,'steel'),
    b(4,25,2,e+1,26,3,'steel'),b(4,7,2,5,24,3,'steel'),b(e,7,2,e+1,24,3,'steel')],
  'herringbone-wood':({b,l,e})=>[
    b(4,5,0,e+1,26,3,'walnut'),b(5,6,3,e,25,3,'oak'),
    ...across(Math.floor((e-7)/4),i=>[l(7+i*4,7,3,9+i*4,15,3,'walnut'),
      l(7+i*4,24,3,9+i*4,15,3,'walnut')])],
  'corner-breakfast':({b,e})=>[
    b(4,5,0,e+1,22,3,'ivory'),b(4,23,0,17,27,3,'ivory'),
    b(5,6,3,e,7,3,'linen'),b(5,21,3,e,22,3,'linen')],
  'tile-inlay':({b,e})=>[
    b(4,8,0,e+1,23,3,'oak'),b(7,5,0,e-2,26,3,'oak'),
    b(7,5,4,e-2,6,4,'marble'),b(7,25,4,e-2,26,4,'marble'),
    ...across(Math.floor((e-7)/4),i=>
      [8,12,16,20].map((y,j)=>b(7+4*i,y,3,9+4*i,y+2,3,(i+j)%2?'marble':'ivory')))],
};
const frames={
  'tapered-legs':w=>({z:17,ops:[7,w-10].flatMap(x=>[8,22].flatMap(y=>[
    L(x+(x<15?-2:2),y+(y<15?-2:2),0,x,y,16,'walnut'),B(x,y,14,x+2,y+2,16,'oak')]))}),
  'central-trumpet':w=>({z:17,ops:[
    C(Math.floor(w/2),15,0,2,11,'steel'),C(Math.floor(w/2),15,3,12,3,'steel'),
    C(Math.floor(w/2),15,13,16,5,'frame'),B(8,13,15,w-9,17,16,'frame')]}),
  'cross-trestle':w=>({z:18,ops:[7,w-10].flatMap(x=>[
    L(x,8,0,x,23,17,'oak'),L(x,23,0,x,8,17,'oak'),
    B(x-1,8,0,x+2,23,1,'walnut')]).concat(B(8,14,7,w-9,17,9,'walnut'))}),
  'wall-banquette':w=>({z:16,ops:[
    B(5,5,0,w-6,9,16,'walnut'),B(4,5,0,w-5,7,29,'linen'),B(5,7,4,w-6,13,8,'linen'),
    L(7,9,6,7,20,15,'frame'),L(w-8,9,6,w-8,20,15,'frame')]}),
};
const settings={
  'bistro-two':({b,c,e})=>[
    ...[10,e-5].flatMap(x=>[c(x,15,4,4,3,'ivory'),c(x,15,4,4,2,'linen'),
      c(x,19,4,6,1,'glass')]),b(13,10,4,e-8,11,4,'red')],
  'tea-and-tart':({b,c,e,m})=>[
    c(m,14,4,9,4,'ivory'),c(m,14,10,11,1,'steel'),
    ...[10,e-5].flatMap(x=>[c(x,17,4,4,3,'ivory'),c(x,17,5,7,2,'ivory')]),
    c(m,21,4,5,3,'amber'),b(m-1,20,5,m+1,22,5,'red')],
  'family-supper':({b,c,e,m})=>[
    ...[[10,11],[10,21],[e-5,11],[e-5,21]].map(([x,y])=>c(x,y,4,4,2,'ivory')),
    c(m,15,4,7,4,'blue'),c(m,15,7,7,3,'amber'),b(m-3,8,4,m+3,9,4,'linen')],
  'counter-service':({b,c,e,m})=>[
    b(8,9,4,16,20,5,'steel'),b(9,10,6,15,19,6,'ivory'),
    b(e-9,10,4,e-3,17,7,'ivory'),b(e-8,12,7,e-4,15,8,'linen'),c(m,22,4,6,2,'glass')],
  'market-breakfast':({b,c,e,m})=>[
    b(7,9,4,17,21,5,'walnut'),...([10,14].map(x=>c(x,14,5,7,2,'amber'))),
    c(e-6,17,4,8,2,'glass'),b(e-9,9,4,e-3,14,6,'linen'),c(m,21,4,5,2,'red')],
};
function seatLayout(service,w) {
  const mid=Math.floor(w/2);
  const side=w-10;
  const chair=(x,back,top)=>[
    ...[x-3,x+3].flatMap(k=>[34,41].map(y=>B(k,y,0,k+1,y+1,8,'walnut'))),
    B(x-4,33,8,x+4,43,10,top),B(x-4,41,10,x+4,43,back,top),
  ];
  switch(service){
    case 'bistro-two':
      return [...chair(mid-5,19,'oak'),...chair(mid+6,19,'oak'),
        B(mid-9,41,17,mid-1,42,18,'walnut'),B(mid+2,41,17,mid+10,42,18,'walnut')];
    case 'tea-and-tart':
      return [...chair(mid,15,'linen'),B(mid-5,40,10,mid-3,43,15,'linen'),
        B(mid+3,40,10,mid+5,43,15,'linen'),
        C(side,48,0,2,4,'steel'),C(side,48,3,11,1,'steel'),C(side,48,12,12,5,'marble')];
    case 'family-supper':
      return [B(7,34,0,10,42,7,'walnut'),B(w-11,34,0,w-8,42,7,'walnut'),
        B(5,33,7,w-6,43,10,'oak'),B(6,41,10,w-7,43,17,'oak')];
    case 'counter-service':
      return [C(mid-6,40,0,2,5,'steel'),C(mid-6,40,3,13,1,'frame'),C(mid-6,40,14,16,4,'red'),
        C(mid+7,40,0,2,5,'steel'),C(mid+7,40,3,13,1,'frame'),C(mid+7,40,14,16,4,'red')];
    case 'market-breakfast':
      return [B(6,34,0,15,44,10,'walnut'),B(6,34,10,15,44,12,'linen'),
        B(w-17,34,0,w-7,44,10,'oak'),B(w-16,35,10,w-8,43,12,'blue')];
  }
  throw new Error(service);
}
const designs=[];
for(const [style,surface] of Object.entries(tops))for(const [width,w] of [['nook',34],['dining-room',62]]){
  for(const [frame,support] of Object.entries(frames))for(const [service,setting] of Object.entries(settings)){
    if((frame==='wall-banquette'&&style==='stone-oval')||(style==='corner-breakfast'&&service==='family-supper'&&width==='nook'))continue;
    const {z,ops}=support(w);
    const a=partAt(w,z);
    const design=asset(`dining-${style}-${width}-${frame}-${service}`,'dining',w,materials,
      [...ops,...surface(a),...setting(a),...seatLayout(service,w)]);
    design.footprintTiles[1]=2;
    designs.push(design);
  }
}
await writeFamily('dining-sets',designs);
