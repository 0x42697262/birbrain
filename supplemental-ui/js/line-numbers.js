// Line numbers for highlight.js code blocks.
// Asciidoctor's `linenums` is a no-op with highlight.js, so we post-process:
// wrap each line in <span class="line"> and let CSS counters draw the numbers.
// Numbers live in ::before, so the copy button (which copies code.innerText)
// never picks them up. Must run after vendor/highlight.js (both are `defer`).
;(function () {
  'use strict'

  function splitLines (html) {
    // hljs output contains only <span ...> / </span> tags; a span (multi-line
    // comment/string) may cross newlines, so close and reopen it per line.
    var lines = []
    var open = [] // stack of opening tags currently in effect
    html.split('\n').forEach(function (raw) {
      var prefix = open.join('')
      var re = /<span[^>]*>|<\/span>/g
      var m
      while ((m = re.exec(raw))) {
        if (m[0] === '</span>') open.pop()
        else open.push(m[0])
      }
      lines.push(prefix + raw + new Array(open.length + 1).join('</span>'))
    })
    return lines
  }

  function number (code) {
    if (code.classList.contains('has-line-numbers')) return
    // Skip blocks hljs couldn't colour (language not in the bundled build,
    // e.g. powershell/toml/fish): no hljs-* token spans were produced.
    if (!code.querySelector('[class^="hljs-"]')) return
    var lines = splitLines(code.innerHTML)
    if (lines.length && lines[lines.length - 1] === '') lines.pop() // trailing newline
    if (lines.length < 2) return
    code.innerHTML = lines
      .map(function (l) { return '<span class="line">' + l + '</span>' })
      .join('\n')
    code.classList.add('has-line-numbers')
    code.style.setProperty('--ln-digits', String(lines.length).length)
  }

  function run () {
    var blocks = document.querySelectorAll('.doc pre.highlightjs > code[data-lang]')
    Array.prototype.forEach.call(blocks, number)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run)
  else run()
})()
