"""Export the same directed OSM cost network for on-device point-to-point routing.
No provider key. Local named-place search; rail links are station-to-station schematics.
"""
import json,math,pathlib,collections,gzip
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
ROOT=pathlib.Path(__file__).parent; RAW=ROOT/'raw'
data=json.loads((ROOT/'dist/data.json').read_text());elements={}
for file in ['beijing-roads-osm.json','beijing-local-osm.json']:
 for e in json.loads((RAW/file).read_text())['elements']:elements[e['type'],e['id']]=e
nodes={i:e for(t,i),e in elements.items() if t=='node'};ids=list(nodes);idx={v:i for i,v in enumerate(ids)}
coords=np.array([[(nodes[i]['lon']-116.39)*85.32,(nodes[i]['lat']-39.93)*111.2] for i in ids]);n=len(ids)
speeds={'motorway':65,'trunk':55,'primary':38,'secondary':32,'tertiary':26,'unclassified':22,'residential':18,'living_street':10,'service':12};edges={};named={}
for (typ,_),w in elements.items():
 if typ!='way':continue
 t=w.get('tags',{});h=t.get('highway','');base=h.replace('_link','');ns=[idx[i] for i in w.get('nodes',[]) if i in idx]
 name=t.get('name','')
 if name and ns and (h or t.get('leisure')=='park'):
  key=(name,t.get('name:en',name));named.setdefault(key,[]).extend(ns)
 if not h or t.get('access') in ['private','no']:continue
 car=base in speeds and t.get('motor_vehicle') not in ['no','private'] and t.get('vehicle')!='no'
 bike=base not in ['motorway','trunk'] and t.get('bicycle') not in ['no','private'] and not(h in ['footway','pedestrian'] and t.get('bicycle') not in ['yes','designated','permissive'])
 walk=base not in ['motorway','trunk'] and t.get('foot') not in ['no','private']
 one=t.get('oneway','no');carone=t.get('oneway','yes' if base=='motorway' or t.get('junction')=='roundabout' else 'no');bikeone='no' if t.get('oneway:bicycle')=='no' else one
 speed=min(speeds.get(base,0),25) if '_link' in h else speeds.get(base,0)
 group=0 if base in ['motorway','trunk'] else 1 if base in ['primary','secondary'] else 2
 for a,b in zip(ns,ns[1:]):
  length=float(np.linalg.norm(coords[b]-coords[a]))
  if length<.0001:continue
  for u,v,reverse in [(a,b,False),(b,a,True)]:
   c=car and (carone not in ['yes','1','true'] if reverse else carone!='-1')
   k=bike and (bikeone not in ['yes','1','true'] if reverse else bikeone!='-1')
   if not(c or k or walk):continue
   row=edges.setdefault((u,v),[length,0,group,0,0])
   if c and speed>row[1]:row[1]=speed;row[2]=group
   rate=5.22 if h=='path' else 4.22
   if k:row[3]=min(row[3] or rate,rate)
   if walk:row[4]=1
# Snap to the same largest strongly connected component as the pair-time model.
keys=np.array(list(edges));vals=np.array(list(edges.values()))
valid=[]
for col in [1,3,4]:
 mask=vals[:,col]>0;g=csr_matrix((np.ones(mask.sum()),(keys[mask,0],keys[mask,1])),shape=(n,n));_,labels=connected_components(g,directed=True,connection='strong');big=np.argmax(np.bincount(labels));valid.append(labels==big)
# Nodes outside the largest components remain in the export only if another mode uses them.
used=np.where(valid[0]|valid[1]|valid[2])[0];remap=np.full(n,-1);remap[used]=np.arange(len(used));export=[]
for (a,b),r in edges.items():
 if remap[a]<0 or remap[b]<0:continue
 r=list(r)
 for mask,col in zip(valid,[1,3,4]):
  if not(mask[a] and mask[b]):r[col]=0
 if r[1] or r[3] or r[4]:export.append([int(remap[a]),int(remap[b]),round(r[0],7),r[1],int(r[2]),r[3],int(r[4])])
