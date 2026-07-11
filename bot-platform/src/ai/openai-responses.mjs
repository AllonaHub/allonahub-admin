export function createOpenAIResponder({ enabled, openaiApiKey, openaiModel }) {
  if (!enabled || !openaiApiKey || !openaiModel) {
    return null;
  }

  return {
    async generate({ systemPrompt, userMessage, knowledgeContext }) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: openaiModel,
          input: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Kullanici mesaji:\n${userMessage}\n\nOnayli bilgi baglami:\n${knowledgeContext}`
            }
          ]
        })
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`OpenAI Responses API failed: ${response.status} ${detail}`);
      }

      const payload = await response.json();
      return payload.output_text ?? '';
    }
  };
}
