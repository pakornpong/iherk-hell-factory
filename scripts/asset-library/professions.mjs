import { writeFamily } from './render.mjs';
const b = (x,y,z,X,Y,Z,material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c = (x,y,zFrom,zTo,radius,material) => ({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l = (x,y,z,X,Y,Z,material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials = Object.fromEntries(Object.entries({
  cream:'#e5e3d6', metal:'#a0b0bc', frame:'#445361', black:'#272f3b',
  blue:'#49798f', aqua:'#78c5c4', red:'#b85446', wood:'#ac784e', yellow:'#e0ad58', paper:'#f2ecdc',
}).map(([key,color]) => [key,{color,kind:key==='wood'?'wood':['metal','frame'].includes(key)?'metal':'matte'}]));
const models = [];
function add(id, category, ops, footprintTiles = [1,1]) {
  models.push({schemaVersion:1,id,category,layer:'object',outlineMode:'silhouette',
    tilePreset:'64x32',voxelsPerTile:32,footprintTiles,palette:'office-night',materials,ops});
}
const legs = (xs,ys,z,material='frame') => xs.flatMap(x=>ys.map(y=>b(x,y,0,x+2,y+2,z,material)));
const smallWheels = (xs,ys) => xs.flatMap(x=>ys.map(y=>b(x,y,0,x+2,y+3,3,'black')));
add('clinic-vitals-tower','medical',[
  ...smallWheels([5,23],[7,23]), b(4,6,4,27,26,6,'cream'),c(15,15,7,32,2,'metal'),
  b(7,9,29,24,13,43,'cream'),b(9,13,31,22,13,41,'black'),
  l(10,13,35,13,13,35,'aqua'),l(13,13,35,16,13,39,'aqua'),l(16,13,39,18,13,34,'aqua'),l(18,13,34,21,13,35,'aqua'),
  b(17,15,17,24,22,20,'blue'),l(24,13,34,25,18,21,'black')]);
add('clinic-adjustable-exam-couch','medical',[
  ...legs([8,53],[7,20],10), b(6,6,10,58,23,12,'cream'),b(8,7,13,42,22,16,'blue'),
  {op:'slope',from:[43,7,13],to:[57,22,25],axis:'+X',material:'blue'},
  b(49,9,22,56,20,25,'aqua'),b(19,7,4,33,20,9,'metal')],[2,1]);
add('dentist-stool-tool-tray','medical',[
  ...smallWheels([7,21],[8,22]),b(8,9,3,24,24,4,'frame'),c(16,16,5,28,2,'metal'),
  b(6,6,28,26,24,31,'metal'),b(8,8,31,24,22,31,'blue'),
  ...[10,14,19,22].map(x=>b(x,10,32,x+1,18+(x%3),32,'cream'))]);
add('salon-dryer-hood-chair','personal-care',[
  c(15,16,0,2,10,'metal'),c(15,16,3,12,3,'frame'),b(7,9,12,24,23,17,'red'),
  b(8,8,16,23,11,25,'red'),b(7,10,17,9,22,22,'frame'),b(22,10,17,24,22,22,'frame'),
  b(14,5,15,17,7,41,'metal'),b(14,6,38,17,16,41,'metal'),c(15,17,33,40,8,'blue'),
  c(15,17,31,32,7,'frame')]);
add('tailor-steam-press-station','textile',[
  ...legs([5,25],[7,23],13),b(4,6,12,28,26,15,'blue'),b(7,8,16,25,24,17,'cream'),
  b(23,8,18,26,11,25,'metal'),b(7,8,24,26,22,27,'blue'),b(9,10,23,24,21,24,'metal'),
  b(11,20,27,17,22,30,'black'),b(24,24,16,25,25,17,'red')]);
add('postal-parcel-weigh-station','logistics',[
  b(4,5,0,27,25,2,'frame'),b(5,6,3,26,24,5,'metal'),b(6,7,6,20,20,18,'wood'),
  b(11,7,18,13,20,18,'paper'),b(23,7,6,25,9,23,'frame'),b(19,7,22,28,11,26,'frame'),
  b(20,11,23,27,11,25,'aqua')]);
add('sound-foley-pit-trays','media',[
  b(3,3,0,61,27,2,'frame'),b(4,4,3,60,26,5,'wood'),b(5,5,6,21,25,6,'metal'),
  b(24,5,6,40,25,6,'yellow'),b(43,5,6,59,25,6,'cream'),
  ...Array.from({length:5},(_,i)=>b(44+i*3,5,7,44+i*3,25,7,'frame')),
  c(12,14,7,7,3,'blue'),c(31,17,7,8,2,'wood')],[2,1]);
add('film-folding-director-monitor','media',[
  ...[6,24].flatMap(x=>[l(x,7,0,x,24,15,'frame'),l(x,24,0,x,7,15,'metal')]),
  b(5,7,15,25,24,17,'black'),b(6,8,18,24,11,34,'frame'),b(8,11,20,22,11,32,'aqua'),
  b(6,11,33,24,17,34,'black'),b(6,12,20,7,17,33,'black'),b(23,12,20,24,17,33,'black')]);
add('garage-tire-balancer','garage',[
  b(5,5,0,26,24,2,'frame'),b(7,6,3,24,21,19,'red'),b(8,7,20,23,17,22,'frame'),
  b(10,7,23,21,9,29,'black'),b(11,9,25,20,9,28,'aqua'),
  b(19,21,13,30,22,15,'metal'),
  b(23,20,6,27,24,22,'black'),b(23,17,8,27,27,20,'black'),b(27,20,11,27,24,17,'metal')]);
add('garage-parts-washer-pedestal','garage',[
  b(6,6,0,25,25,2,'frame'),b(9,9,3,22,22,17,'blue'),b(5,5,17,26,26,21,'metal'),
  b(7,7,21,24,24,21,'frame'),b(5,5,22,26,7,37,'blue'),
  b(7,7,24,24,7,35,'metal'),l(20,8,29,17,14,23,'yellow')]);
add('school-overhead-projector-cart','education',[
  ...smallWheels([5,24],[7,23]), ...[5,24].flatMap(x=>[7,23].map(y=>b(x,y,4,x+1,y+1,18,'frame'))),
  b(5,7,7,25,24,8,'metal'),b(4,6,17,26,25,19,'metal'),
  b(7,8,20,22,22,23,'cream'),b(9,10,23,20,20,23,'aqua'),b(21,8,24,23,10,37,'frame'),
  b(13,8,36,23,12,38,'frame'),b(14,9,35,17,12,36,'blue')]);
add('florist-wrapping-dispenser','retail',[
  ...legs([5,24],[7,22],20,'wood'),b(4,5,19,27,26,22,'wood'),
  b(6,6,23,8,10,34,'frame'),b(23,6,23,25,10,34,'frame'),b(7,7,31,24,9,32,'metal'),
  b(8,8,26,23,11,32,'paper'),b(10,11,23,22,19,23,'paper'),c(22,22,23,24,3,'red')]);
add('commercial-floor-burnisher','maintenance',[
  c(15,19,0,2,10,'black'),c(15,19,3,6,9,'red'),c(15,19,7,13,5,'cream'),
  l(14,12,8,14,3,34,'metal'),l(15,12,8,15,3,34,'metal'),b(8,3,34,21,4,36,'frame'),
  b(14,4,31,17,7,34,'red')]);
add('building-facility-breaker-rack','maintenance',[
  b(4,6,0,26,22,2,'black'),b(5,7,3,25,21,38,'metal'),b(7,21,5,23,22,36,'frame'),
  ...[13,19,25].flatMap(z=>[8,12,16,20].map(x=>b(x,22,z,x+2,23,z+2,'cream'))),
  b(9,23,30,20,23,33,'yellow'),b(11,22,8,20,22,9,'blue')]);
add('ice-cream-push-cart-canopy','food-service',[
  ...smallWheels([4,24],[5,23]),b(3,4,4,28,27,17,'blue'),b(3,4,18,28,27,20,'cream'),
  ...[4,27].flatMap(x=>[5,25].map(y=>b(x,y,21,x,y,39,'metal'))),
  ...Array.from({length:7},(_,i)=>b(2+i*4,3,39,5+i*4,28,41,i%2?'cream':'red')),
  b(8,8,21,23,19,21,'aqua'),b(8,26,9,23,27,13,'paper')]);
add('hotel-luggage-trolley','hospitality',[
  ...smallWheels([5,23],[5,23]),b(4,4,4,27,27,7,'red'),
  ...[5,25].map(x=>b(x,6,8,x+1,7,34,'yellow')),b(5,6,34,26,7,36,'yellow'),
  b(8,9,8,19,19,24,'black'),b(10,10,25,16,10,26,'metal'),
  b(14,19,8,25,24,17,'wood'),b(19,18,12,23,19,14,'metal')]);
add('laundry-commercial-roller-ironer','laundry',[
  ...legs([5,54],[6,24],14),b(4,5,12,60,27,17,'frame'),b(6,6,17,14,25,27,'cream'),
  b(50,6,17,58,25,27,'cream'),b(14,9,20,50,18,26,'metal'),
  b(14,19,17,49,29,18,'metal'),b(18,18,18,43,24,19,'paper'),
  b(53,25,22,56,25,24,'red')],[2,1]);
add('library-book-return-bench','library',[
  ...legs([4,53],[7,24],13,'wood'),b(3,6,12,60,27,16,'wood'),b(35,8,17,58,24,31,'cream'),
  b(38,24,23,55,24,27,'black'),b(38,25,22,55,25,23,'metal'),
  b(40,25,29,53,25,30,'blue'),b(9,12,17,23,23,19,'red'),
  b(11,14,20,26,23,22,'paper')],[2,1]);
add('outdoor-irrigation-hose-reel','gardening',[
  ...[7,23].map(x=>b(x,7,0,x+1,25,2,'frame')),b(7,14,2,8,17,21,'frame'),b(23,14,2,24,17,21,'frame'),
  b(8,10,8,23,21,20,'blue'),b(9,9,11,22,22,17,'blue'),b(8,11,9,9,20,19,'metal'),
  b(22,11,9,23,20,19,'metal'),l(21,20,12,25,27,2,'blue'),b(25,26,2,28,28,4,'yellow')]);
add('survey-total-station-tripod','surveying',[
  ...[[5,24],[24,24],[15,5]].map(([x,y])=>l(15,15,23,x,y,0,'yellow')),
  b(12,12,22,18,18,25,'frame'),b(10,11,25,21,19,36,'yellow'),
  b(12,19,28,19,21,34,'black'),b(14,21,30,17,21,32,'aqua'),
  b(11,11,37,20,12,38,'frame'),b(11,11,36,12,12,37,'frame'),b(19,11,36,20,12,37,'frame')]);
await writeFamily('profession-equipment', models);
