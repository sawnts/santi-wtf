// search modal with pagefind
(function () {
  var modal = document.getElementById('search-modal');
  var backdrop = document.getElementById('search-backdrop');
  var closeBtn = document.getElementById('search-close');
  var trigger = document.getElementById('search-trigger');
  var loaded = false;

  function openSearch() {
    if (!modal) return;
    modal.hidden = false;

    if (!loaded) {
      loaded = true;
      // load pagefind UI dynamically
      var script = document.createElement('script');
      script.src = '/pagefind/pagefind-ui.js';
      script.onload = function () {
        new PagefindUI({
          element: '#search-ui',
          showSubResults: false,
          showImages: false,
        });
        // focus the search input
        var input = document.querySelector('.pagefind-ui__search-input');
        if (input) input.focus();
      };
      document.head.appendChild(script);

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/pagefind/pagefind-ui.css';
      document.head.appendChild(link);
    } else {
      var input = document.querySelector('.pagefind-ui__search-input');
      if (input) input.focus();
    }
  }

  function closeSearch() {
    if (modal) modal.hidden = true;
  }

  // keyboard shortcut: / to open, esc to close
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !e.target.matches('input, textarea')) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && modal && !modal.hidden) {
      closeSearch();
    }
  });

  var triggerFooter = document.getElementById('search-trigger-footer');

  if (trigger) trigger.addEventListener('click', openSearch);
  if (triggerFooter) triggerFooter.addEventListener('click', openSearch);
  if (backdrop) backdrop.addEventListener('click', closeSearch);
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
})();
