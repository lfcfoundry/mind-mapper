import { validateDocument } from "../model/validate.js";

const TAU = Math.PI * 2;
const DEFAULT_TREE_OPTIONS = Object.freeze({ parentGap: 80, branchGap: 28, margin: 24 });
const DEFAULT_RADIAL_OPTIONS = Object.freeze({ radialGap: 64, branchGap: 24, margin: 24, startAngle: -Math.PI / 2 });

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const lexicalCompare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const cleanZero = (value) => Object.is(value, -0) ? 0 : value;

function error(code, message, details = {}) {
  return { code, message, ...details };
}

function failure(errors) {
  return { ok: false, errors };
}

function parseOptions(type, options) {
  if (!isRecord(options)) return { errors: [error("LAYOUT_OPTIONS_INVALID", "Options must be an object.")] };
  const defaults = type === "tree" ? DEFAULT_TREE_OPTIONS : DEFAULT_RADIAL_OPTIONS;
  const allowed = Object.keys(defaults);
  const unknown = Object.keys(options).filter((key) => !allowed.includes(key)).sort(lexicalCompare);
  if (unknown.length > 0) {
    return {
      errors: unknown.map((key) => error("LAYOUT_OPTION_UNKNOWN", "Layout option is not supported for this layout type.", { field: key })),
    };
  }

  const resolved = { ...defaults };
  const errors = [];
  for (const key of allowed) {
    if (!hasOwn(options, key)) continue;
    const value = options[key];
    if (key === "startAngle") {
      if (!Number.isFinite(value)) {
        errors.push(error("LAYOUT_OPTION_INVALID", "startAngle must be a finite number.", { field: key }));
      } else {
        resolved[key] = value;
      }
    } else if (!Number.isFinite(value) || value < 0) {
      errors.push(error("LAYOUT_OPTION_INVALID", key + " must be a finite non-negative number.", { field: key }));
    } else {
      resolved[key] = value;
    }
  }
  if (type === "radial" && errors.length === 0) {
    resolved.startAngle = ((resolved.startAngle % TAU) + TAU) % TAU;
  }
  return { options: resolved, errors };
}

function prepareTree(document) {
  const nodeById = new Map();
  const childCounts = new Map();
  for (const node of document.document.nodes) {
    nodeById.set(node.id, node);
    childCounts.set(node.id, 0);
  }
  for (const node of document.document.nodes) {
    if (node.parentId !== null) childCounts.set(node.parentId, childCounts.get(node.parentId) + 1);
  }

  const childrenById = new Map();
  for (const [id, count] of childCounts) childrenById.set(id, new Array(count));
  for (const node of document.document.nodes) {
    if (node.parentId !== null) childrenById.get(node.parentId)[node.order] = node.id;
  }

  const preorder = [];
  const depthById = new Map([[document.document.rootId, 0]]);
  const levels = [];
  const stack = [document.document.rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    const depth = depthById.get(id);
    preorder.push(id);
    (levels[depth] ??= []).push(id);
    const children = childrenById.get(id);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const childId = children[index];
      depthById.set(childId, depth + 1);
      stack.push(childId);
    }
  }
  return { nodeById, childrenById, preorder, depthById, levels };
}

function validateDimensions(document, tree, dimensions) {
  if (!isRecord(dimensions)) {
    return { errors: [error("DIMENSIONS_INVALID", "Dimensions must be an object keyed by node ID.")] };
  }
  const sizes = new Map();
  const errors = [];
  for (const id of tree.preorder) {
    if (!hasOwn(dimensions, id)) {
      errors.push(error("DIMENSION_MISSING", "A measured width and height are required for every node.", { nodeId: id }));
      continue;
    }
    const value = dimensions[id];
    if (!isRecord(value)
        || !Number.isFinite(value.width)
        || !Number.isFinite(value.height)
        || value.width <= 0
        || value.height <= 0) {
      errors.push(error("DIMENSION_INVALID", "Node dimensions must have finite, positive width and height.", { nodeId: id }));
      continue;
    }
    sizes.set(id, { width: value.width, height: value.height });
  }

  const unknownIds = Object.keys(dimensions)
    .filter((id) => !tree.nodeById.has(id))
    .sort(lexicalCompare);
  for (const nodeId of unknownIds) {
    errors.push(error("DIMENSION_NODE_NOT_FOUND", "Dimensions refer to a node outside the document.", { nodeId }));
  }
  return { sizes, errors };
}

