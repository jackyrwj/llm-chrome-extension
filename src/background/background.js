chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchModelScope') {
    handleModelScopeSearch(request.modelId, request.endpoint)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // async response
  }

  if (request.action === 'translate') {
    handleTranslate(request.text, request.provider, request.apiKey, request.targetLang)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});

async function handleModelScopeSearch(modelId, endpoint) {
  const url = `${endpoint}?search=${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HF-Model-Assistant/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { error: 'Request timeout' };
    }
    return { error: err.message };
  }
}

async function handleTranslate(text, provider, apiKey, targetLang) {
  if (provider === 'deepl' && apiKey) {
    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang.toUpperCase()
        })
      });
      const data = await response.json();
      return { text: data.translations?.[0]?.text };
    } catch (err) {
      return { error: err.message };
    }
  }

  return { error: 'Translation provider not configured' };
}
