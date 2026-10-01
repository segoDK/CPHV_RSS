"""Convert the source GraphML to the browser data.
Usage: python scripts/prepare_network.py path/to/graph.graphml
The original GraphML remains the archival/source file; network.json is the web payload.
"""
import sys,json,xml.etree.ElementTree as ET
from pathlib import Path
months={"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
src=Path(sys.argv[1]); root=ET.parse(src).getroot(); ns={"g":"http://graphml.graphdrawing.org/xmlns"}
keys={k.attrib["id"]:k.attrib.get("attr.name",k.attrib["id"]) for k in root.findall(".//g:key",ns)}
g=root.find(".//g:graph",ns); nodes=[]; edges=[]
for n in g.findall("g:node",ns):
 d={"id":n.attrib["id"]}
 for x in n.findall("g:data",ns):d[keys.get(x.attrib["key"],x.attrib["key"])]=x.text or ""
 nodes.append(d)
for i,e in enumerate(g.findall("g:edge",ns)):
 d={"id":f"e{i:05d}","source":e.attrib["source"],"target":e.attrib["target"]}
 for x in e.findall("g:data",ns):d[keys.get(x.attrib["key"],x.attrib["key"])]=x.text or ""
 try:d["weight"]=float(d.get("weight",0))
 except:d["weight"]=0
 edges.append(d)
deg={n["id"]:0 for n in nodes};wdeg={n["id"]:0 for n in nodes}
for e in edges:
 for a in(e["source"],e["target"]):deg[a]+=1;wdeg[a]+=e["weight"]
for i,n in enumerate(nodes,1):
 n["short_id"]=str(i);n["original_id"]=n["id"];n["degree"]=deg[n["id"]];n["weighted_degree"]=round(wdeg[n["id"]],4)
 y=int(n.get("Year",0) or 0);m=months.get(n.get("Month",""),0);n["date_key"]=y*100+m;n["date"]=f'{n.get("Month","")} {n.get("Year","")}'
# deliberately omit combined_text and Source_Sheet from the web payload
for n in nodes:n.pop("combined_text",None);n.pop("Source_Sheet",None)
out=Path("data/network.json");out.parent.mkdir(exist_ok=True);out.write_text(json.dumps({"metadata":{"nodes":len(nodes),"edges":len(edges)},"nodes":nodes,"edges":edges},ensure_ascii=False,separators=(",",":")),encoding="utf8")
print(f"Wrote {out}: {len(nodes)} nodes, {len(edges)} edges")
