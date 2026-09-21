"""Prepare OSM network matrices. Raw Overpass downloads are scratch inputs."""
import json, math, collections, pathlib, argparse
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree

ROOT=pathlib.Path(__file__).parent
RAW=ROOT/'raw'
CX,CY=116.39,39.93
def xy(lon,lat): return [(lon-CX)*85.32,(lat-CY)*111.2]
places_raw=[
 ('zhongguancun','Zhongguancun','中关村',116.3165,39.9810),
 ('pku','Peking University','北京大学',116.3050,39.9905),
 ('tsinghua','Tsinghua University','清华大学',116.3265,40.0030),
 ('wudaokou','Wudaokou','五道口',116.3316,39.9915),
 ('summer','Summer Palace','颐和园',116.2732,39.9999),
 ('xizhimen','Xizhimen','西直门',116.3490,39.9407),
 ('zoo','Beijing Zoo','北京动物园',116.3334,39.9410),
 ('national','National Library','国家图书馆',116.3180,39.9431),
 ('wukesong','Wukesong','五棵松',116.2683,39.9075),
 ('gongzhufen','Gongzhufen','公主坟',116.3032,39.9075),
 ('west','Beijing West','北京西站',116.3210,39.8950),
 ('financial','Financial Street','金融街',116.3573,39.9169),
 ('xidan','Xidan','西单',116.3670,39.9075),
 ('tiananmen','Tiananmen','天安门',116.3975,39.9087),
 ('qianmen','Qianmen','前门',116.3976,39.8990),
 ('temple','Temple of Heaven','天坛',116.4180,39.8837),
 ('south','Beijing South','北京南站',116.3786,39.8652),
 ('taoranting','Taoranting','陶然亭',116.3744,39.8785),
 ('wangfujing','Wangfujing','王府井',116.4110,39.9145),
 ('beihai','Beihai Park','北海公园',116.3820,39.9245),
 ('shichahai','Shichahai','什刹海',116.3878,39.9390),
 ('gulou','Gulou','鼓楼',116.3936,39.9489),
 ('lama','Lama Temple','雍和宫',116.4173,39.9475),
 ('andong','Andingmen','安定门',116.4070,39.9492),
 ('olympic','Olympic Green','奥林匹克公园',116.3912,40.0020),
 ('bird','Bird’s Nest','鸟巢',116.3905,39.9915),
 ('sanyuan','Sanyuanqiao','三元桥',116.4499,39.9609),
 ('wangjing','Wangjing','望京',116.4630,39.9975),
 ('art','798 Art District','798艺术区',116.4947,39.9842),
 ('sanlitun','Sanlitun','三里屯',116.4543,39.9355),
 ('dongzhimen','Dongzhimen','东直门',116.4281,39.9412),
 ('chaoyang','Chaoyang Park','朝阳公园',116.4773,39.9385),
 ('guomao','Guomao','国贸',116.4617,39.9093),
 ('cctv','CCTV Headquarters','央视总部',116.4582,39.9163),
 ('shuangjing','Shuangjing','双井',116.4618,39.8934),
 ('station','Beijing Railway Station','北京站',116.4272,39.9027),
 ('panjiayuan','Panjiayuan','潘家园',116.4600,39.8765),
 ('shilihe','Shilihe','十里河',116.4575,39.8653),
 ('sihui','Sihui','四惠',116.4958,39.9085),
 ('qingnian','Qingnianlu','青年路',116.5170,39.9240),
]
places_raw.append(('rdfz','RDFZ','人大附中',116.3090306,39.9734083))
selected={'rdfz','zhongguancun','summer','tsinghua','xizhimen','national','wukesong','west','financial','tiananmen','temple','south','wangfujing','shichahai','olympic','wangjing','art','sanlitun','chaoyang','guomao','sihui'}
places=[dict(id=i,name=n,zh=z,lon=x,lat=y,xy=xy(x,y)) for i,n,z,x,y in places_raw if i in selected]
points=np.array([p['xy'] for p in places]); N=len(points)
elements={};osm_timestamp=''
for file in ['beijing-roads-osm.json','beijing-local-osm.json']:
 j=json.loads((RAW/file).read_text());osm_timestamp=j.get('osm3s',{}).get('timestamp_osm_base','2026-09-20')
 for e in j['elements']: elements[(e['type'],e['id'])]=e
