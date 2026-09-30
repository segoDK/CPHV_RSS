# CPHV RSS Semantic Network Explorer

Static GitHub Pages explorer for the enriched semantic network.

## Current GraphML
The supplied `Survey-more-years.graphml` contains 1,937 nodes and 10,085 edges, with year/month, village, source sheet, modularity class, centrality measures, Question and Answer fields.

## Important data design choices
- `Question` and `Answer` are displayed in the inspector.
- `combined_text` is intentionally omitted from the browser payload.
- The long `#` identifier is retained only as hidden provenance. The interface uses short numeric IDs.
- `Modularity Class`, `Year`, `Month`, `Date`, `Village`, `Source_Sheet`, and network statistics are available as attributes.
- `Date` is generated as `YYYY-MM` from Year + Month so chronological sorting/grouping is unambiguous.
- Original GraphML node IDs are retained invisibly as `original_id`, so provenance is not lost.

## Updating the network
Replace the source GraphML and run:

```bash
python scripts/prepare_network.py Survey-more-years.graphml
```

Then commit the updated `data/network.json` and push to GitHub.

## Local preview

```bash
python -m http.server 8000
```

Open http://localhost:8000

## GitHub Pages

Put `index.html`, `app.js`, `style.css`, `data/`, and `scripts/` at the repository root and enable Pages from the `main` branch, root folder.
