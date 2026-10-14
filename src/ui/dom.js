export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => { node.dataset[k] = v; });
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  });
  children.filter((child) => child !== null && child !== undefined).forEach((child) => node.append(child));
  return node;
}
