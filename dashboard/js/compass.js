(function () {
    var SVG_INNER =
        '<circle cx="28" cy="28" r="26" fill="#e8eafd" stroke="#1B1AFF" stroke-width="2"/>' +
        '<line x1="28" y1="4" x2="28" y2="10" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="28" y1="46" x2="28" y2="52" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="4" y1="28" x2="10" y2="28" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>' +
        '<line x1="46" y1="28" x2="52" y2="28" stroke="#1B1AFF" stroke-width="2" stroke-linecap="round"/>' +
        '<g class="compass-needle">' +
            '<polygon points="28,10 32,28 28,32 24,28" fill="#1B1AFF"/>' +
            '<polygon points="28,46 32,28 28,24 24,28" fill="#1B1AFF" opacity="0.25"/>' +
            '<circle cx="28" cy="28" r="3.5" fill="#1B1AFF"/>' +
        '</g>';

    document.querySelectorAll('[data-compass-size]').forEach(function (el) {
        var size = el.getAttribute('data-compass-size');
        var style = el.getAttribute('data-compass-style');
        var styleAttr = style ? ' style="' + style + '"' : '';
        el.outerHTML =
            '<svg width="' + size + '" height="' + size + '" viewBox="0 0 56 56" fill="none"' +
            ' xmlns="http://www.w3.org/2000/svg"' + styleAttr + '>' +
            SVG_INNER +
            '</svg>';
    });
}());
