let network,cy,selectedNode=null,playing=false,timer=null;
const palette=["#386cb0","#fdb462","#7fc97f","#ef3b2c","#beaed4","#fdc086","#ffff99","#666666","#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#1f78b4"];
const months={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
let dates=[],colorAttribute="Modularity Class",sizeAttribute="degree",timelineMode="cumulative";
const $=id=>document.getElementById(id);
const annotationLayer=()=>$("annotationLayer");
const pretty=v=>({"Modularity Class":"Modularity class","weighted_degree":"Weighted degree","Betweenness Centrality":"Betweenness centrality","Closeness Centrality":"Closeness centrality","Harmonic Closeness Centrality":"Harmonic closeness","Eccentricity":"Eccentricity","Question":"Question"}[v]||v);

async function init(){
 network=await fetch("data/network.json").then(r=>r.json());
 $("stats").textContent=`${network.metadata.nodes.toLocaleString()} nodes · ${network.metadata.edges.toLocaleString()} edges`;
 dates=[...new Set(network.nodes.map(n=>Number(n.date_key)))].sort((a,b)=>a-b);
 const labels=dates.map(formatDate);
 const numeric=["degree","weighted_degree","Betweenness Centrality","Closeness Centrality","Harmonic Closeness Centrality","Eccentricity","Modularity Class"];
 const categorical=["Village","date","Question"];
 fill($("colorBy"),["Village","date","Question","Modularity Class","degree","weighted_degree","Betweenness Centrality","Closeness Centrality","Harmonic Closeness Centrality","Eccentricity"]);
 fill($("sizeBy"),["degree","weighted_degree","Betweenness Centrality","Closeness Centrality","Harmonic Closeness Centrality","Eccentricity","Modularity Class"]);
 [...new Set(network.nodes.map(n=>n.Village))].sort().forEach(v=>{let o=document.createElement("option");o.value=v;o.textContent=v;$("villageFilter").appendChild(o)});
 $("timeline").min=0;$("timeline").max=Math.max(0,dates.length-1);$("timeline").value=dates.length-1;
 $("timelineStart").textContent=labels[0]||"";$("timelineEnd").textContent=labels.at(-1)||"";
 $("timeline").addEventListener("input",()=>{updateTimeline();applyFilters()});
 $("timelineMode").onchange=e=>{timelineMode=e.target.value;updateTimeline();applyFilters()};
 $("play").onclick=togglePlay;$("allDates").onclick=()=>{$("timelineMode").value="cumulative";timelineMode="cumulative";$("timeline").value=dates.length-1;updateTimeline();applyFilters()};
 $("villageFilter").onchange=applyFilters;$("search").oninput=applyFilters;$("minDegree").oninput=()=>{$("degreeValue").textContent=$("minDegree").value;applyFilters()};
 $("colorBy").onchange=e=>{colorAttribute=e.target.value;updateStyle()};$("sizeBy").onchange=e=>{sizeAttribute=e.target.value;updateStyle()};
 $("sizeScale").oninput=updateStyle;$("edgeOpacity").oninput=updateStyle;
 $("fit").onclick=()=>cy.fit(cy.nodes(":visible"),40);$("resetStyle").onclick=resetStyle;$("downloadPng").onclick=exportPNG;
 const elements=[...network.nodes.map(n=>({data:n,position:{x:Number(n.x)||0,y:Number(n.y)||0}})),...network.edges.map(e=>({data:e}))];
 cy=cytoscape({container:$("cy"),elements,pixelRatio:1,wheelSensitivity:.2,boxSelectionEnabled:true,
  style:[
   {selector:"node",style:{"background-color":nodeColor,"width":nodeSize,"height":nodeSize,"border-width":.8,"border-color":"#fff","label":"","z-index":5}},
   {selector:"node:selected",style:{"border-width":4,"border-color":"#111827","background-opacity":1,"z-index":20}},
   {selector:"node.hovered",style:{"border-width":4,"border-color":"#315efb","z-index":19}},
   {selector:"node.area",style:{"shape":"round-rectangle","background-opacity":.18,"border-width":3,"border-style":"dashed","label":"data(label)","font-size":18,"font-weight":"bold","color":"#253047","text-wrap":"wrap","text-max-width":"180px","text-valign":"center","text-halign":"center","z-index":1,"overlay-opacity":0}},
   {selector:"edge",style:{"width":edgeWidth,"line-color":"#9aa3b2","opacity":parseFloat($("edgeOpacity").value),"curve-style":"haystack","z-index":0}},
   {selector:".faded",style:{opacity:.08}}, {selector:".highlighted",style:{opacity:1}}
  ],
  layout:{name:"preset",fit:true,padding:50}
 });
 cy.on("mouseover","node",e=>{if(e.target.hasClass("area"))return;inspectNode(e.target,false);e.target.addClass("hovered")});
 cy.on("mouseout","node",e=>{e.target.removeClass("hovered")});
 cy.on("tap","node",e=>{if(e.target.hasClass("area"))return;inspectNode(e.target,true)});
 cy.on("tap",e=>{if(e.target===cy)clearInspector()});
 // Make initial network visible, with a random node as the initial inspected node but do not recenter.
 const visible=cy.nodes().filter(n=>!n.hasClass("area")); if(visible.length) inspectNode(visible[Math.floor(Math.random()*visible.length)],false);
 $("loading").style.display="none";updateTimeline();updateStyle();renderLegend();initializeAnnotations();
}
function fill(s,vals){vals.forEach(v=>{let o=document.createElement("option");o.value=v;o.textContent=pretty(v);s.appendChild(o)})}
function formatDate(k){let y=Math.floor(k/100),m=k%100;let name=Object.keys(months).find(x=>months[x]===m)||"";return `${name} ${y}`}
function updateTimeline(){
 let i=Number($("timeline").value), label=dates[i]!==undefined?formatDate(dates[i]):"All dates";
 $("timelineDate").textContent=timelineMode==="exact"?`Survey wave: ${label}`:`Up to: ${label}`;
}
function cutoff(){return dates[Number($("timeline").value)]??Infinity}
function visibleByTime(n){
 const d=Number(n.data("date_key")), c=cutoff();
 return timelineMode==="exact" ? d===c : d<=c;
}
function numericValues(a){return network.nodes.map(n=>Number(n[a])).filter(Number.isFinite)}
function range(a){let v=numericValues(a);return v.length?[Math.min(...v),Math.max(...v)]:[0,1]}
function norm(v,a,b){return b===a?.5:(Number(v)-a)/(b-a)}
function nodeSize(n){let [a,b]=range(sizeAttribute);return (8+Math.sqrt(Math.max(0,norm(n.data(sizeAttribute),a,b)))*27)*Number($("sizeScale").value)}
function hash(s){let h=0;String(s??"").split("").forEach(c=>h=((h<<5)-h+c.charCodeAt(0))|0);return Math.abs(h)}
function nodeColor(n){let v=n.data(colorAttribute);if(colorAttribute==="Modularity Class")return palette[Math.abs(Number(v)||0)%palette.length];
 if(["degree","weighted_degree","Betweenness Centrality","Closeness Centrality","Harmonic Closeness Centrality","Eccentricity"].includes(colorAttribute)){let[a,b]=range(colorAttribute),t=norm(v,a,b);return `hsl(${220-200*t},72%,${48+10*(1-t)}%)`}
 return palette[hash(v)%palette.length]}
function edgeWidth(e){return Math.max(.5,Math.min(6,.5+Math.log1p(Number(e.data("weight"))||1)*.55))}
function updateStyle(){if(!cy)return;cy.nodes().not(".area").forEach(n=>{n.style("background-color",nodeColor(n));n.style("width",nodeSize(n));n.style("height",nodeSize(n))});cy.edges().style("opacity",Number($("edgeOpacity").value));renderLegend()}
function applyFilters(){let q=$("search").value.trim().toLowerCase(),v=$("villageFilter").value,min=Number($("minDegree").value);
 cy.nodes().not(".area").forEach(n=>{let d=n.data(),hay=[d.id,d.short_id,d.Question,d.Answer].filter(Boolean).join(" ").toLowerCase();let ok=visibleByTime(n)&&(!q||hay.includes(q))&&(v==="__all__"||d.Village===v)&&Number(d.degree)>=min;n.style("display",ok?"element":"none")});
 cy.edges().forEach(e=>{let ok=e.source().style("display")!=="none"&&e.target().style("display")!=="none";e.style("display",ok?"element":"none")});
}
function highlight(n){cy.elements().removeClass("faded highlighted");n.neighborhood().add(n).addClass("highlighted")}
function inspectNode(n,center){selectedNode=n;highlight(n);if(center)cy.animate({fit:{eles:n.neighborhood().add(n),padding:130},duration:280});renderInspector(n)}
function renderInspector(n){let d=n.data(),attrs=["Village","date","Year","Month","Modularity Class","Eccentricity","Closeness Centrality","Harmonic Closeness Centrality","Betweenness Centrality","degree","weighted_degree"];
 let meta=attrs.filter(a=>d[a]!==undefined).map(a=>`<div><b>${escapeHtml(pretty(a))}</b><span>${escapeHtml(d[a])}</span></div>`).join("");
 let neighbours=n.neighborhood("node").filter(x=>!x.hasClass("area")).sort((a,b)=>Number(b.data("weight")||0)-Number(a.data("weight")||0)).slice(0,15);
 let con=neighbours.map(x=>`<div class="connection" data-node="${escapeHtml(x.id())}"><b>${escapeHtml(x.data("short_id"))}</b> · ${escapeHtml(truncate(x.data("Answer")||"No answer",125))}</div>`).join("");
 $("inspector").innerHTML=`<h2 class="node-title">Node ${escapeHtml(d.short_id)}</h2><div class="node-id">original: ${escapeHtml(d.original_id)}</div>
 <div class="answer-card"><h3>Answer</h3><p>${escapeHtml(d.Answer||"Not available")}</p></div>
 <div class="card"><h3>Question</h3><p>${escapeHtml(d.Question||"Not available")}</p></div>
 <div class="card"><h3>Network attributes</h3><div class="meta">${meta}</div></div>
 <div class="card"><h3>Connected nodes (${n.neighborhood("node").length})</h3>${con||"<p>No connected nodes.</p>"}</div>`;
 $("inspector").querySelectorAll(".connection").forEach(el=>el.onclick=()=>{let t=cy.getElementById(el.dataset.node);if(t.nonempty())inspectNode(t,true)});
}
function clearInspector(){cy.elements().removeClass("faded highlighted");$("inspector").innerHTML=`<div class="inspector-empty"><div class="big-icon">◉</div><h2>Inspect a node</h2><p>Hover over a node to inspect it. Click to centre the map on it.</p></div>`}
function togglePlay(){playing=!playing;$("play").textContent=playing?"❚❚ Pause timeline":"▶ Play timeline";if(!playing){clearInterval(timer);return} if(Number($("timeline").value)>=dates.length-1)$("timeline").value=0;timer=setInterval(()=>{let i=Number($("timeline").value);if(i>=dates.length-1){playing=false;clearInterval(timer);$("play").textContent="▶ Play timeline";return}$("timeline").value=i+1;updateTimeline();applyFilters()},900)}
function resetStyle(){$("colorBy").value="Modularity Class";$("sizeBy").value="degree";$("sizeScale").value=1;$("edgeOpacity").value=.35;colorAttribute="Modularity Class";sizeAttribute="degree";updateStyle()}
function exportPNG(){let png=cy.png({full:true,scale:2,bg:"#fbfcfe"}),a=document.createElement("a");a.href=png;a.download="semantic-network.png";a.click()}
function renderLegend(){let e=$("legend");if(colorAttribute==="Village"){let vals=[...new Set(network.nodes.map(n=>n.Village))].sort();e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(v)}</div>`).join("")}else if(colorAttribute==="Question"){let vals=[...new Set(network.nodes.map(n=>n.Question))];e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(truncate(v,38))}</div>`).join("")}else if(colorAttribute==="Modularity Class"){e.innerHTML=palette.slice(0,8).map((c,i)=>`<div class="legend-item"><span class="swatch" style="background:${c}"></span>Community ${i}</div>`).join("")}else e.innerHTML="<div class='legend-item'>Colour scale / categorical colours shown on nodes.</div>"}
function truncate(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+"…":s}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
init().catch(e=>{console.error(e);$("loading").textContent="Could not load the network. See the browser console."});



