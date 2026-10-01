let network,cy,selectedNode=null,playing=false,timer=null;
const palette=["#386cb0","#fdb462","#7fc97f","#ef3b2c","#beaed4","#fdc086","#ffff99","#666666","#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#1f78b4"];
const months={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
let dates=[],colorAttribute="Modularity Class",sizeAttribute="degree",areas=[],selectedAreaId=null,timelineMode="cumulative";
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
 $("addArea").onclick=addArea;$("clearAreas").onclick=clearAreas;
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
 cy.on("pan zoom resize", renderAnnotations);
 cy.on("render", renderAnnotations);
 cy.on("mouseover","node",e=>{if(e.target.hasClass("area"))return;inspectNode(e.target,false);e.target.addClass("hovered")});
 cy.on("mouseout","node",e=>{e.target.removeClass("hovered")});
 cy.on("tap","node",e=>{if(e.target.hasClass("area"))return;inspectNode(e.target,true)});
 cy.on("tap",e=>{if(e.target===cy)clearInspector()});
 // Make initial network visible, with a random node as the initial inspected node but do not recenter.
 const visible=cy.nodes().filter(n=>!n.hasClass("area")); if(visible.length) inspectNode(visible[Math.floor(Math.random()*visible.length)],false);
 $("loading").style.display="none";updateTimeline();updateStyle();renderLegend();loadAreas();
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
function defaultAreaPoints(){
 const w=cy.width(),h=cy.height(),z=cy.zoom(),pan=cy.pan();
 const sx=(w*.5-180), sy=(h*.5-110), ex=(w*.5+180), ey=(h*.5+110);
 return [[sx,sy],[ex,sy],[ex,ey],[sx,ey]].map(([x,y])=>({x:(x-pan.x)/z,y:(y-pan.y)/z}));
}
function modelToScreen(pt){const z=cy.zoom(),pan=cy.pan();return {x:pt.x*z+pan.x,y:pt.y*z+pan.y}}
function screenToModel(x,y){const z=cy.zoom(),pan=cy.pan();return {x:(x-pan.x)/z,y:(y-pan.y)/z}}
function areaCentroid(a){let sx=0,sy=0;a.points.forEach(p=>{sx+=p.x;sy+=p.y});return {x:sx/a.points.length,y:sy/a.points.length}}
function addArea(){
 if(!cy)return;
 const id="area_"+Date.now();
 const a={id,label:"Topic area",color:palette[areas.length%palette.length],showLabel:true,points:defaultAreaPoints()};
 areas.push(a);selectedAreaId=id;saveAreas();renderAreaList();requestAnimationFrame(()=>renderAnnotations());
}
function renderAreaList(){
 const el=$("areaList"); el.innerHTML="";
 if(!areas.length){el.innerHTML='<div class="hint">No topic areas yet.</div>';return}
 areas.forEach(a=>{
  const row=document.createElement("div");row.className="area-row"+(a.id===selectedAreaId?" selected":"");
  row.innerHTML=`<button class="area-select" title="Select area">▱</button><input class="area-color" type="color" value="${a.color}"><input class="area-label" value="${escapeHtml(a.label)}" title="Topic label"><button class="delete-area">×</button>`;
  row.querySelector('.area-select').onclick=()=>{selectedAreaId=a.id;renderAreaList();renderAnnotations()};
  row.querySelector('.area-color').onchange=e=>{a.color=e.target.value;saveAreas();renderAnnotations()};
  row.querySelector('.area-label').oninput=e=>{a.label=e.target.value;saveAreas();renderAnnotations()};
  row.querySelector('.delete-area').onclick=()=>{areas=areas.filter(x=>x.id!==a.id);if(selectedAreaId===a.id)selectedAreaId=areas[0]?.id||null;saveAreas();renderAreaList();renderAnnotations()};
  el.appendChild(row);
  const tools=document.createElement('div');tools.className='area-tools';
  tools.innerHTML=`<button class="add-corner">＋ Add corner</button><button class="remove-corner" ${a.points.length<=3?'disabled':''}>− Remove corner</button><label class="label-toggle"><input type="checkbox" ${a.showLabel?'checked':''}> Show label</label><span class="corner-count">${a.points.length} corners</span>`;
  tools.querySelector('.add-corner').onclick=()=>addCorner(a.id);
  tools.querySelector('.remove-corner').onclick=()=>removeCorner(a.id);
  tools.querySelector('input').onchange=e=>{a.showLabel=e.target.checked;saveAreas();renderAnnotations()};
  row.after(tools);
 });
}
function addCorner(id){
 const a=areas.find(x=>x.id===id);if(!a)return;
 let best=0,bestLen=-1;
 for(let i=0;i<a.points.length;i++){const p=a.points[i],q=a.points[(i+1)%a.points.length];const dx=q.x-p.x,dy=q.y-p.y,len=dx*dx+dy*dy;if(len>bestLen){bestLen=len;best=i}}
 const p=a.points[best],q=a.points[(best+1)%a.points.length];
 a.points.splice(best+1,0,{x:(p.x+q.x)/2,y:(p.y+q.y)/2});selectedAreaId=id;saveAreas();renderAreaList();renderAnnotations();
}
function removeCorner(id){
 const a=areas.find(x=>x.id===id);if(!a||a.points.length<=3)return;
 // Remove the vertex nearest the centroid, preserving at least a triangle.
 const c=areaCentroid(a);let idx=0,best=Infinity;a.points.forEach((p,i)=>{const d=(p.x-c.x)**2+(p.y-c.y)**2;if(d<best){best=d;idx=i}});a.points.splice(idx,1);saveAreas();renderAreaList();renderAnnotations();
}
function svgEl(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e}
function renderAnnotations(){
 const svg=annotationLayer();if(!svg||!cy)return;while(svg.firstChild)svg.removeChild(svg.firstChild);
 const w=Math.max(1,cy.width()),h=Math.max(1,cy.height());svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 areas.forEach(a=>{
  const g=svgEl('g',{class:'annotation-group'+(a.id===selectedAreaId?' selected':'')});g.style.pointerEvents='auto';
  const pts=a.points.map(modelToScreen);const poly=svgEl('polygon',{class:'annotation-polygon',points:pts.map(p=>`${p.x},${p.y}`).join(' '),fill:a.color,'fill-opacity':'0.16',stroke:a.color});
  poly.style.pointerEvents='all';poly.addEventListener('pointerdown',e=>startAreaDrag(e,a.id));
  poly.addEventListener('click',e=>{e.stopPropagation();selectedAreaId=a.id;renderAreaList();renderAnnotations()});
  g.appendChild(poly);
  if(a.showLabel){const c=modelToScreen(areaCentroid(a));const t=svgEl('text',{class:'annotation-label',x:c.x,y:c.y,'text-anchor':'middle','dominant-baseline':'middle'});t.textContent=a.label||'';g.appendChild(t)}
  pts.forEach((p,i)=>{
   const h=svgEl('circle',{class:'annotation-handle',cx:p.x,cy:p.y,r:8});h.style.pointerEvents='all';
   h.addEventListener('pointerdown',e=>startHandleDrag(e,a.id,i));
   g.appendChild(h);
  });
  svg.appendChild(g);
 });
}
function startHandleDrag(e,id,index){
 e.preventDefault();e.stopPropagation();const a=areas.find(x=>x.id===id);if(!a)return;selectedAreaId=id;renderAreaList();
 const move=ev=>{const r=annotationLayer().getBoundingClientRect();const p=screenToModel(ev.clientX-r.left,ev.clientY-r.top);a.points[index]=p;renderAnnotations()};
 const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);saveAreas()};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
