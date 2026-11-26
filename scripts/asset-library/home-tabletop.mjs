import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  china:{kind:'matte',color:'#d4cbb7'}, iron:{kind:'metal',color:'#59646c'}, nickel:{kind:'metal',color:'#a4aaa8'},
  oak:{kind:'wood',color:'#a9815e'}, walnut:{kind:'wood',color:'#785a48'},
  sand:{kind:'matte',color:'#b29978'}, blue:{kind:'matte',color:'#667f93'},
  terra:{kind:'matte',color:'#a66654'}, glass:{kind:'glass',color:'#8aa9b6'},
  brass:{kind:'metal',color:'#bd9c62'}, paper:{kind:'matte',color:'#e2dac4'},
  wax:{kind:'matte',color:'#d1bd8d'}, screen:{kind:'emissive',color:'#a5bec9',glowRadius:1,glowIntensity:.12},
};
const items={
  'tea-tray-pot-and-cups':[
    c(12,12,1,6,5,'china'),c(12,12,7,8,4,'china'),c(12,12,9,10,1,'brass'),
    l(15,12,5,20,12,8,'china'),b(6,11,4,7,13,7,'china'),c(22,17,1,5,2,'china'),c(21,8,1,4,2,'china')],
  'espresso-cups-stacked':[
    ...[[9,12],[15,15],[20,11]].flatMap(([x,y],i)=>[c(x,y,1,1,3,'china'),
      c(x,y,2,5+i,2,'china'),l(x+1,y,3,x+3,y,4,'nickel')]),b(12,20,1,23,22,1,'oak')],
  'manual-coffee-grinder':[
    b(7,8,1,24,23,10,'walnut'),b(8,23,3,23,23,8,'oak'),b(13,23,5,18,24,6,'brass'),
    c(15,13,11,17,5,'iron'),c(15,13,18,19,4,'nickel'),c(15,13,20,24,1,'iron'),
    l(15,13,23,25,13,23,'nickel'),c(25,13,22,26,1,'walnut')],
  'stove-moka-pot':[
    c(15,14,1,7,6,'nickel'),c(15,14,8,10,4,'iron'),c(15,14,10,16,5,'nickel'),
    c(15,14,17,19,1,'iron'),l(19,14,13,24,14,16,'iron'),
    l(24,14,16,24,14,11,'iron'),b(10,13,13,12,15,15,'nickel')],
  'cake-dome-stand':[
    c(15,15,1,2,6,'nickel'),c(15,15,2,6,2,'nickel'),c(15,15,6,7,9,'china'),
    c(15,15,8,13,7,'glass'),c(15,15,14,16,6,'glass'),c(15,15,17,18,4,'glass'),
    c(15,15,19,20,1,'brass')],
  'bathroom-tray-soap-brush':[
    b(7,8,1,24,23,2,'china'),c(10,12,3,9,2,'glass'),
    b(9,10,9,13,12,10,'nickel'),c(19,10,3,7,2,'china'),
    l(19,10,6,19,11,16,'blue'),l(20,12,5,21,13,13,'terra'),b(11,19,3,18,21,5,'sand')],
  'folded-towels-tray':[
    b(6,8,1,25,23,3,'oak'),b(7,9,4,24,21,7,'sand'),b(8,10,8,23,21,10,'paper'),
    b(9,10,11,22,20,13,'blue'),b(10,20,11,22,20,12,'china')],
  'cosmetics-mirror-tray':[
    c(13,16,1,2,7,'brass'),c(13,16,3,11,1,'brass'),
    b(8,10,10,18,13,23,'brass'),b(9,13,12,17,13,21,'glass'),
    c(23,15,1,7,2,'glass'),c(23,15,8,9,1,'nickel'),b(19,21,1,26,23,2,'terra')],
  'alarm-clock-twin-bell':[
    b(7,11,1,24,20,3,'walnut'),b(9,10,4,22,19,15,'blue'),
    b(11,19,6,20,19,13,'paper'),l(15,19,10,15,19,13,'iron'),l(15,19,10,18,19,9,'iron'),
    c(10,14,16,18,2,'nickel'),c(21,14,16,18,2,'nickel')],
  'radio-wood-and-dial':[
    b(6,8,1,25,22,13,'walnut'),b(8,22,3,23,22,11,'sand'),
    ...[4,6,8].map(z=>b(9,23,z,18,23,z,'iron')),
    b(20,22,5,22,23,9,'brass'),l(8,9,13,7,8,24,'nickel')],
  'charging-clock-dock':[
    b(6,8,1,25,23,6,'iron'),b(7,23,2,19,23,5,'screen'),
    b(9,23,3,17,23,3,'blue'),b(11,11,6,19,17,7,'blue'),
    b(12,12,7,19,13,17,'walnut'),b(13,13,8,18,13,16,'screen'),
    l(22,22,2,27,23,1,'iron')],
  'desk-diffuser-vessel':[
    c(12,13,1,6,5,'glass'),c(12,13,7,10,3,'glass'),
    ...[[8,11,24],[13,10,27],[15,16,26],[11,17,22]].map(([x,y,z])=>l(12,13,7,x,y,z,'oak')),
    b(19,16,1,24,23,3,'china'),c(21,19,4,8,2,'wax')],
  'bookends-and-books':[
    b(7,9,1,7,23,12,'walnut'),b(7,9,1,12,23,2,'walnut'),
    b(25,9,1,25,23,12,'walnut'),b(20,9,1,25,23,2,'walnut'),
    ...[9,12,15,18,21].map((x,i)=>b(x,11,3,x+1,22,12+i%3,['terra','blue','paper'][i%3]))],
  'drafting-pencil-cups':[
    c(11,12,1,10,4,'nickel'),...[9,11,13].map((x,i)=>l(x,11,10,x+1,12,19+i%2,'oak')),
    b(17,14,1,25,21,4,'walnut'),b(18,15,5,24,20,5,'paper'),
    b(19,15,6,22,16,7,'terra')],
  'sewists-notions':[
    b(6,8,1,25,23,3,'oak'),b(6,8,4,25,9,13,'walnut'),
    c(11,15,4,9,3,'terra'),c(20,15,4,7,3,'blue'),
    l(13,19,4,20,23,5,'nickel'),l(18,19,4,12,22,5,'nickel')],
  'folding-board-game':[
    b(6,6,1,25,25,2,'walnut'),
    ...Array.from({length:16},(_,i)=>{const x=8+(i%4)*4,y=8+Math.floor(i/4)*4;
      return b(x,y,3,x+3,y+3,3,(i+Math.floor(i/4))%2?'oak':'paper');}),
    ...[[10,10],[14,18],[18,14],[22,22]].map(([x,y],i)=>c(x,y,4,5,1,i%2?'iron':'terra'))],
};
const trays={
  'lined-tray':[b(4,6,0,27,25,1,'walnut'),b(4,6,1,5,25,2,'oak'),b(26,6,1,27,25,2,'oak')],
  'stone-platter':[c(15,15,0,1,12,'china'),c(15,15,1,1,10,'sand')],
  'woven-basket':[b(4,6,0,27,26,1,'oak'),b(4,6,1,5,26,4,'oak'),b(26,6,1,27,26,4,'oak'),
    b(5,6,1,26,7,4,'walnut'),b(5,25,1,26,26,4,'walnut')],
  'tiered-organizer':[b(4,6,0,27,25,1,'iron'),b(5,7,1,25,9,12,'oak'),
    b(5,8,12,25,13,13,'oak'),b(7,8,13,12,11,15,'paper')],
  'open-counter':[b(5,8,0,26,23,0,'sand')],
};
const designs=[];
for(const [item,ops] of Object.entries(items)){
  for(const [holder,base] of Object.entries(trays)){
    designs.push({schemaVersion:1,id:`home-prop-${item}-${holder}`,category:'household',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],
      palette:'office-night',materials,ops:[...base,...ops]});
  }
}
await writeFamily('home-tabletop',designs);
