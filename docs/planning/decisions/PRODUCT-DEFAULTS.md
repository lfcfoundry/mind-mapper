# Mind Mapper — Confirmed Product Defaults

These product decisions are approved. The v1 implementation details recorded below realize those decisions without changing their scope.

## Approved

- The document is a rooted parent-child hierarchy. Every non-root node has exactly one parent.
- Cross-links are separate, independently identified relationships with source, target, and label. They may be directional or undirected. Semantic direction is separate from whether/how an arrow is drawn.
- Multiple differently labeled relationships between the same nodes are permitted. Duplicate detection considers normalized labels and endpoint/direction semantics.
- Node content is plain text initially; the data model must permit future rich-text content.
- Deleting a node deletes its descendants and incident cross-links. Reparenting moves the entire subtree.
- Radial and directional layouts are initial views. Changing layout never changes document structure.
- Automatic local recovery and explicit native JSON save/open are required. Cloud synchronization is excluded from the initial product.
- Mobile interaction prioritizes reliable tap, selection, editing, and navigation before advanced gesture complexity.

## Still open as implementation details

- The document envelope, migration details, and whether view defaults travel in native JSON.
- Radial/tree geometry, layout stability measures, and text measurement.
- Canvas scene representation, spatial index, and render invalidation.
- Touch movement thresholds and the eventual branch-drag interaction after reliable tap/edit/navigation are established.
- IndexedDB record/recovery layout and numeric performance budgets.
- Browser minimum versions and visual export sequencing.

## Implemented v1 model decisions

- Use the `lfcfoundry.mindmap` envelope at schema version 1, with a document ID, title, root ID, flat node records, and independent relationship records. No style, presentation, or arbitrary metadata fields are currently accepted.
- IDs are non-empty strings of at most 128 Unicode code points; document, node, and relationship IDs share one uniqueness namespace. Generated IDs use Web Crypto when available; tests and callers can inject an ID factory.
- Self-links are rejected. Relationship labels must contain non-whitespace text and are limited to 200 Unicode code points. Node labels are limited to 10,000 code points and titles to 200.
- Duplicate relationship comparison applies Unicode NFC normalization and trims outer whitespace without changing display labels. It remains case-sensitive. Directed endpoint order is significant; undirected endpoints are compared in lexical canonical order. Direction mode is part of the duplicate key, and differently labeled relationships remain permitted.
- Sibling orders are contiguous, non-negative integers starting at zero for each parent; the root order is zero. Unknown schema fields and unsupported schema versions fail validation.
- These choices and the exact API behavior are specified in [Document Model](../DOCUMENT-MODEL.md). There is no migration implementation yet.
