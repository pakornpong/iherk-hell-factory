import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const s=(x,y,z,X,Y,Z,axis,material)=>({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
const materials={
  steel:{kind:'metal',color:'#a1a9ac'}, slate:{kind:'metal',color:'#606e7b'},
  black:{kind:'matte',color:'#3e484e'}, white:{kind:'matte',color:'#ded6c3'},
  amber:{kind:'matte',color:'#c3a05f'}, red:{kind:'matte',color:'#a96153'},
  blue:{kind:'matte',color:'#657e92'}, wood:{kind:'wood',color:'#a78460'},
  glass:{kind:'glass',color:'#8caab5'},
};
const loads={
  'baggage-trolley':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'blue'),b(5,7,z+3,7,24,z+22,'steel'),
    b(w-8,7,z+3,w-6,24,z+22,'steel'),b(6,7,z+21,w-7,9,z+22,'steel'),
    b(6,22,z+21,w-7,24,z+22,'steel'),b(8,10,z+4,17,22,z+12,'black'),
    b(9,11,z+13,16,16,z+14,'steel'),b(w-17,9,z+4,w-9,22,z+16,'red'),
    b(w-16,11,z+17,w-11,13,z+18,'steel')],
  'passenger-stairway':(w,z)=>[
    b(5,7,z,w-6,24,z+2,'slate'),
    ...Array.from({length:Math.floor((w-11)/6)},(_,i)=>b(6+6*i,8,z+3,11+6*i,23,z+5+i*3,'steel')),
    ...[7,23].flatMap(y=>[
      b(7,y,z+3,8,y+1,z+14,'steel'),b(w-9,y,z+14,w-8,y+1,z+27,'steel'),
      l(7,y,z+14,w-8,y,z+27,'steel')])],
  'belt-bag-loader':(w,z)=>[
    b(5,6,z,w-6,25,z+2,'slate'),s(7,8,z+3,w-8,23,z+21,'+X','black'),
    ...[7,23].map(y=>l(7,y,z+5,w-8,y,z+21,'steel')),
    b(w-14,9,z+2,w-10,12,z+16,'slate'),b(w-14,19,z+2,w-10,22,z+16,'slate'),
    b(8,11,z+5,14,18,z+8,'red')],
  'ground-power-cart':(w,z)=>[
    b(5,6,z,w-6,24,z+18,'white'),b(6,24,z+2,w-7,25,z+16,'steel'),
    ...[6,9,12].map(h=>b(8,25,z+h,w-10,25,z+h,'slate')),
    b(w-17,24,z+12,w-9,25,z+15,'black'),b(w-15,25,z+13,w-10,25,z+14,'glass'),
    l(10,23,z+8,5,26,z+3,'black'),b(4,25,z+2,7,28,z+3,'amber')],
  'aircraft-water-cart':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'slate'),b(8,9,z+4,w-9,22,z+16,'white'),
    b(9,11,z+17,w-10,20,z+19,'white'),c(12,16,z+19,z+21,2,'steel'),
    b(w-15,22,z+6,w-11,23,z+13,'blue'),l(w-14,22,z+8,w-8,26,z+4,'blue'),
    b(8,22,z+12,w-9,22,z+13,'blue')],
  'crew-cabin-transfer':(w,z)=>[
    b(5,6,z,w-6,24,z+16,'white'),b(6,7,z+16,w-7,23,z+18,'white'),
    ...Array.from({length:Math.floor((w-13)/7)},(_,i)=>b(7+i*7,24,z+8,12+i*7,24,z+14,'glass')),
    b(w-13,24,z+2,w-8,24,z+15,'blue'),b(5,7,z+10,5,23,z+14,'glass'),
    b(6,24,z+5,w-7,24,z+6,'blue')],
  'mobile-ramp-light-tower':(w,z)=>[
    b(5,6,z,w-6,24,z+8,'amber'),b(7,7,z+8,19,15,z+12,'slate'),
    c(13,13,z+12,z+40,1,'steel'),b(8,11,z+38,18,15,z+40,'slate'),
    ...[8,16].flatMap(x=>[b(x,12,z+38,x+3,16,z+45,'black'),
      b(x,16,z+39,x+3,16,z+44,'white')]),b(w-15,24,z+3,w-8,25,z+6,'steel')],
  'airfield-pallet-container':(w,z)=>[
    b(5,6,z,w-6,24,z+16,'steel'),s(6,7,z+16,w-7,23,z+22,'+X','steel'),
    b(6,24,z+3,w-7,25,z+13,'white'),b(7,25,z+5,w-8,25,z+6,'blue'),
    b(w-6,9,z+3,w-6,21,z+13,'slate'),b(w-6,14,z+6,w-6,17,z+7,'black')],
};
const chassis={
  'tow-tongue':w=>({z:6,ops:[
    ...[7,w-11].flatMap(x=>[6,22].map(y=>b(x,y,0,x+4,y+3,4,'black'))),
    b(4,6,4,w-5,25,5,'slate'),b(w-6,13,3,w-1,16,4,'amber')]}),
  'low-skid':w=>({z:4,ops:[b(4,6,2,w-5,25,3,'steel'),...([7,23].map(y=>b(5,y,0,w-6,y+1,2,'slate')))]}),
  'service-riser':w=>({z:10,ops:[
    ...[6,w-9].flatMap(x=>[7,22].map(y=>b(x,y,0,x+3,y+2,8,'slate'))),
    b(4,6,8,w-5,25,9,'steel'),l(8,23,2,w-9,23,8,'slate')]}),
  'powered-platform':w=>({z:8,ops:[
    ...[8,w-12].flatMap(x=>[6,22].map(y=>b(x,y,0,x+4,y+4,5,'black'))),
    b(3,5,5,w-4,26,7,'blue'),b(3,7,7,5,23,9,'amber'),b(w-11,8,4,w-7,17,7,'slate')]}),
};
const designs=[];
for(const [application,build] of Object.entries(loads)){
  for(const [size,w] of [['narrow-apron',34],['wide-apron',61]]){
    for(const [carrier,base] of Object.entries(chassis)){
      if(application==='crew-cabin-transfer'&&carrier==='low-skid')continue;
      const {z,ops}=base(w);
      designs.push({schemaVersion:1,id:`airfield-${application}-${size}-${carrier}`,category:'aviation',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('airfield-service',designs);
