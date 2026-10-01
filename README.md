# Semantic Network Explorer V7

# Semantic Network Explorer v7

Interactive semantic-network explorer using the corrected GraphML.

## v6 features
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
- Free-form polygon topic areas with 3+ corners.
  - Add or remove corners.
  - Drag individual corners to shape the area.
  - Drag the polygon itself to move the whole area.
  - Optional labels and independent colours.
  - Annotations are saved in the browser.
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


## v6 annotation fix
- Topic areas are rendered in a dedicated SVG overlay with explicit pointer-event handling so the Add topic area control reliably produces a visible polygon.


## V7 polygon annotations

Topic areas are free-form polygons anchored to the network coordinate system.

- Drag the polygon interior to move the whole area.
- Drag individual corner handles to reshape it.
- Add or remove corners from the annotation controls.
- Change colour and label.
- Toggle labels.
- Multiple areas are supported independently.
- Annotation geometry is stored in the browser's local storage and follows the network when it is panned or zoomed.
