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
  var LABEL_COLOR = '59,59,59'
  var LINK_RGB = '60,60,60'
  // Per-frame lerp factor: ~0.18 at 60fps ≈ a 180ms ease-out, matching iOS-style fades.
  var EASE = 0.18

  function colorOf (node) {
    return PALETTE[node.component] || FALLBACK_COLOR
  }

  function rgbOf (hex) {
    var n = parseInt(hex.slice(1), 16)
    return [n >> 16, (n >> 8) & 0xff, n & 0xff]
  }

  function darken (hex) {
    var c = rgbOf(hex)
    return [Math.max(0, c[0] - 48), Math.max(0, c[1] - 48), Math.max(0, c[2] - 48)]
  }

  function rgba (rgb, alpha) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')'
  }

  function ease (current, target) {
    var next = current + (target - current) * EASE
    return Math.abs(next - target) < 0.005 ? target : next
  }

  function escapeHtml (str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function truncate (str, max) {
    return str.length > max ? str.slice(0, max - 1).trimEnd() + '…' : str
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
   * opts: onNavigate(node), width, height, currentId, relSize, labelZoom,
   *       alwaysLabels, maxLabelLength, maxZoom, fitOnStop, fitPadding
   * Returns { graph, setDim(fn) } where fn(node) -> true dims the node (search filter). */
  function create (el, data, opts) {
    opts = opts || {}
    var relSize = opts.relSize || 3
    var labelZoom = opts.labelZoom || 2
    var maxLabelLength = opts.maxLabelLength || 28
    var hoverNode = null
    var dimFn = null
    var fitted = false

    function highlightTarget (node) {
      if (dimFn && dimFn(node)) return 0
      if (hoverNode && node !== hoverNode && !hoverNode.neighbors.has(node)) return 0
      return 1
    }

    var graph = new ForceGraph(el)
      .graphData(data)
      .nodeId('id')
      .nodeRelSize(relSize)
      .nodeVal(function (node) { return 1 + node.degree })
      .nodeLabel(function (node) { return escapeHtml(node.title) })
      // Repaint every frame so the eased highlight/label alphas animate smoothly.
      .autoPauseRedraw(false)
      .nodeCanvasObjectMode(function () { return 'replace' })
      .nodeCanvasObject(function (node, ctx, globalScale) {
        node.__hl = ease(node.__hl === undefined ? 1 : node.__hl, highlightTarget(node))
        var hl = node.__hl
        var color = colorOf(node)
        var r = Math.sqrt(1 + node.degree) * relSize
        var alpha = 0.15 + 0.85 * hl
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        ctx.fillStyle = rgba(rgbOf(color), alpha)
        ctx.fill()
        ctx.lineWidth = Math.min(1, 2 / globalScale)
        ctx.strokeStyle = rgba(darken(color), Math.max(0.06, 0.9 * hl))
        ctx.stroke()
        if (node.id === opts.currentId) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 2.5 / globalScale, 0, 2 * Math.PI)
          ctx.lineWidth = 1.5 / globalScale
          ctx.strokeStyle = rgba(darken(color), 0.9 * hl)
          ctx.stroke()
        }
        var nearHover = hoverNode && (node === hoverNode || hoverNode.neighbors.has(node))
        var wantsLabel = hl > 0.5 && (opts.alwaysLabels || nearHover || globalScale >= labelZoom)
        node.__la = ease(node.__la === undefined ? (opts.alwaysLabels ? 1 : 0) : node.__la, wantsLabel ? 1 : 0)
        if (node.__la > 0.02) {
          var fontSize = Math.max(11 / globalScale, 2)
          ctx.font = fontSize + 'px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = rgba([59, 59, 59], (nearHover ? 0.95 : 0.7) * node.__la)
          ctx.fillText(truncate(node.title, maxLabelLength), node.x, node.y + r + 2 / globalScale)
        }
      })
      .linkColor(function (link) {
        var incident = hoverNode && (link.source === hoverNode || link.target === hoverNode)
        link.__hl = ease(link.__hl === undefined ? 0 : link.__hl, incident ? 1 : 0)
        var endHl = Math.min(
          link.source.__hl === undefined ? 1 : link.source.__hl,
          link.target.__hl === undefined ? 1 : link.target.__hl)
        return rgba([60, 60, 60], 0.06 + 0.19 * endHl + 0.35 * link.__hl)
      })
      .linkWidth(function (link) { return 1 + 0.6 * (link.__hl || 0) })
      .onNodeHover(function (node) {
        hoverNode = node || null
        el.style.cursor = node ? 'pointer' : ''
      })

    if (opts.onNavigate) graph.onNodeClick(opts.onNavigate)
    if (opts.width) graph.width(opts.width)
    if (opts.height) graph.height(opts.height)
    if (opts.maxZoom) graph.maxZoom(opts.maxZoom)
    if (opts.cooldownTime) graph.cooldownTime(opts.cooldownTime)
    if (opts.fitOnStop) {
      graph.onEngineStop(function () {
        if (fitted) return
        fitted = true
        graph.zoomToFit(500, opts.fitPadding || 24)
      })
    }

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
