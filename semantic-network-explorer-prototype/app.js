let network;
let cy;
let colorAttribute = "modularity";
let sizeAttribute = "degree";
let selectedNode = null;

const palette = [
  "#386cb0","#fdb462","#7fc97f","#ef3b2c","#beaed4",
  "#fdc086","#ffff99","#666666","#1b9e77","#d95f02",
  "#7570b3","#e7298a"
];

const $ = id => document.getElementById(id);

async function init() {
  network = await fetch("data/network.json").then(r => r.json());

  $("stats").textContent = `${network.metadata.nodes.toLocaleString()} nodes · ${network.metadata.edges.toLocaleString()} edges`;

  const nodeAttrs = ["degree", "weighted_degree", "modularity", "x", "y", "Question", "Answer", "#"];
  fillSelect($("colorBy"), ["modularity", "degree", "weighted_degree", "Question", "Answer", "#"]);
  fillSelect($("sizeBy"), ["degree", "weighted_degree", "modularity"]);

  const elements = [
    ...network.nodes.map(n => ({ data: n, position: { x: n.x || 0, y: n.y || 0 } })),
    ...network.edges.map(e => ({ data: e }))
  ];

  cy = cytoscape({
    container: $("cy"),
    elements,
    pixelRatio: 1,
    wheelSensitivity: 0.25,
    boxSelectionEnabled: true,
    style: [
      {
        selector: "node",
        style: {
          "background-color": nodeColor,
          "width": nodeSize,
          "height": nodeSize,
          "border-width": 0.8,
          "border-color": "#ffffff",
          "label": "",
          "overlay-opacity": 0
        }
      },
      {
        selector: "node:selected",
        style: {
          "border-width": 3,
          "border-color": "#111827",
          "overlay-opacity": 0.12
        }
      },
      {
        selector: "edge",
        style: {
          "width": edgeWidth,
          "line-color": "#9aa3b2",
          "opacity": parseFloat($("edgeOpacity").value),
          "curve-style": "haystack"
        }
      },
      {
        selector: ".faded",
        style: { "opacity": 0.08 }
      },
      {
        selector: ".highlighted",
        style: { "opacity": 1 }
      }
    ],
    layout: { name: "preset", fit: true, padding: 30 }
  });

  cy.on("tap", "node", evt => inspectNode(evt.target));
  cy.on("tap", evt => {
    if (evt.target === cy) clearInspector();
  });

  $("colorBy").addEventListener("change", e => {
    colorAttribute = e.target.value;
    updateStyle();
  });
  $("sizeBy").addEventListener("change", e => {
    sizeAttribute = e.target.value;
    updateStyle();
  });
  $("sizeScale").addEventListener("input", updateStyle);
  $("edgeOpacity").addEventListener("input", updateStyle);
  $("layout").addEventListener("change", runLayout);
  $("fit").onclick = () => cy.fit(cy.elements("node"), 30);
  $("resetStyle").onclick = resetStyle;
  $("downloadPng").onclick = exportPNG;
  $("resetFilters").onclick = resetFilters;
  $("search").addEventListener("input", applyFilters);
  $("minDegree").addEventListener("input", () => {
    $("degreeValue").textContent = $("minDegree").value;
    applyFilters();
  });

  $("loading").style.display = "none";
  updateStyle();
  renderLegend();
}

function fillSelect(select, values) {
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v; o.textContent = pretty(v);
    select.appendChild(o);
  });
}

function pretty(v) {
  return ({modularity:"Modularity / community", weighted_degree:"Weighted degree"}[v]) || v;
}

function numericValues(attr) {
  return network.nodes.map(n => Number(n[attr])).filter(Number.isFinite);
}

function range(attr) {
  const vals = numericValues(attr);
  if (!vals.length) return [0,1];
  return [Math.min(...vals), Math.max(...vals)];
}

function normalized(value, min, max) {
  if (max === min) return .5;
  return (Number(value) - min) / (max - min);
}

function nodeSize(node) {
  const [min,max] = range(sizeAttribute);
  const s = normalized(node.data(sizeAttribute), min, max);
  return (7 + Math.sqrt(Math.max(0, s)) * 20) * parseFloat($("sizeScale").value);
}

function nodeColor(node) {
  const val = node.data(colorAttribute);
  if (colorAttribute === "modularity") return palette[Math.abs(Number(val) || 0) % palette.length];
  if (["degree","weighted_degree","x","y"].includes(colorAttribute)) {
    const [min,max] = range(colorAttribute);
    const t = normalized(val, min, max);
    return `hsl(${220 - 200*t}, 72%, ${48 + 10*(1-t)}%)`;
  }
  // Stable categorical color.
  let hash = 0;
  String(val ?? "").split("").forEach(c => hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0);
  return palette[Math.abs(hash) % palette.length];
}

function edgeWidth(edge) {
  const w = Number(edge.data("weight")) || 1;
  return Math.max(0.5, Math.min(6, 0.5 + Math.log1p(w) * 0.55));
}

function updateStyle() {
  if (!cy) return;
  cy.nodes().forEach(n => {
    n.style("background-color", nodeColor(n));
    n.style("width", nodeSize(n));
    n.style("height", nodeSize(n));
  });
  cy.edges().forEach(e => e.style("opacity", parseFloat($("edgeOpacity").value)));
  renderLegend();
}

