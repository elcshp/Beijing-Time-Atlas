/* A phenomenological congestion field, not an Einstein-equation solver. */
(function(root){'use strict';
const kinds=['core','commute','tourism','night','hub'];
const pulse=(h,c,w)=>{const d=Math.min(Math.abs(h-c),24-Math.abs(h-c));return Math.exp(-.5*(d/w)**2)};
function weights(day,h){const weekend=day==='weekend',morning=pulse(h,8.2,1.35),home=pulse(h,18,1.8),daytime=pulse(h,13.5,4.8);return[
 .16+.60*daytime+.20*home,
 weekend?.12*pulse(h,13,4):.95*morning+1.15*home+.16*daytime,
 (weekend?1.15:.55)*pulse(h,13.8,3.5)+.15*pulse(h,19,2),
 (weekend?1.05:.75)*pulse(h,21.5,2.15),
 .18+.35*morning+.45*home+.2*daytime
 ];}
const zone=(id,en,zh,kind,lon,lat,radius,weight)=>({id,en,zh,kind,xy:[(lon-116.39)*85.32,(lat-39.93)*111.2],radius,weight});
const zones=[
 zone('inner','Inner-city bottlenecks','老城持续瓶颈','core',116.391,39.919,3.25,.78),
 zone('guomao','Guomao / CBD','国贸 / CBD','commute',116.462,39.911,2.3,.95),
 zone('finance','Financial Street','金融街','commute',116.357,39.917,1.8,.65),
 zone('tech','Zhongguancun','中关村','commute',116.3165,39.981,2.5,.80),
 zone('wangjing','Wangjing','望京','commute',116.463,39.9975,2,.55),
 zone('palace','Tiananmen / Qianmen','天安门 / 前门','tourism',116.3975,39.902,1.5,.78),
 zone('shops','Wangfujing','王府井','tourism',116.411,39.9145,1.2,.65),
 zone('lakes','Shichahai','什刹海','tourism',116.3878,39.939,1.35,.65),
 zone('summer','Summer Palace approaches','颐和园周边','tourism',116.278,39.992,1.5,.95),
 zone('temple','Temple of Heaven','天坛','tourism',116.418,39.8837,1.4,.65),
 zone('art','798 Art District','798艺术区','tourism',116.4947,39.9842,1.2,.60),
 zone('sanlitun','Sanlitun evening activity','三里屯夜间活动','night',116.4543,39.9355,1.6,1.10),
 zone('houhai','Houhai evening activity','后海夜间活动','night',116.386,39.94,1.15,.6),
 zone('west','Beijing West approaches','北京西站周边','hub',116.321,39.895,1.3,.55),
 zone('south','Beijing South approaches','北京南站周边','hub',116.3786,39.8652,1.3,.55)
];
function components(p,day,h){const w=weights(day,h),out=[.08*w[0],0,0,0,0];for(const z of zones){const k=kinds.indexOf(z.kind),r2=((p[0]-z.xy[0])**2+(p[1]-z.xy[1])**2)/z.radius**2;out[k]+=z.weight*Math.exp(-.5*r2)*w[k];}return out;}
function pressure(p,day,h){return components(p,day,h).reduce((a,b)=>a+b,0)}
function multiplier(p,day,h,roadClass=1){return 1+pressure(p,day,h)*[.80,1,.72][roadClass]}
function period(h){return h<5?'midnight':h<11?'morning':h<14?'noon':h<17?'afternoon':h<20?'offwork':h<24?'evening':'midnight'}
function service(h){return h>=6&&h<22}
const api={kinds,zones,weights,components,pressure,multiplier,period,service};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.TimeAtlasTraffic=api;
})(globalThis);
