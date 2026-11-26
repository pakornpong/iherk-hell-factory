import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#aa8159'}, walnut:{kind:'wood',color:'#755541'},
  gray:{kind:'metal',color:'#909c9f'}, black:{kind:'matte',color:'#3e4851'},
  felt:{kind:'matte',color:'#897e72'}, denim:{kind:'matte',color:'#656f80'},
  linen:{kind:'matte',color:'#c9bfac'}, paper:{kind:'matte',color:'#ded6c3'},
  brass:{kind:'metal',color:'#b19b6c'}, frost:{kind:'glass',color:'#a4adb1'},
};
const styles={
  'acoustic-channels':(x,X,y,h)=>[
    b(x,y,5,X,y+2,h,'felt'),
    ...Array.from({length:Math.floor((X-x+1)/4)},(_,i)=>b(x+1+i*4,y+3,8,x+1+i*4,y+3,h-2,'linen'))],
  'timber-slats':(x,X,y,h)=>[
    b(x,y,7,X,y+2,10,'walnut'),b(x,y,h-4,X,y+2,h-2,'walnut'),
    ...Array.from({length:Math.floor((X-x+1)/4)},(_,i)=>b(x+1+i*4,y+2,5,x+2+i*4,y+3,h,'oak'))],
  'divided-glazing':(x,X,y,h)=>[
    b(x,y,6,X,y+1,h,'frost'),b(x,y+2,10,X,y+2,11,'gray'),
    b(x,y+2,Math.floor(h/2),X,y+2,Math.floor(h/2)+1,'gray'),
    ...[x+1,Math.floor((x+X)/2),X-1].map(k=>b(k,y+2,6,k,y+2,h,'gray'))],
  'brochure-grid':(x,X,y,h)=>[
    b(x,y,5,X,y+1,h,'denim'),
    ...[9,16,23,30].filter(z=>z<h-4).flatMap(z=>[
      b(x,y+2,z,X,y+5,z+1,'oak'),b(x+2,y+3,z+1,Math.floor((x+X)/2),y+4,z+5,'paper'),
      b(Math.floor((x+X)/2)+2,y+2,z+1,X-1,y+4,z+4,'linen')])],
  'perforated-metal':(x,X,y,h)=>[
    ...Array.from({length:Math.floor((h-5)/3)},(_,i)=>b(x,y,5+i*3,X,y+1,6+i*3,'gray')),
    ...Array.from({length:Math.floor((X-x)/5)},(_,i)=>b(x+i*5,y+1,6,x+i*5,y+1,h,'black'))],
  'privacy-linen-fold':(x,X,y,h)=>[
    b(x,y,6,X,y+1,h,'linen'),
    ...Array.from({length:Math.floor((X-x+1)/4)},(_,i)=>b(x+i*4,y+2,6,x+i*4,y+3,h,'felt')),
    b(x,y+1,6,X,y+2,7,'brass')],
  'writing-surface':(x,X,y,h)=>[
    b(x,y,7,X,y+2,h,'paper'),b(x,y+2,8,X,y+5,9,'gray'),
    l(x+3,y+3,h-5,X-5,y+3,h-7,'denim'),l(x+3,y+3,h-9,X-8,y+3,h-9,'denim'),
    b(X-5,y+4,9,X-3,y+5,10,'black')],
  'fabric-pinboard':(x,X,y,h)=>[
    b(x,y,6,X,y+1,h,'denim'),b(x+2,y+2,h-9,x+6,y+2,h-4,'paper'),
    b(X-7,y+2,h-10,X-4,y+2,h-5,'linen'),b(Math.floor((x+X)/2),y+2,10,X-4,y+2,Math.max(11,h-13),'felt')],
};
const frames={
  'rolling-rail': (x,X,y)=>[
    ...[x,X-2].flatMap(k=>[y-4,y+6].map(ty=>b(k,ty,0,k+2,ty+2,2,'black'))),
    b(x,y-4,2,x+2,y+8,4,'gray'),b(X-2,y-4,2,X,y+8,4,'gray'),b(x,y,4,X,y+2,5,'gray')],
  'oak-trestle':(x,X,y)=>[
    ...[x,X-1].flatMap(k=>[l(k,y,5,k,y-4,0,'walnut'),l(k,y+2,5,k,y+7,0,'walnut')]),
    b(x,y,4,X,y+2,5,'oak')],
  'anchored-plinth':(x,X,y)=>[b(x-1,y-2,0,X+1,y+5,2,'black'),b(x,y-1,3,X,y+4,5,'oak')],
  'cantilever-feet':(x,X,y)=>[
    b(x,y+1,0,X,y+2,2,'gray'),b(x,y+1,2,x+1,y+2,5,'gray'),b(X-1,y+1,2,X,y+2,5,'gray'),
    b(x,y+1,0,x+1,y+9,1,'gray'),b(X-1,y+1,0,X,y+9,1,'gray')],
};
const arrangements={
  'compact-console':{h:23,panels:[[5,27,12]],foot:[1,1]},
  'straight-room':{h:37,panels:[[5,58,12]],foot:[2,1]},
  'three-leaf':{h:34,panels:[[5,20,12],[21,39,17],[40,57,11]],foot:[2,1]},
  'low-zoned':{h:17,panels:[[5,30,12],[31,58,16]],foot:[2,1]},
};
const designs=[];
for(const [panel,build] of Object.entries(styles)){
  for(const [format,{h,panels,foot}] of Object.entries(arrangements)){
    for(const [mount,base] of Object.entries(frames)){
      const ops=[];
      for(const [index,[x,X,y]] of panels.entries()){
        if(index>0){
          const [,right,prevY]=panels[index-1];
          ops.push(l(right,prevY+1,10,x,y+1,10,'gray'),l(right,prevY+1,h-4,x,y+1,h-4,'gray'));
        }
        ops.push(...base(x,X,y),...build(x,X,y,h),b(x,y,4,x+1,y+2,h,'black'),
          b(X-1,y,4,X,y+2,h,'black'),b(x,y,h,X,y+2,h+1,'black'));
      }
      designs.push({schemaVersion:1,id:`divider-${panel}-${format}-${mount}`,category:'room-divider',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:foot,
        palette:'office-night',materials,ops});
    }
  }
}
await writeFamily('room-dividers',designs);
