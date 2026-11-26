import { writeFamily } from './render.mjs';

const b = (x,y,z,X,Y,Z,material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l = (x,y,z,X,Y,Z,material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c = (x,y,zFrom,zTo,radius,material) => ({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});

const materials = {
  black: {kind:'matte',color:'#323a47'}, steel:{kind:'metal',color:'#8599a8'},
  brass:{kind:'metal',color:'#b99258'}, red:{kind:'matte',color:'#a95548'},
  case:{kind:'matte',color:'#4c6872'}, silver:{kind:'metal',color:'#b0c3cb'},
  lamp:{kind:'emissive',color:'#fff1ca',glowRadius:1,glowIntensity:0.2},
};

const mounts = {
  'studio-tripod': [
    ...[[5,25],[26,24],[15,4]].flatMap(([x,y])=>
      [l(15,14,27,x,y,1,'black'),l(16,14,27,x+1,y,1,'steel'),b(x,y,0,x+1,y+1,1,'black')]),
    c(15,14,24,35,2,'steel')],
  'medical-rolling': [
    ...[[5,16],[25,16],[16,6],[16,26]].flatMap(([x,y]) =>
      [l(15,15,4,x,y,2,'steel'),b(x,y,0,x+2,y+1,3,'black')]),
    c(15,15,3,24,2,'silver'),l(15,15,24,15,8,31,'steel'),l(15,8,31,15,14,36,'steel')],
  'floor-disc': [c(15,15,0,2,10,'brass'),c(15,15,3,26,1,'brass'),
    l(15,15,26,15,11,32,'brass'),l(15,11,32,15,14,36,'brass')],
  'shop-a-frame': [
    b(5,5,0,27,7,2,'black'),b(5,24,0,27,26,2,'black'),
    ...[6,25].flatMap(x=>[l(x,7,0,15,14,30,'steel'),l(x,24,0,15,14,30,'steel')]),
    b(13,12,29,17,16,36,'red')],
  'counter-scissor': [
    b(5,6,0,26,23,1,'silver'),b(6,7,2,25,22,4,'case'),c(15,13,5,8,4,'brass'),
    ...[14,16].flatMap(x=>[l(x,13,8,x,21,18,'steel'),l(x,21,18,x,10,28,'steel'),l(x,10,28,x,14,36,'steel')])],
};

const heads = {
  'barn-door-fresnel': [
    b(9,10,34,21,19,43,'black'),b(11,19,35,19,20,42,'silver'),b(12,20,36,18,20,41,'lamp'),
    b(8,18,34,10,24,43,'black'),b(20,18,34,22,24,43,'black'),
    b(10,18,43,20,24,44,'black'),b(10,18,33,20,23,34,'black')],
  'softbox-square': [
    b(13,10,34,17,14,42,'black'),b(10,13,32,20,16,45,'black'),
    b(7,16,30,23,20,47,'black'),b(8,20,31,22,20,46,'lamp')],
  'dual-work-flood': [
    b(5,11,36,25,14,38,'red'),
    ...[5,18].flatMap(x=>[b(x,12,36,x+8,17,44,'black'),b(x+1,17,37,x+7,17,43,'lamp'),
      ...[1,3,5,7].map(i=>b(x+i,11,38,x+i,12,43,'silver'))])],
  'long-task-bar': [
    b(3,13,36,28,17,40,'silver'),b(4,16,36,27,18,37,'lamp'),
    b(2,13,37,3,17,39,'black'),b(28,13,37,29,17,39,'black')],
  'studio-ring': [
    ...Array.from({length:28},(_,i)=>{
      const a=2*Math.PI*i/28;
      const x=Math.round(15+8*Math.cos(a)), z=Math.round(44+8*Math.sin(a));
      return [b(x-1,13,z-1,x+1,15,z+1,'black'),b(x,16,z,x+1,16,z+1,'lamp')];
    }).flat(),
    b(14,13,34,16,15,36,'black'),b(14,13,41,16,13,45,'steel')],
  'inspection-magnifier': [
    b(13,12,35,17,16,41,'case'),c(15,18,41,43,8,'case'),
    c(15,18,44,44,7,'lamp'),{op:'cylinder',center:[15,18],zFrom:41,zTo:44,radius:4,material:null}],
};

const designs=[];
for(const [head, fixture] of Object.entries(heads)){
  for(const [mount, stand] of Object.entries(mounts)){
    designs.push({
      schemaVersion:1,id:`light-${head}-${mount}`,category:'lighting',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],
      palette:'office-night',materials,ops:[...stand,...fixture],
    });
  }
}
await writeFamily('lighting',designs);
