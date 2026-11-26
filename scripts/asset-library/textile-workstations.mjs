import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  walnut:{kind:'wood',color:'#745741'}, oak:{kind:'wood',color:'#aa805a'},
  steel:{kind:'metal',color:'#a0aaaa'}, iron:{kind:'metal',color:'#53606b'},
  cream:{kind:'matte',color:'#d8d0bd'}, linen:{kind:'matte',color:'#aa9a86'},
  blue:{kind:'matte',color:'#687e91'}, terracotta:{kind:'matte',color:'#a96557'},
  dark:{kind:'matte',color:'#404850'}, brass:{kind:'metal',color:'#bc9d65'},
  pale:{kind:'glass',color:'#9ab1b8'},
};
const machines={
  'embroidery-hoop-computer':(w,z)=>[
    b(5,6,z,w-6,24,z+4,'iron'),b(7,8,z+5,w-8,12,z+16,'cream'),
    b(8,11,z+14,w-9,18,z+18,'cream'),b(9,15,z+12,14,18,z+15,'steel'),
    c(15,17,z+5,z+6,6,'brass'),c(15,17,z+6,z+6,5,'linen'),
    c(w-11,11,z+19,z+22,2,'blue'),b(w-13,16,z+13,w-8,19,z+17,'pale')],
  'pattern-cutting-mat':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'oak'),b(7,8,z+3,w-8,23,z+3,'blue'),
    ...[9,13,17,21].map(y=>b(8,y,z+3,w-9,y,z+3,'cream')),
    b(9,10,z+4,19,21,z+4,'linen'),l(10,10,z+4,18,20,z+4,'terracotta'),
    c(w-13,14,z+4,z+5,2,'steel'),l(w-13,14,z+5,w-9,18,z+5,'brass')],
  'dressform-pin-fitting':(w,z)=>[
    c(12,14,z,z+2,6,'iron'),c(12,14,z+2,z+16,1,'steel'),c(12,14,z+15,z+19,5,'linen'),
    c(12,14,z+20,z+23,4,'linen'),c(12,14,z+24,z+29,5,'linen'),c(12,14,z+30,z+33,2,'linen'),
    b(w-14,9,z,w-7,22,z+6,'oak'),b(w-13,12,z+6,w-9,21,z+9,'blue'),
    l(15,15,z+25,19,17,z+20,'brass')],
  'narrow-ribbon-loom':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'oak'),b(6,8,z+4,8,22,z+26,'walnut'),b(w-9,8,z+4,w-7,22,z+26,'walnut'),
    b(8,9,z+24,w-8,12,z+26,'oak'),b(8,19,z+17,w-8,22,z+20,'oak'),
    ...Array.from({length:Math.floor((w-15)/3)},(_,i)=>l(8+i*3,10,z+24,8+i*3,19,z+20,i%2?'terracotta':'cream')),
    b(13,15,z+21,22,17,z+22,'blue')],
  'serger-thread-tree':(w,z)=>[
    b(5,7,z,w-6,25,z+3,'oak'),b(6,9,z+4,21,23,z+8,'cream'),
    b(15,9,z+8,22,16,z+18,'cream'),b(9,10,z+16,19,15,z+19,'cream'),
    b(10,12,z+11,11,14,z+16,'steel'),b(5,12,z+4,14,19,z+5,'linen'),
    b(21,7,z+4,22,8,z+29,'steel'),b(11,7,z+28,23,8,z+29,'steel'),
    ...[12,17,22].map((x,i)=>c(x,9,z+19,z+23,1,['blue','linen','terracotta'][i]))],
  'buttonholer-jig':(w,z)=>[
    b(5,7,z,w-6,24,z+5,'iron'),b(7,8,z+6,w-8,12,z+17,'cream'),
    b(9,13,z+12,w-9,16,z+17,'cream'),b(11,17,z+5,w-10,21,z+6,'steel'),
    l(12,14,z+10,12,18,z+8,'steel'),b(14,17,z+7,20,21,z+7,'linen'),
    b(w-12,10,z+17,w-9,15,z+20,'blue')],
  'fabric-bolt-dispenser':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'oak'),b(6,8,z+3,8,21,z+29,'iron'),b(w-9,8,z+3,w-7,21,z+29,'iron'),
    ...[9,17,25].flatMap((h,i)=>[b(7,13,z+h,w-8,14,z+h+1,'steel'),
      b(8,11,z+h-2,w-9,16,z+h+2,['linen','blue','terracotta'][i])]),
    b(9,16,z+7,w-10,20,z+8,'linen')],
  'quilt-press-frame':(w,z)=>[
    b(5,7,z,w-6,24,z+3,'oak'),b(6,8,z+4,8,23,z+22,'iron'),b(w-9,8,z+4,w-7,23,z+22,'iron'),
    b(7,8,z+20,w-8,23,z+22,'steel'),b(9,10,z+13,w-10,21,z+16,'cream'),
    c(Math.floor(w/2),14,z+16,z+25,1,'steel'),
    ...Array.from({length:Math.floor((w-16)/4)},(_,i)=>
      b(8+i*4,10,z+4,11+i*4,19,z+5,i%2?'terracotta':'linen'))],
  'hemming-steam-board':(w,z)=>[
    b(5,8,z,w-6,23,z+3,'steel'),b(7,9,z+4,w-8,22,z+6,'linen'),
    b(9,10,z+7,21,17,z+7,'blue'),b(w-17,12,z+7,w-10,19,z+10,'cream'),
    b(w-15,14,z+10,w-11,15,z+13,'dark'),b(w-12,8,z+4,w-8,10,z+18,'iron'),
    l(w-10,9,z+18,w-13,14,z+13,'dark')],
};
const tables={
  'portable-case':w=>({z:4,ops:[b(4,6,0,w-5,25,3,'dark'),b(5,25,0,w-6,25,3,'steel'),
    b(9,25,2,13,26,3,'brass')]}),
  'oak-cutting-table':w=>({z:14,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,13,'walnut'))),b(4,6,12,w-5,25,13,'oak'),
    b(5,8,5,w-6,23,6,'oak')]}),
  'machine-frame':w=>({z:15,ops:[
    ...[5,w-8].map(x=>b(x,7,0,x+2,24,1,'iron')),b(5,9,1,7,11,14,'iron'),
    b(w-8,20,1,w-6,22,14,'iron'),b(4,6,13,w-5,25,14,'steel'),b(10,21,0,18,25,1,'dark')]}),
  'sewing-floor-cabinet':w=>({z:11,ops:[
    b(4,6,0,w-5,25,2,'dark'),b(5,7,3,w-6,24,10,'oak'),b(4,6,10,w-5,25,10,'walnut'),
    b(7,24,4,w-8,25,8,'linen'),b(11,25,7,w-12,26,7,'brass')]}),
  'factory-caster':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,3,'dark'))),
    b(4,6,4,w-5,25,7,'iron'),b(4,5,7,w-5,7,8,'steel')]}),
};
const designs=[];
for(const [machine,build] of Object.entries(machines)){
  for(const [size,w] of [['atelier',32],['wide',60]]){
    for(const [fixture,support] of Object.entries(tables)){
      if(machine==='dressform-pin-fitting'&&['portable-case','oak-cutting-table'].includes(fixture))continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`textile-${machine}-${size}-${fixture}`,category:'textile',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('textile-workstations',designs);
