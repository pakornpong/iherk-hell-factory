import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#a8825e'}, walnut:{kind:'wood',color:'#785b47'},
  black:{kind:'matte',color:'#3b424a'}, gray:{kind:'metal',color:'#88949a'},
  steel:{kind:'metal',color:'#a6adad'}, yellow:{kind:'metal',color:'#c1a164'},
  copper:{kind:'metal',color:'#a87b60'}, ivory:{kind:'matte',color:'#dcd3be'},
  leather:{kind:'matte',color:'#8c6f5d'}, blue:{kind:'matte',color:'#657a8e'},
  red:{kind:'matte',color:'#a36153'},
};
function coord(w,z){
  return {
    w,end:w-5,mid:Math.floor(w/2),
    b:(x,y,k,X,Y,K,m)=>B(x,y,z+k,X,Y,z+K,m),
    c:(x,y,k,K,r,m)=>C(x,y,z+k,z+K,r,m),
    l:(x,y,k,X,Y,K,m)=>L(x,y,z+k,X,Y,z+K,m),
  };
}
const fixtures={
  'guitar-display':({b,l,end})=>[10,end-6].flatMap((x,i)=>[
    b(x-3,12,1,x+3,16,13,i?'walnut':'oak'),b(x-5,12,1,x+5,16,7,i?'walnut':'oak'),
    b(x-1,13,11,x+1,15,28,'walnut'),b(x-2,13,27,x+2,15,32,'black'),
    l(x,16,6,x,16,29,'steel'),b(x-7,10,0,x-6,21,7,'black'),b(x+6,10,0,x+7,21,7,'black')]),
  'upright-string-bass':({b,l,mid})=>[
    b(mid-6,10,2,mid+6,18,23,'walnut'),b(mid-9,11,4,mid+9,17,15,'walnut'),
    b(mid-5,10,19,mid+5,18,28,'oak'),b(mid-1,12,25,mid+1,15,44,'walnut'),
    b(mid-2,12,43,mid+2,15,46,'black'),l(mid,18,11,mid,16,44,'steel'),
    b(mid-4,16,10,mid+4,18,12,'black'),b(mid,13,0,mid+1,14,4,'steel')],
  'violin-and-bow-case':({b,l,mid,end})=>[
    b(5,7,0,end,24,3,'black'),b(6,7,3,end-1,10,18,'blue'),
    b(7,10,4,end-2,23,5,'leather'),b(9,12,6,mid+1,20,8,'oak'),
    b(mid,14,6,end-6,17,8,'walnut'),l(11,15,8,end-6,16,8,'steel'),
    l(9,11,9,end-3,12,9,'walnut')],
  'compact-drum-kit':({b,c,end})=>[
    c(14,15,0,13,8,'red'),c(14,15,13,14,8,'ivory'),
    c(end-6,18,8,17,5,'red'),c(end-6,18,17,18,5,'ivory'),
    c(end-6,18,0,8,1,'steel'),c(9,9,0,26,1,'steel'),c(9,9,26,27,5,'yellow'),
    c(end-4,9,0,30,1,'steel'),c(end-4,9,30,31,4,'yellow')],
  'frame-drum-and-shakers':({b,c,end})=>[
    b(5,8,0,end,24,4,'oak'),c(13,16,5,8,7,'walnut'),c(13,16,8,9,6,'ivory'),
    ...[12,20].map(y=>b(end-8,y,5,end-1,y+2,8,'leather')),c(end-5,15,5,11,2,'red')],
  'mallet-percussion-rack':({b,l,end})=>[
    b(5,8,0,end,10,15,'black'),b(5,22,0,end,24,15,'black'),
    ...Array.from({length:Math.floor((end-6)/4)},(_,i)=>[
      b(6+i*4,10+i%2,14,8+i*4,22-i%2,16,i%2?'oak':'walnut'),
      b(6+i*4,14,4,7+i*4,16,13,'steel')]).flat(),
    l(8,10,17,18,19,17,'gray'),b(17,18,17,19,20,18,'black')],
  'harp-practice-frame':({b,c,l,end})=>[
    b(6,8,0,end,24,4,'walnut'),b(8,9,4,10,13,43,'oak'),
    l(9,13,42,end-3,13,29,'oak'),l(9,13,5,end-3,13,29,'oak'),
    ...Array.from({length:Math.floor((end-11)/3)},(_,i)=>{
      const x=11+i*3;
      const span=end-12;
      return l(x,13,6+Math.round(22*(x-9)/span),x,13,41-Math.round(12*(x-9)/span),'yellow');
    }),c(10,12,42,44,2,'yellow')],
  'low-brass-corner':({b,c,l,mid})=>[
    b(6,7,0,25,24,3,'walnut'),l(10,16,3,10,16,28,'yellow'),
    l(10,16,28,21,17,28,'yellow'),l(21,17,28,21,17,14,'yellow'),
    l(21,17,14,mid,17,11,'yellow'),l(mid,17,11,mid,18,23,'yellow'),
    c(10,16,28,32,4,'yellow'),c(10,16,32,32,3,'copper'),
    b(mid-3,17,19,mid+3,19,22,'gray')],
  'woodwind-service-stand':({b,c,l,end})=>[
    b(5,7,0,end,24,3,'oak'),...([10,end-5].flatMap((x,i)=>[
      c(x,15,3,8,1,'steel'),l(x,15,5,x,16,27-i*5,'walnut'),
      b(x-1,15,8,x+1,17,20-i*4,i?'yellow':'black'),
      ...[9,13,17].map(h=>b(x,17,h,x+1,18,h,'steel'))]))],
  'music-copyists-stand':({b,c,l,end,mid})=>[
    ...[[6,23],[end-1,23],[mid,7]].map(([x,y])=>l(mid,15,12,x,y,0,'steel')),
    c(mid,15,11,31,1,'steel'),b(6,11,19,end,14,31,'black'),
    b(8,14,20,end-2,14,30,'ivory'),...([22,25,27].map(z=>b(10,14,z,end-4,14,z,'gray'))),
    b(7,14,18,end-1,16,19,'black')],
  'accordion-open-case':({b,c,end,mid})=>[
    b(5,7,0,end,24,3,'black'),b(6,8,3,end-1,11,17,'blue'),
    b(8,12,4,end-3,22,12,'red'),b(8,12,12,12,22,13,'ivory'),
    ...[13,16,19].map(y=>b(9,y,13,12,y,13,'black')),
    ...Array.from({length:Math.floor((end-14)/2)},(_,i)=>b(13+2*i,12,11,13+2*i,22,13,'black')),
    c(end-4,19,12,13,1,'ivory')],
};
const mounts={
  'soundstage-carpet':w=>({z:2,ops:[B(3,5,0,w-4,26,1,'blue'),B(4,6,1,w-5,25,1,'leather')]}),
  'studio-platform':w=>({z:5,ops:[B(4,6,0,w-5,25,2,'walnut'),
    ...[6,11,16,21].map(y=>B(4,y,3,w-5,y+3,4,'oak'))]}),
  'rolling-roadboard':w=>({z:7,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,6,'steel'),B(5,24,5,12,25,6,'yellow')]}),
  'music-shop-display':w=>({z:8,ops:[
    B(4,6,0,w-5,25,6,'walnut'),B(5,7,6,w-6,24,7,'oak'),
    B(7,25,2,17,25,4,'ivory'),B(5,7,6,w-6,8,14,'oak')]}),
  'carrying-cradle':w=>({z:4,ops:[
    B(4,6,0,w-5,25,2,'black'),B(5,7,2,w-6,24,3,'blue'),B(4,6,3,6,25,8,'steel'),
    B(w-7,6,3,w-5,25,8,'steel'),B(9,24,3,14,25,4,'walnut')]}),
};
const items=[];
for(const [instrument,build] of Object.entries(fixtures)){
  for(const [size,w] of [['solo',34],['ensemble',61]]){
    for(const [stand,support] of Object.entries(mounts)){
      if(['compact-drum-kit','harp-practice-frame'].includes(instrument)&&stand==='carrying-cradle')continue;
      const {z,ops}=support(w);
      items.push({schemaVersion:1,id:`music-fixture-${instrument}-${size}-${stand}`,category:'musical-instruments',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(coord(w,z))]});
    }
  }
}
await writeFamily('instrument-stands',items);
