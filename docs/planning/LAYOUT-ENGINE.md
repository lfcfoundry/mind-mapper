# Mind Mapper Layout Engine

The v1 layout engine is a deterministic, rendering-independent transformation from a validated document and caller-supplied node sizes to rectangles and structural connector endpoints. It does not measure text, mutate the document, read the DOM, or include cross-links.

## API

```js
import { layoutDocument } from "../../src/js/layout/index.js";

const result = layoutDocument(document, {
  type: "tree", // "tree" or "radial"
  direction: "left-to-right", // tree only; defaults to left-to-right
  dimensions: {
    root: { width: 120, height: 48 },
    branch: { width: 96, height: 40 },
  },
  options: {},
});
```

The `dimensions` object must provide an own `{ width, height }` entry for every node ID. Width and height must be finite positive numbers. Unknown dimension IDs fail too. No estimated fallback is used, so measured and guessed geometry cannot be mixed silently.

Tree directions are `left-to-right`, `right-to-left`, `top-to-bottom`, and `bottom-to-top`. Radial layout does not accept `direction`. Configuration and option fields are checked; unsupported fields fail instead of being ignored.

### Defaults

| Option | Tree | Radial | Meaning |
|---|---:|---:|---|
| `parentGap` | 80 | — | Clear space between parent and child depth layers along the primary axis. |
| `branchGap` | 28 | 24 | Minimum clear spacing between sibling subtree regions / angular node footprints. |
| `radialGap` | — | 64 | Minimum clear radial space between adjacent depth rings. |
| `margin` | 24 | 24 | Padding around the node extents in returned bounds. |
| `startAngle` | — | -π/2 | Start of the root's angular sector; normalized modulo 2π. |

The root's center is at world coordinate `(0, 0)` for both layout types. In directional layouts, `parentGap` applies horizontally for left/right directions and vertically for top/bottom directions. `branchGap` applies on the perpendicular axis.

## Output

Success is `{ ok: true, layout }`. Failure is `{ ok: false, errors }`, where each error has a stable `code`, message, and relevant `nodeId`, `field`, or nested document `validationErrors` when applicable.

`layout` contains:

- `type`, resolved `direction` (or `null` for radial), and resolved `options`.
- `nodesById`, a property-safe, null-prototype object keyed by stable node ID. Each value is `{ id, x, y, width, height, depth }`; `x` and `y` are the rectangle's top-left world coordinate.
- `structuralEdges`, in deterministic hierarchy/sibling order. Each `{ parentId, childId, from, to }` has connector endpoint coordinates on the parent and child rectangle boundaries.
- `bounds: { x, y, width, height }`, enclosing every rectangle plus `margin` on each side.
- `warnings`, currently always an empty array. Missing dimensions are errors, and the layouts reserve enough space to avoid rectangle overlap. Numeric overflow or unrepresentable geometry returns an error.

Relationship records are intentionally absent. A later scene or relationship router can process them independently.

## Directional tree algorithm

The engine builds child lists from explicit parent IDs and sibling `order`; source array order and object key order do not control placement. Traversals are iterative so deep trees do not rely on the JavaScript call stack.

For each node, a postorder pass computes its breadth span as the larger of its own breadth dimension and the combined spans of its child subtrees plus `branchGap` between each pair. Child subtrees are placed in document sibling order as adjacent bands, centered under/along their parent. The node is centered on the full span. A second pass finds the maximum primary-axis size at each depth. Depth-layer center positions then use those maxima plus `parentGap`, preventing boxes in neighboring layers from overlapping even when node sizes differ.

The four orientations use the same tree coordinates and reverse only the primary-axis sign where needed. Horizontal trees list siblings top-to-bottom; vertical trees list siblings left-to-right. Bounds include all node rectangles and margin.

## Radial tree algorithm

The root is centered at `(0, 0)`. Each node's conservative circular footprint has radius `hypot(width, height) / 2`, so its rectangle fits inside that circle.

Each parent owns an angular sector. Its children subdivide that sector in sibling order. At a given depth, the ring radius is at least the previous ring radius plus both depth levels' maximum footprint radii and `radialGap`. It is increased as needed so the children of every parent fit within that parent's sector without their circular footprints touching. A child's minimum half-angle is `asin((child footprint radius + branchGap / 2) / ring radius)`. Remaining sector angle is divided in proportion to subtree mass. A node's mass is `1 + log1p(2 × footprint radius)` plus the masses of its descendants. This gives larger branches more angular room while preserving the hierarchy's order and nested branch sectors.

Node centers lie on their depth ring at their sector midpoint. Because rectangles fit inside the reserved circles, the spacing also prevents rectangle overlap. Radial structural connectors are straight segments between the parent and child rectangle boundaries along the center-to-center direction.

## Determinism and limits

The layout validates but never changes the document. Geometry uses stable IDs, explicit sibling order, supplied dimensions, normalized options, deterministic iterative traversals, and no randomness, time, or browser measurement. Equal document semantics, dimensions, and options produce equal output; input array order and dimension-object property order do not affect it.

Directional work is linear in nodes after validation. Radial spacing uses a fixed-iteration search per depth and visits each node a bounded number of times. A deterministic 5,000-node fixture is part of the ordinary tests; it is correctness evidence, not a benchmark or performance target.

Implemented errors include `INVALID_DOCUMENT`, `LAYOUT_CONFIG_INVALID`, `LAYOUT_CONFIG_FIELD_UNKNOWN`, `LAYOUT_TYPE_INVALID`, `LAYOUT_DIRECTION_INVALID`, `LAYOUT_DIRECTION_NOT_APPLICABLE`, `LAYOUT_OPTIONS_INVALID`, `LAYOUT_OPTION_UNKNOWN`, `LAYOUT_OPTION_INVALID`, `DIMENSIONS_INVALID`, `DIMENSION_MISSING`, `DIMENSION_INVALID`, `DIMENSION_NODE_NOT_FOUND`, and `GEOMETRY_NOT_FINITE`.

## Future extension points and limitations

Text measurement remains a separate caller responsibility. This engine has no fold filtering, previous-layout stabilization, incremental updates, freeform positions, styling, cross-link routing, force layout, or rendering. A later adapter can provide measured dimensions and filtered visible nodes while retaining the v1 document as the source of truth. No incremental or device-performance claims have been measured.
