"""
Regenerate the browser data from a GraphML file.

Usage:
    python scripts/prepare_network.py path/to/semantic-network.graphml

The current prototype expects:
  node: x, y, #, Question, Answer, combined_text
  edge: weight

When the enriched GraphML is supplied, this script should preserve any
additional node attributes automatically. Date/community fields can then
be used directly by the browser UI.
"""
import json, sys, xml.etree.ElementTree as ET
from pathlib import Path

NS = {"g": "http://graphml.graphdrawing.org/xmlns"}

src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("semantic-network.graphml")
root = ET.parse(src).getroot()
graph = root.find(".//g:graph", NS)
keys = {k.attrib["id"]: k.attrib.get("attr.name", k.attrib["id"])
        for k in root.findall(".//g:key", NS)}

nodes = []
for n in graph.findall("g:node", NS):
    d = {"id": n.attrib["id"]}
    for x in n.findall("g:data", NS):
        name = keys.get(x.attrib["key"], x.attrib["key"])
        d[name] = x.text or ""
    for name in ("x", "y", "degree", "weighted_degree", "modularity"):
        if name in d:
            try: d[name] = float(d[name])
            except ValueError: pass
    nodes.append(d)

edges = []
for i, e in enumerate(graph.findall("g:edge", NS)):
    d = {"id": f"e{i:05d}", "source": e.attrib["source"], "target": e.attrib["target"]}
    for x in e.findall("g:data", NS):
        name = keys.get(x.attrib["key"], x.attrib["key"])
        d[name] = x.text or ""
    if "weight" in d:
        try: d["weight"] = float(d["weight"])
        except ValueError: pass
    edges.append(d)

degree = {n["id"]: 0 for n in nodes}
weighted_degree = {n["id"]: 0.0 for n in nodes}
for e in edges:
    degree[e["source"]] += 1
    degree[e["target"]] += 1
    weighted_degree[e["source"]] += float(e.get("weight", 0) or 0)
    weighted_degree[e["target"]] += float(e.get("weight", 0) or 0)

for n in nodes:
    n.setdefault("degree", degree[n["id"]])
    n.setdefault("weighted_degree", weighted_degree[n["id"]])

out = Path("data/network.json")
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({
    "metadata": {"source": str(src), "nodes": len(nodes), "edges": len(edges)},
    "nodes": nodes, "edges": edges
}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {out} ({len(nodes)} nodes, {len(edges)} edges)")
