# Semantic Network Explorer V9

# Semantic Network Explorer V9

Interactive semantic-network explorer using the corrected GraphML.

## V8 features
- Original GraphML x/y layout is the default.
- Hover to inspect without recentering; click to inspect and centre.
- Strong selected-node highlighting.
- Answer-first inspector.
- Village and date are first in Network attributes.
- Village filtering.
- Colour by Village, Date, Question, Modularity Class, and network metrics.
- Larger node-size range.
- Timeline across the actual survey waves.
  - **Show up to selected date** progressively reveals the network.
  - **Show only selected date** isolates one survey wave.
  - **Play timeline** automatically advances through the waves.
- Polygon annotations (V9 rewrite), fixed to map coordinates so they follow pan and zoom.
  - **Draw new area**: click corners on the map; finish with double-click, Enter, or by clicking the first corner. Esc cancels.
  - **Edit**: select an area, then drag corners, drag a "+" on an edge to add a corner, double-click or right-click a corner to remove it, drag the outline or label to move the whole area.
  - Per-area label, colour picker, fill strength, show/hide label, Zoom to, Delete.
  - Saved in the browser. **Export/Import** JSON. To give every visitor the same annotations, commit the exported file as `data/annotations.json` (loaded on first visit when the visitor has none saved).
- Connected nodes use short ID + answer preview.
- Edge opacity can be set to 0%.

## Updating the data
Keep the GraphML as the master source. Run:

```bash
python scripts/prepare_network.py path/to/new.graphml
```

Then commit the regenerated `data/network.json` and the site files.

## GitHub Pages
Put `index.html`, `app.js`, `style.css`, `data/`, and `scripts/` at the repository root and publish the root of the main branch.


## V8 annotation fix
- Topic areas are rendered in a dedicated SVG overlay with explicit pointer-event handling so the Add topic area control reliably produces a visible polygon.


## V8 polygon annotations

Topic areas are free-form polygons anchored to the network coordinate system.

- Drag the polygon interior to move the whole area.
- Drag individual corner handles to reshape it.
- Add or remove corners from the annotation controls.
- Change colour and label.
- Toggle labels.
- Multiple areas are supported independently.
- Annotation geometry is stored in the browser's local storage and follows the network when it is panned or zoomed.


## V9 annotation system

The annotation feature uses one integrated SVG polygon layer tied directly to the Cytoscape graph coordinate system.

- Add a topic area from the annotation controls.
- Drag the polygon interior to move it.
- Drag individual vertices to reshape it.
- Add or remove vertices.
- Use at least three vertices.
- Edit colour and label.
- Toggle labels.
- Delete individual areas or clear all areas.
- Areas remain attached to the network while panning and zooming.
- Annotation data is stored locally in the browser.


## V9 interaction fix

The annotation layer no longer calls `cy.renderedPosition()`. Annotation coordinates
are transformed using the Cytoscape core's pan and zoom values, while ordinary
Cytoscape rendering is left untouched. The annotation SVG only accepts pointer
events on actual polygon and corner shapes.
