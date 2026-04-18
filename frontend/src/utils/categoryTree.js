/**
 * GET /categories/tree returns nested nodes with subcategories arrays.
 * Layout sidebar expects { category, subcategories } with CategoryTreeItem recursion.
 */

function apiNodeToSidebarShape(node) {
  const id = node._id ?? node.id;
  const category = { ...node, _id: id };
  const rawSubs = node.subcategories || [];
  return {
    category,
    subcategories: rawSubs.map((child) => apiNodeToSidebarShape(child)),
  };
}

/** Roots from API → sidebar tree items */
export function adaptApiCategoryTreeForSidebar(nodes) {
  if (!nodes?.length) return [];
  return nodes.map((n) => apiNodeToSidebarShape(n));
}

/** Nested tree → flat list with parentCategory for dropdowns (matches list endpoint shape). */
export function flattenCategoryApiTree(nodes, parentId = null, out = []) {
  for (const node of nodes || []) {
    const id = node._id ?? node.id;
    out.push({
      ...node,
      _id: id,
      parentCategory: parentId ? { _id: parentId } : null,
    });
    if (node.subcategories?.length) {
      flattenCategoryApiTree(node.subcategories, id, out);
    }
  }
  return out;
}