/* ============================================================
   V9 ANNOTATION SYSTEM
   - Polygons are stored in MAP coordinates, so they stick to the
     network when you pan or zoom (one transform on one <g>).
   - The SVG never intercepts the map: only outlines, corner
     handles and the label of the SELECTED area take the pointer.
   - Draw: click corners, finish with double-click / click first
     corner / Enter. Esc cancels.
   - Edit (select an area): drag corners, drag "+" edge handles
     to add corners, double-click or right-click a corner to
     remove it, drag the outline or label to move the whole area.
   - Saved in the browser; Export/Import JSON; optional shared
     defaults from data/annotations.json.
   ============================================================ */
const SVGNS="http://www.w3.org/2000/svg", ANN_KEY="semantic-network-explorer-annotations-v9";
const ANN_COLORS=["#e6194b","#3cb44b","#4363d8","#f58231","#911eb4","#008080","#f032e6","#9a6324","#808000","#000075"];
const ann={items:[],sel:null,selVertex:null,drag:null,draw:null,svg:null,root:null,ready:false};

const mk=(tag,attrs={},parent)=>{const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e};
const annZoom=()=>cy?cy.zoom():1;
const annById=id=>ann.items.find(a=>a.id===id)||null;
const annSel=()=>annById(ann.sel);

