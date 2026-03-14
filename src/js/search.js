// inline sidebar fuzzy search
(function () {
  var input = document.getElementById('sidebar-search-input');
  if (!input) return;

  var items = document.querySelectorAll('.tree-item.child[data-title]');

  // simple fuzzy match: all characters of query appear in order in target
  function fuzzyMatch(query, target) {
    if (!query) return true;
    query = query.toLowerCase();
    target = target.toLowerCase();

    // first check simple includes
    if (target.indexOf(query) !== -1) return true;

    // fuzzy: chars in order
    var qi = 0;
    for (var ti = 0; ti < target.length && qi < query.length; ti++) {
      if (target[ti] === query[qi]) qi++;
    }
    return qi === query.length;
  }

  input.addEventListener('input', function () {
    var query = input.value.trim();

    items.forEach(function (item) {
      var title = item.getAttribute('data-title') || '';
      if (fuzzyMatch(query, title)) {
        item.classList.remove('filtered-out');
      } else {
        item.classList.add('filtered-out');
      }
    });

    // auto-expand folders that have visible children
    var folders = document.querySelectorAll('.tree-folder');
    folders.forEach(function (folder) {
      if (query) {
        var visibleChildren = folder.querySelectorAll('.tree-item.child:not(.filtered-out)');
        if (visibleChildren.length > 0) {
          folder.setAttribute('open', '');
        } else {
          folder.removeAttribute('open');
        }
      }
    });
  });

  // keyboard shortcut: ctrl/cmd+k focuses search
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.blur();
    }
  });
})();
