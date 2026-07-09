/* Mounts a local-graph panel (current page + 1-hop neighbors, links and backlinks).
 * Preferred spot: the right sidebar, below the Contents toc. Fallback (no toc /
 * narrow screens): a collapsible panel at the end of the article. */
;(function () {
  'use strict'

  var script = document.currentScript
  if (!script || !window.BirbGraph || !window.ForceGraph) return
  var article = document.querySelector('article.doc')
  if (!article) return

  var siteRootHref = new URL(script.dataset.siteRoot + '/', location.href)

  BirbGraph.load(siteRootHref).then(function (data) {
    var rootPath = decodeURIComponent(siteRootHref.pathname)
    var currentPath = decodeURIComponent(location.pathname)
    if (currentPath.indexOf(rootPath) !== 0) return
    var currentId = '/' + currentPath.slice(rootPath.length)
    var current = data.byId.get(currentId)
    if (!current || current.neighbors.size === 0) return

    var visible = new Set(current.neighbors)
    visible.add(current)
    var nodes = data.nodes.filter(function (n) { return visible.has(n) })
    var links = data.links.filter(function (l) {
      return visible.has(data.byId.get(l.source)) && visible.has(data.byId.get(l.target))
    })

    // site.js removes aside.toc.sidebar on pages without headings; it is also
    // display:none below the desktop breakpoint — offsetParent covers both.
    var tocMenu = document.querySelector('aside.toc.sidebar .toc-menu')
    var inSidebar = tocMenu && tocMenu.offsetParent !== null
    var canvasBox = document.createElement('div')
    canvasBox.className = 'local-graph-canvas'

    if (inSidebar) {
      var box = document.createElement('div')
      box.className = 'local-graph is-sidebar'
      var title = document.createElement('h3')
      title.textContent = 'Graph'
      box.appendChild(title)
      box.appendChild(canvasBox)
      tocMenu.appendChild(box)
    } else {
      var panel = document.createElement('details')
      panel.className = 'local-graph'
      panel.open = true
      var summary = document.createElement('summary')
      summary.textContent = 'Graph'
      panel.appendChild(summary)
      panel.appendChild(canvasBox)
      article.appendChild(panel)
    }

    var view = BirbGraph.create(canvasBox, { nodes: nodes, links: links }, {
      onNavigate: function (node) {
        if (node.id !== currentId) location.href = BirbGraph.hrefFor(node, siteRootHref)
      },
      width: canvasBox.clientWidth,
      height: canvasBox.clientHeight,
      currentId: currentId,
      relSize: 2,
      alwaysLabels: true,
      maxLabelLength: 16,
      maxZoom: 2.5,
      cooldownTime: 3000,
      fitOnStop: true,
      fitPadding: 20,
    })

    window.addEventListener('resize', function () {
      view.graph.width(canvasBox.clientWidth)
    })
  }).catch(function () { /* graph is a progressive enhancement; stay quiet */ })
})()
