#!/usr/bin/env node
/*
  Finds models in server/models that are not referenced elsewhere in server/ (simple heuristic)
*/
import fs from 'fs';
import path from 'path';

const modelsDir = path.resolve(process.cwd(), 'server', 'models');
if (!fs.existsSync(modelsDir)) {
  console.error('models dir not found:', modelsDir);
  process.exit(1);
}

const models = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
const repoDir = path.resolve(process.cwd());

import { spawnSync } from 'child_process';

function grepFiles(keyword) {
  const res = spawnSync('grep', ['-RIn', '--exclude-dir=node_modules', '--', keyword, repoDir]);
  if (res.status !== 0 && res.status !== 1) return null;
  return String(res.stdout || '').split('\n').filter(Boolean);
}

console.log('Found models:', models.join(', '));
for (const m of models) {
  const base = path.basename(m, '.js');
  // search for import/require of model filename or model name
  const hits = grepFiles(base);
  const imports = hits ? hits.filter(l => !l.includes(path.join('server','models', m))) : [];
  if (!imports || imports.length === 0) {
    console.log(`UNUSED: ${m}`);
  } else {
    console.log(`USED: ${m} -> ${imports.length} references`);
  }
}