nodes={i:e for (t,i),e in elements.items() if t=='node'}
ways=[e for (t,i),e in elements.items() if t=='way']
ids=list(nodes); idx={i:n for n,i in enumerate(ids)}
coords=np.array([xy(nodes[i]['lon'],nodes[i]['lat']) for i in ids]); count=len(ids)
scenarios=['light','typical','rush']
speed_car={'motorway':65,'trunk':55,'primary':38,'secondary':32,'tertiary':26,'unclassified':22,'residential':18,'living_street':10,'service':12}
traffic=[[1,1,1],[.78,.67,.81],[.50,.42,.65]]
matrices={}; distances={}; snaps={}; map_roads=[]; lands=[]
for w in ways:
 t=w['tags']; h=t.get('highway',''); ns=w.get('nodes',[])
 if len(ns)<2: continue
 line=[coords[idx[i]].round(4).tolist() for i in ns if i in idx]
 if h and h not in ['footway','path','service','living_street','pedestrian','cycleway']:
  # Preserve curves while limiting geometry density to around 65 m.
  simp=[line[0]]
  for p in line[1:-1]:
   if math.dist(p,simp[-1])>.065: simp.append(p)
  simp.append(line[-1]);map_roads.append([h,simp])
 elif t.get('leisure')=='park' or t.get('natural')=='water':
  if len(line)>3: lands.append(['water' if t.get('natural')=='water' else 'park',line])

def graph_for(mode,scenario):
 edge={}
 for w in ways:
  tags=w['tags'];h=tags.get('highway','');base=h.replace('_link','')
  if not h or tags.get('access') in ['private','no']: continue
  if mode in ['car','bus']:
   if base not in speed_car or tags.get('motor_vehicle') in ['no','private'] or tags.get('vehicle')=='no': continue
  elif mode=='bike':
   if base in ['motorway','trunk'] or tags.get('bicycle') in ['no','private'] or (h in ['footway','pedestrian'] and tags.get('bicycle') not in ['yes','designated','permissive']): continue
  elif mode=='walk':
   if base in ['motorway','trunk'] or tags.get('foot') in ['no','private']: continue
  ns=w.get('nodes',[])
  one=tags.get('oneway','no')
  if mode=='walk' or (mode=='bike' and tags.get('oneway:bicycle')=='no'):one='no'
  if mode in ['car','bus'] and (base=='motorway' or tags.get('junction')=='roundabout') and 'oneway' not in tags:one='yes'
  for u,v in zip(ns,ns[1:]):
   if u not in idx or v not in idx:continue
   a,b=idx[u],idx[v];length=float(np.linalg.norm(coords[a]-coords[b]));
   if length<.0001:continue
   if mode in ['car','bus']:
    group=0 if base in ['motorway','trunk'] else 1 if base in ['primary','secondary'] else 2
    speed=speed_car[base]*traffic[scenario][group]
    if '_link' in h:speed=min(speed,25)
    if mode=='bus': speed=min(speed*.72,38)
    cost=length/speed*60 + (length*1.3 if mode=='bus' else length*.22)
   elif mode=='bike':cost=length/(12 if h=='path' else 15)*60+length*.22
   else:cost=length/4.8*60
   if one!='-1':edge[(a,b)]=min(edge.get((a,b),float('inf')),cost)
   if one not in ['yes','1','true']:edge[(b,a)]=min(edge.get((b,a),float('inf')),cost)
 ar=np.array(list(edge));val=np.array(list(edge.values()))
 graph=csr_matrix((val,(ar[:,0],ar[:,1])),shape=(count,count))
 _,labels=connected_components(graph,directed=True,connection='strong')
 biggest=np.argmax(np.bincount(labels));available=np.where(labels==biggest)[0]
 tree=cKDTree(coords[available]);offset,near=tree.query(points);chosen=available[near]
 return graph,chosen,offset,available

walk=None
for mode in ['car','bus','bike','walk']:
 for scenario in (range(3) if mode in ['car','bus'] else [0]):
  graph,chosen,offset,available=graph_for(mode,scenario)
  print(mode,scenario,'graph',count,graph.nnz,'snap max',round(max(offset),3),flush=True)
  result=dijkstra(graph,directed=True,indices=chosen)
  mat=result[:,chosen].copy()
  if mode=='walk': walk=(graph,result,available,chosen,offset);continue
  extra=(offset[:,None]+offset[None,:])/4.8*60
  # Per-trip preparation/parking or average bus wait and access. Bus corridor model only.
  mat+=extra+({'car':4,'bus':10,'bike':1}[mode]);np.fill_diagonal(mat,0)
  assert np.isfinite(mat).all()
  matrices[mode+'_'+scenarios[scenario]]=np.round(mat,2).tolist()
  snaps[mode]=np.round(offset,3).tolist()

