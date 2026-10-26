const { test } = require('node:test');
const assert = require('node:assert/strict');
const network = require('../public/js/network-model');
const profiles = [
  { id: 'a', firstName: 'Alex', city: ' Brisbane ', university: 'QUT', subjects: ['Python', 'python', ' Maths '], studyStyle: 'Collaborative' },
  { id: 'b', firstName: 'Maya', city: 'brisbane', university: 'UQ', subjects: ['PYTHON'], studyStyle: 'Collaborative' },
  { id: 'c', firstName: 'Sam', university: 'QUT', subjects: ['Biology'] },
];
test('city and university grouping normalize labels, preserve students and tolerate missing cities', () => {
  const byCity = network.clusters(profiles, 'city');
  assert.equal(byCity.length, 2);
  assert.equal(byCity[0].profiles.length, 2);
  assert.equal(byCity[1].label, 'City not shared');
  const byUni = network.clusters(profiles, 'university');
  assert.equal(byUni[0].label, 'QUT');
  assert.deepEqual(byUni[0].profiles.map(p => p.id), ['a', 'c']);
  assert.equal(byUni.reduce((sum, g) => sum + g.profiles.length, 0), profiles.length);
  assert.deepEqual(network.clusters([], 'city'), []);
});
test('common-interest callouts count distinct students, not repeated subjects, and never invent similarities', () => {
  const signals = network.sharedSignals(profiles);
  assert.equal(signals.find(s => s.type === 'subject').count, 2);
  assert.equal(signals.find(s => s.type === 'style').count, 2);
  assert.equal(signals.some(s => s.label === 'Biology'), false);
  assert.deepEqual(network.commonSubjects(profiles[0], profiles[1]), ['python']);
  assert.deepEqual(network.sharedSignals([profiles[0]]), []);
});
