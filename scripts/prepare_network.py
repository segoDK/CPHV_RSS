import json, sys, xml.etree.ElementTree as ET
from pathlib import Path

NS={'g':'http://graphml.graphdrawing.org/xmlns'}
MONTHS={'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12}
src=Path(sys.argv[1]) if len(sys.argv)>1 else Path('semantic-network.graphml')
root=ET.parse(src).getroot(); graph=root.find('.//g:graph',NS)
keys={k.attrib['id']:k.attrib.get('attr.name',k.attrib['id']) for k in root.findall('.//g:key',NS)}
nodes=[]
for n in graph.findall('g:node',NS):
 d={'id':n.attrib['id'],'original_id':n.attrib['id']}
 for x in n.findall('g:data',NS): d[keys.get(x.attrib['key'],x.attrib['key'])]=x.text or ''
 for k in ['x','y','size','Modularity Class','Eccentricity','Closeness Centrality','Harmonic Closeness Centrality','Betweenness Centrality']:
  if k in d:
   try:d[k]=float(d[k])
   except ValueError: pass
 d['short_id']=str(len(nodes)+1); d['label']=d['short_id']
 y=int(float(d.get('Year',0))); m=MONTHS.get(str(d.get('Month',''))[:3],0)
 d['date_key']=y*100+m; d['date']=f"{d.get('Month','')} {d.get('Year','')}"
 d.pop('combined_text',None); d.pop('Source_Sheet',None); d.pop('#',None)
 nodes.append(d)
D={n['id']:0 for n in nodes}; WD={n['id']:0.0 for n in nodes}; edges=[]
for i,e in enumerate(graph.findall('g:edge',NS)):
 d={'id':f'e{i:05d}','source':e.attrib['source'],'target':e.attrib['target']}
 for x in e.findall('g:data',NS): d[keys.get(x.attrib['key'],x.attrib['key'])]=x.text or ''
 try:d['weight']=float(d.get('weight',0))
 except ValueError:d['weight']=0
 edges.append(d); D[d['source']]+=1; D[d['target']]+=1; WD[d['source']]+=d['weight']; WD[d['target']]+=d['weight']
for n in nodes:n['degree']=D[n['id']]; n['weighted_degree']=WD[n['id']]
out=Path('data/network.json'); out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'metadata':{'nodes':len(nodes),'edges':len(edges),'source':str(src)},'nodes':nodes,'edges':edges},ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(f'Wrote {out}: {len(nodes)} nodes, {len(edges)} edges')
