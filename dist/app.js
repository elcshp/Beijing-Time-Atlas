'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const Model=TimeAtlasModel, Warp=TimeAtlasWarp, Traffic=TimeAtlasTraffic;
let routeUI=null,displayWarp=p=>p;
let data,model,embedding,field,flat,warped,layers,frame,screen=[],activeLandmark=null;
let state={mode:'car',day:'weekday',hour:8,heat:true,subway:false,view:'time',pair:[0,18],grid:true};
let zoom=1,pan=[0,0],anim=0,dragMoved=false,pointer=null;
// Only the two endpoints are selectable; this blend exists just during conversion.
let transitionFrame=0,shown,shownPlaces=[],shownPressure,targetPressure,playing=false,playTimer=0;
const referenceMinutesPerKm=4.5;
function usesSubway(){return state.mode!=='car'&&state.subway&&Traffic.service(state.hour);}
const svg=$('map-svg'),canvas=$('base-map'),ctx=canvas.getContext('2d'),stage=$('stage');

const icons={
 rdfz:['🏫','School','The High School Affiliated to Renmin University of China (main campus), 37 Zhongguancun Street, Haidian.'],
 zhongguancun:['💻','Technology district','A landmark for Beijing’s technology and university district.'],
 tsinghua:['🎓','University','Tsinghua University’s campus area in northwest Beijing.'],
 summer:['🏯','Historic garden','The Summer Palace: palaces, gardens and Kunming Lake.'],
 xizhimen:['🚇','Transport hub','A major interchange connecting central and northwest Beijing.'],
 national:['📚','Library','The National Library of China and its surrounding neighbourhood.'],
 wukesong:['🏟️','Sports & entertainment','An arena and entertainment district in western Beijing.'],
 west:['🚉','Railway station','Beijing West Railway Station and its station district.'],
 financial:['🏦','Business district','Financial Street, west of Beijing’s historic centre.'],
 tiananmen:['🏛️','Historic landmark','The Tiananmen area on Beijing’s central axis.'],
 temple:['🛕','Historic park','The Temple of Heaven and its surrounding park.'],
 south:['🚉','Railway station','Beijing South Railway Station in the southern city.'],
 wangfujing:['🛍️','Shopping district','The Wangfujing shopping district, east of the historic centre.'],
 shichahai:['🌊','Lakes & hutongs','A neighbourhood of lakes and hutongs north of the old city centre.'],
 olympic:['🏟️','Olympic park','The Olympic Green’s sports venues and open spaces.'],
 wangjing:['🏙️','Neighbourhood','A residential and business district in northeast Beijing.'],
 art:['🎨','Arts district','798 Art District, known for its galleries and former industrial buildings.'],
 sanlitun:['🛍️','Shopping & nightlife','Sanlitun’s shops, restaurants and nightlife in eastern Beijing.'],
 chaoyang:['🌳','City park','Chaoyang Park and its surrounding neighbourhood.'],
 guomao:['🏙️','Business district','Guomao and the China World Trade Center area.'],
 sihui:['🚇','Transport hub','Sihui, an eastern transport interchange and neighbourhood.']
};
function el(tag,attrs={},parent=svg){const x=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))x.setAttribute(k,String(v));if(parent)parent.appendChild(x);return x;}
function safeText(id,text){$(id).textContent=text;}
const landmarkZh={
 rdfz:['中学','中国人民大学附属中学本部，海淀区中关村大街37号。'],
 zhongguancun:['科技街区','北京高校与科技企业集中的地标性街区。'],tsinghua:['大学','北京西北部的清华大学校园区域。'],summer:['历史园林','颐和园的宫殿、园林与昆明湖。'],xizhimen:['交通枢纽','连接中心城区与北京西北部的重要换乘区域。'],national:['图书馆','中国国家图书馆及周边街区。'],wukesong:['体育与休闲','北京西部的体育场馆与休闲商业区域。'],west:['火车站','北京西站及其周边站区。'],financial:['商务区','位于北京老城西部的金融街。'],tiananmen:['历史地标','北京中轴线上的天安门区域。'],temple:['历史公园','天坛古建筑群及周边公园。'],south:['火车站','位于北京南部的北京南站。'],wangfujing:['购物街区','位于老城中心以东的王府井商业街区。'],shichahai:['湖泊与胡同','老城北部由湖泊和胡同构成的街区。'],olympic:['奥林匹克公园','奥林匹克公园的体育场馆与开放空间。'],wangjing:['城市街区','北京东北部的居住与商务街区。'],art:['艺术区','以画廊和工业建筑改造空间闻名的798艺术区。'],sanlitun:['购物与夜生活','三里屯的商店、餐厅和夜生活区域。'],chaoyang:['城市公园','朝阳公园及其周边街区。'],guomao:['商务区','国贸与中国国际贸易中心周边区域。'],sihui:['交通枢纽','北京东部的四惠换乘枢纽与周边街区。']};
