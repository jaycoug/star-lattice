// Every test file; index.html runs them. Add new *.test.js files here.

import './shared/lattice.test.js';
import './shared/star.test.js';
import './shared/camera.test.js';
import './shared/engine.test.js';
import './shared/formats.test.js';
import './shared/arrangement.test.js';
import './shared/kiteDesign.test.js';
import './shared/blocks.test.js';
import './shared/color.test.js';
import './shared/kiteless.test.js';
import './shared/questions.test.js';
import './shared/independent.test.js';
import './shared/goals.test.js';
import './shared/importQuiz.test.js';
import './shared/qset.test.js';   // round 15
import './shared/sync.test.js';   // round 16
import './shared/shuffle.test.js';   // round 17
import './shared/plain.test.js';     // round 17
import './shared/decided.test.js';   // stage 3
import './shared/terms.test.js';     // stage 3
import './shared/layout.test.js';    // P4

export { run } from './runner.js';
