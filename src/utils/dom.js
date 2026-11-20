const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function applyAttributes(node, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(name, value === true ? '' : value);
    }
  }
}

function appendChildren(node, children) {
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
}

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  applyAttributes(node, attributes);
  appendChildren(node, children);
  return node;
}

export function svg(tag, attributes = {}, ...children) {
  const node = document.createElementNS(SVG_NAMESPACE, tag);
  applyAttributes(node, attributes);
  appendChildren(node, children);
  return node;
}
