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
   V8 ANNOTATION SYSTEM
   Single authoritative SVG annotation layer.
   - Cytoscape owns the map and its pointer interaction.
   - SVG is a visual overlay and only selected annotation controls
     receive pointer events.
   - No render-event feedback loop and no full SVG rebuild during drag.
   ============================================================ */
const annotationState = {
  items: [],
  selectedId: null,
  drag: null,
  raf: 0
};

const ANNOTATION_STORAGE_KEY = "semantic-network-explorer-annotations-v8";
const SVG_NS = "http://www.w3.org/2000/svg";

function annotationSvg() {
  return document.getElementById("annotationLayer");
}

function annotationStorageKey() {
  return ANNOTATION_STORAGE_KEY;
}

function finiteNumber(v) {
  return Number.isFinite(Number(v));
}

function normalizeAnnotation(item, index = 0) {
  if (!item || !Array.isArray(item.points) || item.points.length < 3) return null;

  const points = item.points.map(p => ({
    x: Number(p?.x),
    y: Number(p?.y)
  }));

  if (!points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;

  return {
    id: String(item.id || `annotation-${Date.now()}-${index}`),
    label: String(item.label ?? "Topic area"),
    color: /^#[0-9a-f]{6}$/i.test(String(item.color || "")) ? String(item.color) : "#f59e0b",
    showLabel: item.showLabel !== false,
    points
  };
}

function loadAnnotations() {
  annotationState.items = [];
  annotationState.selectedId = null;

  try {
    let raw = localStorage.getItem(annotationStorageKey());
    let sourceKey = annotationStorageKey();

    if (!raw) {
      raw = localStorage.getItem("semanticAreas");
      sourceKey = "semanticAreas";
    }

    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    annotationState.items = parsed
      .map((item, index) => normalizeAnnotation(item, index))
      .filter(Boolean);

    // Persist the validated V8 representation and retire the legacy key.
    saveAnnotations();
    if (sourceKey === "semanticAreas") localStorage.removeItem("semanticAreas");
  } catch (error) {
    // A bad annotation must never prevent the network from loading.
    annotationState.items = [];
    annotationState.selectedId = null;
    try {
      localStorage.removeItem(annotationStorageKey());
      localStorage.removeItem("semanticAreas");
    } catch (_) {}
  }
}

function saveAnnotations() {
  try {
    const safe = annotationState.items
      .map((item, index) => normalizeAnnotation(item, index))
      .filter(Boolean);
    annotationState.items = safe;
    localStorage.setItem(annotationStorageKey(), JSON.stringify(safe));
  } catch (error) {
    console.warn("Could not save annotations", error);
  }
}

function annotationCentre(item) {
  let sx = 0;
  let sy = 0;
  item.points.forEach(p => {
    sx += p.x;
    sy += p.y;
  });
  return {
    x: sx / item.points.length,
    y: sy / item.points.length
  };
}

function graphToAnnotationScreen(point) {
  if (!cy) return { x: 0, y: 0 };
  const pan = cy.pan();
  const zoom = cy.zoom();
  return {
    x: Number(point.x) * zoom + pan.x,
    y: Number(point.y) * zoom + pan.y
  };
}

function annotationScreenToGraph(clientX, clientY) {
  const svg = annotationSvg();
  if (!svg || !cy) return { x: 0, y: 0 };

  const rect = svg.getBoundingClientRect();
  const renderedX = clientX - rect.left;
  const renderedY = clientY - rect.top;
  const pan = cy.pan();
  const zoom = cy.zoom() || 1;

  return {
    x: (renderedX - pan.x) / zoom,
    y: (renderedY - pan.y) / zoom
  };
}

function annotationPointString(points) {
  return points.map(point => {
    const p = graphToAnnotationScreen(point);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function selectedAnnotation() {
  return annotationState.items.find(
    item => item.id === annotationState.selectedId
  ) || null;
}

function ensureAnnotationLayer() {
  const svg = annotationSvg();
  if (!svg) return null;

  let layer = svg.querySelector(".annotation-layer");
  if (!layer) {
    layer = document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", "annotation-layer");
    svg.appendChild(layer);
  }
  return layer;
}

function makeSvg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function updateAnnotationVisual(item, group) {
  const polygon = group.querySelector(".annotation-polygon");
  if (polygon) {
    polygon.setAttribute("points", annotationPointString(item.points));
    polygon.setAttribute("fill", item.color);
    polygon.setAttribute("stroke", item.color);
    polygon.setAttribute(
      "fill-opacity",
      item.id === annotationState.selectedId ? "0.22" : "0.12"
    );
    polygon.setAttribute(
      "stroke-width",
      item.id === annotationState.selectedId ? "3" : "2"
    );
  }

  const centre = graphToAnnotationScreen(annotationCentre(item));
  const label = group.querySelector(".annotation-label");
  if (label) {
    label.setAttribute("x", centre.x);
    label.setAttribute("y", centre.y);
    label.setAttribute("fill", item.color);
    label.textContent = item.label || "Topic area";
  }

  group.querySelectorAll(".annotation-handle").forEach((handle, index) => {
    const point = item.points[index];
    if (!point) return;
    const screen = graphToAnnotationScreen(point);
    handle.setAttribute("cx", screen.x);
    handle.setAttribute("cy", screen.y);
    handle.setAttribute("stroke", item.color);
  });
}

function scheduleAnnotationVisualUpdate() {
  if (annotationState.raf) return;
  annotationState.raf = requestAnimationFrame(() => {
    annotationState.raf = 0;
    updateAnnotationVisuals();
  });
}

function updateAnnotationVisuals() {
  const layer = ensureAnnotationLayer();
  if (!layer || !cy) return;

  const groups = layer.querySelectorAll(".annotation-group");
  groups.forEach(group => {
    const item = annotationState.items.find(
      candidate => candidate.id === group.dataset.annotationId
    );
    if (item) updateAnnotationVisual(item, group);
  });
}

function beginPolygonDrag(event, item, polygon) {
  if (event.button !== 0) return;

  annotationState.selectedId = item.id;
  annotationState.drag = {
    type: "polygon",
    item,
    start: annotationScreenToGraph(event.clientX, event.clientY),
    original: item.points.map(p => ({ ...p }))
  };

  try { polygon.setPointerCapture(event.pointerId); } catch (_) {}
  event.preventDefault();
  event.stopPropagation();
  renderAnnotationControls();
  updateAnnotationVisuals();
}

function beginVertexDrag(event, item, index, handle) {
  if (event.button !== 0) return;

  annotationState.selectedId = item.id;
  annotationState.drag = {
    type: "vertex",
    item,
    index
  };

  try { handle.setPointerCapture(event.pointerId); } catch (_) {}
  event.preventDefault();
  event.stopPropagation();
  renderAnnotationControls();
}

function buildAnnotationGroup(item) {
  const group = makeSvg("g", {
    class: "annotation-group",
    "data-annotation-id": item.id
  });

  const polygon = makeSvg("polygon", {
    class: "annotation-polygon",
    points: annotationPointString(item.points),
    fill: item.color,
    "fill-opacity": item.id === annotationState.selectedId ? "0.22" : "0.12",
    stroke: item.color,
    "stroke-width": item.id === annotationState.selectedId ? "3" : "2",
    "stroke-dasharray": "7 5"
  });

  // Keep polygon interaction deliberately narrow. The map remains usable
  // everywhere outside an actively selected annotation.
  polygon.style.pointerEvents = item.id === annotationState.selectedId ? "auto" : "none";
  polygon.style.cursor = "move";
  polygon.addEventListener("pointerdown", event => beginPolygonDrag(event, item, polygon));
  group.appendChild(polygon);

  if (item.showLabel !== false) {
    const centre = graphToAnnotationScreen(annotationCentre(item));
    const text = makeSvg("text", {
      class: "annotation-label",
      x: centre.x,
      y: centre.y,
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
    text.textContent = item.label || "Topic area";
    group.appendChild(text);
  }

  if (item.id === annotationState.selectedId) {
    item.points.forEach((point, index) => {
      const screen = graphToAnnotationScreen(point);
      const handle = makeSvg("circle", {
        class: "annotation-handle",
        cx: screen.x,
        cy: screen.y,
        r: "7",
        fill: "#ffffff",
        stroke: item.color,
        "stroke-width": "3"
      });
      handle.style.pointerEvents = "auto";
      handle.addEventListener("pointerdown", event => beginVertexDrag(event, item, index, handle));
      group.appendChild(handle);
    });
  }

  return group;
}

function renderAnnotations() {
  const svg = annotationSvg();
  if (!svg || !cy) return;

  const layer = ensureAnnotationLayer();
  if (!layer) return;

  // Rebuild only when annotation structure/selection changes, never during
  // Cytoscape's render loop or every pointermove.
  layer.replaceChildren();
  annotationState.items.forEach(item => layer.appendChild(buildAnnotationGroup(item)));
  updateAnnotationVisuals();
}

function addTopicArea() {
  if (!cy) return;

  const extent = cy.extent();
  const cx = (extent.x1 + extent.x2) / 2;
  const cyy = (extent.y1 + extent.y2) / 2;
  const width = Math.max((extent.x2 - extent.x1) * 0.18, 80);
  const height = Math.max((extent.y2 - extent.y1) * 0.14, 60);
  const id = `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
  annotationState.drag = null;
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
  if (!item || item.points.length < 3) return;

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
    row.className = "area-item" + (item.id === annotationState.selectedId ? " selected" : "");
    row.innerHTML = `
      <input class="area-label" value="${escapeHtml(item.label || "Topic area")}">
      <input class="area-color" type="color" value="${item.color || "#f59e0b"}">
      <div class="area-actions">
        <button class="area-select" type="button">Select</button>
        <button class="area-add" type="button">＋ Corner</button>
        <button class="area-remove" type="button" ${item.points.length <= 3 ? "disabled" : ""}>− Corner</button>
        <button class="area-delete" type="button">Delete</button>
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
      annotationState.items = annotationState.items.filter(x => x.id !== item.id);
      if (annotationState.selectedId === item.id) annotationState.selectedId = null;
      annotationState.drag = null;
      saveAnnotations();
      renderAnnotations();
      renderAnnotationControls();
    };
    row.querySelector(".area-label").oninput = event => {
      item.label = event.target.value;
      saveAnnotations();
      updateAnnotationVisuals();
    };
    row.querySelector(".area-color").oninput = event => {
      item.color = event.target.value;
      saveAnnotations();
      updateAnnotationVisuals();
      renderAnnotationControls();
    };
    row.querySelector(".area-show input").onchange = event => {
      item.showLabel = event.target.checked;
      saveAnnotations();
      renderAnnotations();
    };

    list.appendChild(row);
  });
}

function handleAnnotationPointerMove(event) {
  const drag = annotationState.drag;
  if (!drag || !cy) return;

  const point = annotationScreenToGraph(event.clientX, event.clientY);

  if (drag.type === "vertex") {
    drag.item.points[drag.index] = point;
  } else if (drag.type === "polygon") {
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    drag.item.points = drag.original.map(original => ({
      x: original.x + dx,
      y: original.y + dy
    }));
  }

  scheduleAnnotationVisualUpdate();
}

function handleAnnotationPointerUp() {
  if (!annotationState.drag) return;
  annotationState.drag = null;
  saveAnnotations();
  renderAnnotations();
  renderAnnotationControls();
}

let annotationsInitialized = false;

function initializeAnnotations() {
  const svg = annotationSvg();
  if (!svg || !cy || annotationsInitialized) return;
  annotationsInitialized = true;

  svg.style.pointerEvents = "none";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.zIndex = "4";
  svg.setAttribute("preserveAspectRatio", "none");

  loadAnnotations();
  renderAnnotations();
  renderAnnotationControls();

  document.getElementById("addArea")?.addEventListener("click", addTopicArea);
  document.getElementById("clearAreas")?.addEventListener("click", clearTopicAreas);

  // These events only reposition existing SVG elements. There is no render
  // event subscription, so Cytoscape and SVG cannot recursively trigger each other.
  cy.on("pan zoom resize", scheduleAnnotationVisualUpdate);
  window.addEventListener("pointermove", handleAnnotationPointerMove, { passive: true });
  window.addEventListener("pointerup", handleAnnotationPointerUp, { passive: true });
}
