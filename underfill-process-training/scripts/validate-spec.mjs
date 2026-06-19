import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const root = resolve(import.meta.dirname, '..');
const [spec, schema] = await Promise.all([
  readFile(resolve(root, 'src/data/process-spec.v1.json'), 'utf8').then(JSON.parse),
  readFile(resolve(root, 'src/data/process-spec.schema.json'), 'utf8').then(JSON.parse)
]);
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat('date', /^\d{4}-\d{2}-\d{2}$/);
const validate = ajv.compile(schema);
if (!validate(spec)) {
  console.error(validate.errors);
  process.exit(1);
}
const controlledRules = [];
function inspect(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  if (value.status === 'controlled') {
    controlledRules.push(path);
    if (!value.id && path !== '$.metadata') throw new Error(`Controlled rule without id: ${path}`);
    if (value.id && (!value.source || !value.reference)) throw new Error(`Controlled rule without source/reference: ${path}`);
  }
  Object.entries(value).forEach(([key, child]) => inspect(child, `${path}.${key}`));
}
inspect(spec);
for (const sourceId of spec.metadata.authorityOrder) {
  if (!spec.sources[sourceId]) throw new Error(`Authority source does not exist: ${sourceId}`);
}
console.log(`Specification ${spec.metadata.specVersion} valid; ${controlledRules.length} controlled nodes checked.`);
