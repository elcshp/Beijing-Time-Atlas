# Start here

This is the complete current Beijing Time Atlas project, including the latest search, routing, phone layout and smooth-playback changes.

## Run the website

From this folder, run:

```bash
python -m http.server 8000 --directory dist
```

Then open http://localhost:8000 in a browser. On Windows, use `py` instead of `python` if necessary. Do not open index.html directly.

## Website files

Everything the website needs is in `dist/`. When uploading the site files to your GitHub Pages publishing folder, copy **the contents of dist**, keeping all file names and relative paths. Include `routes-graph.json.gz`; it powers route search. You can place README.md alongside index.html. The Python scripts and raw snapshots are not needed to run the website.

## Source and data

- README.md: mathematical model and assumptions.
- dist/: complete website, JavaScript source and prepared data.
- prepare_data.py, prepare_traffic.py, prepare_routes.py: data-preparation source.
- raw/: the three original OSM input snapshots.
- requirements.txt: Python dependencies for data preparation. Node.js is also required by prepare_traffic.py.

The scripts in this export use project-relative raw-data paths. No API account or key is required.

## Rebuilding data

The bundled prepared data is already ready to use. If rebuilding, install the Python dependencies with `python -m pip install -r requirements.txt`. Read README.md before replacing outputs: prepare_data.py can overwrite the enriched map geometry. Use its `--output` option to write a separate base JSON file, then deliberately merge places, matrices, straight, metroInfo, meta.places and meta.snapKm into dist/data.json while preserving the detailed visual layers. After that, run prepare_traffic.py and prepare_routes.py from this folder.

## Attribution

© OpenStreetMap contributors. Preserve the map attribution and applicable ODbL data notices when redistributing. See https://www.openstreetmap.org/copyright. A software-code licence is a separate choice and has not been assigned by this export.
