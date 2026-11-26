import { writeFamily } from './render.mjs';
const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#aa815d'}, walnut:{kind:'wood',color:'#725543'},
  dark:{kind:'matte',color:'#3f4649'}, steel:{kind:'metal',color:'#a0a8a9'},
  copper:{kind:'metal',color:'#b47d5e'}, pale:{kind:'matte',color:'#d7caba'},
  stone:{kind:'matte',color:'#a5a09a'}, glass:{kind:'glass',color:'#91aab4'},
  coffee:{kind:'matte',color:'#675143'}, rust:{kind:'matte',color:'#a76a57'},
  kraft:{kind:'matte',color:'#b89f7a'}, slate:{kind:'matte',color:'#5d7387'},
};
const context=(w,z)=>({
  w,mid:Math.floor(w/2),end:w-6,
  b:(x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m),
  c:(x,y,k,K,r,m)=>C(x,y,z+k,K+z,r,m),
  l:(x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,K+z,m),
});
const fixtures={
  'dual-group-espresso': ({b,c,end})=>[
    b(5,7,0,end,24,4,'steel'),b(6,7,5,end-1,13,22,'dark'),b(5,8,20,end,19,23,'copper'),
    c(11,16,16,20,2,'steel'),c(end-5,16,16,20,2,'steel'),
    b(10,16,15,12,21,16,'dark'),b(end-6,16,15,end-4,21,16,'dark'),
    c(11,17,5,9,2,'pale'),c(end-5,17,5,9,2,'pale'),
    b(7,19,21,end-2,19,22,'steel')],
  'manual-pour-over-rack':({b,c,end})=>[
    b(5,7,0,end,24,3,'oak'),b(6,8,3,7,23,26,'steel'),b(end-1,8,3,end,23,26,'steel'),
    b(6,8,19,end,23,20,'oak'),b(6,8,25,end,23,26,'oak'),
    ...[11,end-5].flatMap(x=>[c(x,15,4,13,3,'glass'),c(x,15,10,12,2,'coffee'),
      c(x,15,20,22,4,'pale'),c(x,15,23,23,5,'pale')])],
  'cold-brew-drip-tower':({b,c,l,end,mid})=>[
    b(5,7,0,end,24,3,'walnut'),b(6,7,3,7,21,37,'oak'),b(end-1,7,3,end,21,37,'oak'),
    b(6,8,15,end,18,17,'oak'),b(6,8,25,end,18,27,'oak'),b(6,8,35,end,18,37,'oak'),
    c(mid,13,28,34,5,'glass'),c(mid,13,23,25,1,'steel'),c(mid,13,17,23,3,'coffee'),
    c(mid,13,4,13,5,'glass'),c(mid,13,5,8,4,'coffee'),l(mid,13,14,mid,13,17,'glass')],
  'bulk-bean-grinders':({b,c,end})=>[
    b(5,7,0,end,24,4,'steel'),
    ...[10,end-5].flatMap((x,i)=>[b(x-3,9,5,x+3,18,15,i?'slate':'dark'),
      c(x,12,16,19,2,'steel'),c(x,12,20,25,4,'glass'),c(x,12,21,23,3,'coffee'),
      b(x-1,18,9,x+1,20,11,'copper'),c(x,21,5,7,2,'pale')])],
  'small-batch-bean-roaster':({b,c,l,end})=>[
    b(5,7,0,end,25,3,'steel'),b(7,8,4,end-2,19,18,'dark'),
    b(8,9,18,end-3,18,20,'copper'),b(9,19,8,end-4,20,16,'copper'),
    c(13,23,4,7,4,'steel'),c(13,23,7,7,3,'coffee'),c(end-6,12,20,27,3,'steel'),
    l(end-6,12,26,end-3,11,29,'steel'),b(end-9,20,12,end-5,20,13,'pale')],
  'tea-urn-and-caddies':({b,c,end})=>[
    b(5,7,0,end,25,3,'oak'),c(12,14,4,22,5,'steel'),c(12,14,23,24,4,'steel'),
    c(12,14,25,26,1,'copper'),b(11,18,11,13,22,12,'dark'),c(12,22,4,7,2,'pale'),
    ...[10,19].map(y=>c(end-4,y,4,12,3,'pale')),b(end-6,9,8,end-2,10,9,'kraft')],
  'pastry-dome-display':({b,c,end})=>[
    b(5,7,0,end,24,3,'oak'),...([10,end-5].flatMap((x,i)=>[
      c(x,15,4,5,4,'copper'),c(x,15,6,9,3,i?'kraft':'rust'),
      c(x,15,6,12,4,'glass'),c(x,15,13,14,3,'glass'),c(x,15,15,16,1,'copper')]))],
  'cash-and-ticket-counter':({b,c,end,mid})=>[
    b(5,6,0,end,24,3,'oak'),b(7,8,4,mid+2,19,9,'dark'),
    b(8,10,9,mid+1,12,18,'steel'),b(9,12,12,mid,12,16,'glass'),
    b(mid+4,11,4,end-1,20,10,'pale'),b(mid+5,20,6,end-2,21,7,'dark'),
    b(mid+6,21,6,end-3,25,6,'pale'),c(end-4,9,4,5,2,'copper')],
  'cup-lid-condiment-rail':({b,c,end})=>[
    b(5,7,0,end,24,4,'oak'),b(5,7,5,end,10,16,'walnut'),
    ...[11,end-5].flatMap((x,i)=>[c(x,14,5,13,3,'pale'),c(x,14,8,8,4,i?'slate':'kraft'),
      c(x,20,5,9,2,i?'glass':'pale')])],
  'syrup-pump-flight':({b,c,end})=>[
    b(5,7,0,end,24,3,'oak'),b(5,8,4,end,12,8,'walnut'),
    ...Array.from({length:Math.floor((end-6)/5)},(_,i)=>{
      const x=8+5*i,y=i%2?11:18;
      return [c(x,y,4+i%2*4,14+i%2*4,2,'glass'),c(x,y,9+i%2*4,12+i%2*4,1,i%2?'rust':'coffee'),
        c(x,y,15+i%2*4,18+i%2*4,1,'steel'),b(x,y,18+i%2*4,x+1,y+3,18+i%2*4,'steel')];
    }).flat()],
};
const stations={
  'compact-inset':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'dark'),B(5,7,1,w-6,24,2,'steel')]}),
  'fluted-front-bar':w=>({z:16,ops:[
    B(4,6,0,w-5,25,2,'walnut'),B(5,7,3,w-6,23,15,'oak'),
    ...Array.from({length:Math.floor((w-9)/3)},(_,i)=>B(6+3*i,24,3,6+3*i,25,14,'walnut')),
    B(4,6,15,w-5,25,15,'stone')]}),
  'wheeled-pop-up':w=>({z:10,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+3,3,'dark'))),
    B(4,6,4,w-5,25,9,'steel'),B(5,24,5,w-6,25,8,'slate'),B(w-7,8,8,w-5,23,11,'walnut')]}),
  'arched-cafe-counter':w=>({z:14,ops:[
    B(4,5,11,w-5,26,13,'oak'),B(5,6,0,8,23,12,'walnut'),B(w-9,6,0,w-6,23,12,'walnut'),
    C(10,15,0,6,5,'walnut'),C(w-11,15,0,6,5,'walnut')]}),
  'backbar-shelf':w=>({z:12,ops:[
    B(4,6,0,w-5,9,31,'walnut'),B(4,8,10,w-5,25,11,'oak'),
    B(4,8,27,w-5,16,28,'oak'),B(7,11,29,13,14,32,'kraft'),B(w-14,11,29,w-8,14,32,'pale')]}),
};
const designs=[];
for(const [job,build] of Object.entries(fixtures)){
  for(const [size,w] of [['single',32],['double',60]]){
    for(const [counter,support] of Object.entries(stations)){
      if(job==='cold-brew-drip-tower'&&counter==='backbar-shelf')continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`cafe-${job}-${size}-${counter}`,category:'coffee-service',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(context(w,z))]});
    }
  }
}
await writeFamily('coffee-bars',designs);
