
    const frame = document.getElementById('frame');

    function toggleTheme() {
      document.body.classList.toggle('light-mode');
    }

    function loadPage(url) {
      frame.classList.remove('active');
      setTimeout(() => {
        frame.src = url;
        frame.onload = () => frame.classList.add('active');
      }, 300);
    }
  