function startAreaDrag(e,id){
 e.preventDefault();e.stopPropagation();const a=areas.find(x=>x.id===id);if(!a)return;selectedAreaId=id;renderAreaList();
 const r=annotationLayer().getBoundingClientRect(),start=screenToModel(e.clientX-r.left,e.clientY-r.top);const original=a.points.map(p=>({...p}));
 const move=ev=>{const rr=annotationLayer().getBoundingClientRect(),now=screenToModel(ev.clientX-rr.left,ev.clientY-rr.top),dx=now.x-start.x,dy=now.y-start.y;a.points=a.points.map((p,i)=>({x:original[i].x+dx,y:original[i].y+dy}));renderAnnotations()};
 const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);saveAreas()};
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
}
function saveAreas(){localStorage.setItem('semanticAreas',JSON.stringify(areas))}
function loadAreas(){try{areas=JSON.parse(localStorage.getItem('semanticAreas')||'[]')}catch{areas=[]}areas=areas.filter(a=>Array.isArray(a.points)&&a.points.length>=3);selectedAreaId=areas[0]?.id||null;renderAreaList();renderAnnotations()}
function clearAreas(){areas=[];selectedAreaId=null;localStorage.removeItem('semanticAreas');renderAreaList();renderAnnotations()}
function renderLegend(){let e=$("legend");if(colorAttribute==="Village"){let vals=[...new Set(network.nodes.map(n=>n.Village))].sort();e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(v)}</div>`).join("")}else if(colorAttribute==="Question"){let vals=[...new Set(network.nodes.map(n=>n.Question))];e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(truncate(v,38))}</div>`).join("")}else if(colorAttribute==="Modularity Class"){e.innerHTML=palette.slice(0,8).map((c,i)=>`<div class="legend-item"><span class="swatch" style="background:${c}"></span>Community ${i}</div>`).join("")}else e.innerHTML="<div class='legend-item'>Colour scale / categorical colours shown on nodes.</div>"}
function truncate(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+"…":s}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
init().catch(e=>{console.error(e);$("loading").textContent="Could not load the network. See the browser console."});


