# Semantic Network Explorer v3

## What changed
- Uses the corrected GraphML as the source.
- Initial view uses the GraphML's original x/y positions. No automatic alternate layout is used.
- Random node is inspected on startup without recentering the map.
- Hover inspects without recentering; click inspects and centres.
- Strong selected-node highlighting.
- Answer is the primary highlighted content in the inspector.
- Source sheet and combined text are omitted from the web interface.
- Village and date are first in the inspector's attributes.
- Village, date, question and network metrics can drive colour.
- Timeline progressively filters the network through the available survey dates and can play automatically.
- Village filtering.
- Larger node-size range.
- Movable, labelled, recolourable topic-area annotations saved in the browser.
- Connected-node list uses short ID + answer preview.
- Edge opacity can be zero.

## Update workflow
Keep the GraphML as the master source. To replace the data:
`python scripts/prepare_network.py path/to/new.graphml`
Then commit/push `data/network.json` and the site files.

## GitHub Pages
Put index.html, app.js, style.css, data/, and scripts/ at the repository root and publish the root of the main branch.
