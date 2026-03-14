// theme toggle
(function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();

// sidebar: hide/show toggle (desktop)
(function () {
  var layout = document.getElementById('layout');
  var hideBtn = document.getElementById('hide-sidebar');
  var showBtn = document.getElementById('sidebar-toggle');

  if (!layout) return;

  // restore collapsed state
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    layout.classList.add('sidebar-collapsed');
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', function () {
      layout.classList.add('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', 'true');
    });
  }

  if (showBtn) {
    showBtn.addEventListener('click', function () {
      // on desktop: uncollapse. on mobile: open drawer.
      if (window.innerWidth > 768) {
        layout.classList.remove('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', 'false');
      } else {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('visible');
      }
    });
  }
})();

// sidebar: mobile drawer
(function () {
  var sidebar = document.getElementById('sidebar');
  var closeBtn = document.getElementById('sidebar-close');
  var overlay = document.getElementById('sidebar-overlay');

  function closeMobile() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  if (closeBtn) closeBtn.addEventListener('click', closeMobile);
  if (overlay) overlay.addEventListener('click', closeMobile);
})();

// sidebar: collapse/expand all folders
(function () {
  var btn = document.getElementById('toggle-folders');
  if (!btn) return;

  var expanded = true;

  btn.addEventListener('click', function () {
    var folders = document.querySelectorAll('.tree-folder');
    expanded = !expanded;
    folders.forEach(function (f) {
      if (expanded) {
        f.setAttribute('open', '');
      } else {
        f.removeAttribute('open');
      }
    });

    // swap icon
    var icon = btn.querySelector('use');
    if (icon) {
      icon.setAttribute('href', expanded ? '#icon-collapse' : '#icon-expand');
    }
  });
})();
