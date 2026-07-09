/* Bootstraps the full-screen global graph page (graph.html at the site root). */
;(function () {
  'use strict'

  var siteRootHref = new URL('.', location.href)
  var container = document.getElementById('graph')
  var status = document.getElementById('graph-status')
  var legendEl = document.getElementById('graph-legend')
  var searchEl = document.getElementById('graph-search')

  BirbGraph.load(siteRootHref).then(function (data) {
    status.remove()
    var hiddenComponents = new Set()

    var view = BirbGraph.create(container, data, {
      onNavigate: function (node) { location.href = BirbGraph.hrefFor(node, siteRootHref) },
      width: window.innerWidth,
      height: window.innerHeight,
    })

    window.addEventListener('resize', function () {
      view.graph.width(window.innerWidth).height(window.innerHeight)
    })

    function applyComponentFilter () {
      var nodes = data.nodes.filter(function (n) { return !hiddenComponents.has(n.component) })
      var visible = new Set(nodes)
      var links = data.links.filter(function (l) {
        var s = typeof l.source === 'object' ? l.source : data.byId.get(l.source)
        var t = typeof l.target === 'object' ? l.target : data.byId.get(l.target)
        return visible.has(s) && visible.has(t)
      })
      view.graph.graphData({ nodes: nodes, links: links })
    }

    var components = Array.from(new Set(data.nodes.map(function (n) { return n.component })))
    components.forEach(function (component) {
      var btn = document.createElement('button')
      btn.type = 'button'
      var swatch = document.createElement('span')
      swatch.className = 'swatch'
      swatch.style.background = BirbGraph.colorOf({ component: component })
      btn.appendChild(swatch)
      btn.appendChild(document.createTextNode(component))
      btn.addEventListener('click', function () {
        if (hiddenComponents.has(component)) hiddenComponents.delete(component)
        else hiddenComponents.add(component)
        btn.classList.toggle('off', hiddenComponents.has(component))
        applyComponentFilter()
      })
      legendEl.appendChild(btn)
    })

    searchEl.addEventListener('input', function () {
      var query = searchEl.value.trim().toLowerCase()
      view.setDim(query
        ? function (node) { return node.title.toLowerCase().indexOf(query) === -1 }
        : null)
    })
    searchEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return
      var query = searchEl.value.trim().toLowerCase()
      if (!query) return
      var matches = data.nodes.filter(function (node) {
        return node.title.toLowerCase().indexOf(query) !== -1
      })
      if (matches.length === 1) location.href = BirbGraph.hrefFor(matches[0], siteRootHref)
    })
  }).catch(function (err) {
    status.textContent = 'Failed to load graph: ' + err.message
  })
})()
