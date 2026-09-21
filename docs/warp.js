/* A smooth map deformation shared by landmarks and every geographic feature. */
(function(root){
'use strict';
const kernel=r=>r>1e-12?r*Math.log(r):0;
function solve(a,b){const n=b.length,m=a.map((row,i)=>[...row,b[i]]);for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[p][k]))p=i;if(Math.abs(m[p][k])<1e-12)throw Error('Degenerate map anchors');[m[p],m[k]]=[m[k],m[p]];const v=m[k][k];for(let j=k;j<=n;j++)m[k][j]/=v;for(let i=0;i<n;i++){if(i===k)continue;const t=m[i][k];for(let j=k;j<=n;j++)m[i][j]-=t*m[k][j];}}return m.map(row=>row[n]);}
function make(geo,dist,referenceMinutesPerKm){
 const ideal=TimeAtlasModel.embed(dist,geo),n=geo.length;let targetSum=0,geoSum=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++){targetSum+=dist[i][j];geoSum+=Math.hypot(geo[i][0]-geo[j][0],geo[i][1]-geo[j][1]);}
 const minutesPerKm=referenceMinutesPerKm||targetSum/geoSum,mean=[0,0];geo.forEach(p=>{mean[0]+=p[0]/n;mean[1]+=p[1]/n});
 const pins=geo.map(p=>[(p[0]-mean[0])/10,(p[1]-mean[1])/10]);
 const targets=ideal.positions.map(p=>[p[0]/minutesPerKm+mean[0],p[1]/minutesPerKm+mean[1]]);
 const a=Array.from({length:n+3},()=>Array(n+3).fill(0));
 for(let i=0;i<n;i++){for(let j=0;j<n;j++){const dx=pins[i][0]-pins[j][0],dy=pins[i][1]-pins[j][1];a[i][j]=kernel(dx*dx+dy*dy)+(i===j?.001:0);}a[i][n]=a[n][i]=1;a[i][n+1]=a[n+1][i]=pins[i][0];a[i][n+2]=a[n+2][i]=pins[i][1];}
 const wx=solve(a,[...targets.map((p,i)=>p[0]-geo[i][0]),0,0,0]),wy=solve(a,[...targets.map((p,i)=>p[1]-geo[i][1]),0,0,0]);
 function displacement(p){const x=(p[0]-mean[0])/10,y=(p[1]-mean[1])/10;let dx=wx[n]+wx[n+1]*x+wx[n+2]*y,dy=wy[n]+wy[n+1]*x+wy[n+2]*y;for(let i=0;i<n;i++){const ex=x-pins[i][0],ey=y-pins[i][1],u=kernel(ex*ex+ey*ey);dx+=wx[i]*u;dy+=wy[i]*u;}return[dx,dy];}
 // Bound local folding on a dense grid over the geographic map extent.
 const samples=[];for(let x=-15;x<=15;x+=.6)for(let y=-13;y<=14;y+=.6){const p=[x,y],d=displacement(p),ex=displacement([x+.002,y]),ey=displacement([x,y+.002]);samples.push([(ex[0]-d[0])/.002,(ey[0]-d[0])/.002,(ex[1]-d[1])/.002,(ey[1]-d[1])/.002]);}
 function minDet(strength){let min=Infinity;for(const[a,b,c,d]of samples)for(const t of[.25,.5,.75,1]){const s=strength*t;min=Math.min(min,(1+s*a)*(1+s*d)-s*s*b*c);}return min;}
 let strength=1;while(minDet(strength)<.08&&strength>.1)strength*=.9;
 const apply=p=>{const d=displacement(p);return[p[0]+d[0]*strength,p[1]+d[1]*strength]};
 const positions=geo.map(apply);let error=0;for(let i=0;i<n;i++)for(let j=0;j<i;j++)error+=Math.abs(Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1])*minutesPerKm-dist[i][j]);
 return{apply,positions,minutesPerKm,error:100*error/targetSum,strength,minJacobian:minDet(strength)};
}
const api={make};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TimeAtlasWarp=api;
})(globalThis);
