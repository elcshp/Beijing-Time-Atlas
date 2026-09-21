(function(root){'use strict';
function combine(data,mode,scenario,subway){
 if(!['car','bus','bike'].includes(mode))throw Error('Invalid mode');
 const {day,hour}=scenario;if(!['weekday','weekend'].includes(day)||!Number.isFinite(hour)||hour<0||hour>=24)throw Error('Invalid scenario');
 const slot=Math.round(hour*2)%48,railOpen=TimeAtlasTraffic.service(hour),available=mode!=='bus'||railOpen;
 const base=mode==='bike'?data.matrices.bike_light:data.traffic.days[day][mode][slot];
 const commute=TimeAtlasTraffic.weights(day,hour)[1],waitExtra=commute>.65?1:3;
 const rail=data.matrices.metro.map((row,i)=>row.map((v,j)=>i===j?0:railOpen&&v>=0?v+waitExtra:-1));
 const directed=base.map((row,i)=>row.map((v,j)=>mode!=='car'&&subway&&rail[i][j]>=0?Math.min(v,rail[i][j]):v));
 const symmetric=directed.map((row,i)=>row.map((v,j)=>(v+directed[j][i])/2));
 return{base,directed,symmetric,rail,railOpen,available,waitExtra};
}
function center(p){let x=0,y=0;p.forEach(v=>{x+=v[0];y+=v[1]});return p.map(v=>[v[0]-x/p.length,v[1]-y/p.length]);}
function embed(dist,geo){const n=dist.length,ref=center(geo);let p=ref.map(v=>[...v]),sum=0,g=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++){sum+=dist[i][j];g+=Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1]);}p=p.map(v=>v.map(x=>x*sum/g));for(let step=0;step<350;step++){const q=Array.from({length:n},()=>[0,0]);for(let i=0;i<n;i++)for(let j=0;j<i;j++){let dx=p[i][0]-p[j][0],dy=p[i][1]-p[j][1],weight=dist[i][j]/Math.max(.000001,Math.hypot(dx,dy))/n;dx*=weight;dy*=weight;q[i][0]+=dx;q[i][1]+=dy;q[j][0]-=dx;q[j][1]-=dy;}p=q;}let dot=0,cross=0;for(let i=0;i<n;i++){dot+=p[i][0]*ref[i][0]+p[i][1]*ref[i][1];cross+=p[i][0]*ref[i][1]-p[i][1]*ref[i][0];}const a=Math.atan2(cross,dot),c=Math.cos(a),s=Math.sin(a);p=p.map(v=>[v[0]*c-v[1]*s,v[0]*s+v[1]*c]);let error=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++)error+=Math.abs(Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1])-dist[i][j]);return{positions:p,error:error/sum*100};}
const api={combine,embed,center};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TimeAtlasModel=api;})(globalThis);
