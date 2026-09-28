# Semantic Network Explorer

A static GitHub Pages prototype for exploring a semantic network in the browser.

## Features

- Original GraphML coordinates
- Force-directed, circle, and grid layouts
- Color nodes by attributes
- Size nodes by attributes
- Search/filter by node text
- Minimum-degree filter
- Click a node to inspect Question, Answer, combined text, metadata, and connected nodes
- Highlight the selected node's local neighbourhood
- PNG export

## Local preview

Because browsers restrict `fetch()` from `file://` URLs, run a tiny local server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## GitHub Pages

Push the contents of this directory to a repository and enable GitHub Pages from the repository's main branch.

## Updating the network

Replace `semantic-network.graphml` and run:

```bash
python scripts/prepare_network.py semantic-network.graphml
```

Then commit the updated `data/network.json`.

## Important

The initial supplied GraphML has 668 nodes and 3,862 edges. It contains `x`, `y`, `#`, `Question`, `Answer`, `combined_text`, and edge `weight`. It does not contain date or modularity/community attributes. The prototype therefore uses a clearly provisional community field derived from degree so the categorical controls can be exercised. Replace this with the real modularity/community field in the next GraphML.

Cytoscape.js is loaded from jsDelivr. See https://js.cytoscape.org/
