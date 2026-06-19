import training from '../data/training-content.v1.json';
import simulations from '../data/simulation-modules.v1.json';
import media from '../data/media-manifest.v1.json';

export const TRAINING = Object.freeze(training);
export const SIMULATIONS = Object.freeze(simulations);
export const MEDIA = Object.freeze(media);

const localized = (value, language) => value?.[language] ?? value?.en ?? '';
export function textFor(value, language) { return localized(value, language); }
export function topicById(id) { return TRAINING.topics.find((topic) => topic.id === id); }
export function moduleById(id) { return SIMULATIONS.modules.find((module) => module.id === id); }
export function mediaById(id) { return MEDIA.items.find((item) => item.id === id); }
export function authorityLabel(authority, language) {
  const labels = {
    controlled: {'zh-Hant':'受控規則引用',en:'Controlled rule references'},
    'training-only': {'zh-Hant':'深度訓練',en:'Deep training'},
    experimental: {'zh-Hant':'實驗模型',en:'Experimental model'},
    disputed: {'zh-Hant':'待工程定版',en:'Pending engineering approval'}
  };
  return localized(labels[authority], language);
}

export function validateExperience() {
  const moduleIds = new Set(SIMULATIONS.modules.map((module) => module.id));
  const mediaIds = new Set(MEDIA.items.map((item) => item.id));
  const topicIds = new Set();
  for (const topic of TRAINING.topics) {
    if (topicIds.has(topic.id)) throw new Error(`Duplicate topic: ${topic.id}`);
    topicIds.add(topic.id);
    if (!moduleIds.has(topic.moduleId)) throw new Error(`Unknown module ${topic.moduleId} in ${topic.id}`);
    for (const id of topic.mediaIds) if (!mediaIds.has(id)) throw new Error(`Unknown media ${id} in ${topic.id}`);
    if (topic.quiz.answerIndex >= topic.quiz.options.length) throw new Error(`Quiz answer outside options: ${topic.id}`);
  }
  return { topics:topicIds.size, modules:moduleIds.size, media:mediaIds.size };
}
