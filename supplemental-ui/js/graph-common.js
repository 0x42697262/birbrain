/* Shared setup for the birbrain graph views (global page + per-page local graph).
 * Depends on the vendored force-graph library (window.ForceGraph). */
;(function () {
  'use strict'

  var PALETTE = {
    知識: '#2a78d6',
    'malware-development': '#1baf7a',
    writeups: '#eda100',
    archives: '#008300',
  }
  var FALLBACK_COLOR = '#898781'
  var LINK_COLOR = 'rgba(60, 60, 60, 0.25)'
  var LINK_DIM_COLOR = 'rgba(60, 60, 60, 0.06)'
  var LABEL_COLOR = '#3b3b3b'
  var NODE_REL_SIZE = 3

  function colorOf (node) {
    return PALETTE[node.component] || FALLBACK_COLOR
  }

  function darken (hex) {
    var n = parseInt(hex.slice(1), 16)
    var r = Math.max(0, (n >> 16) - 48)
    var g = Math.max(0, ((n >> 8) & 0xff) - 48)
    var b = Math.max(0, (n & 0xff) - 48)
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  }

  function withAlpha (hex, alpha) {
    var n = parseInt(hex.slice(1), 16)
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 0xff) + ',' + (n & 0xff) + ',' + alpha + ')'
  }

  function escapeHtml (str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // Fetches graph.json and annotates nodes with degree + neighbor sets.
  function load (siteRootHref) {
    return fetch(new URL('graph.json', siteRootHref)).then(function (res) {
      if (!res.ok) throw new Error('graph.json: HTTP ' + res.status)
      return res.json()
    }).then(function (data) {
      var byId = new Map()
      data.nodes.forEach(function (node) {
        node.degree = 0
        node.neighbors = new Set()
        byId.set(node.id, node)
      })
      data.links.forEach(function (link) {
        var source = byId.get(link.source)
        var target = byId.get(link.target)
        source.neighbors.add(target)
        target.neighbors.add(source)
        source.degree++
        target.degree++
      })
      data.byId = byId
      return data
    })
  }

  function hrefFor (node, siteRootHref) {
    return new URL(node.id.replace(/^\//, ''), siteRootHref).href
  }

  /* Creates a configured ForceGraph in el.
   * opts: onNavigate(node), width, height, currentId (local graph), labelZoom
   * Returns { graph, setDim(fn) } where fn(node) -> true dims the node (search filter). */
  function create (el, data, opts) {
    opts = opts || {}
    var hoverNode = null
    var dimFn = null
    var labelZoom = opts.labelZoom || 2

    function isDimmed (node) {
      if (dimFn && dimFn(node)) return true
      return hoverNode && node !== hoverNode && !hoverNode.neighbors.has(node)
    }

    var graph = new ForceGraph(el)
      .graphData(data)
      .nodeId('id')
      .nodeRelSize(NODE_REL_SIZE)
      .nodeVal(function (node) { return 1 + node.degree })
      .nodeLabel(function (node) { return escapeHtml(node.title) })
      .nodeCanvasObjectMode(function () { return 'replace' })
      .nodeCanvasObject(function (node, ctx, globalScale) {
        var dim = isDimmed(node)
        var color = colorOf(node)
        var r = Math.sqrt(1 + node.degree) * NODE_REL_SIZE
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = dim ? withAlpha(color, 0.15) : color
        ctx.fill()
        ctx.lineWidth = Math.min(1, 2 / globalScale)
        ctx.strokeStyle = dim ? 'rgba(0,0,0,0.06)' : darken(color)
        ctx.stroke()
        if (node.id === opts.currentId) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI)
          ctx.lineWidth = 2 / globalScale
          ctx.strokeStyle = darken(color)
          ctx.stroke()
        }
        var hovered = hoverNode && (node === hoverNode || hoverNode.neighbors.has(node))
        if (!dim && (hovered || globalScale >= labelZoom)) {
          var fontSize = Math.max(11 / globalScale, 2)
          ctx.font = fontSize + 'px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = hovered ? LABEL_COLOR : 'rgba(59,59,59,0.7)'
          ctx.fillText(node.title, node.x, node.y + r + 2 / globalScale)
        }
      })
      .linkColor(function (link) {
        if (hoverNode && (link.source === hoverNode || link.target === hoverNode)) return 'rgba(60,60,60,0.6)'
        if (isDimmed(link.source) || isDimmed(link.target)) return LINK_DIM_COLOR
        return LINK_COLOR
      })
      .linkWidth(function (link) {
        return hoverNode && (link.source === hoverNode || link.target === hoverNode) ? 1.5 : 1
      })
      .onNodeHover(function (node) {
        hoverNode = node || null
        el.style.cursor = node ? 'pointer' : ''
      })

    if (opts.onNavigate) graph.onNodeClick(opts.onNavigate)
    if (opts.width) graph.width(opts.width)
    if (opts.height) graph.height(opts.height)

    return {
      graph: graph,
      setDim: function (fn) { dimFn = fn },
    }
  }

  window.BirbGraph = {
    PALETTE: PALETTE,
    colorOf: colorOf,
    load: load,
    create: create,
    hrefFor: hrefFor,
  }
})()
