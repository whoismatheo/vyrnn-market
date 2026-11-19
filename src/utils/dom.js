export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(name, value === true ? '' : value);
    }
  }

  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}