function placeName(i){return language==='zh'?data.places[i].zh:data.places[i].name;}
function stationName(name){return language==='zh'?name:(data.stationNames?.[name]||name);}
function landmark(i){const p=data.places[i],v=icons[p.id]||['📍','Place','A selected Beijing neighbourhood.'];return language==='zh'?[v[0],...(landmarkZh[p.id]||['地点','选定的北京街区。'])]:v;}
function showLandmark(i){activeLandmark=i;const p=data.places[i],[icon,category,detail]=landmark(i);safeText('landmark-icon',icon);safeText('landmark-name',placeName(i));safeText('landmark-zh',language==='zh'?p.name:p.zh);safeText('landmark-category',category);safeText('landmark-detail',detail);safeText('landmark-hint',tr(state.pair.length===1?'cardNext':'cardPair'));$('landmark-card').hidden=false;updateLocalField(i);}
function tooltip(i){if(!screen[i])return;const p=data.places[i],[icon,category]=landmark(i),tip=$('landmark-tooltip');tip.replaceChildren();const title=document.createElement('strong');title.textContent=icon+' '+placeName(i);const sub=document.createElement('small');sub.textContent=(language==='zh'?p.name:p.zh)+' · '+category;tip.append(title,sub);tip.hidden=false;const w=stage.clientWidth,h=stage.clientHeight;tip.style.left=Math.max(8,Math.min(w-tip.offsetWidth-8,screen[i][0]+24))+'px';tip.style.top=Math.max(85,Math.min(h-tip.offsetHeight-65,screen[i][1]-55))+'px';}
function hideTooltip(){$('landmark-tooltip').hidden=true;}
function choose(i){if(state.pair.length===2)state.pair=[i];else if(state.pair[0]!==i)state.pair.push(i);hideTooltip();showLandmark(i);updatePair();render();}
function sync(){
 safeText('controls-context',tr(state.mode)+' · '+tr(state.day)+' · '+formatHour(state.hour));
 document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 document.querySelectorAll('[data-day]').forEach(b=>{const on=b.dataset.day===state.day;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 document.querySelectorAll('[data-hour]').forEach(b=>{const on=Traffic.period(Number(b.dataset.hour))===Traffic.period(state.hour);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 $('city-hour').value=state.hour;safeText('clock-time',formatHour(state.hour));$('city-hour').setAttribute('aria-valuetext',formatHour(state.hour)+' '+tr(Traffic.period(state.hour)));$('show-field').checked=state.heat;
 $('play-day').setAttribute('aria-pressed',playing);safeText('play-day',tr(playing?'pauseDay':'playDay'));
 safeText('scenario-badge',tr(state.day)+' · '+formatHour(state.hour)+' · '+tr(Traffic.period(state.hour)));$('field-legend').hidden=!state.heat;
 const closed=!Traffic.service(state.hour);$('service-note').hidden=!closed||state.mode==='car'||(state.mode==='bike'&&!state.subway);safeText('service-note',tr(state.mode==='bus'?'busClosed':'railClosed'));
 document.querySelectorAll('[data-view]').forEach(b=>{const on=b.dataset.view===state.view;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 const driving=state.mode==='car';$('subway-controls').hidden=driving;$('subway').checked=!driving&&state.subway;$('subway').disabled=driving;$('show-grid').checked=state.grid;
 safeText('subway-label',tr('subway'));safeText('subway-small',tr('subwaySmall'));safeText('subway-note',tr('subwayNote'));
 safeText('traffic-note',tr(state.mode==='bike'?'bikeTraffic':'dailyNote'));
 safeText('map-title',tr(model&&!model.available?'busUnavailableTitle':state.view==='geographic'?'geoTitle':'timeTitle'));safeText('view-label',tr(model&&!model.available?'geoLabel':state.view==='geographic'?'geoLabel':'timeLabel'));safeText('view-description',tr(model&&!model.available?'busClosed':state.view==='geographic'?'geoDescription':'timeDescription'));
}
function refreshStats(){if(!model||!field)return;if(!model.available){for(const id of ['average','stress','benefit'])safeText(id,'—');safeText('benefit-label',tr('benefit'));safeText('benefit-unit','');safeText('benefit-caption',tr('busClosedShort'));$('subway-impact').hidden=true;return;}let sum=0,base=0,n=0,changed=0;for(let i=0;i<data.places.length;i++)for(let j=0;j<i;j++){const original=(model.base[i][j]+model.base[j][i])/2;sum+=model.symmetric[i][j];base+=original;changed+=original-model.symmetric[i][j]>=1;n++;}
 safeText('average',Math.round(sum/n));safeText('stress',field.error.toFixed(0));safeText('benefit-label',tr(state.mode==='car'?'routeModel':'benefit'));
 if(state.mode==='car'){safeText('benefit',tr('roadOnly'));safeText('benefit-unit','');safeText('benefit-caption',tr('drivingOnly'));$('subway-impact').hidden=true;}
 else{safeText('benefit',usesSubway()?((base-sum)/n).toFixed(1):tr(state.subway&&!model.railOpen?'unavailable':'off'));safeText('benefit-unit',usesSubway()?tr('saved'):'');safeText('benefit-caption',usesSubway()?tr('benefitCaption',{count:changed}):tr('switchCompare'));safeText('subway-impact',tr(changed?'benefitNotice':'noBenefit',{count:changed}));$('subway-impact').hidden=!usesSubway();}
}

function updatePair(){
 if(!model)return;$('place-a').value=state.pair[0];$('place-b').value=state.pair[1]??'';if(!model.available){safeText('pair-time','—');safeText('pair-route',tr('busClosed'));safeText('pair-km','');safeText('pair-directions','');safeText('pair-gain','');$('journey-comparison').hidden=true;safeText('rail-breakdown','');return;}const[i,j]=state.pair;$('place-a').value=i;$('place-b').value=j??'';
 if(j===undefined){safeText('pair-time','—');safeText('pair-km',tr('chooseSecond'));safeText('pair-route',tr('chooseHint'));safeText('pair-directions','');safeText('pair-gain','');$('journey-comparison').hidden=true;safeText('rail-breakdown','');return;}
 $('journey-comparison').hidden=state.mode==='car';$('rail-breakdown').hidden=state.mode==='car';safeText('pair-time',Math.round(model.symmetric[i][j]));$('pair-km').innerHTML=data.straight[i][j].toFixed(1)+' '+tr('km')+'<br><small>'+tr('straight')+'</small>';
 const f=usesSubway()&&model.rail[i][j]>=0&&model.rail[i][j]<model.base[i][j],b=usesSubway()&&model.rail[j][i]>=0&&model.rail[j][i]<model.base[j][i];
 safeText('pair-route',tr(f&&b?'bothRail':f||b?'oneRail':usesSubway()?'roadFaster':'modeEstimate',{mode:tr(state.mode)}));
 safeText('pair-directions',tr('directions',{a:placeName(i),b:placeName(j),forward:Math.round(model.directed[i][j]),reverse:Math.round(model.directed[j][i])}));
 const road=(model.base[i][j]+model.base[j][i])/2,rail=(model.rail[i][j]+model.rail[j][i])/2,gain=road-model.symmetric[i][j];
 safeText('road-comparison',tr('roadComparison',{mode:tr(state.mode),minutes:Math.round(road)}));$('road-comparison').classList.toggle('faster',!model.railOpen||road<=rail);
 safeText('rail-comparison',tr(model.railOpen?'railComparison':'railUnavailable',{minutes:Math.round(rail)}));$('rail-comparison').classList.toggle('faster',model.railOpen&&rail<road);
 const info=data.metroInfo[i+'_'+j];safeText('rail-breakdown',info&&model.railOpen?tr('railBreakdown',{from:stationName(info.from),to:stationName(info.to),walk:Math.round(info.access+info.exit),rail:Math.round(info.rail),overhead:8+model.waitExtra}):'');
 safeText('pair-gain',usesSubway()?tr(gain>=.5?'gain':'noGain',{minutes:Math.round(gain)}):'');
}
// Every layer uses a common geographic coordinate array, then the same smooth field.
function makeGeometry(){
 const coords=[];layers={roads:{},parks:[],water:[],rail:[],grid:[],heat:[],labels:[]};const bounds=[-13.652,-12.232,13.652,12.232];
 function clipSegment(a,b){let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1],p=[-dx,dx,-dy,dy],q=[a[0]-bounds[0],bounds[2]-a[0],a[1]-bounds[1],bounds[3]-a[1]];for(let k=0;k<4;k++){if(Math.abs(p[k])<1e-12){if(q[k]<0)return null;}else{const r=q[k]/p[k];if(p[k]<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return null;}}return[[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];}
 function addLine(points,dest,clip=true){let run=[];const flush=()=>{if(run.length>1){const start=coords.length/2;for(let i=0;i<run.length;i++){const p=run[i];if(i){const prev=run[i-1],n=Math.ceil(Math.hypot(p[0]-prev[0],p[1]-prev[1])/.18);for(let k=1;k<n;k++)coords.push(prev[0]+(p[0]-prev[0])*k/n,prev[1]+(p[1]-prev[1])*k/n);}coords.push(...p);}dest.push([start,coords.length/2]);}run=[];};
  for(let i=1;i<points.length;i++){const pair=clip?clipSegment(points[i-1],points[i]):[points[i-1],points[i]];if(!pair){flush();continue;}if(run.length&&Math.hypot(run.at(-1)[0]-pair[0][0],run.at(-1)[1]-pair[0][1])>.0001)flush();if(!run.length)run.push(pair[0]);run.push(pair[1]);}flush();
 }
 function polygonClip(poly){let out=poly;const edges=[p=>p[0]>=bounds[0],p=>p[0]<=bounds[2],p=>p[1]>=bounds[1],p=>p[1]<=bounds[3]];for(let e=0;e<4;e++){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],ia=edges[e](a),ib=edges[e](b);if(ia)out.push(a);if(ia!==ib){const axis=e<2?0:1,value=bounds[[0,2,1,3][e]],t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}}return out;}
 for(const[type,line]of data.land){const polygon=polygonClip(line);if(polygon.length>2)addLine([...polygon,polygon[0]],type==='water'?layers.water:layers.parks,false);}
 for(const[type,line]of data.roads){const group=/motorway|trunk/.test(type)?'express':/primary/.test(type)?'primary':/secondary/.test(type)?'secondary':'local';addLine(line,layers.roads[group]??=[]);}
 const seen=new Set();for(const[ref,color,line]of data.metroLines){if(seen.has(ref))continue;seen.add(ref);addLine(line,layers.rail);}
 for(let x=-12;x<=12;x+=2){const line=[];for(let y=-12;y<=12;y+=.2)line.push([x,y]);addLine(line,layers.grid,false);}
 for(let y=-12;y<=12;y+=2){const line=[];for(let x=-12;x<=12;x+=.2)line.push([x,y]);addLine(line,layers.grid,false);}
 for(let x=-13.5;x<13.5;x+=.75)for(let y=-12;y<12;y+=.75){const start=coords.length/2;coords.push(x,y,x+.75,y,x+.75,y+.75,x,y+.75);layers.heat.push({start,end:coords.length/2,xy:[x+.375,y+.375]});}
 for(const label of data.roadLabels||[]){layers.labels.push({index:coords.length/2,...label});coords.push(...label.xy);}
 flat=new Float64Array(coords);warped=new Float64Array(flat.length);frame=new Float32Array(flat.length);
}
function rebuild(animate=true){
 if(!data)return;
 model=Model.combine(data,state.mode,{day:state.day,hour:state.hour},state.subway);
 targetPressure=Float32Array.from(layers.heat,cell=>Traffic.pressure(cell.xy,state.day,state.hour));
 field=Warp.make(data.places.map(p=>p.xy),model.symmetric,referenceMinutesPerKm);embedding={positions:field.positions,error:field.error};
 for(let i=0;i<flat.length;i+=2){const p=field.apply([flat[i],flat[i+1]]);warped[i]=p[0];warped[i+1]=p[1];}
 sync();refreshStats();updatePair();if(activeLandmark!==null)updateLocalField(activeLandmark);animateGeometry(animate?(playing?1800:1050):0);routeUI?.scenarioChanged();
}
function animateGeometry(duration){
 cancelAnimationFrame(transitionFrame);transitionFrame=0;hideTooltip();
 const time=state.view==='time'&&model.available,target=time?warped:flat,targetPlaces=time?field.positions:data.places.map(p=>p.xy),toWarp=time?field.apply:(p=>p),fromWarp=displayWarp,continuous=playing;
 if(!shown)shown=new Float64Array(target);
 if(!shownPressure)shownPressure=targetPressure.slice();
 if(!shownPlaces.length)shownPlaces=targetPlaces.map(p=>[...p]);
 if(!duration||window.matchMedia('(prefers-reduced-motion: reduce)').matches){displayWarp=toWarp;shown.set(target);shownPressure.set(targetPressure);shownPlaces=targetPlaces.map(p=>[...p]);render();return;}
 const fromPressure=shownPressure.slice(),from=shown.slice(),fromPlaces=shownPlaces.map(p=>[...p]),start=performance.now();
 function step(now){const t=Math.min(1,Math.max(0,(now-start)/duration)),e=continuous?t:t*t*(3-2*t);displayWarp=p=>{const a=fromWarp(p),b=toWarp(p);return[a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e]};for(let i=0;i<shown.length;i++)shown[i]=from[i]+(target[i]-from[i])*e;for(let i=0;i<shownPressure.length;i++)shownPressure[i]=fromPressure[i]+(targetPressure[i]-fromPressure[i])*e;shownPlaces=targetPlaces.map((p,i)=>[fromPlaces[i][0]+(p[0]-fromPlaces[i][0])*e,fromPlaces[i][1]+(p[1]-fromPlaces[i][1])*e]);if(t===1){displayWarp=toWarp;shown.set(target);shownPressure.set(targetPressure);shownPlaces=targetPlaces.map(p=>[...p]);}transitionFrame=t<1?requestAnimationFrame(step):0;render();}
 transitionFrame=requestAnimationFrame(step);render();
}
function formatHour(h){return String(Math.floor(h)).padStart(2,'0')+':'+(h%1?'30':'00')}
function updateLocalField(i){if(!data)return;const values=Traffic.components(data.places[i].xy,state.day,state.hour),factor=1+values.reduce((a,b)=>a+b,0),dominant=Traffic.kinds[values.indexOf(Math.max(...values))];$('local-field').innerHTML='<span>'+tr('localMetric')+'</span><strong>'+factor.toFixed(2)+'× <small>'+tr('roadCost')+'</small></strong><p>'+tr('source_'+dominant)+'</p><small>'+tr('localMetricNote')+'</small>';}
function stopDay(){playing=false;clearTimeout(playTimer);playTimer=0;sync()}
function advanceDay(){if(!playing)return;state.hour=(state.hour+.5)%24;rebuild();playTimer=setTimeout(advanceDay,1800)}
function setClock(hour){stopDay();state.hour=Number(hour);rebuild()}

function path(start,end){if(end<=start)return;ctx.moveTo(frame[start*2],frame[start*2+1]);for(let i=start+1;i<end;i++)ctx.lineTo(frame[i*2],frame[i*2+1]);}
function drawGroup(lines,color,width,dash=[]){ctx.beginPath();for(const[a,b]of lines)path(a,b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function render(){
 if(!data||!field)return;const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);const dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 // One fixed geographic camera and minute scale across every day/hour scenario.
 const margin=w<550?24:55,s=Math.min((w-margin*2)/27.3,(h-155)/24.5)*zoom,ox=w/2+pan[0],oy=h/2+25+pan[1];
 const project=p=>[ox+p[0]*s,oy-p[1]*s];
 for(let i=0;i<shown.length;i+=2){frame[i]=ox+shown[i]*s;frame[i+1]=oy-shown[i+1]*s;}
 screen=shownPlaces.map(project);
 ctx.lineJoin='round';ctx.lineCap='round';for(const[a,b]of layers.parks){ctx.beginPath();path(a,b);ctx.fillStyle='#1d4c43';ctx.fill();}for(const[a,b]of layers.water){ctx.beginPath();path(a,b);ctx.fillStyle='#275c75';ctx.fill();ctx.strokeStyle='#427c91';ctx.lineWidth=.4;ctx.stroke();}
 if(state.heat){const colors=['#70c6b708','#91cf7518','#e5c7662c','#ee9c4c3a','#ed665247','#df495753'];for(let k=0;k<layers.heat.length;k++){const cell=layers.heat[k],pressure=shownPressure[k],bin=Math.min(5,Math.floor(pressure/.42));ctx.beginPath();path(cell.start,cell.end);ctx.closePath();ctx.fillStyle=colors[bin];ctx.fill();}}
 drawGroup(layers.roads.local||[],'#2a4e58',.6);drawGroup(layers.roads.secondary||[],'#3b6169',.85);drawGroup(layers.roads.primary||[],'#658285',1.05);drawGroup(layers.roads.express||[],'#8c9a89',1.4);
 if(state.grid)drawGroup(layers.grid,'#84c7b735',.75,[3,4]);
 if(usesSubway())drawGroup(layers.rail,'#68d9b89a',1.9);
 // Shared deformation also keeps road-name labels attached to their roads.
 if(layers.labels.length){ctx.font='10px Inter,Segoe UI,Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';for(const item of layers.labels){const q=[frame[item.index*2],frame[item.index*2+1]];if(q[0]<50||q[0]>w-50||q[1]<110||q[1]>h-65||screen.some(p=>Math.hypot(p[0]-q[0],p[1]-q[1])<58))continue;ctx.strokeStyle='#102b35';ctx.lineWidth=3;ctx.strokeText(language==='zh'?item.zh:item.name,q[0],q[1]);ctx.fillStyle='#93aaa7';ctx.fillText(language==='zh'?item.zh:item.name,q[0],q[1]);}}
 routeUI?.draw(ctx,project,displayWarp);
 const focusId=document.activeElement?.getAttribute?.('data-place');svg.replaceChildren();
 if(state.pair.length===2&&model.available&&!routeUI?.hasRoute()){const[a,b]=state.pair,p=screen[a],q=screen[b];el('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'selected-line'});const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2;el('rect',{x:mx-29,y:my-12,width:58,height:24,rx:6,class:'bubble'});el('text',{x:mx,y:my+4,'text-anchor':'middle',class:'bubble-label'}).textContent=Math.round(model.symmetric[a][b])+' '+tr('minute');}
 const labels=[{x:12,y:10,w:300,h:80}],chosen=new Set(state.pair),order=data.places.map((p,i)=>i).sort((a,b)=>Number(chosen.has(b))-Number(chosen.has(a)));
 for(const i of order){const p=data.places[i],[x,y]=screen[i],sel=chosen.has(i),[icon,category]=landmark(i);const group=el('g',{class:'node'+(sel?' selected':''),role:'button',tabindex:0,'data-place':i,'aria-label':placeName(i)+' · '+category+(sel?', '+tr('selected'):''),'aria-pressed':sel});el('title',{},group).textContent=p.name+' · '+p.zh;el('circle',{cx:x,cy:y,r:24,class:'hit'},group);el('circle',{cx:x,cy:y,r:22,class:'halo'},group);el('circle',{cx:x,cy:y,r:17,class:'landmark-badge'},group);el('text',{x,y:y+1,class:'landmark-glyph'},group).textContent=icon;
 const label=placeName(i).replace('University','Univ.'),tw=label.length*(language==='zh'?(w<550?12:13):(w<550?5.2:6)),th=16,choices=[[26,-4],[-tw-26,-4],[-tw/2,-28],[-tw/2,37],[22,28],[-tw-22,28],[22,-25],[-tw-22,-25]];let best,bestScore=Infinity;
 for(const[dx,dy]of choices){const box={x:x+dx,y:y+dy-12,w:tw,h:th};let score=labels.reduce((a,b)=>a+(box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y?100:0),0);score+=screen.reduce((a,v,j)=>a+(j!==i&&v[0]>box.x-20&&v[0]<box.x+tw+20&&v[1]>box.y-20&&v[1]<box.y+th+20?50:0),0);if(box.x<6||box.x+tw>w-6||box.y<10||box.y+th>h-40)score+=200;if(score<bestScore){bestScore=score;best={box,dx,dy};}}
 if(sel||w>=550||bestScore<100){labels.push(best.box);el('text',{x:x+best.dx,y:y+best.dy,class:'node-label'},group).textContent=label;}
 group.addEventListener('click',e=>{e.stopPropagation();if(!dragMoved&&performance.now()>=suppressClickUntil)choose(i)});group.addEventListener('pointerenter',e=>{if(!pointer&&e.pointerType!=='touch')tooltip(i)});group.addEventListener('pointerleave',hideTooltip);group.addEventListener('focus',()=>tooltip(i));group.addEventListener('blur',hideTooltip);group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i);svg.querySelector('[data-place="'+i+'"]')?.focus();}});
 }
 routeUI?.markers(svg,el,project,displayWarp);
 if(focusId!==null&&focusId!==undefined)svg.querySelector('[data-place="'+focusId+'"]')?.focus({preventScroll:true});
 if(transitionFrame){safeText('scale',tr('changingView'));return;}
 const minutes=state.view==='time'&&model.available,unitFactor=minutes?field.minutesPerKm:1,target=70/s*unitFactor,values=minutes?[5,10,15,20,30,45,60]:[1,2,3,5,10],v=values.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);$('scale').innerHTML=v+' '+tr(minutes?'minuteScale':'km')+'<div class="ruler" style="width:'+(v/unitFactor*s)+'px"></div>';
}
function setView(view){if(!['time','geographic'].includes(view))throw Error('Invalid view');state.view=view;sync();animateGeometry(1200);}

function requestRender(){if(anim)cancelAnimationFrame(anim);anim=requestAnimationFrame(()=>{anim=0;render()})}
const mapPointers=new Map();let pinch=null,suppressClickUntil=0;
function beginPinch(){const[a,b]=[...mapPointers.values()],r=stage.getBoundingClientRect();pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),mid:[(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top],zoom,pan:[...pan]};pointer=null;dragMoved=true;}
svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;mapPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});hideTooltip();if(mapPointers.size===1){pointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:[...pan]};dragMoved=false;}else if(mapPointers.size===2)beginPinch();if(e.target===svg)svg.setPointerCapture(e.pointerId)});
window.addEventListener('pointermove',e=>{if(!mapPointers.has(e.pointerId))return;mapPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&mapPointers.size>=2){const[a,b]=[...mapPointers.values()],r=stage.getBoundingClientRect(),mid=[(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top],distance=Math.hypot(a.x-b.x,a.y-b.y),centre=[stage.clientWidth/2,stage.clientHeight/2+25];zoom=Math.max(.55,Math.min(4,pinch.zoom*distance/pinch.distance));const ratio=zoom/pinch.zoom;pan=mid.map((v,k)=>v-centre[k]-(pinch.mid[k]-centre[k]-pinch.pan[k])*ratio);dragMoved=true;suppressClickUntil=performance.now()+350;requestRender();return;}if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>4)dragMoved=true;if(dragMoved){pan=[pointer.pan[0]+dx,pointer.pan[1]+dy];suppressClickUntil=performance.now()+350;requestRender();}});
function releasePointer(e){if(!mapPointers.has(e.pointerId))return;mapPointers.delete(e.pointerId);if(dragMoved)suppressClickUntil=performance.now()+350;pinch=null;if(mapPointers.size===1){const[id,p]=[...mapPointers.entries()][0];pointer={id,x:p.x,y:p.y,pan:[...pan]};}else pointer=null;if(!mapPointers.size)setTimeout(()=>{dragMoved=false},0);}
window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);window.addEventListener('blur',()=>{mapPointers.clear();pointer=null;pinch=null;dragMoved=false});
stage.addEventListener('wheel',e=>{if(!data)return;e.preventDefault();hideTooltip();zoom=Math.max(.55,Math.min(4,zoom*(e.deltaY>0?.92:1.08)));requestRender()},{passive:false});
$('zoom-in').onclick=()=>{zoom=Math.min(4,zoom*1.2);render()};$('zoom-out').onclick=()=>{zoom=Math.max(.55,zoom/1.2);render()};$('zoom-fit').onclick=()=>{if(!data||!field)return;const points=state.view==='time'&&model.available?field.positions:data.places.map(p=>p.xy),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),w=stage.clientWidth,h=stage.clientHeight,margin=w<550?24:55,base=Math.min((w-margin*2)/27.3,(h-155)/24.5),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;zoom=Math.max(.55,Math.min(4,Math.min((w-110)/(Math.max(...xs)-Math.min(...xs)),(h-240)/(Math.max(...ys)-Math.min(...ys)))/base));pan=[-cx*base*zoom,cy*base*zoom+15];render()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;rebuild()});document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{state.day=b.dataset.day;rebuild()});document.querySelectorAll('[data-hour]').forEach(b=>b.onclick=()=>setClock(Number(b.dataset.hour)));document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('subway').onchange=e=>{state.subway=e.target.checked;rebuild()};
$('city-hour').oninput=e=>setClock(e.target.value);$('play-day').onclick=()=>{if(playing)stopDay();else{playing=true;sync();playTimer=setTimeout(advanceDay,1800)}};$('show-field').onchange=e=>{state.heat=e.target.checked;sync();render()};window.addEventListener('pagehide',()=>{clearTimeout(playTimer);cancelAnimationFrame(transitionFrame)});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDay()});
$('show-grid').onchange=e=>{state.grid=e.target.checked;render()};
$('place-a').onchange=e=>{const a=Number(e.target.value),b=state.pair[1];state.pair=b!==undefined&&b!==a?[a,b]:[a];showLandmark(a);updatePair();render()};$('place-b').onchange=e=>{if(e.target.value==='')return;const b=Number(e.target.value),a=state.pair[0];state.pair=a===b?[a]:[a,b];showLandmark(b);updatePair();render()};
$('reset').onclick=()=>{if(!data)return;state.pair=[0,data.places.findIndex(p=>p.id==='guomao')];$('landmark-card').hidden=true;updatePair();render()};$('landmark-close').onclick=()=>{$('landmark-card').hidden=true;activeLandmark=null};
$('about-button').onclick=()=>$('about').showModal();$('close-about').onclick=()=>$('about').close();$('about').onclick=e=>{if(e.target===$('about')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
function fillPlaceSelectors(){if(!data)return;for(const id of['place-a','place-b']){const select=$(id);select.replaceChildren();if(id==='place-b'){const option=document.createElement('option');option.value='';option.textContent=tr('chooseLandmark');select.appendChild(option)}data.places.forEach((p,i)=>{const option=document.createElement('option');option.value=i;option.textContent=landmark(i)[0]+' '+placeName(i);select.appendChild(option)})}$('place-a').value=state.pair[0];$('place-b').value=state.pair[1]??'';}
function changeLanguage(value){if(!['en','zh'].includes(value))throw Error('Unsupported language');language=value;try{localStorage.setItem('beijing-map-language',language)}catch{}applyLanguage();fillPlaceSelectors();sync();refreshStats();updatePair();if(activeLandmark!==null&&!$('landmark-card').hidden)showLandmark(activeLandmark);hideTooltip();routeUI?.refresh();render();}
const compactLayout=window.matchMedia('(max-width: 900px)');
function applyResponsiveLayout(){const compact=compactLayout.matches;$('controls-panel').open=!compact;$(compact?'mobile-pair':'desktop-pair').appendChild($('pair-panel'));$(compact?'mobile-details':'stage').appendChild($('landmark-card'));hideTooltip();requestRender();}
compactLayout.addEventListener('change',applyResponsiveLayout);applyResponsiveLayout();
$('close-controls').onclick=()=>{$('controls-panel').open=false;$('controls-summary').focus({preventScroll:true});$('controls-summary').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>changeLanguage(b.dataset.language));applyLanguage();sync();
routeUI=createRouteUI({settings:()=>({mode:state.mode,day:state.day,hour:state.hour,subway:usesSubway()}),render:requestRender,stop:stopDay,pair:()=>data?state.pair.map(i=>data.places[i]):[],fit(raw){if(!raw.length)return;const points=raw.map(displayWarp),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),w=stage.clientWidth,h=stage.clientHeight,base=Math.min((w-(w<550?48:110))/27.3,(h-155)/24.5),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;zoom=Math.max(.55,Math.min(4,Math.min((w-90)/Math.max(.2,Math.max(...xs)-Math.min(...xs)),(h-160)/Math.max(.2,Math.max(...ys)-Math.min(...ys)))/base));pan=[-cx*base*zoom,cy*base*zoom+5];render()}});
new ResizeObserver(requestRender).observe(stage);
Promise.all(['data.json','traffic.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('Data unavailable');return r.json()}))).then(([d,traffic])=>{data=d;data.traffic=traffic;state.pair=[0,data.places.findIndex(p=>p.id==='guomao')];fillPlaceSelectors();makeGeometry();$('message').classList.add('hidden');document.body.classList.add('loaded');rebuild(false);registerTools();}).catch(e=>{$('message').textContent=tr('loadError');console.error(e)});
function registerTools(){const context=document.modelContext;if(!context?.registerTool)return;const controller=new AbortController();window.addEventListener('pagehide',()=>controller.abort(),{once:true});try{Promise.resolve(context.registerTool({name:'configure_beijing_time_map',title:'Configure Beijing time map',description:'Set Beijing weekday/weekend, local hour, transport, subway alternative, language and map view. All estimates are illustrative traffic snapshots.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['car','bus','bike']},day:{type:'string',enum:['weekday','weekend']},hour:{type:'number',minimum:0,maximum:23.5,multipleOf:.5},subway:{type:'boolean'},view:{type:'string',enum:['time','geographic']},language:{type:'string',enum:['en','zh']},grid:{type:'boolean'},heat:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected an object');const allowed={mode:['car','bus','bike'],day:['weekday','weekend'],view:['time','geographic'],language:['en','zh']};for(const k of Object.keys(input)){if(!['mode','day','hour','subway','view','language','grid','heat'].includes(k))throw Error('Unknown setting');if(['subway','grid','heat'].includes(k)&&typeof input[k]!=='boolean')throw Error(k+' must be boolean');if(allowed[k]&&!allowed[k].includes(input[k]))throw Error('Invalid '+k);if(k==='hour'&&(!Number.isFinite(input.hour)||input.hour<0||input.hour>23.5||input.hour*2%1))throw Error('Hour must be a half-hour from 0 to 23.5');}stopDay();for(const k of['mode','day','hour','subway','grid','heat','view'])if(k in input)state[k]=input[k];if('language'in input)changeLanguage(input.language);rebuild();return{settings:{...state,subway:usesSubway(),language},serviceModelAvailable:model.available,layoutMismatchPercent:model.available?Math.round(field.error):null,places:data.places.map((p,i)=>placeName(i)),estimatedMinutes:model.available?model.symmetric:null};}},{signal:controller.signal})).catch(()=>{});}catch{}}