function annClean(a,i){
 if(!a||!Array.isArray(a.points)||a.points.length<3)return null;
 const pts=a.points.map(p=>({x:Number(p&&p.x),y:Number(p&&p.y)}));
 if(!pts.every(p=>isFinite(p.x)&&isFinite(p.y)))return null;
 return {id:String(a.id||"a"+Date.now()+"-"+i),label:String(a.label??"Topic area"),
  color:/^#[0-9a-f]{6}$/i.test(a.color||"")?a.color:ANN_COLORS[i%ANN_COLORS.length],
  opacity:isFinite(+a.opacity)?Math.min(.6,Math.max(.03,+a.opacity)):.12,showLabel:a.showLabel!==false,points:pts};
}
const annSave=()=>{try{localStorage.setItem(ANN_KEY,JSON.stringify(ann.items))}catch(e){console.warn("Could not save annotations",e)}};
async function annLoad(){
 let raw=null;
 try{raw=localStorage.getItem(ANN_KEY)||localStorage.getItem("semantic-network-explorer-annotations-v8")}catch(e){}
 let list=null;
 try{if(raw)list=JSON.parse(raw)}catch(e){}
 if(!Array.isArray(list)){ // first visit: try shared defaults committed to the repo
  try{const r=await fetch("data/annotations.json",{cache:"no-store"});if(r.ok){const j=await r.json();list=Array.isArray(j)?j:j.annotations}}catch(e){}
 }
 ann.items=(Array.isArray(list)?list:[]).map(annClean).filter(Boolean);
}

