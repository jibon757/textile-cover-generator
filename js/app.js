fetch('/api/health')
  .then(r => r.json())
  .then(d => {
    document.getElementById('status').textContent =
      d.ok ? 'সার্ভার (Worker) কাজ করছে ✔' : 'সার্ভারে সমস্যা ✘';
  })
  .catch(() => {
    document.getElementById('status').textContent = 'সার্ভারে সমস্যা ✘';
  });
