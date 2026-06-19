import Ajv2020 from 'ajv/dist/2020.js';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataRoot = resolve(root, 'src', 'data');
const definitions = [
  ['training-content.v1.json','training-content.schema.json'],
  ['simulation-modules.v1.json','simulation-modules.schema.json'],
  ['media-manifest.v1.json','media-manifest.schema.json']
];
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const ajv = new Ajv2020({ allErrors:true, strict:true });
const loaded = {};

for (const [dataName,schemaName] of definitions) {
  const data = await readJson(resolve(dataRoot,dataName));
  const schema = await readJson(resolve(dataRoot,schemaName));
  if (!ajv.validate(schema,data)) throw new Error(`${dataName}: ${ajv.errorsText(ajv.errors,{separator:'\n'})}`);
  loaded[dataName] = data;
}

const spec = await readJson(resolve(dataRoot,'process-spec.v1.json'));
const ruleIds = new Set();
function collectIds(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.id === 'string') ruleIds.add(value.id);
  Object.values(value).forEach(collectIds);
}
collectIds(spec);

const training = loaded['training-content.v1.json'];
const simulation = loaded['simulation-modules.v1.json'];
const media = loaded['media-manifest.v1.json'];
const moduleIds = new Set(simulation.modules.map((module) => module.id));
const mediaIds = new Set(media.items.map((item) => item.id));
if (moduleIds.size !== simulation.modules.length) throw new Error('Simulation module IDs must be unique.');
if (mediaIds.size !== media.items.length) throw new Error('Media IDs must be unique.');

for (const topic of training.topics) {
  if (!moduleIds.has(topic.moduleId)) throw new Error(`${topic.id} references unknown module ${topic.moduleId}.`);
  for (const id of topic.controlledRuleIds) if (!ruleIds.has(id)) throw new Error(`${topic.id} references unknown rule ${id}.`);
  for (const id of topic.mediaIds) if (!mediaIds.has(id)) throw new Error(`${topic.id} references unknown media ${id}.`);
  if (topic.quiz.answerIndex >= topic.quiz.options.length) throw new Error(`${topic.id} quiz answer is outside option range.`);
}
for (const module of simulation.modules) for (const id of module.ruleIds) if (!ruleIds.has(id)) throw new Error(`${module.id} references unknown rule ${id}.`);
for (const item of media.items.filter((candidate) => candidate.localPath)) await access(resolve(root,'public',item.localPath.replace(/^\.\//,'')));

function rejectEngineeringNumbers(value, path = []) {
  if (typeof value === 'number' && path.at(-1) !== 'answerIndex') throw new Error(`Numeric engineering value outside process specification at ${path.join('.')}`);
  if (!value || typeof value !== 'object') return;
  for (const [key,child] of Object.entries(value)) rejectEngineeringNumbers(child,[...path,key]);
}
rejectEngineeringNumbers(training);
rejectEngineeringNumbers(simulation);

console.log(`Experience data valid: ${training.topics.length} topics, ${simulation.modules.length} modules, ${media.items.length} media entries.`);