function finite(value) {
  return Number.isFinite(value);
}

function buildPositionMap(tree, dimensions, positionForId) {
  const nodesById = Object.create(null);
  for (const id of tree.preorder) {
    const size = dimensions.get(id);
    const position = positionForId(id);
    nodesById[id] = {
      id,
      x: cleanZero(position.x),
      y: cleanZero(position.y),
      width: size.width,
      height: size.height,
      depth: tree.depthById.get(id),
    };
  }
  return nodesById;
}

function directionalEdges(tree, nodesById, direction) {
  const edges = [];
  for (const parentId of tree.preorder) {
    const parent = nodesById[parentId];
    for (const childId of tree.childrenById.get(parentId)) {
      const child = nodesById[childId];
      let from;
      let to;
      if (direction === "left-to-right") {
        from = { x: parent.x + parent.width, y: parent.y + parent.height / 2 };
        to = { x: child.x, y: child.y + child.height / 2 };
      } else if (direction === "right-to-left") {
        from = { x: parent.x, y: parent.y + parent.height / 2 };
        to = { x: child.x + child.width, y: child.y + child.height / 2 };
      } else if (direction === "top-to-bottom") {
        from = { x: parent.x + parent.width / 2, y: parent.y + parent.height };
        to = { x: child.x + child.width / 2, y: child.y };
      } else {
        from = { x: parent.x + parent.width / 2, y: parent.y };
        to = { x: child.x + child.width / 2, y: child.y + child.height };
      }
      edges.push({ parentId, childId, from, to });
    }
  }
  return edges;
}

function getBounds(nodesById, preorder, margin) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const id of preorder) {
    const node = nodesById[id];
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.width);
    maxY = Math.max(maxY, node.y + node.height);
  }
  return {
    x: cleanZero(minX - margin),
    y: cleanZero(minY - margin),
    width: cleanZero(maxX - minX + margin * 2),
    height: cleanZero(maxY - minY + margin * 2),
  };
}

function geometryIsFinite(nodesById, preorder, edges, bounds) {
  for (const id of preorder) {
    const node = nodesById[id];
    if (![node.x, node.y, node.width, node.height, node.depth, node.x + node.width, node.y + node.height]
      .every(finite)) return false;
  }
  for (const edge of edges) {
    if (![edge.from.x, edge.from.y, edge.to.x, edge.to.y].every(finite)) return false;
  }
  return [bounds.x, bounds.y, bounds.width, bounds.height].every(finite);
}