/* ============================================================
   V8 ANNOTATION SYSTEM
   One authoritative SVG polygon layer, anchored to Cytoscape
   model coordinates. No window.cy dependency.
   ============================================================ */
const annotationState = {
  items: [],
  selectedId: null,
  drag: null
};

function annotationStorageKey() {
  return "semantic-network-explorer-annotations-v8";
}

function loadAnnotations() {
  try {
    const saved = JSON.parse(localStorage.getItem(annotationStorageKey()) || "[]");
    annotationState.items = Array.isArray(saved) ? saved : [];
  } catch (e) {
    annotationState.items = [];
  }
}

function saveAnnotations() {
  localStorage.setItem(
    annotationStorageKey(),
    JSON.stringify(annotationState.items)
  );
}

function annotationSvg() {
  return document.getElementById("annotationLayer");
}

function graphToAnnotationScreen(point) {
  const rendered = cy.renderedPosition({ x: point.x, y: point.y });
  return { x: rendered.x, y: rendered.y };
}

function annotationScreenToGraph(clientX, clientY) {
  const svg = annotationSvg();
  const rect = svg.getBoundingClientRect();
  const renderedX = clientX - rect.left;
  const renderedY = clientY - rect.top;
  const pan = cy.pan();
  const zoom = cy.zoom();

  return {
    x: (renderedX - pan.x) / zoom,
    y: (renderedY - pan.y) / zoom
  };
}

function annotationPointString(points) {
  return points.map(p => {
    const q = graphToAnnotationScreen(p);
    return `${q.x},${q.y}`;
  }).join(" ");
}

function selectedAnnotation() {
  return annotationState.items.find(
    item => item.id === annotationState.selectedId
  ) || null;
}

function annotationCentre(item) {
  const sum = item.points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return {
    x: sum.x / item.points.length,
    y: sum.y / item.points.length
  };
}

