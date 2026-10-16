(() => {
  const els = [...document.querySelectorAll('[aria-label],[data-name],[title]')];
  return els.map((e) => ({ tag: e.tagName, aria: e.getAttribute('aria-label'), dn: e.getAttribute('data-name'), title: e.getAttribute('title'), vis: e.offsetParent !== null }))
    .filter((x) => /pine|script|editor/i.test([x.aria, x.dn, x.title].join(' '))).slice(0, 30);
})()
