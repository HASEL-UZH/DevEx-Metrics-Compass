// Dashboard interactions: two charts, "show all" on ranked lists, and copy buttons.
// Everything degrades to a readable page if Chart.js fails to load from the CDN.

(function () {
    'use strict';

    var BLUE = '#1B1AFF';
    var PALE = '#c9c9ff';
    var UP   = '#1f9d55';
    var DOWN = '#d64545';

    function parseData(el, attr) {
        try { return JSON.parse(el.dataset[attr] || '[]'); }
        catch (e) { return []; }
    }

    // ── Sessions over time ────────────────────────────────────────────────
    var sessionsEl = document.getElementById('chart-sessions');
    if (sessionsEl && window.Chart) {
        var labels = parseData(sessionsEl, 'labels');
        var values = parseData(sessionsEl, 'values');
        if (labels.length) {
            new Chart(sessionsEl, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{ label: 'Sessions', data: values, backgroundColor: BLUE, borderRadius: 2 }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { maxTicksLimit: 14 } },
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        } else {
            sessionsEl.replaceWith(Object.assign(document.createElement('p'), {
                className: 'empty', textContent: 'No sessions in this period.'
            }));
        }
    }

    // ── Feedback over time ────────────────────────────────────────────────
    var fbEl = document.getElementById('chart-feedback');
    if (fbEl && window.Chart) {
        var fbLabels = parseData(fbEl, 'labels');
        if (fbLabels.length) {
            new Chart(fbEl, {
                type: 'bar',
                data: {
                    labels: fbLabels,
                    datasets: [
                        { label: 'Up',   data: parseData(fbEl, 'up'),   backgroundColor: UP },
                        { label: 'Down', data: parseData(fbEl, 'down'), backgroundColor: DOWN }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        }
    }

    // ── Ranked list expansion ─────────────────────────────────────────────
    document.querySelectorAll('.showall').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var list = btn.previousElementSibling;
            if (!list) return;
            var extras = list.querySelectorAll('.extra');
            var expanded = btn.dataset.expanded === '1';
            extras.forEach(function (li) { li.hidden = expanded; });
            btn.dataset.expanded = expanded ? '0' : '1';
            btn.textContent = expanded ? 'Show all ' + list.children.length : 'Show fewer';
        });
    });

    // ── Copy buttons ──────────────────────────────────────────────────────
    function copyFrom(el, button) {
        var text = el.value !== undefined ? el.value : el.textContent;
        var done = function () {
            var original = button.textContent;
            button.textContent = 'Copied';
            setTimeout(function () { button.textContent = original; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, function () { fallback(el, done); });
        } else {
            fallback(el, done);
        }
    }

    function fallback(el, done) {
        if (el.select) { el.select(); document.execCommand('copy'); done(); }
    }

    // ── Confirm before anything that changes what the numbers include ─────
    document.addEventListener('submit', function (ev) {
        var button = ev.target.querySelector('[data-confirm]');
        if (button && !window.confirm(button.dataset.confirm)) {
            ev.preventDefault();
        }
    });

    document.querySelectorAll('.copy-md, .copy-text').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var target = document.getElementById(btn.dataset.target);
            if (target) copyFrom(target, btn);
        });
    });
}());
