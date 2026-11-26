import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  cloth:{kind:'matte',color:'#64778b'}, edge:{kind:'matte',color:'#434b53'},
  frame:{kind:'metal',color:'#8f9c9f'}, ivory:{kind:'matte',color:'#d8ceba'},
  paper:{kind:'matte',color:'#d1c1a4'}, brass:{kind:'metal',color:'#bea071'},
  red:{kind:'matte',color:'#a26657'}, lining:{kind:'matte',color:'#9b7d66'},
  oak:{kind:'wood',color:'#aa845e'}, glass:{kind:'glass',color:'#8eabb9'},
};
const frames={
  'interlocking-hard-shell': h=>[
    b(7,8,2,24,21,h-1,'cloth'),b(6,9,4,25,20,h-3,'cloth'),b(8,8,h-1,23,21,h,'cloth'),
    b(7,22,3,24,22,h-2,'edge'),...([11,15,19].map(x=>b(x,23,5,x,23,h-4,'frame'))),
    b(8,22,h-4,23,23,h-3,'edge')],
  'framed-leather-trunk':h=>[
    b(5,7,2,26,23,h,'lining'),b(5,7,2,26,8,h,'edge'),b(5,22,2,26,23,h,'edge'),
    b(5,8,h-1,26,22,h,'oak'),...([7,22].map(x=>b(x,23,3,x+2,23,h-2,'brass'))),
    b(13,23,h-5,17,24,h-2,'brass')],
  'zippered-soft-case':h=>[
    b(7,8,2,24,22,h-3,'cloth'),b(6,9,4,25,20,h-4,'cloth'),b(8,9,h-3,23,21,h,'cloth'),
    b(8,20,5,23,24,h-6,'lining'),b(9,21,6,22,25,h-7,'cloth'),
    b(8,23,6,23,23,h-6,'cloth'),b(10,23,h-7,21,24,h-6,'edge'),
    b(12,24,h-7,14,24,h-6,'frame')],
  'reinforced-road-case':h=>[
    b(5,7,2,26,24,h,'edge'),b(5,7,2,6,24,h,'frame'),b(25,7,2,26,24,h,'frame'),
    b(5,7,h-1,26,24,h,'frame'),b(5,8,2,26,23,3,'frame'),
    ...[5,24].flatMap(x=>[7,22].map(y=>b(x,y,h-4,x+2,y+2,h+1,'frame'))),
    b(9,24,h-5,13,25,h-3,'brass'),b(18,24,h-5,22,25,h-3,'brass')],
  'sliding-clamshell':h=>[
    b(6,7,2,25,22,Math.floor(h/2),'cloth'),b(5,8,Math.floor(h/2),26,23,h-2,'lining'),
    b(5,8,h-2,26,23,h,'cloth'),b(5,23,Math.floor(h/2)+2,26,26,h-4,'lining'),b(5,21,Math.floor(h/2),26,22,Math.floor(h/2)+1,'frame'),
    b(11,23,h-5,19,24,h-4,'frame')],
};
const carriers={
  'wheel-through':h=>[
    ...[8,22].flatMap(x=>[9,20].map(y=>b(x,y,0,x+2,y+2,2,'edge'))),
    b(10,7,h-1,11,8,h+10,'frame'),b(20,7,h-1,21,8,h+10,'frame'),
    b(10,7,h+10,21,9,h+11,'edge')],
  'carry-handle':h=>[
    b(5,8,1,25,22,2,'edge'),b(10,11,h,11,13,h+4,'frame'),
    b(20,11,h,21,13,h+4,'frame'),b(10,11,h+3,21,13,h+4,'lining')],
  'strapped-to-dolly':h=>[
    ...[6,23].map(x=>b(x,8,0,x+3,12,3,'edge')),b(4,7,2,27,24,3,'frame'),
    b(5,7,3,6,9,h+8,'frame'),b(25,7,3,26,9,h+8,'frame'),b(5,7,h+7,26,9,h+8,'edge'),
    b(5,19,h-5,26,20,h-4,'red')],
  'leaning-shoulder-strap':h=>[
    b(6,7,1,25,22,2,'edge'),l(6,17,h-4,10,16,h+7,'lining'),
    l(10,16,h+7,20,16,h+7,'lining'),l(20,16,h+7,25,17,h-3,'lining'),
    b(13,16,h+7,17,17,h+8,'edge')],
  'locker-cradle':h=>[
    b(4,6,0,27,25,2,'oak'),b(4,6,3,5,9,h+5,'frame'),b(26,6,3,27,9,h+5,'frame'),
    b(4,6,h+5,27,9,h+6,'frame'),b(4,24,2,27,25,7,'oak')],
};
const kits={
  'passenger-carry-on':h=>[
    b(10,23,h-8,15,24,h-3,'red'),b(11,24,h-7,14,24,h-4,'paper')],
  'field-mapping-kit':h=>[
    b(6,15,h-4,13,22,h+2,'cloth'),b(7,16,h+2,12,21,h+4,'paper'),
    c(23,19,5,h+1,2,'frame'),b(22,18,h+1,24,20,h+3,'edge')],
  'photographer-rig':h=>[
    b(8,22,h-12,22,25,h-4,'edge'),b(10,25,h-10,20,25,h-6,'cloth'),
    b(20,10,h-1,25,16,h+6,'edge'),b(22,16,h+1,24,17,h+3,'glass')],
  'journeyman-inspection-kit':h=>[
    b(8,23,6,20,25,13,'frame'),b(10,25,8,18,26,11,'glass'),
    b(22,11,h-4,26,16,h+3,'red'),b(23,14,h+2,26,18,h+4,'frame')],
  'sample-sales-display':h=>[
    b(7,23,5,24,25,h-4,'lining'),b(8,25,7,15,25,h-6,'paper'),
    b(16,25,7,22,25,h-6,'cloth'),b(7,8,h+1,15,17,h+3,'lining')],
  'tailor-garment-carry':h=>[
    b(7,22,4,23,24,h,'cloth'),b(12,23,h-3,18,25,h+3,'edge'),
    b(15,23,h+1,16,25,h+8,'frame'),l(10,24,h,15,24,h+5,'frame'),
    l(15,24,h+5,21,24,h,'frame')],
  'picnic-provision-carrier':h=>[
    b(6,23,4,25,24,h-5,'oak'),b(7,24,h-5,24,25,h-3,'lining'),
    c(11,13,h,h+6,2,'frame'),c(21,13,h,h+5,2,'cloth'),b(14,16,h,20,20,h+2,'ivory')],
  'survey-transit-protection':h=>[
    b(6,8,h-2,25,23,h+2,'frame'),b(7,8,h+2,24,22,h+4,'edge'),
    b(9,10,h+4,21,18,h+5,'lining'),b(12,12,h+5,18,16,h+9,'red'),
    b(9,24,h-6,16,25,h-5,'brass')],
};
function exterior(name,h){
  switch(name){
    case 'passenger-carry-on':
      return [b(7,23,5,24,26,h-7,'cloth'),b(9,26,7,22,27,h-8,'lining'),b(11,27,9,18,27,10,'frame')];
    case 'field-mapping-kit':
      return [b(25,10,4,29,15,h+5,'lining'),b(25,10,7,29,15,8,'edge'),
        b(25,10,h-5,29,15,h-4,'edge'),c(27,12,h+5,h+8,2,'paper')];
    case 'photographer-rig':
      return [l(7,23,4,6,25,h+9,'frame'),l(8,23,4,9,25,h+9,'frame'),
        l(9,23,4,12,25,h+9,'edge'),b(5,24,h+8,13,26,h+10,'edge'),
        b(6,23,h-3,12,26,h-2,'lining')];
    case 'journeyman-inspection-kit':
      return [b(5,11,3,26,25,7,'frame'),b(5,8,7,7,22,h+3,'frame'),
        b(24,8,7,26,22,h+3,'frame'),b(7,8,h+2,24,10,h+3,'frame')];
    case 'sample-sales-display':
      return [b(7,23,6,23,28,h-3,'lining'),b(8,28,8,15,28,h-5,'paper'),
        b(16,28,8,22,28,h-5,'cloth'),b(7,24,h-3,23,28,h-2,'frame')];
    case 'tailor-garment-carry':
      return [b(3,10,6,27,21,h-1,'cloth'),b(5,11,h-1,25,22,h+1,'cloth'),
        b(7,21,h-2,23,23,h+1,'lining')];
    case 'picnic-provision-carrier':
      return [b(6,23,4,25,25,h-3,'oak'),...Array.from({length:Math.floor((h-6)/3)},(_,i)=>
        b(7,25,5+3*i,24,25,5+3*i,'lining')),
        b(5,9,h,7,20,h+2,'oak'),b(24,9,h,26,20,h+2,'oak')];
    case 'survey-transit-protection':
      return [b(5,8,h+3,26,22,h+6,'frame'),b(6,8,h+6,25,10,h+9,'edge'),
        b(6,20,h+6,25,22,h+9,'edge'),b(8,11,h+6,22,19,h+7,'red')];
  }
  throw new Error(name);
}
const layouts=[['compact',19],['extended',29],['upright',38]];
const designs=[];
for(const [name,build] of Object.entries(kits)){
  for(const [size,h] of layouts){
    for(const [shell,enclosure] of Object.entries(frames)){
      for(const [carry,fit] of Object.entries(carriers)){
        if(!['interlocking-hard-shell','reinforced-road-case'].includes(shell)&&
          ['strapped-to-dolly','locker-cradle'].includes(carry))continue;
        if(size==='compact'&&carry==='locker-cradle')continue;
        if(['tailor-garment-carry','survey-transit-protection'].includes(name)&&size==='compact')continue;
        const finishes=['#64778b','#74675e','#555b60','#99775c','#7c8187'];
        const finish=finishes[(name.length+shell.length+size.length*2)%finishes.length];
        designs.push({schemaVersion:1,id:`travel-${name}-${size}-${shell}-${carry}`,category:'travel',
          layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],
          palette:'office-night',materials:{...materials,cloth:{...materials.cloth,color:finish}},
          ops:[...fit(h),...enclosure(h),...build(h),...exterior(name,h)]});
      }
    }
  }
}
await writeFamily('travel-kits',designs);