export.sort(key=lambda r:r[0]);xy=np.round(coords[used],6).tolist();flags=[int(valid[0][i])+2*int(valid[1][i])+4*int(valid[2][i]) for i in used]
metro=json.loads((RAW/'beijing-metro-osm.json').read_text());mels={(e['type'],e['id']):e for e in metro['elements']};stations={};lines=[]
for route in metro['elements']:
 if route['type']!='relation' or route.get('tags',{}).get('route')!='subway':continue
 t=route['tags'];ref=t.get('ref') or t.get('name:en') or t.get('name',str(route['id']));seq=[]
 for mem in route['members']:
  if mem['type']!='node' or mem.get('role','') not in ['stop','stop_entry_only','stop_exit_only']:continue
  p=mels.get(('node',mem['ref']));tag=p.get('tags',{}) if p else {};name=tag.get('name','')
  if not name:continue
  stations.setdefault(name,{'zh':name,'name':tag.get('name:en',data.get('stationNames',{}).get(name,name)),'xy':[(p['lon']-116.39)*85.32,(p['lat']-39.93)*111.2]})
  if not seq or seq[-1]!=name:seq.append(name)
 if len(seq)>1:lines.append((ref,seq))
snames=list(stations);si={s:i for i,s in enumerate(snames)};states=[];stateidx={};by=collections.defaultdict(list);rail={}
for ref,seq in lines:
 for name in seq:
  if (ref,name) not in stateidx:stateidx[ref,name]=len(states);by[name].append(len(states));states.append([ref,si[name]])
 for a,b in zip(seq,seq[1:]):
  pair=(stateidx[ref,a],stateidx[ref,b]);cost=math.dist(stations[a]['xy'],stations[b]['xy'])*1.08/36*60+.65;rail[pair]=min(rail.get(pair,float('inf')),cost)
for inds in by.values():
 for a in inds:
  for b in inds:
   if a!=b:rail[a,b]=5
walkids=np.where(valid[2])[0];tree=cKDTree(coords[walkids])
for name in snames:
 p=stations[name];off,near=tree.query(p['xy']);p['node']=int(remap[walkids[near]]) if off<=.7 else -1;p['offset']=round(float(off),7)
cat=[dict(p,kind='landmark') for p in data['places']]
def inside(p):return -13.65<=p[0]<=13.65 and -12.23<=p[1]<=12.23
for i,s in enumerate(stations.values()):
 if inside(s['xy']):cat.append({'id':'station-'+str(i),'name':s['name'],'zh':s['zh'],'xy':s['xy'],'kind':'station'})
for (zh,en),ns in named.items():
 pts=coords[ns];c=pts.mean(axis=0);p=pts[np.argmin(np.linalg.norm(pts-c,axis=1))].tolist()
 if inside(p):cat.append({'id':'osm-'+str(len(cat)),'name':en,'zh':zh,'xy':p,'kind':'street'})
# Stable bilingual aliases for the core landmarks; all other names come from OSM.
alias={'rdfz':'ren da fu zhong rendafuzhong 中国人民大学附属中学','summer':'yi he yuan yiheyuan','sanlitun':'san li tun','zhongguancun':'zhong guan cun','tsinghua':'qing hua da xue','guomao':'guo mao'}
for p in cat:p['aliases']=alias.get(p['id'],'')
out={'xy':xy,'flags':flags,'edges':export,'stations':list(stations.values()),'states':states,'rail':[[a,b,round(t,7)]for(a,b),t in rail.items()]}
raw=json.dumps(out,separators=(',',':'),ensure_ascii=False).encode();(ROOT/'dist/routes-graph.json.gz').write_bytes(gzip.compress(raw,compresslevel=6));(ROOT/'dist/search-places.json').write_text(json.dumps(cat,separators=(',',':'),ensure_ascii=False))
print('Routing:',len(xy),'nodes,',len(export),'directed edges;',len(cat),'searchable places;',len(raw),'raw bytes;',len(gzip.compress(raw)),'compressed',flush=True)
