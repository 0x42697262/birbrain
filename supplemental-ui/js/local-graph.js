/* Mounts a collapsible local-graph panel (current page + 1-hop neighbors, links and
 * backlinks) at the bottom of each article. Does nothing on pages without links. */
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

    var panel = document.createElement('details')
    panel.className = 'local-graph'
    panel.open = true
    var summary = document.createElement('summary')
    summary.textContent = 'Graph'
    var canvasBox = document.createElement('div')
    canvasBox.className = 'local-graph-canvas'
    panel.appendChild(summary)
    panel.appendChild(canvasBox)
    article.appendChild(panel)

    var view = BirbGraph.create(canvasBox, { nodes: nodes, links: links }, {
      onNavigate: function (node) {
        if (node.id !== currentId) location.href = BirbGraph.hrefFor(node, siteRootHref)
      },
      width: canvasBox.clientWidth,
      height: 280,
      currentId: currentId,
      labelZoom: 1,
    })
    view.graph.zoom(2.5)

    window.addEventListener('resize', function () {
      view.graph.width(canvasBox.clientWidth)
    })
  }).catch(function () { /* graph is a progressive enhancement; stay quiet */ })
})()