function runLayout() {
  const name = $("layout").value;
  if (name === "preset") {
    cy.layout({ name:"preset", fit:true, padding:30 }).run();
  } else {
    cy.layout({
      name,
      animate: name === "cose",
      fit: true,
      padding: 40,
      idealEdgeLength: 90,
      nodeRepulsion: 5000,
      gravity: 0.25
    }).run();
  }
}

function inspectNode(node) {
  selectedNode = node;
  const d = node.data();
  cy.elements().removeClass("faded highlighted");
  node.neighborhood().add(node).addClass("highlighted");
  cy.animate({ fit: { eles: node.neighborhood().add(node), padding: 100 }, duration: 250 });

  const neighbours = node.neighborhood("node").sort((a,b) => (b.data("weight")||0) - (a.data("weight")||0));
  const connections = neighbours.slice(0, 12).map(n => {
    const text = n.data("Question") || n.data("Answer") || n.data("#") || n.id();
    return `<div class="connection" data-node="${escapeHtml(n.id())}">${escapeHtml(truncate(text, 110))}</div>`;
  }).join("");

  $("inspector").innerHTML = `
    <h2 class="node-title">${escapeHtml(d["#"] || d.id)}</h2>
    <div class="node-id">${escapeHtml(d.id)}</div>
    <div class="card">
      <h3>Question</h3>
      <p>${escapeHtml(d.Question || "Not available")}</p>
    </div>
    <div class="card">
      <h3>Answer</h3>
      <p>${escapeHtml(d.Answer || "Not available")}</p>
    </div>
    <div class="card">
      <h3>Combined text</h3>
      <p>${escapeHtml(d.combined_text || "Not available")}</p>
    </div>
    <div class="card">
      <h3>Network attributes</h3>
      <div class="meta">
        <div><b>Degree</b><span>${d.degree}</span></div>
        <div><b>Weighted degree</b><span>${Number(d.weighted_degree).toFixed(2)}</span></div>
        <div><b>Community</b><span>${d.modularity}</span></div>
        <div><b>Coordinates</b><span>${Number(d.x).toFixed(1)}, ${Number(d.y).toFixed(1)}</span></div>
      </div>
    </div>
    <div class="card">
      <h3>Connected nodes (${neighbours.length})</h3>
      ${connections || "<p>No connected nodes.</p>"}
    </div>
  `;

  $("inspector").querySelectorAll(".connection").forEach(el => {
    el.onclick = () => {
      const target = cy.getElementById(el.dataset.node);
      if (target.nonempty()) inspectNode(target);
    };
  });
}

function clearInspector() {
  cy.elements().removeClass("faded highlighted");
  $("inspector").innerHTML = `<div class="inspector-empty">
    <div class="big-icon">◉</div><h2>Inspect a node</h2>
    <p>Click a node in the network to see its question, answer, metadata, and local connections.</p>
  </div>`;
}

function applyFilters() {
  const q = $("search").value.trim().toLowerCase();
  const minDegree = Number($("minDegree").value);
  cy.nodes().forEach(n => {
    const d = n.data();
    const hay = [d.id,d["#"],d.Question,d.Answer,d.combined_text].filter(Boolean).join(" ").toLowerCase();
    const visible = d.degree >= minDegree && (!q || hay.includes(q));
    n.style("display", visible ? "element" : "none");
  });
}

function resetFilters() {
  $("search").value = "";
  $("minDegree").value = 0;
  $("degreeValue").textContent = "0";
  cy.nodes().style("display","element");
}

function resetStyle() {
  $("colorBy").value = "modularity";
  $("sizeBy").value = "degree";
  $("sizeScale").value = 1;
  $("edgeOpacity").value = .35;
  $("layout").value = "preset";
  colorAttribute = "modularity";
  sizeAttribute = "degree";
  updateStyle();
  runLayout();
}

function renderLegend() {
  const el = $("legend");
  if (colorAttribute === "modularity") {
    el.innerHTML = palette.slice(0, 8).map((c,i) =>
      `<div class="legend-item"><span class="swatch" style="background:${c}"></span>Community ${i}</div>`
    ).join("");
  } else if (["degree","weighted_degree"].includes(colorAttribute)) {
    el.innerHTML = `<div class="legend-item"><span class="swatch" style="background:hsl(220,72%,58%)"></span>Lower</div>
      <div class="legend-item"><span class="swatch" style="background:hsl(120,72%,58%)"></span>Middle</div>
      <div class="legend-item"><span class="swatch" style="background:hsl(20,72%,58%)"></span>Higher</div>`;
  } else {
    el.innerHTML = `<div class="legend-item">Categorical colours are assigned deterministically.</div>`;
  }
}

function exportPNG() {
  const png = cy.png({ full: true, scale: 2, bg: "#fbfcfe" });
  const a = document.createElement("a");
  a.href = png;
  a.download = "semantic-network.png";
  a.click();
}

function truncate(s,n) { return s.length > n ? s.slice(0,n-1) + "…" : s; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init().catch(err => {
  console.error(err);
  $("loading").textContent = "Could not load network.json. See the browser console for details.";
});
