// theme toggle — uses colorScheme instead of data-theme
(function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  // set initial icon visibility
  function updateIcons(scheme) {
    var sun = toggle.querySelector('.theme-icon-sun');
    var moon = toggle.querySelector('.theme-icon-moon');
    if (sun) sun.style.display = scheme === 'dark' ? 'block' : 'none';
    if (moon) moon.style.display = scheme === 'light' ? 'block' : 'none';
  }

  // determine current scheme
  var current = document.documentElement.style.colorScheme ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  updateIcons(current);

  toggle.addEventListener('click', function () {
    var cur = document.documentElement.style.colorScheme || 'dark';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.style.colorScheme = next;
    localStorage.setItem('theme', next);
    updateIcons(next);
  });
})();

// sidebar: hide/show toggle (desktop)
(function () {
  var sidebar = document.getElementById('sidebar');
  var hideBtn = document.getElementById('hide-sidebar');
  var showBtn = document.getElementById('sidebar-toggle');
  var overlay = document.getElementById('sidebar-overlay');

  if (!sidebar) return;

  // restore collapsed state on desktop
  if (window.innerWidth > 768 && localStorage.getItem('sidebar-closed') === 'true') {
    sidebar.classList.add('closed');
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', function () {
      sidebar.classList.add('closed');
      localStorage.setItem('sidebar-closed', 'true');
    });
  }

  if (showBtn) {
    showBtn.addEventListener('click', function () {
      if (window.innerWidth > 768) {
        // desktop: uncollapse
        sidebar.classList.remove('closed');
        localStorage.setItem('sidebar-closed', 'false');
      } else {
        // mobile: open drawer
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('visible');
      }
    });
  }
})();

// sidebar: mobile drawer close
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

    // save folder state
    saveFolderState();
  });
})();

// sidebar: search focus button
(function () {
  var btn = document.getElementById('focus-search');
  var input = document.getElementById('sidebar-search-input');
  if (!btn || !input) return;

  btn.addEventListener('click', function () {
    input.focus();
    input.scrollIntoView({ block: 'nearest' });
  });
})();

// sidebar: scroll position persistence
(function () {
  var tree = document.getElementById('file-tree');
  if (!tree) return;

  // restore saved scroll position
  var saved = sessionStorage.getItem('sidebar-scroll');
  if (saved !== null) {
    tree.scrollTop = parseInt(saved, 10);
  } else {
    // scroll active item into view on first visit
    var active = tree.querySelector('.tree-item.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }

  // save scroll position on link clicks (before navigation)
  tree.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      sessionStorage.setItem('sidebar-scroll', tree.scrollTop);
    });
  });
})();

// sidebar: folder expand/collapse state persistence
function saveFolderState() {
  var state = {};
  document.querySelectorAll('.tree-folder').forEach(function (folder) {
    var summary = folder.querySelector('summary');
    if (summary) {
      var text = summary.textContent.trim();
      state[text] = folder.hasAttribute('open');
    }
  });
  localStorage.setItem('folder-state', JSON.stringify(state));
}

(function () {
  var saved = localStorage.getItem('folder-state');
  if (!saved) return;

  try {
    var state = JSON.parse(saved);
    document.querySelectorAll('.tree-folder').forEach(function (folder) {
      var summary = folder.querySelector('summary');
      if (summary) {
        var text = summary.textContent.trim();
        if (state.hasOwnProperty(text)) {
          if (state[text]) {
            folder.setAttribute('open', '');
          } else {
            folder.removeAttribute('open');
          }
        }
      }
    });
  } catch (e) {
    // ignore parse errors
  }

  // auto-open folder containing active page
  var active = document.querySelector('.tree-item.active');
  if (active) {
    var parent = active.closest('.tree-folder');
    if (parent) parent.setAttribute('open', '');
  }

  // listen for toggle events to save state
  document.querySelectorAll('.tree-folder').forEach(function (folder) {
    folder.addEventListener('toggle', saveFolderState);
  });
})();