# Metro compiled separately below if snapshot is present.
metro_data=json.loads((RAW/'beijing-metro-osm.json').read_text())
mels={(e['type'],e['id']):e for e in metro_data['elements']}
routes=[e for e in metro_data['elements'] if e['type']=='relation' and e.get('tags',{}).get('route')=='subway']
stations={};lines=[]
for route in routes:
 tag=route.get('tags',{});ref=tag.get('ref') or tag.get('name:en') or tag.get('name',str(route['id']))
 seq=[]
 for mem in route['members']:
  if mem['type']!='node' or mem.get('role','') not in ['stop','stop_entry_only','stop_exit_only']:continue
  n=mels.get(('node',mem['ref']))
  if not n:continue
  nt=n.get('tags',{});name=nt.get('name','')
  if not name:continue
  pos=xy(n['lon'],n['lat'])
  # Merge nearby platform stop positions using station names.
  key=name
  if key not in stations:stations[key]={'name':name,'xy':pos,'en':nt.get('name:en',name)}
  if not seq or seq[-1]!=key:seq.append(key)
 if len(seq)>1: lines.append({'ref':ref,'color':tag.get('colour','#4bbda3'),'stations':seq})
print('metro routes',len(lines),'stations',len(stations),flush=True)
assert len(stations)>70,'Insufficient metro stop data'
# Platform states prevent zero-cost line changes. Same station transfers cost 5 min.
states=[]; state_idx={}; rail_edges={};by_station=collections.defaultdict(list)
for line in lines:
 ref=line['ref']
 for name in line['stations']:
  key=(ref,name)
  if key not in state_idx:
   state_idx[key]=len(states);states.append(key);by_station[name].append(state_idx[key])
 for a,b in zip(line['stations'],line['stations'][1:]):
  u,v=state_idx[(ref,a)],state_idx[(ref,b)]
  # 36 km/h running speed, 0.65 min dwell per stop; geometry approximation factor.
  t=math.dist(stations[a]['xy'],stations[b]['xy'])*1.08/36*60+.65
  rail_edges[(u,v)]=min(rail_edges.get((u,v),float('inf')),t)
for inds in by_station.values():
 for a in inds:
  for b in inds:
   if a!=b:rail_edges[(a,b)]=5
ra=np.array(list(rail_edges)); rv=np.array(list(rail_edges.values()))
rail=csr_matrix((rv,(ra[:,0],ra[:,1])),shape=(len(states),len(states)))
rd=dijkstra(rail,directed=True)
graph,result,available,chosen,offset=walk
tree=cKDTree(coords[available]);station_names=list(stations)
spos=np.array([stations[x]['xy'] for x in station_names]);soff,snear=tree.query(spos)
snode=available[snear];walk_access=result[:,snode]+offset[:,None]/4.8*60+soff[None,:]/4.8*60
# Reject out-of-bounds stations and unreasonable last-mile connectors.
for k,n in enumerate(station_names):
 sx,sy=stations[n]['xy']
 if soff[k]>.7:walk_access[:,k]=np.inf
nameidx={x:i for i,x in enumerate(station_names)}
access=np.array([walk_access[:,nameidx[n]] for ref,n in states]).T
access[access>25]=np.inf
metro=np.full((N,N),np.inf);metro_info={}
for i in range(N):
 # 3 min entrance/security, 3 min average wait; 2 min exit.
 via=access[i,:,None]+6+rd
 start=np.argmin(via,axis=0);v=via[start,np.arange(len(states))]
 for j in range(N):
  totals=v+access[j]+2
  b=int(np.argmin(totals));a=int(start[b]);metro[i,j]=totals[b]
  if np.isfinite(metro[i,j]):
   metro_info[f'{i}_{j}']={'from':states[a][1],'to':states[b][1],'access':round(access[i,a],1),'exit':round(access[j,b],1),'rail':round(rd[a,b],1)}
np.fill_diagonal(metro,0)
matrices['metro']=np.where(np.isfinite(metro),np.round(metro,2),-1).tolist()
straight=np.linalg.norm(points[:,None,:]-points[None,:,:],axis=2)
payload={'places':places,'matrices':matrices,'straight':np.round(straight,3).tolist(),'metroInfo':metro_info,
 'roads':map_roads,'land':lands,'metroLines':[[l['ref'],l['color'],[stations[n]['xy'] for n in l['stations']]] for l in lines],
 'meta':{'osmTimestamp':osm_timestamp,'date':'2026-09-20','roadWays':len(map_roads),'metroStations':len(stations),'places':N,'snapKm':snaps,'bounds':[116.23,39.82,116.55,40.04]}}
parser=argparse.ArgumentParser();parser.add_argument('--output',type=pathlib.Path,default=ROOT/'dist/data.json');output=parser.parse_args().output
output.write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False))
print('Wrote', output.stat().st_size, 'bytes',flush=True)