function directionalLayout(tree, dimensions, direction, options) {
  const horizontal = direction === "left-to-right" || direction === "right-to-left";
  const spans = new Map();
  for (let index = tree.preorder.length - 1; index >= 0; index -= 1) {
    const id = tree.preorder[index];
    const childIds = tree.childrenById.get(id);
    const breadthSize = horizontal ? dimensions.get(id).height : dimensions.get(id).width;
    let childSpan = 0;
    for (const childId of childIds) childSpan += spans.get(childId);
    if (childIds.length > 1) childSpan += options.branchGap * (childIds.length - 1);
    spans.set(id, Math.max(breadthSize, childSpan));
    if (!finite(spans.get(id))) return failure([error("GEOMETRY_NOT_FINITE", "Subtree breadth exceeds finite geometry.")]);
  }

  const maxMainByDepth = [];
  for (const id of tree.preorder) {
    const depth = tree.depthById.get(id);
    const mainSize = horizontal ? dimensions.get(id).width : dimensions.get(id).height;
    maxMainByDepth[depth] = Math.max(maxMainByDepth[depth] ?? 0, mainSize);
  }
  const mainCenterByDepth = [0];
  for (let depth = 1; depth < maxMainByDepth.length; depth += 1) {
    mainCenterByDepth[depth] = mainCenterByDepth[depth - 1]
      + maxMainByDepth[depth - 1] / 2
      + options.parentGap
      + maxMainByDepth[depth] / 2;
    if (!finite(mainCenterByDepth[depth])) {
      return failure([error("GEOMETRY_NOT_FINITE", "Tree depth exceeds finite geometry.")]);
    }
  }

  const breadthCenterById = new Map([[tree.preorder[0], 0]]);
  for (const id of tree.preorder) {
    const childIds = tree.childrenById.get(id);
    if (childIds.length === 0) continue;
    let groupSpan = 0;
    for (const childId of childIds) groupSpan += spans.get(childId);
    if (childIds.length > 1) groupSpan += options.branchGap * (childIds.length - 1);
    let cursor = breadthCenterById.get(id) - groupSpan / 2;
    for (const childId of childIds) {
      const center = cursor + spans.get(childId) / 2;
      breadthCenterById.set(childId, center);
      cursor += spans.get(childId) + options.branchGap;
    }
  }

  const mainSign = direction === "right-to-left" || direction === "bottom-to-top" ? -1 : 1;
  const nodesById = buildPositionMap(tree, dimensions, (id) => {
    const size = dimensions.get(id);
    const depth = tree.depthById.get(id);
    const mainCenter = mainCenterByDepth[depth] * mainSign;
    const breadthCenter = breadthCenterById.get(id);
    if (horizontal) {
      return { x: mainCenter - size.width / 2, y: breadthCenter - size.height / 2 };
    }
    return { x: breadthCenter - size.width / 2, y: mainCenter - size.height / 2 };
  });
  const edges = directionalEdges(tree, nodesById, direction);
  const bounds = getBounds(nodesById, tree.preorder, options.margin);
  if (!geometryIsFinite(nodesById, tree.preorder, edges, bounds)) {
    return failure([error("GEOMETRY_NOT_FINITE", "Layout produced non-finite geometry.")]);
  }
  return {
    ok: true,
    layout: {
      type: "tree",
      direction,
      options,
      nodesById,
      structuralEdges: edges,
      bounds,
      warnings: [],
    },
  };
}

function halfAngleSum(group, nodeRadii, branchGap, radius) {
  let sum = 0;
  for (const id of group.childIds) {
    const nodeRadius = nodeRadii.get(id);
    const halfAngle = Math.asin(Math.min(1, (nodeRadius + branchGap / 2) / radius));
    sum += halfAngle;
  }
  return sum;
}

function requiredAngularRadius(groups, nodeRadii, branchGap) {
  let lower = 0;
  for (const group of groups) {
    for (const id of group.childIds) {
      lower = Math.max(lower, nodeRadii.get(id) + branchGap / 2);
    }
  }
  if (!(lower > 0) || !finite(lower)) return null;
  const fits = (radius) => groups.every((group) =>
    halfAngleSum(group, nodeRadii, branchGap, radius) <= group.sector.span / 2);
  if (fits(lower)) return lower;

  let upper = lower;
  while (!fits(upper)) {
    if (upper > Number.MAX_VALUE / 2) return null;
    upper *= 2;
  }
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = lower + (upper - lower) / 2;
    if (fits(middle)) upper = middle;
    else lower = middle;
  }
  return upper;
}