function renderAnnotations() {
  const svg = annotationSvg();
  if (!svg || !cy) return;

  let layer = svg.querySelector(".annotation-layer");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "annotation-layer");
    svg.appendChild(layer);
  }

  layer.innerHTML = "";

  annotationState.items.forEach(item => {
    const group = document.createElementNS(
      "http://www.w3.org/2000/svg", "g"
    );
    group.dataset.annotationId = item.id;

    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg", "polygon"
    );

    polygon.setAttribute("points", annotationPointString(item.points));
    polygon.setAttribute("fill", item.color);
    polygon.setAttribute(
      "fill-opacity",
      item.id === annotationState.selectedId ? "0.22" : "0.12"
    );
    polygon.setAttribute("stroke", item.color);
    polygon.setAttribute(
      "stroke-width",
      item.id === annotationState.selectedId ? "3" : "2"
    );
    polygon.setAttribute("stroke-dasharray", "7 5");
    polygon.style.pointerEvents = "auto";
    polygon.style.cursor = "move";

    polygon.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;

      annotationState.selectedId = item.id;

      const start = annotationScreenToGraph(
        event.clientX,
        event.clientY
      );

      annotationState.drag = {
        type: "polygon",
        item,
        start,
        original: item.points.map(p => ({ ...p }))
      };

      polygon.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      renderAnnotations();
      renderAnnotationControls();
    });

    group.appendChild(polygon);

    if (item.showLabel !== false) {
      const centre = annotationCentre(item);
      const screen = graphToAnnotationScreen(centre);

      const text = document.createElementNS(
        "http://www.w3.org/2000/svg", "text"
      );

      text.setAttribute("x", screen.x);
      text.setAttribute("y", screen.y);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("font-size", "14");
      text.setAttribute("font-weight", "700");
      text.setAttribute("fill", item.color);
      text.setAttribute("stroke", "#ffffff");
      text.setAttribute("stroke-width", "4");
      text.setAttribute("paint-order", "stroke");
      text.style.pointerEvents = "none";
      text.textContent = item.label || "Topic area";

      group.appendChild(text);
    }

    if (item.id === annotationState.selectedId) {
      item.points.forEach((point, index) => {
        const screen = graphToAnnotationScreen(point);

        const handle = document.createElementNS(
          "http://www.w3.org/2000/svg", "circle"
        );

        handle.setAttribute("cx", screen.x);
        handle.setAttribute("cy", screen.y);
        handle.setAttribute("r", "7");
        handle.setAttribute("fill", "#ffffff");
        handle.setAttribute("stroke", item.color);
        handle.setAttribute("stroke-width", "3");
        handle.style.pointerEvents = "auto";
        handle.style.cursor = "grab";

        handle.addEventListener("pointerdown", event => {
          if (event.button !== 0) return;

          annotationState.selectedId = item.id;
          annotationState.drag = {
            type: "vertex",
            item,
            index
          };

          event.preventDefault();
          event.stopPropagation();
        });

        group.appendChild(handle);
      });
    }

    layer.appendChild(group);
  });
}

