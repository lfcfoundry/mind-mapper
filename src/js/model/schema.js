export const DOCUMENT_FORMAT = "lfcfoundry.mindmap";
export const SCHEMA_VERSION = 1;

export const DIRECTION = Object.freeze({
  DIRECTED: "directed",
  UNDIRECTED: "undirected",
});

export const LIMITS = Object.freeze({
  idCodePoints: 128,
  titleCodePoints: 200,
  nodeLabelCodePoints: 10_000,
  relationshipLabelCodePoints: 200,
  nodes: 100_000,
  relationships: 500_000,
});

export const DOCUMENT_FIELDS = Object.freeze([
  "id",
  "title",
  "rootId",
  "nodes",
  "relationships",
]);

export const NODE_FIELDS = Object.freeze([
  "id",
  "parentId",
  "order",
  "label",
]);

export const RELATIONSHIP_FIELDS = Object.freeze([
  "id",
  "sourceId",
  "targetId",
  "direction",
  "label",
]);
