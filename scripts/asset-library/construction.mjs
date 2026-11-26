import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  steel:{kind:'metal',color:'#a0aaab'}, iron:{kind:'metal',color:'#56616b'},
  rubber:{kind:'matte',color:'#3d444b'}, amber:{kind:'matte',color:'#c79e56'},
  safety:{kind:'matte',color:'#ad6e4b'}, slate:{kind:'matte',color:'#637787'},
  brick:{kind:'matte',color:'#a16a59'}, sand:{kind:'matte',color:'#b8a385'},
  timber:{kind:'wood',color:'#a4805e'}, concrete:{kind:'matte',color:'#a39f97'},
  cream:{kind:'matte',color:'#d9d1be'}, glass:{kind:'glass',color:'#8ba9b4'},
};
function ops(z){
  return [
    (x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m),
    (x,y,k,K,r,m)=>C(x,y,z+k,z+K,r,m),
    (x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,z+K,m),
  ];
}
const machines={
  'mortar-drum-mixer':(w,b,c,l)=>[
    b(6,8,0,24,24,4,'iron'),b(8,11,4,10,13,16,'iron'),
    b(21,11,4,23,13,17,'iron'),b(9,9,12,22,22,17,'amber'),
    b(11,10,17,20,21,23,'amber'),b(12,11,23,19,20,25,'iron'),
    b(10,22,13,21,25,16,'safety'),c(6,15,10,12,3,'steel')],
  'electric-slab-compactor':(w,b,c,l)=>[
    b(6,6,0,26,24,2,'iron'),b(8,8,3,24,22,5,'amber'),b(11,9,6,22,20,12,'iron'),
    c(17,14,12,14,3,'steel'),l(10,13,9,7,24,28,'steel'),l(12,13,9,9,24,28,'steel'),
    b(7,24,27,16,26,29,'rubber')],
  'scissor-service-lift':(w,b,c,l)=>[
    b(5,7,0,w-6,24,4,'amber'),...([8,22].flatMap(y=>[
      l(7,y,4,w-8,y,26,'steel'),l(w-8,y,4,7,y,26,'steel')])),
    b(5,6,25,w-6,25,27,'iron'),
    ...[6,w-8].flatMap(x=>[7,23].map(y=>b(x,y,28,x+1,y+1,40,'amber'))),
    b(6,7,39,w-7,8,40,'amber'),b(6,23,39,w-7,24,40,'amber')],
  'masonry-block-cut-saw':(w,b,c,l)=>[
    b(5,6,0,w-6,25,4,'steel'),b(6,8,5,w-7,23,6,'iron'),
    b(8,10,7,20,21,10,'brick'),b(w-15,9,6,w-12,13,24,'iron'),
    b(w-24,11,21,w-12,14,24,'amber'),b(w-23,11,13,w-17,14,22,'steel'),
    b(w-23,10,18,w-17,15,22,'amber'),l(w-15,20,22,w-7,23,25,'rubber')],
  'bricklayers-material-hoist':(w,b,c,l)=>[
    b(6,8,0,23,23,3,'iron'),b(8,9,3,10,12,46,'amber'),
    b(20,9,3,22,12,46,'amber'),b(8,10,45,22,12,46,'amber'),
    ...[9,18,27,36].map(h=>l(9,10,h,20,10,h+8,'steel')),
    b(9,12,13,21,23,15,'iron'),b(11,14,16,19,21,20,'brick')],
  'portable-dust-extractor':(w,b,c,l)=>[
    c(15,15,0,3,9,'rubber'),c(15,15,4,20,8,'steel'),c(15,15,21,25,7,'slate'),
    b(19,15,12,24,17,16,'iron'),l(23,16,15,26,22,11,'rubber'),
    l(26,22,11,27,26,4,'rubber'),b(23,25,3,28,27,4,'iron')],
  'rebar-thread-table':(w,b,c,l)=>[
    b(4,6,0,w-5,24,4,'iron'),b(8,8,5,21,22,17,'amber'),b(21,11,8,w-8,16,14,'steel'),
    b(20,10,7,23,17,15,'iron'),b(w-12,10,5,w-8,17,10,'iron'),
    l(9,19,6,w-10,19,6,'steel'),b(10,11,17,13,13,18,'safety')],
  'survey-level-on-frame':(w,b,c,l)=>[
    ...[[6,24],[24,24],[15,5]].map(([x,y])=>l(15,15,23,x,y,0,'steel')),
    c(15,15,22,26,4,'iron'),b(9,11,27,21,19,35,'amber'),
    b(10,19,29,20,22,33,'iron'),b(12,22,30,18,22,32,'glass')],
  'grout-hopper-pump':(w,b,c,l)=>[
    b(5,6,0,w-6,25,4,'iron'),b(7,8,4,24,22,9,'amber'),c(15,15,9,13,5,'steel'),
    c(15,15,14,18,8,'steel'),c(15,15,18,18,6,'concrete'),
    b(20,14,6,w-8,16,9,'iron'),l(w-8,16,7,w-7,22,4,'rubber')],
  'tile-cut-rail-table':(w,b,c,l)=>[
    b(4,6,0,w-5,24,4,'iron'),b(6,7,5,w-7,23,6,'steel'),
    b(8,9,6,20,21,7,'cream'),b(w-14,9,6,w-8,21,7,'cream'),
    b(7,12,9,w-8,13,10,'steel'),b(7,16,9,w-8,17,10,'steel'),
    b(13,11,10,18,17,12,'safety'),l(16,13,12,18,17,19,'iron')],
};
const mounts={
  'equipment-skid':w=>({z:4,ops:[
    ...[7,22].map(y=>B(4,y,0,w-5,y+2,2,'timber')),B(4,6,2,w-5,25,3,'timber')]}),
  'tracked-carrier':w=>({z:8,ops:[
    B(4,5,0,w-5,9,6,'rubber'),B(4,22,0,w-5,26,6,'rubber'),
    B(6,6,6,w-7,25,7,'iron'),
    ...Array.from({length:Math.floor((w-8)/4)},(_,i)=>[5,26].map(y=>B(6+4*i,y,1,7+4*i,y,5,'steel'))).flat()]}),
  'jobsite-trailer':w=>({z:7,ops:[
    ...[8,w-11].flatMap(x=>[6,22].map(y=>B(x,y,0,x+4,y+3,4,'rubber'))),
    B(4,6,4,w-5,25,6,'steel'),B(w-6,13,3,w-1,16,4,'amber')]}),
  'rubber-pad-footing':w=>({z:3,ops:[
    ...[6,w-9].flatMap(x=>[7,23].map(y=>B(x,y,0,x+3,y+2,1,'rubber'))),
    B(4,6,2,w-5,25,2,'iron')]}),
};
function extension(machine, w, z) {
  if (w < 60) return [];
  const [b,c,l] = ops(z);
  switch(machine) {
    case 'mortar-drum-mixer':
      return [b(30,7,0,55,22,3,'iron'),b(32,8,3,46,22,7,'concrete'),
        b(33,9,7,45,21,7,'sand'),b(49,10,3,53,20,13,'steel'),l(48,11,6,56,19,14,'timber')];
    case 'electric-slab-compactor':
      return [b(32,9,0,54,24,4,'slate'),b(34,10,4,52,23,7,'concrete'),
        b(37,11,7,51,20,8,'sand'),b(52,9,4,55,22,10,'steel')];
    case 'bricklayers-material-hoist':
      return [b(28,7,0,54,24,4,'timber'),...([31,38,45].flatMap(x=>[
        b(x,9,4,x+5,14,7,'brick'),b(x,16,4,x+5,22,7,'brick')])),
        b(28,8,4,29,23,19,'iron'),l(28,21,18,52,21,18,'iron')];
    case 'portable-dust-extractor':
      return [b(32,7,0,54,22,8,'slate'),c(43,14,8,12,7,'rubber'),
        c(43,14,12,12,4,'steel'),l(28,25,4,38,20,9,'rubber'),b(52,9,8,54,19,13,'steel')];
    case 'survey-level-on-frame':
      return [b(32,8,0,54,22,8,'amber'),b(31,7,8,55,23,10,'iron'),
        b(36,9,10,51,13,11,'cream'),b(35,22,3,40,24,5,'steel')];
    case 'grout-hopper-pump':
      return [b(31,7,0,53,23,3,'iron'),c(44,15,3,12,7,'rubber'),
        c(44,15,12,13,4,'steel'),l(40,18,8,52,22,3,'rubber')];
    default:
      return [];
  }
}
const designs=[];
for(const [machine,build] of Object.entries(machines)){
  for(const [size,w] of [['compact',34],['extended',60]]){
    for(const [mount,makeMount] of Object.entries(mounts)){
      if(['portable-dust-extractor','survey-level-on-frame'].includes(machine)&&mount==='tracked-carrier')continue;
      const {z,ops:foundation}=makeMount(w);
      designs.push({schemaVersion:1,id:`site-${machine}-${size}-${mount}`,category:'construction',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...foundation,...build(w,...ops(z)),...extension(machine,w,z)]});
    }
  }
}
await writeFamily('construction',designs);