function addTopicArea() {
  if (!cy) return;

  const extent = cy.extent();
  const cx = (extent.x1 + extent.x2) / 2;
  const cyy = (extent.y1 + extent.y2) / 2;

  const width = Math.max((extent.x2 - extent.x1) * 0.18, 80);
  const height = Math.max((extent.y2 - extent.y1) * 0.14, 60);

  const id = "annotation-" + Date.now();

  annotationState.items.push({
    id,
    label: "Topic area",
    color: "#f59e0b",
    showLabel: true,
    points: [
      { x: cx - width, y: cyy - height },
      { x: cx + width, y: cyy - height },
      { x: cx + width * 1.1, y: cyy + height * 0.55 },
      { x: cx - width * 0.9, y: cyy + height }
    ]
  });

  annotationState.selectedId = id;
  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

function deleteSelectedAnnotation() {
  if (!annotationState.selectedId) return;

  annotationState.items = annotationState.items.filter(
    item => item.id !== annotationState.selectedId
  );

  annotationState.selectedId = null;
  annotationState.drag = null;

  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

function clearTopicAreas() {
  annotationState.items = [];
  annotationState.selectedId = null;
  annotationState.drag = null;

  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

function addAnnotationCorner(item) {
  if (!item) return;

  let longest = 0;
  let longestLength = -Infinity;

  for (let i = 0; i < item.points.length; i++) {
    const a = item.points[i];
    const b = item.points[(i + 1) % item.points.length];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const length = dx * dx + dy * dy;

    if (length > longestLength) {
      longestLength = length;
      longest = i;
    }
  }

  const a = item.points[longest];
  const b = item.points[(longest + 1) % item.points.length];

  item.points.splice(longest + 1, 0, {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });

  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

function removeAnnotationCorner(item) {
  if (!item || item.points.length <= 3) return;

  item.points.pop();

  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

function renderAnnotationControls() {
  const list = document.getElementById("areaList");
  if (!list) return;

  list.innerHTML = "";

  annotationState.items.forEach(item => {
    const row = document.createElement("div");
    row.className =
      "area-item" +
      (item.id === annotationState.selectedId ? " selected" : "");

    row.innerHTML = `
      <input class="area-label" value="${escapeHtml(item.label || "Topic area")}">
      <input class="area-color" type="color" value="${item.color || "#f59e0b"}">
      <div class="area-actions">
        <button class="area-select">Select</button>
        <button class="area-add">＋ Corner</button>
        <button class="area-remove">− Corner</button>
        <button class="area-delete">Delete</button>
      </div>
      <label class="area-show">
        <input type="checkbox" ${item.showLabel !== false ? "checked" : ""}>
        Show label
      </label>
      <span class="area-count">${item.points.length} corners</span>
    `;

    row.querySelector(".area-select").onclick = () => {
      annotationState.selectedId = item.id;
      renderAnnotations();
      renderAnnotationControls();
    };

    row.querySelector(".area-add").onclick = () => {
      annotationState.selectedId = item.id;
      addAnnotationCorner(item);
    };

    row.querySelector(".area-remove").onclick = () => {
      annotationState.selectedId = item.id;
      removeAnnotationCorner(item);
    };

    row.querySelector(".area-delete").onclick = () => {
      annotationState.items = annotationState.items.filter(
        x => x.id !== item.id
      );

      if (annotationState.selectedId === item.id) {
        annotationState.selectedId = null;
      }

      saveAnnotations();
      renderAnnotations();
      renderAnnotationControls();
    };

    row.querySelector(".area-label").oninput = event => {
      item.label = event.target.value;
      saveAnnotations();
      renderAnnotations();
    };

    row.querySelector(".area-color").oninput = event => {
      item.color = event.target.value;
      saveAnnotations();
      renderAnnotations();
    };

    row.querySelector(".area-show input").onchange = event => {
      item.showLabel = event.target.checked;
      saveAnnotations();
      renderAnnotations();
    };

    list.appendChild(row);
  });
}

document.addEventListener("pointermove", event => {
  const drag = annotationState.drag;
  if (!drag || !cy) return;

  if (drag.type === "vertex") {
    const point = annotationScreenToGraph(
      event.clientX,
      event.clientY
    );

    drag.item.points[drag.index] = point;
  } else if (drag.type === "polygon") {
    const current = annotationScreenToGraph(
      event.clientX,
      event.clientY
    );

    const dx = current.x - drag.start.x;
    const dy = current.y - drag.start.y;

    drag.item.points = drag.original.map(point => ({
      x: point.x + dx,
      y: point.y + dy
    }));
  }

  renderAnnotations();
});

document.addEventListener("pointerup", () => {
  if (!annotationState.drag) return;

  annotationState.drag = null;
  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
});

function initializeAnnotations() {
  const svg = document.getElementById("annotationLayer");
  if (!svg || !cy) return;

  svg.style.pointerEvents = "none";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.zIndex = "4";

  loadAnnotations();
  renderAnnotations();
  renderAnnotationControls();

  document.getElementById("addArea")?.addEventListener(
    "click",
    addTopicArea
  );

  document.getElementById("clearAreas")?.addEventListener(
    "click",
    clearTopicAreas
  );

  cy.on("pan zoom resize", renderAnnotations);
}

/* Call this once, after Cytoscape has been constructed. */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

(function waitForGraphForAnnotations() {
  if (typeof cy !== "undefined" && cy && document.getElementById("annotationLayer")) {
    initializeAnnotations();
  } else {
    requestAnimationFrame(waitForGraphForAnnotations);
  }
})();