function radialConnections(tree, nodesById) {
  const edges = [];
  for (const parentId of tree.preorder) {
    const parent = nodesById[parentId];
    for (const childId of tree.childrenById.get(parentId)) {
      const child = nodesById[childId];
      const parentCenter = { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 };
      const childCenter = { x: child.x + child.width / 2, y: child.y + child.height / 2 };
      const dx = childCenter.x - parentCenter.x;
      const dy = childCenter.y - parentCenter.y;
      const distance = Math.hypot(dx, dy);
      if (!(distance > 0) || !finite(distance)) return null;
      const ux = dx / distance;
      const uy = dy / distance;
      const boundaryDistance = (node, x, y) => Math.min(
        x === 0 ? Number.POSITIVE_INFINITY : node.width / 2 / Math.abs(x),
        y === 0 ? Number.POSITIVE_INFINITY : node.height / 2 / Math.abs(y),
      );
      const fromDistance = boundaryDistance(parent, ux, uy);
      const toDistance = boundaryDistance(child, ux, uy);
      edges.push({
        parentId,
        childId,
        from: { x: parentCenter.x + ux * fromDistance, y: parentCenter.y + uy * fromDistance },
        to: { x: childCenter.x - ux * toDistance, y: childCenter.y - uy * toDistance },
      });
    }
  }
  return edges;
}

function radialLayout(tree, dimensions, options) {
  const nodeRadii = new Map();
  const subtreeMass = new Map();
  for (let index = tree.preorder.length - 1; index >= 0; index -= 1) {
    const id = tree.preorder[index];
    const size = dimensions.get(id);
    const radius = Math.hypot(size.width, size.height) / 2;
    nodeRadii.set(id, radius);
    let mass = 1 + Math.log1p(radius * 2);
    for (const childId of tree.childrenById.get(id)) mass += subtreeMass.get(childId);
    if (!finite(radius) || !finite(mass)) {
      return failure([error("GEOMETRY_NOT_FINITE", "Radial node size or subtree weight exceeds finite geometry.", { nodeId: id })]);
    }
    subtreeMass.set(id, mass);
  }

  const centerRadiusByDepth = [0];
  const maxNodeRadiusByDepth = [nodeRadii.get(tree.preorder[0])];
  const angles = new Map();
  const startAngle = options.startAngle;
  const sectorsById = new Map([[tree.preorder[0], { start: startAngle, span: TAU }]]);

  for (let depth = 1; depth < tree.levels.length; depth += 1) {
    const groups = [];
    let levelMaxRadius = 0;
    for (const parentId of tree.levels[depth - 1]) {
      const childIds = tree.childrenById.get(parentId);
      if (childIds.length === 0) continue;
      const sector = sectorsById.get(parentId);
      groups.push({ parentId, childIds, sector });
      for (const childId of childIds) {
        levelMaxRadius = Math.max(levelMaxRadius, nodeRadii.get(childId));
      }
    }
    const angularRadius = requiredAngularRadius(groups, nodeRadii, options.branchGap);
    if (angularRadius === null) {
      return failure([error("GEOMETRY_NOT_FINITE", "Radial angular spacing cannot be represented with finite coordinates.")]);
    }
    const radialMinimum = centerRadiusByDepth[depth - 1]
      + maxNodeRadiusByDepth[depth - 1]
      + levelMaxRadius
      + options.radialGap;
    const ringRadius = Math.max(radialMinimum, angularRadius) * (1 + 1e-12);
    if (!finite(ringRadius)) {
      return failure([error("GEOMETRY_NOT_FINITE", "Radial ring exceeds finite coordinates.")]);
    }
    centerRadiusByDepth[depth] = ringRadius;
    maxNodeRadiusByDepth[depth] = levelMaxRadius;

    for (const group of groups) {
      const halfAngles = group.childIds.map((id) =>
        Math.asin(Math.min(1, (nodeRadii.get(id) + options.branchGap / 2) / ringRadius)));
      const halfTotal = halfAngles.reduce((total, value) => total + value, 0);
      const slack = Math.max(0, group.sector.span - 2 * halfTotal);
      let totalMass = 0;
      for (const id of group.childIds) totalMass += subtreeMass.get(id);
      if (!(totalMass > 0) || !finite(totalMass)) {
        return failure([error("GEOMETRY_NOT_FINITE", "Radial subtree weights exceed finite geometry.", { nodeId: group.parentId })]);
      }

      let cursor = group.sector.start;
      for (let index = 0; index < group.childIds.length; index += 1) {
        const id = group.childIds[index];
        const baseSlot = 2 * halfAngles[index];
        const proposed = baseSlot + slack * (subtreeMass.get(id) / totalMass);
        const slot = index === group.childIds.length - 1
          ? group.sector.start + group.sector.span - cursor
          : proposed;
        if (!finite(slot) || slot < baseSlot) {
          return failure([error("GEOMETRY_NOT_FINITE", "Radial sector allocation could not be represented.", { nodeId: id })]);
        }
        angles.set(id, cursor + slot / 2);
        sectorsById.set(id, { start: cursor, span: slot });
        cursor += slot;
      }
    }
  }

  const rootId = tree.preorder[0];
  const nodesById = buildPositionMap(tree, dimensions, (id) => {
    const depth = tree.depthById.get(id);
    if (depth === 0) {
      const size = dimensions.get(id);
      return { x: -size.width / 2, y: -size.height / 2 };
    }
    const radius = centerRadiusByDepth[depth];
    const angle = angles.get(id);
    const size = dimensions.get(id);
    const centerX = radius * Math.cos(angle);
    const centerY = radius * Math.sin(angle);
    return { x: centerX - size.width / 2, y: centerY - size.height / 2 };
  });
  const edges = radialConnections(tree, nodesById);
  if (!edges) return failure([error("GEOMETRY_NOT_FINITE", "Radial connector endpoints could not be represented.")]);
  const bounds = getBounds(nodesById, tree.preorder, options.margin);
  if (!geometryIsFinite(nodesById, tree.preorder, edges, bounds)) {
    return failure([error("GEOMETRY_NOT_FINITE", "Radial layout produced non-finite geometry.")]);
  }
  return {
    ok: true,
    layout: {
      type: "radial",
      direction: null,
      options,
      nodesById,
      structuralEdges: edges,
      bounds,
      warnings: [],
    },
  };
}

