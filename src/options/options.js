document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.options-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.options-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.options-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tabName}`).classList.add('active');
    });
  });

  const settings = await Storage.getAll();
  document.getElementById('default-tool').value = settings.defaultTool;
  document.getElementById('preferred-mirror').value = settings.preferredMirror;
  document.getElementById('vram-gb').value = settings.vramGB;
  document.getElementById('sidebar-open').checked = settings.sidebarDefaultOpen;
  document.getElementById('language').value = settings.language;
  document.getElementById('translation-provider').value = settings.translationProvider;
  document.getElementById('translation-api-key').value = settings.translationApiKey;

  document.getElementById('save-btn').addEventListener('click', async () => {
    const newSettings = {
      defaultTool: document.getElementById('default-tool').value,
      preferredMirror: document.getElementById('preferred-mirror').value,
      vramGB: parseInt(document.getElementById('vram-gb').value) || 8,
      sidebarDefaultOpen: document.getElementById('sidebar-open').checked,
      language: document.getElementById('language').value,
      translationProvider: document.getElementById('translation-provider').value,
      translationApiKey: document.getElementById('translation-api-key').value
    };

    await Storage.setMultiple(newSettings);

    const status = document.getElementById('save-status');
    status.textContent = '已保存';
    setTimeout(() => status.textContent = '', 2000);
  });
});