function annCentroid(a){
 let A=0,cx=0,cy_=0;const p=a.points;
 for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],c=p[i].x*q.y-q.x*p[i].y;A+=c;cx+=(p[i].x+q.x)*c;cy_+=(p[i].y+q.y)*c}
 if(Math.abs(A)<1e-9)return {x:p.reduce((s,q)=>s+q.x,0)/p.length,y:p.reduce((s,q)=>s+q.y,0)/p.length};
 return {x:cx/(3*A),y:cy_/(3*A)};
}
function annToModel(ev){
 const r=ann.svg.getBoundingClientRect(),pan=cy.pan(),z=cy.zoom();
 return {x:(ev.clientX-r.left-pan.x)/z,y:(ev.clientY-r.top-pan.y)/z};
}
const annPts=pts=>pts.map(p=>p.x+","+p.y).join(" ");

/* ---- drawing the SVG ---- */
function annApplyView(){ // cheap: runs on every pan/zoom
 if(!ann.root)return;
 const pan=cy.pan(),z=cy.zoom(),inv=1/z;
 ann.root.setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${z})`);
 ann.root.querySelectorAll("[data-r]").forEach(e=>e.setAttribute("r",e.dataset.r*inv));
 ann.root.querySelectorAll("[data-fs]").forEach(e=>{e.setAttribute("font-size",e.dataset.fs*inv);e.setAttribute("stroke-width",4*inv)});
 ann.root.querySelectorAll("[data-sw]").forEach(e=>e.setAttribute("stroke-width",e.dataset.sw*inv));
 ann.root.querySelectorAll("[data-dash]").forEach(e=>e.setAttribute("stroke-dasharray",`${8*inv} ${5*inv}`));
}
function annRender(){
 if(!ann.svg)return;
 ann.root.replaceChildren();
 ann.items.forEach(a=>{
  const on=a.id===ann.sel,g=mk("g",{"data-id":a.id},ann.root);
  mk("polygon",{class:"ann-fill",points:annPts(a.points),fill:a.color,"fill-opacity":a.opacity},g);
  const edge=mk("polygon",{class:"ann-edge",points:annPts(a.points),fill:"none",stroke:a.color,"stroke-linejoin":"round","data-sw":on?3:2,"data-dash":1},g);
  const hit=mk("polygon",{class:"ann-hit"+(on?" on":""),points:annPts(a.points),fill:"none",stroke:"transparent","data-sw":14},g);
  hit.addEventListener("pointerdown",e=>annDown(e,a,{type:"move"}));
  if(a.showLabel){
   const c=annCentroid(a),t=mk("text",{class:"ann-label"+(on?" on":""),x:c.x,y:c.y,"text-anchor":"middle","dominant-baseline":"middle","data-fs":16,fill:a.color},g);
   t.textContent=a.label||"Topic area";
   t.addEventListener("pointerdown",e=>annDown(e,a,{type:"move"}));
  }
  if(on){
   a.points.forEach((p,i)=>{ // edge "+" handles
    const q=a.points[(i+1)%a.points.length];
    const m=mk("circle",{class:"ann-mid",cx:(p.x+q.x)/2,cy:(p.y+q.y)/2,"data-r":5,stroke:a.color,"data-sw":2},g);
    m.addEventListener("pointerdown",e=>{const np={x:(p.x+q.x)/2,y:(p.y+q.y)/2};a.points.splice(i+1,0,np);ann.selVertex=i+1;annRender();annDown(e,a,{type:"vertex",index:i+1},true)});
   });
   a.points.forEach((p,i)=>{
    const h=mk("circle",{class:"ann-handle"+(i===ann.selVertex?" sel":""),cx:p.x,cy:p.y,"data-r":7,stroke:a.color,"data-sw":3},g);
    h.addEventListener("pointerdown",e=>{ann.selVertex=i;annDown(e,a,{type:"vertex",index:i})});
    h.addEventListener("dblclick",e=>{e.preventDefault();annRemoveCorner(a,i)});
    h.addEventListener("contextmenu",e=>{e.preventDefault();annRemoveCorner(a,i)});
   });
  }
 });
 if(ann.draw)annRenderDraft();
 annApplyView();
}
function annUpdateShape(a){ // used during drag: no rebuild
 const g=ann.root.querySelector(`g[data-id="${a.id}"]`);if(!g)return;
 const s=annPts(a.points);g.querySelectorAll("polygon").forEach(p=>p.setAttribute("points",s));
 const c=annCentroid(a),t=g.querySelector("text");if(t){t.setAttribute("x",c.x);t.setAttribute("y",c.y)}
 g.querySelectorAll(".ann-handle").forEach((h,i)=>{h.setAttribute("cx",a.points[i].x);h.setAttribute("cy",a.points[i].y)});
 g.querySelectorAll(".ann-mid").forEach((m,i)=>{const p=a.points[i],q=a.points[(i+1)%a.points.length];m.setAttribute("cx",(p.x+q.x)/2);m.setAttribute("cy",(p.y+q.y)/2)});
}
function annStyleOnly(a){
 const g=ann.root.querySelector(`g[data-id="${a.id}"]`);if(!g)return;
 g.querySelector(".ann-fill").setAttribute("fill",a.color);g.querySelector(".ann-fill").setAttribute("fill-opacity",a.opacity);
 g.querySelector(".ann-edge").setAttribute("stroke",a.color);
 const t=g.querySelector("text");if(t){t.setAttribute("fill",a.color);t.textContent=a.label||"Topic area"}
 g.querySelectorAll(".ann-handle,.ann-mid").forEach(h=>h.setAttribute("stroke",a.color));
}

/* ---- interaction ---- */
function annSelect(id){
 ann.sel=id;ann.selVertex=null;annRender();annList();
}
function annDown(e,a,drag,keepSel){
 if(e.button!==0||ann.draw)return;
 e.preventDefault();e.stopPropagation();
 if(ann.sel!==a.id&&!keepSel){annSelect(a.id);if(drag.type==="move"){/* first click only selects */return}}
 ann.drag={...drag,a,start:annToModel(e),orig:a.points.map(p=>({...p})),moved:false};
}
function annMove(e){
 const d=ann.drag;
 if(d){
  const p=annToModel(e);d.moved=true;
  if(d.type==="vertex")d.a.points[d.index]=p;
  else{const dx=p.x-d.start.x,dy=p.y-d.start.y;d.a.points=d.orig.map(o=>({x:o.x+dx,y:o.y+dy}))}
  annUpdateShape(d.a);
 }
 if(ann.draw){ann.draw.cursor=annToModel(e);annRenderDraft()}
}
function annUp(){
 const d=ann.drag;if(!d)return;
 ann.drag=null;annSave();annList();
 if(d.moved)annRender(); // a plain click keeps the DOM so double-click on a corner still works
 else{const g=ann.root.querySelector(`g[data-id="${d.a.id}"]`);if(g)g.querySelectorAll(".ann-handle").forEach((h,i)=>h.classList.toggle("sel",i===ann.selVertex))}
}
function annRemoveCorner(a,i){
 if(a.points.length<=3)return;
 a.points.splice(i,1);ann.selVertex=null;annSave();annRender();annList();
}
function annAddCorner(a){ // sidebar button: split the longest edge
 let best=0,bl=-1;
 a.points.forEach((p,i)=>{const q=a.points[(i+1)%a.points.length],l=(p.x-q.x)**2+(p.y-q.y)**2;if(l>bl){bl=l;best=i}});
 const p=a.points[best],q=a.points[(best+1)%a.points.length];
 a.points.splice(best+1,0,{x:(p.x+q.x)/2,y:(p.y+q.y)/2});ann.selVertex=best+1;annSave();annRender();annList();
}

/* ---- drawing mode ---- */
function annStartDraw(){
 if(ann.draw)return annCancelDraw();
 ann.sel=null;ann.draw={points:[],cursor:null};
 ann.svg.classList.add("drawing");$("addArea").textContent="✕ Cancel drawing";
 annRender();annList();annHint();
}
function annCancelDraw(){
 ann.draw=null;ann.svg.classList.remove("drawing");$("addArea").textContent="＋ Draw new area";
 annRender();annHint();
}
function annFinishDraw(){
 const d=ann.draw;if(!d)return;
 if(d.points.length<3){annCancelDraw();return}
 const i=ann.items.length,a=annClean({id:"a"+Date.now()+"-"+Math.random().toString(36).slice(2,6),label:"Topic area "+(i+1),color:ANN_COLORS[i%ANN_COLORS.length],points:d.points},i);
 ann.items.push(a);annCancelDraw();ann.sel=a.id;annSave();annRender();annList();
}
function annRenderDraft(){
 ann.root.querySelectorAll(".ann-draft").forEach(e=>e.remove());
 const d=ann.draw;if(!d)return;
 const g=mk("g",{class:"ann-draft"},ann.root),pts=d.points.slice();
 if(d.cursor)pts.push(d.cursor);
 if(pts.length>1)mk("polyline",{points:annPts(pts),fill:"rgba(49,94,251,.12)",stroke:"#315efb","data-sw":2,"data-dash":1},g);
 d.points.forEach((p,i)=>mk("circle",{cx:p.x,cy:p.y,"data-r":i===0?9:6,fill:i===0?"#315efb":"#fff",stroke:"#315efb","data-sw":2},g));
 annApplyView();
}
function annHint(){
 $("annHint").textContent=ann.draw
  ?"Click on the map to place corners. Click the first (blue) corner, double-click or press Enter to finish. Esc cancels."
  :"Draw areas to highlight regions. Select an area to drag its corners, drag a “+” on an edge to add a corner, double-click or right-click a corner to remove it. Areas stay fixed to the map when you pan or zoom.";
}

/* ---- sidebar ---- */
function annList(){
 const list=$("areaList");list.innerHTML="";
 ann.items.forEach(a=>{
  const row=document.createElement("div");row.className="area-item"+(a.id===ann.sel?" selected":"");
  row.innerHTML=`<div class="area-top"><input class="area-label" value="${escapeHtml(a.label)}" placeholder="Label"><input class="area-color" type="color" value="${a.color}" title="Colour"></div>
  <label class="area-row">Fill <input class="area-op" type="range" min=".03" max=".6" step=".01" value="${a.opacity}"></label>
  <label class="area-show"><input type="checkbox" ${a.showLabel?"checked":""}> Show label on map</label>
  <div class="area-actions"><button class="a-sel">${a.id===ann.sel?"Deselect":"Edit"}</button><button class="a-zoom">Zoom to</button><button class="a-add">＋ Corner</button><button class="a-rem" ${a.points.length<=3?"disabled":""}>− Corner</button><button class="a-del">Delete</button></div>
  <span class="area-count">${a.points.length} corners</span>`;
  const q=s=>row.querySelector(s);
  q(".a-sel").onclick=()=>annSelect(a.id===ann.sel?null:a.id);
  q(".a-zoom").onclick=()=>{const xs=a.points.map(p=>p.x),ys=a.points.map(p=>p.y),pad=40,w=cy.width(),h=cy.height();
   const z=Math.min((w-2*pad)/(Math.max(...xs)-Math.min(...xs)||1),(h-2*pad)/(Math.max(...ys)-Math.min(...ys)||1));
   cy.animate({zoom:z,pan:{x:w/2-z*(Math.min(...xs)+Math.max(...xs))/2,y:h/2-z*(Math.min(...ys)+Math.max(...ys))/2},duration:300})};
  q(".a-add").onclick=()=>{ann.sel=a.id;annAddCorner(a)};
  q(".a-rem").onclick=()=>{ann.sel=a.id;annRemoveCorner(a,ann.selVertex!=null?ann.selVertex:a.points.length-1)};
  q(".a-del").onclick=()=>{ann.items=ann.items.filter(x=>x!==a);if(ann.sel===a.id)ann.sel=null;annSave();annRender();annList()};
  q(".area-label").oninput=e=>{a.label=e.target.value;annSave();annStyleOnly(a);if(!a.showLabel)return;annApplyView()};
  q(".area-color").oninput=e=>{a.color=e.target.value;annSave();annStyleOnly(a)};
  q(".area-op").oninput=e=>{a.opacity=+e.target.value;annSave();annStyleOnly(a)};
  q(".area-show input").onchange=e=>{a.showLabel=e.target.checked;annSave();annRender()};
  list.appendChild(row);
 });
}
function annExport(){
 const b=new Blob([JSON.stringify(ann.items,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),l=document.createElement("a");
 l.href=u;l.download="annotations.json";l.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function annImport(file){
 const r=new FileReader();
 r.onload=()=>{try{const j=JSON.parse(r.result),list=(Array.isArray(j)?j:j.annotations).map(annClean).filter(Boolean);
  if(!list.length)throw 0;ann.items=ann.items.concat(list.map(a=>({...a,id:a.id+"-"+Math.random().toString(36).slice(2,5)})));annSave();annRender();annList()}
  catch(e){alert("That file doesn't contain valid annotations.")}};
 r.readAsText(file);
}

async function initializeAnnotations(){
 if(ann.ready)return;ann.ready=true;
 ann.svg=$("annotationLayer");ann.svg.replaceChildren();
 ann.root=mk("g",{id:"annRoot"},ann.svg);
 // transparent catcher used only while drawing (screen space, behind the root group)
 const catcher=mk("rect",{class:"ann-catcher",x:0,y:0,width:"100%",height:"100%",fill:"transparent"});ann.svg.insertBefore(catcher,ann.root);
 catcher.addEventListener("click",e=>{
  if(!ann.draw)return;const p=annToModel(e),pts=ann.draw.points,z=annZoom();
  if(pts.length>=3&&Math.hypot(p.x-pts[0].x,p.y-pts[0].y)*z<12)return annFinishDraw();
  const last=pts[pts.length-1];if(last&&Math.hypot(p.x-last.x,p.y-last.y)*z<4)return;
  pts.push(p);annRenderDraft();
 });
 catcher.addEventListener("dblclick",e=>{e.preventDefault();annFinishDraw()});
 ann.svg.addEventListener("wheel",e=>{ // keep wheel-zoom working over handles / drawing
  e.preventDefault();const r=ann.svg.getBoundingClientRect();
  cy.zoom({level:cy.zoom()*Math.exp(-e.deltaY*.0015),renderedPosition:{x:e.clientX-r.left,y:e.clientY-r.top}});
 },{passive:false});
 await annLoad();annRender();annList();annHint();
 $("addArea").onclick=annStartDraw;
 $("clearAreas").onclick=()=>{if(ann.items.length&&confirm("Delete all annotations?")){ann.items=[];ann.sel=null;annSave();annRender();annList()}};
 $("exportAreas").onclick=annExport;
 $("importAreas").onclick=()=>$("importFile").click();
 $("importFile").onchange=e=>{if(e.target.files[0])annImport(e.target.files[0]);e.target.value=""};
 cy.on("pan zoom resize",annApplyView);
 cy.on("tap",e=>{if(e.target===cy&&ann.sel&&!ann.draw)annSelect(null)});
 window.addEventListener("pointermove",annMove);
 window.addEventListener("pointerup",annUp);
 window.addEventListener("keydown",e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==="Escape"){ann.draw?annCancelDraw():annSelect(null)}
  else if(e.key==="Enter"&&ann.draw)annFinishDraw();
  else if((e.key==="Delete"||e.key==="Backspace")&&ann.sel&&ann.selVertex!=null){const a=annSel();if(a)annRemoveCorner(a,ann.selVertex)}
 });
}
