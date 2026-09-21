"""Route all pairs on the OSM graph for 96 spatial traffic scenarios.
Traffic-field coefficients are explicit hypotheses, not observed Beijing speeds.
The existing base map, stations and landmark identities are preserved.
"""
import json, math, pathlib, subprocess
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree
ROOT=pathlib.Path(__file__).parent
RAW=ROOT/'raw'
data=json.loads((ROOT/'dist/data.json').read_text());points=np.array([p['xy'] for p in data['places']]);n=len(points)
config=json.loads(subprocess.check_output(['node','-e',"const f=require('./dist/traffic-field.js');console.log(JSON.stringify({zones:f.zones,kinds:f.kinds,weights:Object.fromEntries(['weekday','weekend'].map(d=>[d,Array.from({length:48},(_,i)=>f.weights(d,i/2))]))}))"],cwd=ROOT))
elements={}
for file in ['beijing-roads-osm.json','beijing-local-osm.json']:
 for e in json.loads((RAW/file).read_text())['elements']:elements[(e['type'],e['id'])]=e
nodes={i:e for (t,i),e in elements.items() if t=='node'};ids=list(nodes);idx={i:n for n,i in enumerate(ids)}
coords=np.array([[(nodes[i]['lon']-116.39)*85.32,(nodes[i]['lat']-39.93)*111.2] for i in ids]);count=len(ids)
speeds={'motorway':65,'trunk':55,'primary':38,'secondary':32,'tertiary':26,'unclassified':22,'residential':18,'living_street':10,'service':12}
edges={}
for (typ,_),w in elements.items():
 if typ!='way':continue
 t=w.get('tags',{});h=t.get('highway','');base=h.replace('_link','')
 if base not in speeds or t.get('access') in ['private','no'] or t.get('motor_vehicle') in ['private','no'] or t.get('vehicle')=='no':continue
 speed=min(speeds[base],25) if '_link' in h else speeds[base]
 group=0 if base in ['motorway','trunk'] else 1 if base in ['primary','secondary'] else 2
 one=t.get('oneway','yes' if base=='motorway' or t.get('junction')=='roundabout' else 'no')
 for u,v in zip(w.get('nodes',[]),w.get('nodes',[])[1:]):
  if u not in idx or v not in idx:continue
  a,b=idx[u],idx[v];length=np.linalg.norm(coords[b]-coords[a])
  if length<.0001:continue
  for pair in ([] if one=='-1' else [(a,b)])+([] if one in ['yes','1','true'] else [(b,a)]):
   if pair not in edges or length/speed<edges[pair][0]/edges[pair][1]:edges[pair]=(length,speed,group)
keys=np.array(sorted(edges));vals=np.array([edges[tuple(k)] for k in keys]);length,speed,group=vals.T
mid=(coords[keys[:,0]]+coords[keys[:,1]])/2;sensitivity=np.array([.80,1,.72])[group.astype(int)]
basis=np.zeros((len(keys),5));basis[:,0]=.08
for z in config['zones']:
 k=config['kinds'].index(z['kind']);r2=np.sum((mid-z['xy'])**2,axis=1)/z['radius']**2;basis[:,k]+=z['weight']*np.exp(-.5*r2)
graph=csr_matrix((length/speed*60,(keys[:,0],keys[:,1])),shape=(count,count))
_,labels=connected_components(graph,directed=True,connection='strong');available=np.where(labels==np.argmax(np.bincount(labels)))[0]
offset,near=cKDTree(coords[available]).query(points);chosen=available[near]
extra=(offset[:,None]+offset[None,:])/4.8*60
out={'meta':{'kind':'Illustrative spatial traffic scenarios; not calibrated or live','stepMinutes':30,'timeZone':'Asia/Shanghai','serviceWindow':[6,22],'serviceWindowNote':'Conservative model window; not an operator timetable','routing':'Directed OSM road shortest paths recomputed for every snapshot','edgeCount':len(keys),'nodeCount':count},'days':{}}
for day in ['weekday','weekend']:
 out['days'][day]={'car':[],'bus':[]}
 for slot,w in enumerate(config['weights'][day]):
  pressure=basis@np.array(w);mult=1+sensitivity*pressure
  for mode in ['car','bus']:
   effective=speed/mult
   if mode=='bus':effective=np.minimum(effective*.72,38)
   costs=length/effective*60+length*(1.3 if mode=='bus' else .22)
   g=csr_matrix((costs,(keys[:,0],keys[:,1])),shape=(count,count))
   mat=dijkstra(g,directed=True,indices=chosen)[:,chosen]+extra+(10 if mode=='bus' else 4)
   np.fill_diagonal(mat,0);assert np.isfinite(mat).all()
   out['days'][day][mode].append(np.round(mat,2).tolist())
  if slot%12==0:print(day,slot/2,'hours routed',flush=True)
(ROOT/'dist/traffic.json').write_text(json.dumps(out,separators=(',',':')))
print('Saved traffic scenarios',len(keys),'edges',flush=True)
