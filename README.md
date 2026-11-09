# CutPlan v0.4.3

CutPlan converts cutting lists into monochrome, portrait sheet layouts using a multi-stage guillotine packing heuristic.

## Three cutting modes

- **Cut along width** — fixes the primary cut direction across the sheet width.
- **Cut along length** — fixes the primary cut direction along the sheet length.
- **Optimal** — evaluates both primary cut directions and chooses the best validated result found.

All three modes use the same guillotine placement and splitting rules. The v0.4.3 display and cutting-list parser changes do not alter the packing/splitting algorithm.

## Cutting-list input and edge-banding notation

The preferred row order is:

`Reference | Length | Width | Quantity`

Rotation may be included as a fifth value in CSV or recognized text.

- References may be numeric or alphanumeric, for example `1A`, `2KB`, `CAB-A1`.
- Append one underscore `_` per edge requiring **0.8 mm** edge banding.
- Append one tilde `~` per edge requiring **2 mm** edge banding.
- The markers are interpreted independently. For example, `780__` means two 780 mm edges with 0.8 mm banding; `500_` means one 500 mm edge with 0.8 mm banding; `600~~` means two 600 mm edges with 2 mm banding.
- No marker means no banding for that dimension.
- Markers are shown in the editable cutting-list table and preserved in CSV export. Review PDF/image extraction before optimizing because OCR can misread small underscore and tilde glyphs.

The dashboard calculates total linear metres for 0.8 mm and 2 mm banding, including row quantity. Banding is a material estimate only; it is not highlighted in the sheet drawings and does not affect cutting geometry.

## Drawing labels

- Board drawings are portrait and monochrome.
- Length and width are shown separately on their matching sides; the labels account for a part's displayed orientation.
- Original cutting-list references are shown inside parts. Small labels are reduced to fit where possible, and a small-part schedule repeats dimensions when the drawing text would be too small to read.
- The drawing does not add a "rotated" label.

## Files

- `index.html` — browser interface, PDF/image/CSV/manual import, dashboard, drawings and print/PDF export.
- `cutting-list-parser.js` — alphanumeric reference, dimension suffix and OCR text parsing.
- `nesting-engine.js` — multi-stage guillotine engine and geometry validation.
- `test-engine.js` — Node.js regression checks, including the 27-row / 51-piece benchmark and new banding parser/total tests.

## Run locally

Keep all four files in one folder, then run:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

## Run the engine and parser tests

```bash
node test-engine.js
```

## Important production notes

- Set the actual sheet size, measured blade kerf and edge margin before generating a production plan.
- A blank kerf is treated as 0 mm and is explicitly provisional; it is not production-ready.
- The engine places parts only in rectangular free regions and splits those regions with straight guillotine cuts. It validates piece count, bounds, overlaps and recorded cut extents.
- The optimizer is heuristic. It searches 12, 64 or 240 deterministic strategies depending on the selected effort; it does not prove global optimality.
- Verify the resulting cut order, grain direction, clamping, trim allowance and banding requirements against the actual saw and job before cutting.
