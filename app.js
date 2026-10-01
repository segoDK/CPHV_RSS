let network,cy,selectedNode=null,playing=false,timer=null;
const palette=["#386cb0","#fdb462","#7fc97f","#ef3b2c","#beaed4","#fdc086","#ffff99","#666666","#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#1f78b4"];
const months={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
let dates=[],colorAttribute="Modularity Class",sizeAttribute="degree",areas=[],timelineMode="cumulative";
const $=id=>document.getElementById(id);
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
function addArea(){let id="area_"+Date.now(),center=cy.renderedPosition({x:cy.width()/2,y:cy.height()/2});let p=cy.pan();let zoom=cy.zoom();let pos={x:(center.x-p.x)/zoom,y:(center.y-p.y)/zoom};let n=cy.add({group:"nodes",data:{id,label:"Topic area",annotation:true},position:pos});n.addClass("area");n.style({width:300,height:180,"background-color":"#fdb462"});n.grabify();areas.push({id,label:"Topic area",color:"#fdb462",width:300,height:180});saveAreas();renderAreaList();n.on("dragfree",saveAreas)}
function renderAreaList(){let el=$("areaList");el.innerHTML="";areas.forEach(a=>{let row=document.createElement("div");row.className="area-row";row.innerHTML=`<input class="area-color" type="color" value="${a.color}"><input class="area-label" value="${escapeHtml(a.label)}"><button class="delete-area">×</button>`;row.querySelector(".area-color").onchange=e=>{a.color=e.target.value;let n=cy.getElementById(a.id);n.style("background-color",a.color);saveAreas()};row.querySelector(".area-label").oninput=e=>{a.label=e.target.value;let n=cy.getElementById(a.id);n.data("label",a.label);saveAreas()};row.querySelector(".delete-area").onclick=()=>{cy.getElementById(a.id).remove();areas=areas.filter(x=>x.id!==a.id);saveAreas();renderAreaList()};el.appendChild(row)})}
function saveAreas(){let vals=areas.map(a=>{let n=cy.getElementById(a.id);return {...a,position:n.position(),width:Number(n.width()),height:Number(n.height())}});localStorage.setItem("semanticAreas",JSON.stringify(vals))}
function loadAreas(){try{areas=JSON.parse(localStorage.getItem("semanticAreas")||"[]")}catch{areas=[]}areas.forEach(a=>{let n=cy.add({group:"nodes",data:{id:a.id,label:a.label,annotation:true},position:a.position});n.addClass("area");n.style({width:a.width,height:a.height,"background-color":a.color});n.on("dragfree",saveAreas)});renderAreaList()}
function clearAreas(){cy.nodes(".area").remove();areas=[];localStorage.removeItem("semanticAreas");renderAreaList()}
function renderLegend(){let e=$("legend");if(colorAttribute==="Village"){let vals=[...new Set(network.nodes.map(n=>n.Village))].sort();e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(v)}</div>`).join("")}else if(colorAttribute==="Question"){let vals=[...new Set(network.nodes.map(n=>n.Question))];e.innerHTML=vals.map((v,i)=>`<div class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${escapeHtml(truncate(v,38))}</div>`).join("")}else if(colorAttribute==="Modularity Class"){e.innerHTML=palette.slice(0,8).map((c,i)=>`<div class="legend-item"><span class="swatch" style="background:${c}"></span>Community ${i}</div>`).join("")}else e.innerHTML="<div class='legend-item'>Colour scale / categorical colours shown on nodes.</div>"}
function truncate(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+"…":s}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
init().catch(e=>{console.error(e);$("loading").textContent="Could not load the network. See the browser console."});