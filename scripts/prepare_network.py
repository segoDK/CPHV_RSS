"""Build the browser payload from an enriched GraphML file.
Usage: python scripts/prepare_network.py path/to/file.graphml
"""
import sys,json,xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter,defaultdict
src=Path(sys.argv[1]); out=Path('data/network.json'); ns={'g':'http://graphml.graphdrawing.org/xmlns'}; root=ET.parse(src).getroot(); keys={k.attrib['id']:k.attrib.get('attr.name',k.attrib['id']) for k in root.findall('.//g:key',ns)}; g=root.find('.//g:graph',ns)
nodes=[]
for i,n in enumerate(g.findall('g:node',ns),1):
 d={'id':str(i),'original_id':n.attrib['id']}
 for x in n.findall('g:data',ns): d[keys.get(x.attrib['key'],x.attrib['key'])]=x.text or ''
 for k in ['x','y','Eccentricity','Closeness Centrality','Harmonic Closeness Centrality','Betweenness Centrality','Modularity Class']:
  if k in d:
   try:d[k]=int(float(d[k])) if k in ['Eccentricity','Modularity Class'] else float(d[k])
   except:pass
 d.pop('combined_text',None); [d.pop(k,None) for k in ['r','g','b','label','edgelabel','size']]; nodes.append(d)
idmap={n['original_id']:n['id'] for n in nodes};edges=[]
for i,e in enumerate(g.findall('g:edge',ns),1):
 d={'id':f'e{i:05d}','source':idmap[e.attrib['source']],'target':idmap[e.attrib['target']]}
 for x in e.findall('g:data',ns):d[keys.get(x.attrib['key'],x.attrib['key'])]=x.text or ''
 try:d['weight']=float(d.get('weight',1))
 except:d['weight']=1
 edges.append(d)
deg=Counter();wd=defaultdict(float)
for e in edges:deg[e['source']]+=1;deg[e['target']]+=1;wd[e['source']]+=e['weight'];wd[e['target']]+=e['weight']
for n in nodes:n['Degree']=deg[n['id']];n['Weighted Degree']=round(wd[n['id']],6)
out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({'metadata':{'source':str(src),'nodes':len(nodes),'edges':len(edges)},'nodes':nodes,'edges':edges},ensure_ascii=False,separators=(',',':')),encoding='utf8');print(f'Wrote {out}: {len(nodes)} nodes, {len(edges)} edges')
