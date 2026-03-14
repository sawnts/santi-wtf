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

// mobile sidebar toggle
(function () {
  var sidebar = document.getElementById('sidebar');
  var openBtn = document.getElementById('sidebar-toggle');
  var closeBtn = document.getElementById('sidebar-close');

  if (!sidebar || !openBtn) return;

  openBtn.addEventListener('click', function () {
    sidebar.classList.add('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      sidebar.classList.remove('open');
    });
  }

  // close sidebar on outside click (mobile)
  document.addEventListener('click', function (e) {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        e.target !== openBtn) {
      sidebar.classList.remove('open');
    }
  });
})();
