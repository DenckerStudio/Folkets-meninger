#!/usr/bin/env node
/** Re-enable tool-calling on Generate prompts – structured parser blocks Ollama tools. */
const ops = {
  workflowId: 'MloIdsnX7FozM4dv',
  operations: [
    { type: 'removeConnection', source: 'Prompts JSON parser', target: 'Generate prompts (Ollama)', connectionType: 'ai_outputParser' },
    { type: 'removeConnection', source: 'Ollama Chat Model', target: 'Prompts JSON parser', connectionType: 'ai_languageModel' },
    { type: 'removeNode', nodeName: 'Prompts JSON parser' },
    {
      type: 'updateNodeParameters',
      nodeName: 'Generate prompts (Ollama)',
      parameters: { hasOutputParser: false },
    },
  ],
};

import fs from 'node:fs';
const out = process.argv[2] || '/tmp/n8n-revert-parser-ops.json';
fs.writeFileSync(out, JSON.stringify(ops, null, 2));
console.log('Wrote', out);