/** Compute deterministic node rectangles and hierarchy connectors for a valid v1 document. */
export function layoutDocument(document, configuration) {
  const validation = validateDocument(document);
  if (!validation.valid) {
    return failure([error("INVALID_DOCUMENT", "Layout input is not a valid v1 document.", { validationErrors: validation.errors })]);
  }
  return layoutValidatedDocument(document, configuration);
}

/** Same as layoutDocument for a document the caller already validated (for example one the command history just accepted). */
export function layoutValidatedDocument(document, configuration) {
  if (!isRecord(configuration)) {
    return failure([error("LAYOUT_CONFIG_INVALID", "Layout configuration must be an object.")]);
  }
  const allowedConfig = ["type", "direction", "dimensions", "options"];
  const unknownConfig = Object.keys(configuration).filter((key) => !allowedConfig.includes(key)).sort(lexicalCompare);
  if (unknownConfig.length > 0) {
    return failure(unknownConfig.map((field) => error("LAYOUT_CONFIG_FIELD_UNKNOWN", "Layout configuration field is not supported.", { field })));
  }

  const type = configuration.type;
  if (type !== "tree" && type !== "radial") {
    return failure([error("LAYOUT_TYPE_INVALID", "Layout type must be tree or radial.", { type })]);
  }
  let direction = null;
  if (type === "tree") {
    direction = configuration.direction === undefined ? "left-to-right" : configuration.direction;
    if (!["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top"].includes(direction)) {
      return failure([error("LAYOUT_DIRECTION_INVALID", "Tree direction is not supported.", { direction })]);
    }
  } else if (configuration.direction !== undefined) {
    return failure([error("LAYOUT_DIRECTION_NOT_APPLICABLE", "Radial layout does not accept a direction.")]);
  }

  const optionResult = parseOptions(type, configuration.options === undefined ? {} : configuration.options);
  if (optionResult.errors.length > 0) return failure(optionResult.errors);

  const tree = prepareTree(document);
  const dimensionResult = validateDimensions(document, tree, configuration.dimensions);
  if (dimensionResult.errors.length > 0) return failure(dimensionResult.errors);
  if (type === "tree") {
    return directionalLayout(tree, dimensionResult.sizes, direction, optionResult.options);
  }
  return radialLayout(tree, dimensionResult.sizes, optionResult.options);
}
