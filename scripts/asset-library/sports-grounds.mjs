import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  gray:{kind:'metal',color:'#8d9ba3'}, frame:{kind:'metal',color:'#596772'},
  charcoal:{kind:'matte',color:'#404a51'}, chalk:{kind:'matte',color:'#ddd2bf'},
  court:{kind:'matte',color:'#a67259'}, blue:{kind:'matte',color:'#657d92'},
  turf:{kind:'matte',color:'#718063'}, sand:{kind:'matte',color:'#b79c7b'},
  oak:{kind:'wood',color:'#a57d58'}, rope:{kind:'matte',color:'#b5a28a'},
  amber:{kind:'matte',color:'#c9a468'},
};
const fixtures={
  'court-score-stand':(w,z)=>[
    b(6,7,z,w-7,24,z+3,'frame'),b(7,9,z+3,9,11,z+30,'gray'),
    b(w-10,9,z+3,w-8,11,z+30,'gray'),b(7,8,z+20,w-8,12,z+31,'charcoal'),
    ...[11,w-14].flatMap(x=>[b(x,12,z+22,x+3,12,z+28,'chalk'),b(x+1,12,z+23,x+2,12,z+27,'blue')]),
    b(9,12,z+29,w-10,12,z+30,'amber')],
  'track-hurdle-pair':(w,z)=>[
    ...[9,w-11].flatMap(x=>[b(x,8,z,x+2,23,z+1,'gray'),b(x,9,z+1,x+2,10,z+13,'gray'),
      b(x,22,z+1,x+2,23,z+13,'gray'),b(x,9,z+13,x+2,23,z+14,'chalk'),
      b(x,14,z+13,x+2,16,z+14,'court')])],
  'badminton-post-and-net':(w,z)=>[
    ...[6,w-8].flatMap(x=>[b(x-1,11,z,x+2,19,z+2,'frame'),
      b(x,13,z+2,x+1,14,z+34,'gray')]),
    b(6,13,z+32,w-7,14,z+34,'chalk'),b(6,13,z+17,w-7,13,z+17,'rope'),
    ...Array.from({length:Math.floor((w-10)/4)},(_,i)=>b(7+4*i,13,z+18,7+4*i,13,z+31,'rope')),
    ...[21,25,29].map(h=>b(7,13,z+h,w-8,13,z+h,'rope'))],
  'portable-basket-hoop':(w,z)=>[
    b(6,7,z,24,23,z+3,'charcoal'),b(8,9,z+3,10,11,z+44,'gray'),
    l(9,10,z+38,15,13,z+44,'gray'),b(12,11,z+34,25,13,z+44,'blue'),
    b(13,13,z+35,24,13,z+43,'chalk'),b(17,13,z+34,21,14,z+34,'court'),
    ...[[16,16],[22,16],[19,19]].map(([x,y])=>b(x,y,z+34,x,y,z+35,'court')),
    l(16,16,z+34,19,19,z+34,'court'),l(22,16,z+34,19,19,z+34,'court')],
  'match-ball-bench':(w,z)=>[
    ...[6,w-9].flatMap(x=>[8,21].map(y=>b(x,y,z,x+2,y+2,z+8,'frame'))),
    b(5,7,z+7,w-6,24,z+9,'oak'),
    ...[10,19,w-11].flatMap((x,i)=>[c(x,15,z+10,z+13,3,i%2?'chalk':'court'),
      c(x,15,z+13,z+14,2,i%2?'blue':'amber')])],
  'practice-goal-frame':(w,z)=>[
    b(5,9,z,7,11,z+27,'chalk'),b(w-8,9,z,w-6,11,z+27,'chalk'),
    b(5,9,z+25,w-6,11,z+27,'chalk'),l(6,10,z+25,6,23,z+2,'gray'),
    l(w-7,10,z+25,w-7,23,z+2,'gray'),b(6,22,z+1,w-7,24,z+2,'chalk'),
    ...Array.from({length:Math.floor((w-11)/5)},(_,i)=>l(7+5*i,10,z+24,7+5*i,23,z+2,'rope')),
    ...[6,10,14,18].map(d=>b(6,22-Math.floor(d/2),z+d,w-7,22-Math.floor(d/2),z+d,'rope'))],
  'racket-stringing-cradle':(w,z)=>[
    b(5,7,z,w-6,24,z+4,'frame'),b(7,8,z+4,w-8,23,z+8,'blue'),
    c(14,15,z+9,z+12,5,'gray'),c(14,15,z+12,z+12,4,'charcoal'),
    l(17,17,z+11,w-8,22,z+11,'frame'),b(w-13,10,z+8,w-8,15,z+15,'gray'),
    b(w-12,15,z+11,w-9,17,z+13,'amber')],
  'pool-lifeguard-chair':(w,z)=>[
    ...[7,w-10].flatMap(x=>[l(x,8,z,x,13,z+27,'gray'),l(x,23,z,x,19,z+27,'gray')]),
    b(6,12,z+25,w-7,20,z+27,'chalk'),b(7,12,z+27,w-8,14,z+39,'chalk'),
    ...[5,11,17].map(h=>b(7,22-Math.floor(h/5),z+h,w-8,23-Math.floor(h/5),z+h+1,'gray')),
    b(8,11,z+35,w-9,11,z+37,'court')],
  'sports-hydration-crates':(w,z)=>[
    b(5,7,z,w-6,25,z+4,'oak'),b(5,7,z+4,w-6,9,z+13,'oak'),b(5,23,z+4,w-6,25,z+12,'oak'),
    ...[11,18].flatMap(y=>Array.from({length:Math.floor((w-10)/5)},(_,i)=>[
      c(8+i*5,y,z+5,z+14,2,i%2?'blue':'chalk'),c(8+i*5,y,z+15,z+16,1,'gray')]).flat())],
  'climbing-training-holds':(w,z)=>[
    b(5,7,z,w-6,10,z+40,'oak'),l(5,10,z+35,5,24,z+2,'frame'),
    l(w-6,10,z+35,w-6,24,z+2,'frame'),b(5,8,z,w-6,24,z+3,'charcoal'),
    ...[9,17,26,32].flatMap((h,i)=>[b(8+i%2*5,10,z+h,11+i%2*5,12,z+h+2,'court'),
      b(w-12-i%2*5,10,z+h+2,w-9-i%2*5,12,z+h+4,'amber')])],
  'starter-block-track':(w,z)=>[
    b(5,8,z,w-6,23,z+2,'court'),b(6,10,z+2,w-7,10,z+2,'chalk'),
    b(6,21,z+2,w-7,21,z+2,'chalk'),...([12,19].flatMap(y=>[
      b(8,y,z+3,22,y+1,z+4,'gray'),b(10,y-2,z+4,13,y+2,z+8,'blue'),
      b(16,y-2,z+4,20,y+2,z+8,'blue')]))],
  'coach-cart-and-cones':(w,z)=>[
    b(5,7,z,w-6,25,z+3,'frame'),b(5,7,z+4,w-6,8,z+16,'gray'),
    b(5,23,z+4,w-6,25,z+16,'gray'),b(5,8,z+4,7,23,z+16,'gray'),
    ...[10,18,w-11].flatMap(x=>[c(x,15,z+4,z+6,4,'court'),c(x,15,z+6,z+10,3,'court'),
      c(x,15,z+11,z+14,1,'court')])],
};
const surroundings={
  'gym-timber':w=>({z:3,ops:[b(3,5,0,w-4,26,1,'frame'),
    ...[6,11,16,21].map(y=>b(4,y,2,w-5,y+3,2,'oak'))]}),
  'court-surface':w=>({z:3,ops:[b(3,5,0,w-4,26,2,'court'),b(4,6,2,w-5,7,2,'chalk')]}),
  'sideline-plinth':w=>({z:5,ops:[
    b(3,5,0,w-4,26,3,'frame'),b(4,6,4,w-5,25,4,'sand'),b(5,24,4,w-6,24,4,'amber')]}),
  'synthetic-turf':w=>({z:3,ops:[b(3,5,0,w-4,26,1,'charcoal'),b(4,6,2,w-5,25,2,'turf'),
    ...[9,15,21].map(y=>b(4,y,2,w-5,y,2,'blue'))]}),
  'portable-track-deck':w=>({z:5,ops:[
    b(4,6,0,w-5,25,2,'frame'),b(4,6,3,w-5,25,4,'blue'),b(5,24,4,w-6,25,4,'chalk')]}),
};
function surfaceHardware(piece, surface, w, z) {
  if (surface==='gym-timber') return [];
  const x=w-9;
  const cx=Math.floor(w/2);
  if (piece==='court-score-stand') {
    if (surface==='court-surface') return [b(7,8,z+30,w-8,15,z+34,'gray'),b(10,13,z+31,w-11,15,z+35,'frame')];
    if (surface==='sideline-plinth') return [b(7,10,z+3,w-8,22,z+13,'frame'),b(9,22,z+6,w-10,23,z+10,'chalk')];
    if (surface==='synthetic-turf') return [l(8,10,z+26,8,22,z,'frame'),l(w-9,10,z+26,w-9,22,z,'frame'),
      b(8,8,z+31,w-9,11,z+35,'court')];
    return [c(9,20,z+2,z+12,1,'gray'),c(x,20,z+2,z+12,1,'gray'),
      b(9,20,z+12,x,21,z+13,'gray'),b(cx-3,19,z+13,cx+3,22,z+18,'blue')];
  }
  if (piece==='track-hurdle-pair') {
    if (surface==='court-surface') return [b(9,8,z+7,11,24,z+8,'blue'),b(w-11,8,z+7,w-9,24,z+8,'blue')];
    if (surface==='sideline-plinth') return [b(cx-5,8,z+2,cx+5,22,z+7,'gray'),b(cx-4,21,z+8,cx+4,23,z+10,'amber')];
    if (surface==='synthetic-turf') return [l(9,10,z+3,8,21,z+13,'frame'),l(w-10,10,z+3,w-11,21,z+13,'frame')];
    return [b(9,7,z+13,11,24,z+16,'amber'),b(w-11,7,z+13,w-9,24,z+17,'court')];
  }
  if (piece.includes('net')||piece.includes('goal')) {
    if (surface==='court-surface') return [b(5,10,z+1,8,18,z+6,'blue'),b(x-1,10,z+1,x+2,18,z+6,'blue')];
    if (surface==='sideline-plinth') return [b(cx-6,20,z+1,cx+6,25,z+4,'frame'),
      c(cx-2,22,z+5,z+7,2,'court'),c(cx+3,22,z+5,z+7,2,'chalk')];
    if (surface==='synthetic-turf') return [l(6,10,z+17,6,25,z+1,'rope'),l(w-7,10,z+17,w-7,25,z+1,'rope'),
      b(5,24,z,8,26,z+3,'amber'),b(w-9,24,z,w-6,26,z+3,'amber')];
    return [b(5,23,z+1,w-6,25,z+3,'frame'),b(6,20,z+2,8,23,z+10,'gray'),
      b(w-9,20,z+2,w-7,23,z+10,'gray')];
  }
  if (piece==='pool-lifeguard-chair') {
    if (surface==='court-surface') return [b(7,12,z+39,w-8,13,z+47,'gray'),b(6,10,z+47,w-7,21,z+48,'blue')];
    if (surface==='sideline-plinth') return [c(x,23,z+4,z+6,4,'chalk'),c(x,23,z+6,z+6,2,null)];
    if (surface==='synthetic-turf') return [b(7,11,z+26,8,22,z+31,'gray'),b(w-9,11,z+26,w-8,22,z+31,'gray')];
    return [b(6,14,z+5,7,24,z+16,'gray'),b(w-8,14,z+5,w-7,24,z+16,'gray'),b(6,23,z+15,w-7,24,z+16,'gray')];
  }
  if (surface==='court-surface') return [b(5,8,z+2,7,11,z+11,'blue'),b(5,8,z+10,17,11,z+12,'gray')];
  if (surface==='sideline-plinth') return [b(6,22,z+1,17,25,z+6,'gray'),
    b(7,22,z+6,16,24,z+8,'oak'),c(11,23,z+8,z+11,2,'court')];
  if (surface==='synthetic-turf') return [b(x-1,22,z+1,x+2,24,z+15,'frame'),b(x-5,22,z+13,x+2,25,z+16,'amber')];
  return [b(5,7,z+2,8,24,z+5,'gray'),b(5,7,z+4,6,8,z+18,'frame'),b(5,23,z+4,6,24,z+18,'frame'),
    b(5,8,z+17,6,23,z+18,'gray')];
}
const designs=[];
for(const [piece,build] of Object.entries(fixtures)){
  for(const [size,w] of [['compact',34],['extended',60]]){
    for(const [surface,mount] of Object.entries(surroundings)){
      const {z,ops}=mount(w);
      designs.push({schemaVersion:1,id:`sport-${piece}-${size}-${surface}`,category:'sports',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(w,z),...surfaceHardware(piece,surface,w,z)]});
    }
  }
}
await writeFamily('sports-grounds',designs);
