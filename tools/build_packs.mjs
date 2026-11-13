// Stage 4: builds the six showcase packs in packs/ with the app's own engine, so every board is
// valid by construction. Each pack is packs/<id>/pack.json (its content set), packs/<id>/board.json
// (a starter board, no progress beyond what it shows off) and packs/<id>/README.md; packs/index.json
// lists them (what a new browser starts with, and States ▾ › New from a blueprint…).
//
// Usage (from the project folder):  node tools/build_packs.mjs
// Due dates and hour blocks are set relative to the day it runs: run it again before publishing.
// All content here is original, written for these packs.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../shared/engine/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = JSON.parse(readFileSync(join(ROOT, 'tools', 'pack-base.json'), 'utf8'));
const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date(new Date().toDateString()).getTime();
const NOW = Date.now();
const date = days => new Date(TODAY + days * DAY).toISOString().slice(0, 10);
const PALETTES = {
  gladetrail: ['#8172e1', '#008ede', '#009aaf', '#2b9c79', '#7a965c', '#a48e64'],
  mothchalk: ['#c598e3', '#6ab7f4', '#48c7c6', '#93c88d', '#dbbc83', '#ffb2b2'],
  coastglow: ['#7e47ff', '#e800d4', '#ff009a', '#ff5362', '#ff962f', '#ffcd05'],
  fizzbolt: ['#ff4d9e', '#ff763b', '#ccb300', '#1edc2b', '#198cff', '#cc6ded'],
  cloudblush: ['#00ff99', '#00feff', '#59dfff', '#ff9fff', '#ff8c98', '#ffc60a'],
};

// ---- The packs ---------------------------------------------------------------------------------
// tree: per category, its central kite's star-dots (Nadir, Port, Starboard, then the Zenith), each
//   { name, desc, props, done, q (plain-text questions), marks, kids: [same], deploy }.
// list: per category, its items in order, each [name, plain-text question].

const ORGANIZER = {
  id: 'organizer-demo', title: 'Organizer demo', palette: 'gladetrail',
  about: 'A life organizer: six areas of a life, tasks with due dates, routines that come back, and bigger goals broken into steps.',
  categories: ['Work', 'Learning', 'Home', 'Health', 'People', 'Fun'],
  rules: {}, terms: { stardot: 'task' },
  marks: [{ id: 'people', symbol: '☺', name: 'Involves others' }],
  tree: [
    [{ name: 'Inbox zero on Fridays', props: { persistence: 'weekly', environment: 'office' } },
      { name: 'Update the project board', done: true, props: { environment: 'office' } },
      { name: 'Book the team offsite', props: { due: date(9) }, marks: ['people'] },
      { name: 'Quarterly report', props: { due: date(14), difficulty: 'hard' }, deploy: true,
        kids: [{ name: 'Gather the numbers', done: true }, { name: 'Draft the summary', blocks: [[0, 2]] }, { name: 'Review with Sam', marks: ['people'] }, { name: 'Send it out' }] }],
    [{ name: 'Daily language practice', props: { persistence: 'daily', difficulty: 'easy' } },
      { name: 'Finish the SQL course', props: { due: date(20), difficulty: 'medium' } },
      { name: 'Read one book a month', props: { persistence: 'monthly' } },
      { name: 'Spanish to A2', props: { difficulty: 'hard' },
        kids: [{ name: 'Past tense drills', blocks: [[1, 1]] }, { name: 'Watch a film without subtitles' }, { name: 'Talk with a tutor', marks: ['people'] }] }],
    [{ name: 'Fix the leaking tap', props: { due: date(5), environment: 'kitchen' } },
      { name: 'Deep-clean the kitchen', props: { persistence: 'monthly', environment: 'kitchen' } },
      { name: 'Sort the paperwork', props: { environment: 'den' } },
      { name: 'Plan the garden', kids: [{ name: 'Order seeds' }, { name: 'Build a raised bed' }, { name: 'Plant the tomatoes' }] }],
    [{ name: 'Sleep by eleven', done: true, props: { persistence: 'daily' } },
      { name: 'Annual check-up', props: { due: date(30), persistence: 'annually', environment: 'local' } },
      { name: 'Stretch after work', props: { persistence: 'daily', difficulty: 'easy' } },
      { name: 'Run a 10K', props: { difficulty: 'hard' }, deploy: true,
        kids: [{ name: 'Run three times a week', props: { persistence: 'weekly' } }, { name: 'Long run on Sundays' }, { name: 'Sign up for a race', props: { due: date(25) } }] }],
    [{ name: 'Call grandma', props: { persistence: 'weekly' }, marks: ['people'] },
      { name: 'Plan Alex’s birthday', props: { due: date(12) }, marks: ['people'] },
      { name: 'Thank-you notes', marks: ['people'] },
      { name: 'Host a dinner', marks: ['people'], kids: [{ name: 'Pick a date' }, { name: 'Choose the menu' }, { name: 'Invite everyone' }] }],
    [{ name: 'Learn three songs on guitar', props: { difficulty: 'medium' } },
      { name: 'Board game night', marks: ['people'] },
      { name: 'Visit the new museum', props: { environment: 'distant' } },
      { name: 'Weekend hike', kids: [{ name: 'Choose a trail' }, { name: 'Pack the bag' }] }],
  ],
  relations: [['Run a 10K', 'Sleep by eleven', 4, 'rest makes the training work'], ['Finish the SQL course', 'Quarterly report', 3, 'faster numbers'], ['Host a dinner', 'Deep-clean the kitchen', 2, 'before guests come']],
};

const STATISTICS = {
  id: 'statistics-essentials', title: 'Statistics essentials', palette: 'mothchalk',
  about: 'A study aid: 36 questions in six topics, answered on the map. Choices and the order shuffle each session; a goal appears after three right answers.',
  categories: ['Describing data', 'Probability', 'Distributions', 'Estimation', 'Hypothesis tests', 'Regression'],
  rules: { kites: 'central', stardots: 'independent', perStar: 12, deploy: 'auto', questions: 'on', goalAfter: 3, shuffleChoices: 'on', shuffleQuestions: 'on' },
  terms: { stardot: 'question' },
  list: [
    [['Center and outliers', '1. Which measure of center is least affected by a few extreme values?\nA) Mean\nB) Median\nC) Range\nD) Standard deviation\nAnswer: B\nExplanation: The median depends only on the middle value or values.'],
      ['Median', '1. The data 2, 4, 4, 5, 7, 8 have a median of:\nAnswer: 4.5\nExplanation: With six values, the median is the average of the 3rd and 4th: (4 + 5) / 2.'],
      ['Skew', '1. A distribution with a long tail to the right is ____-skewed.\nAnswer: right; positively; positive\nExplanation: The tail points to where the skew is named.'],
      ['Range', '1. What is the range of 3, 9, 4, 12, 7?\nAnswer: 9\nExplanation: Largest minus smallest: 12 − 3.'],
      ['Interquartile range', '1. The interquartile range covers the middle ____ percent of the data.\nAnswer: 50\nExplanation: From the first quartile (25%) to the third (75%).'],
      ['Box plots', '1. Which plot shows the five-number summary?\nA) Histogram\nB) Scatter plot\nC) Box plot\nD) Pie chart\nAnswer: C\nExplanation: Minimum, Q1, median, Q3 and maximum are the box and its whiskers.']],
    [['An even roll', '1. A fair six-sided die is rolled once. What is the probability of an even number?\nAnswer: 0.5\nExplanation: Three of the six faces are even.'],
      ['Two heads', '1. Two fair coins are tossed. What is the probability of two heads?\nAnswer: 0.25\nExplanation: One outcome of four: HH, HT, TH, TT.'],
      ['Independence', '1. If A and B are independent, P(A and B) equals ____.\nAnswer: P(A)P(B); P(A)*P(B); P(A) × P(B)\nExplanation: For independent events, multiply.'],
      ['Mutually exclusive', '1. Events that cannot happen at the same time are called:\nA) Independent\nB) Complementary\nC) Conditional\nD) Mutually exclusive\nAnswer: D'],
      ['Complements', '1. P(A) = 0.3. What is P(not A)?\nAnswer: 0.7\nExplanation: The probabilities of an event and its complement add to 1.'],
      ['Conditional probability', '1. P(A | B) means the probability of:\nA) A or B\nB) A, given that B happened\nC) B, given that A happened\nD) A and B together\nAnswer: B']],
    [['One standard deviation', '1. In a normal distribution, about what share of values lie within one standard deviation of the mean?\nA) 50%\nB) 68%\nC) 95%\nD) 99.7%\nAnswer: B\nExplanation: The 68–95–99.7 rule.'],
      ['z-scores', '1. A z-score of 2 means the value is two ____ above the mean.\nAnswer: standard deviations; SDs; standard deviation'],
      ['Counting heads', '1. The number of heads in 10 fair coin flips follows which distribution?\nA) Normal\nB) Poisson\nC) Binomial\nD) Uniform\nAnswer: C\nExplanation: A fixed number of independent yes/no trials.'],
      ['Binomial mean', '1. What is the mean of a binomial distribution with n = 20 and p = 0.3?\nAnswer: 6\nExplanation: n × p = 20 × 0.3.'],
      ['Area under the curve', '1. The total area under any probability density curve equals ____.\nAnswer: 1'],
      ['Rare events', '1. Which distribution models counts of rare events in a fixed interval?\nA) Poisson\nB) Binomial\nC) Normal\nD) Uniform\nAnswer: A']],
    [['Confidence intervals', '1. What does a 95% confidence interval for a mean mean?\nA) 95% of the data lie inside it\nB) The sample mean is 95% likely to be inside it\nC) The method captures the true mean in 95% of samples\nD) The true mean changes 5% of the time\nAnswer: C'],
      ['Sample size', '1. A larger sample makes a confidence interval:\nA) Wider\nB) Narrower\nC) No different\nD) Biased\nAnswer: B'],
      ['Standard error', '1. The standard error of the mean is the standard deviation divided by the square root of ____.\nAnswer: n; the sample size'],
      ['Computing it', '1. A sample of 100 has a standard deviation of 20. What is the standard error of the mean?\nAnswer: 2\nExplanation: 20 / √100.'],
      ['Unbiased', '1. An estimator whose expected value equals the parameter is called ____.\nAnswer: unbiased'],
      ['Critical value', '1. For a 95% interval from a normal model, the critical value z* is about:\nAnswer: 1.96']],
    [['p-values', '1. A p-value is the probability of:\nA) The null hypothesis being true\nB) Data at least as extreme as observed, if the null is true\nC) A Type II error\nD) The alternative being true\nAnswer: B'],
      ['Type I', '1. Rejecting a true null hypothesis is a Type ____ error.\nAnswer: I; 1; one'],
      ['Deciding', '1. With α = 0.05 and p = 0.03, you:\nA) Reject the null hypothesis\nB) Fail to reject it\nC) Prove the alternative\nD) Raise α\nAnswer: A'],
      ['Power', '1. The power of a test is the probability of:\nA) A Type I error\nB) Failing to reject the null\nC) Rejecting the null when it is false\nD) A p-value under 0.5\nAnswer: C'],
      ['Two means', '1. To compare the means of two independent groups, a common choice is the two-sample ____ test.\nAnswer: t'],
      ['Chi-square', '1. A chi-square test of independence uses data arranged in a:\nA) Scatter plot\nB) Time series\nC) Box plot\nD) Contingency table\nAnswer: D']],
    [['Slope', '1. In y = 3 + 2x, what is the slope?\nAnswer: 2'],
      ['Correlation', '1. The correlation coefficient r ranges from ____ to 1.\nAnswer: -1; −1'],
      ['Strong and negative', '1. r = −0.9 indicates:\nA) A weak positive relationship\nB) A strong negative relationship\nC) No relationship\nD) Causation\nAnswer: B'],
      ['R-squared', '1. An R² of 0.64 means 64% of the variation in y is ____ by the model.\nAnswer: explained; accounted for'],
      ['Residuals', '1. A residual is:\nA) Observed minus predicted\nB) Predicted minus the mean\nC) The slope’s error\nD) The intercept\nAnswer: A'],
      ['Beyond the data', '1. Predicting outside the range of the observed x values is called ____.\nAnswer: extrapolation']],
  ],
};

const lesson = (name, q) => ({ name, q });
const COURSE = {
  id: 'intro-data-analysis', title: 'Intro to data analysis', palette: 'coastglow',
  about: 'A course map: six units of lessons, a project at each unit’s tip that opens the next steps, and short checks on the way. In three projects, two core steps done unlock the stretch work.',
  categories: ['1 · Getting data', '2 · Cleaning', '3 · Exploring', '4 · Visualizing', '5 · Modeling', '6 · Communicating'],
  rules: { locks: 'on' }, terms: { stardot: 'lesson' },
  tree: [
    [{ name: 'Where data comes from' },
      lesson('Reading a CSV file', '1. CSV stands for comma-separated ____.\nAnswer: values\n\n2. Which line of a CSV file usually holds the column names?\nA) The first\nB) The last\nC) Every tenth\nD) None of them\nAnswer: A'),
      { name: 'Spreadsheets and databases' },
      { name: 'Project: collect a small dataset', kids: [{ name: 'Choose a question' }, { name: 'Collect thirty rows' }, { name: 'Write a data dictionary' }] }],
    [{ name: 'Missing values' },
      { name: 'Duplicates and typos' },
      lesson('Tidy data', '1. In tidy data, each variable is a ____ and each observation is a row.\nAnswer: column\n\n2. Which is NOT a rule of tidy data?\nA) Each variable is a column\nB) Each observation is a row\nC) Each value is a cell\nD) One table holds several kinds of unit\nAnswer: D'),
      { name: 'Project: clean your dataset', kids: [{ name: 'List the problems' }, { name: 'Fix them in a script' }, { name: 'Log each change' }] }],
    [lesson('Summary statistics', '1. What is the mean of 2, 4, 6 and 8?\nAnswer: 5\n\n2. Which of these measures spread?\nA) Mean\nB) Median\nC) Standard deviation\nD) Mode\nAnswer: C'),
      { name: 'Grouping and counting' },
      { name: 'Looking for outliers' },
      { name: 'Project: explore your dataset', kids: [{ name: 'Three questions to ask it' }, { name: 'Answer each with a summary' }, { name: 'Check one surprising number' }, { name: 'Write what you found' },
        { name: 'Stretch: compare two groups' }, { name: 'Stretch: swap findings with a classmate' }] }],
    [lesson('Choosing a chart', '1. To compare one quantity across categories, use a ____ chart.\nAnswer: bar\n\n2. Which shows the relationship between two numeric variables?\nA) Pie chart\nB) Scatter plot\nC) Bar chart\nD) Table\nAnswer: B'),
      { name: 'Color and labels' },
      { name: 'Small multiples' },
      { name: 'Project: three charts', kids: [{ name: 'Draft them' }, { name: 'Ask someone what they see' }, { name: 'Revise' }, { name: 'Caption each one' },
        { name: 'Stretch: an interactive version' }, { name: 'Stretch: redraw a misleading chart' }] }],
    [{ name: 'Fitting a line' },
      lesson('Train and test sets', '1. Data held back to judge a model is the ____ set.\nAnswer: test\n\n2. Why hold data back?\nA) To train faster\nB) To estimate performance on new data\nC) To remove outliers\nD) To fill in missing values\nAnswer: B'),
      { name: 'Checking residuals' },
      { name: 'Project: fit a simple model', kids: [{ name: 'Split the data' }, { name: 'Fit and check' }] }],
    [{ name: 'Writing a summary' },
      lesson('Presenting uncertainty', '1. A range of plausible values for an estimate is a confidence ____.\nAnswer: interval'),
      { name: 'Reproducible reports' },
      { name: 'Project: the final report', kids: [{ name: 'Draft' }, { name: 'Peer review' }, { name: 'Revise' }, { name: 'Publish' },
        { name: 'Stretch: a one-page summary' }, { name: 'Stretch: present it in five minutes' }] }],
  ],
};

const skill = (name, difficulty, done = false) => ({ name, props: { difficulty }, done });
const COOKING = {
  id: 'home-cooking', title: 'Home cooking skill tree', palette: 'fizzbolt',
  about: 'A skill tree: basics on the central star, and each category’s signature skill unlocks a star of advanced ones when it’s done.',
  categories: ['Knife skills', 'Heat', 'Baking', 'Sauces', 'Flavor', 'Planning'],
  rules: { kites: 'central', deploy: 'auto' }, terms: { stardot: 'skill' },
  tree: [
    [skill('Hold a knife safely', 'easy', true), skill('Dice an onion', 'easy'), skill('Mince garlic', 'easy'),
      { ...skill('Julienne', 'medium'), kids: [skill('Chiffonade herbs', 'medium'), skill('Supreme a citrus', 'medium'), skill('Break down a chicken', 'hard'), skill('Fillet a fish', 'hard')] }],
    [skill('Boil and simmer', 'easy', true), skill('Sauté', 'easy'), skill('Roast vegetables', 'easy'),
      { ...skill('Sear a steak', 'medium'), kids: [skill('Pan sauce from the fond', 'medium'), skill('Rest and slice', 'easy'), skill('Reverse sear', 'hard'), skill('Cook to temperature', 'medium')] }],
    [skill('Measure by weight', 'easy', true), skill('Quick bread', 'easy'), skill('Shortbread', 'easy'),
      { ...skill('Yeast bread', 'medium'), kids: [skill('Knead and proof', 'medium'), skill('Shape a loaf', 'medium'), skill('Focaccia', 'medium'), skill('Sourdough starter', 'hard')] }],
    [skill('Vinaigrette', 'easy'), skill('Tomato sauce', 'easy'), skill('Pan gravy', 'medium'),
      { ...skill('Béchamel', 'medium'), kids: [skill('Cheese sauce', 'easy'), skill('Velouté', 'medium'), skill('Hollandaise', 'hard'), skill('Beurre blanc', 'hard')] }],
    [skill('Season with salt', 'easy', true), skill('Balance with acid', 'easy'), skill('Toast whole spices', 'easy'),
      { ...skill('Blend your own spices', 'medium'), kids: [skill('Garam masala', 'medium'), skill('Za’atar', 'easy'), skill('Taste and adjust', 'medium'), skill('Make a marinade', 'easy')] }],
    [skill('Read a recipe through', 'easy', true), skill('Mise en place', 'easy'), skill('Plan a week of meals', 'medium'),
      { ...skill('Cook a three-course dinner', 'hard'), kids: [skill('Write the menu', 'easy'), skill('Shopping list', 'easy'), skill('Timeline back from serving', 'medium'), skill('Host it', 'hard')] }],
  ],
};

const entry = (name, desc, extra = {}) => ({ name, desc, ...extra });
const CAMPAIGN = {
  id: 'lantern-coast', title: 'The Lantern Coast', palette: 'cloudblush',
  about: 'A campaign notebook: six factions of a made-up coast, their people and places, notes, and how they feel about each other.',
  categories: ['The Harbor Guild', 'The Lamplighters', 'Saltmarsh Folk', 'The Drowned Choir', 'House Vey', 'The Wild Coast'],
  rules: {}, terms: { stardot: 'entry', stardots: 'entries' },
  marks: [{ id: 'met', symbol: '☺', name: 'The party has met them' }, { id: 'secret', symbol: '✶', name: 'Holds a secret' }],
  tree: [
    [entry('Guildmaster Orla Penn', 'Runs the docks with a ledger in one hand. Owes the Lamplighters more than she admits.', { marks: ['met'] }),
      entry('The Tally House', 'Where every cargo is counted, twice.'),
      entry('The smuggler’s ledger', 'A second set of books, hidden under the Tally House floor.', { marks: ['secret'] }),
      entry('Pier Nine', 'The only pier the Guild doesn’t patrol after dark.', { deploy: true, kids: [entry('The night crane', 'Creaks at low tide.'), entry('Warehouse Four', 'Locked; the key is with Orla.'), entry('The customs shed', 'Empty since the storm.')] })],
    [entry('Keeper Ansel Rook', 'Has tended the Great Lantern for forty years.', { marks: ['met'] }),
      entry('The Great Lantern', 'Seen from every cove on the coast.'),
      entry('Oil running low', 'A rumor: the reserves won’t last the winter.', { marks: ['secret'] }),
      entry('The Lantern Tower', 'Nine floors, one sealed.', { kids: [entry('The lens room', 'Warm even in winter.'), entry('Keeper’s quarters', 'A desk of old logbooks.'), entry('The sealed cellar', 'Nobody remembers who sealed it.')] })],
    [entry('Elder Maeve Tull', 'Speaks for the reed villages.'),
      entry('Hollin, the reed village', 'Houses on stilts above the marsh.'),
      entry('The eel harvest', 'Late this year, and smaller.'),
      entry('The Sunken Causeway', 'Walkable only at the lowest tides.', { kids: [entry('The toll stones', 'Carved with names.'), entry('The fog bell', 'Rings by itself, they say.')] })],
    [entry('The Cantor', 'Leader of the Choir; never seen above the waterline.', { marks: ['secret'] }),
      entry('Hymn of the Low Tide', 'Sung on the night the sea draws back.'),
      entry('The drowned bell', 'Lost with the old chapel.'),
      entry('The choir caves', 'Reached through the sea at low tide.', { kids: [entry('The echo hall', 'Every word comes back twice.'), entry('The altar of shells', 'Fresh offerings, always.')] })],
    [entry('Lady Imre Vey', 'Lends money to anyone who can’t refuse her.', { marks: ['met'] }),
      entry('Vey Manor', 'On the cliff above the harbor.'),
      entry('The Vey fleet', 'Three ships, one of them not on any register.'),
      entry('The debts of House Vey', 'Who owes, and who is owed.', { kids: [entry('A loan to the Guild', 'Due at the spring tide.'), entry('An unpaid tithe', 'Owed to the Lamplighters.')] })],
    [entry('Wreckers’ Cove', 'Lights here have drawn ships onto the rocks.'),
      entry('Jory the hermit', 'Knows every path in the dunes.', { marks: ['met'] }),
      entry('Storm season', 'Three weeks away.'),
      entry('The lighthouse ruins', 'The old light, before the Great Lantern.', { kids: [entry('The broken stair', 'Missing every third step.'), entry('An old map', 'Shows a fourth pier.')] })],
  ],
  relations: [['Guildmaster Orla Penn', 'Keeper Ansel Rook', 4, 'owes him a debt'], ['Lady Imre Vey', 'Guildmaster Orla Penn', 5, 'lends the Guild money'], ['The Cantor', 'The drowned bell', 5, 'wants it raised'], ['The smuggler’s ledger', 'The Vey fleet', 3, 'lists its third ship'], ['Elder Maeve Tull', 'The Cantor', 2, 'fears the Choir'], ['Jory the hermit', 'Wreckers’ Cove', 4, 'saw who lit the lights']],
};

const TRIVIA = {
  id: 'trivia-night', title: 'Trivia night', palette: 'coastglow',
  about: 'A game: six rounds of twenty questions, a few on the field at a time. Answer three right in a round and a goal question twinkles; answer it to win the round.',
  categories: ['Science', 'History', 'Geography', 'Arts & books', 'Sports', 'Food & drink'],
  rules: { kites: 'central', stardots: 'independent', perStar: 12, deploy: 'auto', questions: 'on', goalAfter: 3, shuffleChoices: 'on', shuffleQuestions: 'on' },
  terms: { stardot: 'question' },
  list: [
    [['Photosynthesis', '1. Which gas do plants take in for photosynthesis?\nA) Oxygen\nB) Carbon dioxide\nC) Nitrogen\nD) Hydrogen\nAnswer: B'],
      ['Gold', '1. What is the chemical symbol for gold?\nAnswer: Au'],
      ['Bones', '1. How many bones are in the adult human body?\nAnswer: 206'],
      ['The Red Planet', '1. Which planet is known as the Red Planet?\nA) Venus\nB) Jupiter\nC) Mars\nD) Saturn\nAnswer: C'],
      ['Boiling point', '1. At sea level, water boils at ____ degrees Celsius.\nAnswer: 100'],
      ['The cell', '1. Which part of a cell holds its genetic material?\nA) The nucleus\nB) A ribosome\nC) The cell wall\nD) A vacuole\nAnswer: A'],
      ["Water", "1. Water is made of hydrogen and which other element?\nA) Carbon\nB) Oxygen\nC) Nitrogen\nD) Helium\nAnswer: B"],
      ["Largest planet", "1. Which is the largest planet in the solar system?\nA) Saturn\nB) Neptune\nC) Jupiter\nD) Uranus\nAnswer: C"],
      ["Hardest mineral", "1. What is the hardest natural mineral?\nA) Quartz\nB) Diamond\nC) Topaz\nD) Corundum\nAnswer: B"],
      ["Red blood cells", "1. Which blood cells carry oxygen around the body?\nA) Red blood cells\nB) White blood cells\nC) Platelets\nD) Plasma cells\nAnswer: A"],
      ["Freezing point", "1. At sea level, pure water freezes at ____ degrees Celsius.\nAnswer: 0"],
      ["Principia", "1. Who set out the law of universal gravitation in the Principia, published in 1687?\nA) Galileo Galilei\nB) Isaac Newton\nC) Johannes Kepler\nD) Albert Einstein\nAnswer: B"],
      ["Spider legs", "1. How many legs does a spider have?\nAnswer: 8"],
      ["Green leaves", "1. Which pigment makes plants green?\nA) Carotene\nB) Chlorophyll\nC) Melanin\nD) Hemoglobin\nAnswer: B"],
      ["Silence", "1. Sound cannot travel through:\nA) A solid\nB) A liquid\nC) A gas\nD) A vacuum\nAnswer: D"],
      ["Element one", "1. Which element has atomic number 1?\nAnswer: hydrogen; H"],
      ["Honey", "1. Bees make honey from the ____ of flowers.\nAnswer: nectar"],
      ["Earth’s crust", "1. What is the outermost layer of the Earth called?\nA) The mantle\nB) The core\nC) The crust\nD) Magma\nAnswer: C"],
      ["A year", "1. To the nearest whole day, how many days does Earth take to orbit the Sun?\nAnswer: 365"],
      ["Mercury", "1. Which planet is closest to the Sun?\nA) Venus\nB) Mercury\nC) Mars\nD) Earth\nAnswer: B"]],
    [['The Berlin Wall', '1. In which year did the Berlin Wall fall?\nAnswer: 1989'],
      ['The Moon', '1. Who was the first person to walk on the Moon?\nA) Buzz Aldrin\nB) Yuri Gagarin\nC) Neil Armstrong\nD) John Glenn\nAnswer: C'],
      ['Machu Picchu', '1. Machu Picchu was built by the ____.\nAnswer: Inca; Incas; Inca Empire'],
      ['Julius Caesar', '1. Julius Caesar was a statesman of ancient:\nA) Greece\nB) Rome\nC) Egypt\nD) Persia\nAnswer: B'],
      ['Printing', '1. Movable-type printing in Europe was developed by Johannes ____.\nAnswer: Gutenberg'],
      ['1912', '1. Which ship sank on its maiden voyage in 1912?\nA) Lusitania\nB) Britannic\nC) Titanic\nD) Olympic\nAnswer: C'],
      ["Giza", "1. The Great Pyramid of Giza is in which country?\nA) Mexico\nB) Egypt\nC) Sudan\nD) Iraq\nAnswer: B"],
      ["Magna Carta", "1. In which year was the Magna Carta sealed?\nAnswer: 1215"],
      ["First emperor", "1. Who was the first emperor of a unified China?\nA) Kublai Khan\nB) Qin Shi Huang\nC) Sun Yat-sen\nD) Liu Bang\nAnswer: B"],
      ["1492", "1. Which explorer crossed the Atlantic in 1492?\nA) Vasco da Gama\nB) Ferdinand Magellan\nC) Christopher Columbus\nD) John Cabot\nAnswer: C"],
      ["Independence", "1. The US Declaration of Independence was adopted in ____.\nAnswer: 1776"],
      ["Waterloo", "1. Napoleon was finally defeated at the Battle of ____ in 1815.\nAnswer: Waterloo"],
      ["Rosetta Stone", "1. The Rosetta Stone helped scholars read which script?\nA) Cuneiform\nB) Egyptian hieroglyphs\nC) Linear B\nD) Runes\nAnswer: B"],
      ["First flight", "1. In which year did the Wright brothers make their first powered flight?\nA) 1893\nB) 1903\nC) 1913\nD) 1923\nAnswer: B"],
      ["The Great Wall", "1. The Great Wall was built in which country?\nAnswer: China"],
      ["Renaissance", "1. In which country did the Renaissance begin?\nA) France\nB) England\nC) Italy\nD) Spain\nAnswer: C"],
      ["1945", "1. In which year did World War II end?\nAnswer: 1945"],
      ["Vikings", "1. The Vikings came mainly from:\nA) Scandinavia\nB) The Balkans\nC) Iberia\nD) North Africa\nAnswer: A"],
      ["Cleopatra", "1. Cleopatra was the last active ruler of the Ptolemaic Kingdom of ____.\nAnswer: Egypt"],
      ["1994", "1. Nelson Mandela became president of which country in 1994?\nA) Kenya\nB) Zimbabwe\nC) South Africa\nD) Namibia\nAnswer: C"]],
    [['Largest ocean', '1. What is the largest ocean on Earth?\nA) Atlantic\nB) Indian\nC) Arctic\nD) Pacific\nAnswer: D'],
      ['Australia', '1. What is the capital of Australia?\nA) Sydney\nB) Melbourne\nC) Canberra\nD) Perth\nAnswer: C'],
      ['South America', '1. The longest river in South America is the ____.\nAnswer: Amazon'],
      ['Continents', '1. By the most common count, how many continents are there?\nAnswer: 7'],
      ['Kilimanjaro', '1. Mount Kilimanjaro is in which country?\nA) Kenya\nB) Tanzania\nC) Uganda\nD) Ethiopia\nAnswer: B'],
      ['Northern Africa', '1. Which desert covers much of northern Africa?\nA) Gobi\nB) Kalahari\nC) Sahara\nD) Atacama\nAnswer: C'],
      ["Everest", "1. What is the tallest mountain above sea level?\nAnswer: Mount Everest; Everest"],
      ["Japan", "1. What is the capital of Japan?\nA) Kyoto\nB) Osaka\nC) Tokyo\nD) Hiroshima\nAnswer: C"],
      ["Canada", "1. What is the capital of Canada?\nA) Toronto\nB) Ottawa\nC) Vancouver\nD) Montreal\nAnswer: B"],
      ["The Nile", "1. The Nile flows into which sea?\nA) The Red Sea\nB) The Mediterranean Sea\nC) The Black Sea\nD) The Arabian Sea\nAnswer: B"],
      ["Largest country", "1. What is the largest country by area?\nAnswer: Russia"],
      ["Iceland", "1. Iceland’s capital is ____.\nAnswer: Reykjavik; Reykjavík"],
      ["The Andes", "1. The Andes run along the western side of which continent?\nA) Africa\nB) Asia\nC) South America\nD) North America\nAnswer: C"],
      ["Smallest country", "1. What is the smallest country in the world by area?\nA) Monaco\nB) Vatican City\nC) San Marino\nD) Liechtenstein\nAnswer: B"],
      ["The reef", "1. The Great Barrier Reef lies off the coast of which country?\nAnswer: Australia"],
      ["The equator", "1. The equator divides the Earth into the Northern and ____ Hemispheres.\nAnswer: Southern"],
      ["Dead Sea", "1. The Dead Sea is famous for being very:\nA) Cold\nB) Deep\nC) Salty\nD) Fresh\nAnswer: C"],
      ["Lagoon city", "1. Which Italian city is built on more than a hundred small islands in a lagoon?\nA) Florence\nB) Venice\nC) Naples\nD) Genoa\nAnswer: B"],
      ["Oceans", "1. By the most common count, how many oceans are there?\nAnswer: 5"],
      ["Mount Fuji", "1. Mount Fuji is the highest mountain in which country?\nA) China\nB) South Korea\nC) Japan\nD) Nepal\nAnswer: C"]],
    [['Mona Lisa', '1. Who painted the Mona Lisa?\nA) Michelangelo\nB) Raphael\nC) Leonardo da Vinci\nD) Botticelli\nAnswer: C'],
      ['Pride and Prejudice', '1. Who wrote Pride and Prejudice?\nA) Charlotte Brontë\nB) Jane Austen\nC) George Eliot\nD) Mary Shelley\nAnswer: B'],
      ['Violin', '1. How many strings does a standard violin have?\nAnswer: 4'],
      ['The Starry Night', '1. The Starry Night was painted by Vincent van ____.\nAnswer: Gogh'],
      ['88 keys', '1. Which instrument usually has 88 keys?\nA) Organ\nB) Piano\nC) Harpsichord\nD) Accordion\nAnswer: B'],
      ['To be, or not to be', '1. “To be, or not to be” is a line from which play?\nA) Macbeth\nB) Hamlet\nC) Othello\nD) King Lear\nAnswer: B'],
      ["Moby-Dick", "1. Who wrote Moby-Dick?\nA) Herman Melville\nB) Mark Twain\nC) Nathaniel Hawthorne\nD) Edgar Allan Poe\nAnswer: A"],
      ["The Thinker", "1. The sculpture The Thinker is by Auguste ____.\nAnswer: Rodin"],
      ["Symphonies", "1. How many symphonies did Beethoven complete?\nAnswer: 9"],
      ["Trumpet", "1. Which section of the orchestra includes the trumpet?\nA) Strings\nB) Woodwinds\nC) Brass\nD) Percussion\nAnswer: C"],
      ["Don Quixote", "1. Don Quixote was written by Miguel de ____.\nAnswer: Cervantes"],
      ["Primary colors", "1. In traditional painting, which of these is a primary color?\nA) Green\nB) Orange\nC) Blue\nD) Purple\nAnswer: C"],
      ["Haiku", "1. How many lines does a traditional haiku have?\nAnswer: 3"],
      ["Sistine Chapel", "1. Who painted the ceiling of the Sistine Chapel?\nA) Raphael\nB) Michelangelo\nC) Titian\nD) Caravaggio\nAnswer: B"],
      ["1984", "1. Who wrote the novel 1984?\nA) Aldous Huxley\nB) George Orwell\nC) H. G. Wells\nD) Ray Bradbury\nAnswer: B"],
      ["Swan Lake", "1. Swan Lake is a ballet by Pyotr Ilyich ____.\nAnswer: Tchaikovsky"],
      ["The Odyssey", "1. The Odyssey is attributed to which ancient poet?\nA) Virgil\nB) Homer\nC) Sappho\nD) Ovid\nAnswer: B"],
      ["The Scream", "1. The Scream was painted by Edvard ____.\nAnswer: Munch"],
      ["Sonnet", "1. How many lines does a sonnet have?\nAnswer: 14"],
      ["Guitar", "1. How many strings does a standard guitar have?\nAnswer: 6"]],
    [['Soccer', '1. How many players does a soccer team have on the field?\nAnswer: 11'],
      ['Tennis', '1. In tennis, what is a score of zero called?\nA) Nil\nB) Love\nC) Duck\nD) Zero\nAnswer: B'],
      ['Olympic rings', '1. How many rings are on the Olympic flag?\nAnswer: 5'],
      ['Marathon', '1. A marathon is about 42.2 ____ long.\nAnswer: kilometers; km; kilometres'],
      ['Slam dunk', '1. In which sport would you see a slam dunk?\nA) Volleyball\nB) Basketball\nC) Handball\nD) Water polo\nAnswer: B'],
      ['Touchdown', '1. How many points is a touchdown worth in American football, before the extra point?\nAnswer: 6'],
      ["Basketball", "1. How many players from one team are on a basketball court at a time?\nAnswer: 5"],
      ["Birdie", "1. In golf, what is one stroke under par on a hole called?\nA) Eagle\nB) Birdie\nC) Bogey\nD) Albatross\nAnswer: B"],
      ["Wimbledon", "1. Wimbledon is played on which surface?\nA) Clay\nB) Grass\nC) Hard court\nD) Carpet\nAnswer: B"],
      ["Every four years", "1. The Summer Olympic Games are held every ____ years.\nAnswer: 4; four"],
      ["Bishop", "1. In chess, which piece can only move diagonally?\nA) Rook\nB) Knight\nC) Bishop\nD) King\nAnswer: C"],
      ["Strikeout", "1. How many strikes make a strikeout in baseball?\nAnswer: 3"],
      ["Cricket", "1. How many players does a cricket team have on the field?\nAnswer: 11"],
      ["Tour de France", "1. The Tour de France is a race for:\nA) Runners\nB) Cyclists\nC) Rowers\nD) Cars\nAnswer: B"],
      ["Bullseye", "1. In which game do players throw small arrows at a board, aiming for the bullseye?\nAnswer: darts"],
      ["Ice hockey", "1. Ice hockey is played with a stick and a:\nA) Ball\nB) Puck\nC) Shuttlecock\nD) Disc\nAnswer: B"],
      ["Volleyball", "1. How many players does a volleyball team have on the court?\nAnswer: 6"],
      ["Sumo", "1. Sumo wrestling comes from which country?\nA) China\nB) Mongolia\nC) Japan\nD) Korea\nAnswer: C"],
      ["Eight-ball", "1. In eight-ball pool, which ball is potted last?\nA) The cue ball\nB) The 1 ball\nC) The 8 ball\nD) The 15 ball\nAnswer: C"],
      ["Hat trick", "1. In soccer, three goals by one player in a game is called a ____ trick.\nAnswer: hat"]],
    [['Guacamole', '1. Guacamole is made mainly from which fruit?\nA) Avocado\nB) Lime\nC) Tomato\nD) Mango\nAnswer: A'],
      ['Sushi rice', '1. Sushi rice is seasoned with sugar, salt and rice ____.\nAnswer: vinegar'],
      ['Kipferl', '1. The croissant’s ancestor, the kipferl, comes from which country?\nA) France\nB) Austria\nC) Italy\nD) Belgium\nAnswer: B'],
      ['Yellow curry', '1. Which spice gives many curries their yellow color?\nA) Cumin\nB) Paprika\nC) Turmeric\nD) Saffron\nAnswer: C'],
      ['Parmesan', '1. Parmigiano Reggiano comes from which country?\nA) France\nB) Spain\nC) Italy\nD) Switzerland\nAnswer: C'],
      ['Spoons', '1. How many teaspoons are in a tablespoon?\nAnswer: 3'],
      ["Tofu", "1. Tofu is made from which bean?\nA) Kidney bean\nB) Soybean\nC) Chickpea\nD) Lentil\nAnswer: B"],
      ["Pesto", "1. Classic pesto is made mainly with which herb?\nA) Parsley\nB) Basil\nC) Mint\nD) Oregano\nAnswer: B"],
      ["Hummus", "1. Hummus is made mainly from ____.\nAnswer: chickpeas; chickpea"],
      ["Saffron", "1. Saffron comes from which flower?\nA) Rose\nB) Crocus\nC) Tulip\nD) Lily\nAnswer: B"],
      ["Paella", "1. Paella comes from which country?\nA) Mexico\nB) Portugal\nC) Spain\nD) Italy\nAnswer: C"],
      ["A dozen", "1. How many eggs are in a dozen?\nAnswer: 12"],
      ["Kimchi", "1. Kimchi is a fermented dish from which country?\nA) Japan\nB) Korea\nC) Vietnam\nD) Thailand\nAnswer: B"],
      ["Rising dough", "1. Most bread rises thanks to ____.\nAnswer: yeast"],
      ["Wasabi", "1. Wasabi is a pungent green paste usually served with:\nA) Tacos\nB) Sushi\nC) Pasta\nD) Curry\nAnswer: B"],
      ["One plant", "1. Green tea and black tea come from the same plant.\nA) True\nB) False\nAnswer: A"],
      ["Chocolate", "1. Chocolate is made from the beans of the ____ tree.\nAnswer: cacao; cocoa"],
      ["Butter", "1. Butter is made by churning:\nA) Milk\nB) Cream\nC) Yogurt\nD) Whey\nAnswer: B"],
      ["Mozzarella", "1. Mozzarella di bufala is made from the milk of which animal?\nA) Cow\nB) Goat\nC) Water buffalo\nD) Sheep\nAnswer: C"],
      ["A quart", "1. How many cups are in a US quart?\nAnswer: 4"]],
  ],
};

const PACKS = [ORGANIZER, STATISTICS, COURSE, COOKING, CAMPAIGN, TRIVIA];

// ---- Building ------------------------------------------------------------------------------------

function contentOf(p) {
  const raw = {
    ...BASE, id: p.id, title: p.title,
    categories: p.categories.map((name, i) => ({ name, color: PALETTES[p.palette][i] })),
    marks: p.marks ?? [],
    start: { central: [0, 1, 2, 3, 4, 5] },
    rules: { ...BASE.rules, ...p.rules }, terms: p.terms,
  };
  return E.normalizeContent(raw);
}

function questions(text, where) {
  const r = E.parsePlain(text);
  if (r.errors.length) throw new Error(`${where}: ${r.errors.map(e => `line ${e.line}: ${e.message}`).join('; ')}`);
  return r.set;
}

function boardOf(p, content) {
  const opts = { ...E.optionsFrom(content), now: NOW };
  let save = E.newSave(content, p.title);
  let st = save.state;
  const kites = E.centralStar(st).kites;
  const byName = new Map();
  const toDeploy = [];
  const dress = (d, node) => {
    st = E.updateDot(st, d, { description: node.desc ?? '', props: node.props ?? {}, marks: node.marks ?? [] });
    if (node.q) st = E.updateDot(E.setAssessment(st, d, questions(node.q, node.name)), d, { role: 'assess' });
    if (node.done) st = E.ignite(st, d, NOW);
    for (const [day, hours] of node.blocks ?? []) st = E.placeBlocks(st, d, TODAY + day * DAY, hours).state;
    byName.set(node.name, d);
  };
  if (p.tree) {
    p.tree.forEach((nodes, i) => {
      nodes.forEach((node, j) => {
        let d;
        [st, d] = E.placeDot(st, kites[i], [0, 1, 3, 2][j], node.name);
        dress(d, node);
        for (const kid of node.kids ?? []) {
          const r = E.addChild(st, d, kid.name, { options: opts });
          if (r.problem) throw new Error(`${p.id} › ${node.name}: ${r.problem}`);
          st = r.state;
          dress(r.dot, kid);
        }
        if (node.deploy) toDeploy.push(d);
      });
    });
  }
  if (p.list) {
    p.list.forEach((items, i) => items.forEach(([name, q]) => {
      let d;
      [st, d] = E.addItem(st, kites[i], name);
      dress(d, { name, q });
    }));
  }
  for (const [a, b, score, how] of p.relations ?? []) {
    if (!byName.has(a) || !byName.has(b)) throw new Error(`${p.id}: a relation names ${byName.has(a) ? b : a}, which isn’t on the board`);
    st = E.addRelation(st, byName.get(a), byName.get(b), score, how);
  }
  st = E.syncArrangements(st, opts);
  for (const d of toDeploy) {
    const r = E.deployStar(st, d, opts);
    if (r.problem) throw new Error(`${p.id} › deploying ${st.dots[d].name}: ${r.problem}`);
    st = r.state;
  }
  return E.normalizeSave({ ...save, state: st });
}

const index = { about: 'The showcase packs (tools/build_packs.mjs): what a new browser starts with, and States ▾ › New from a blueprint…. Paths are relative to this file.', packs: [] };
for (const p of PACKS) {
  const content = contentOf(p);
  const board = boardOf(p, content);
  const dir = join(ROOT, 'packs', p.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(content, null, 2) + '\n');
  writeFileSync(join(dir, 'board.json'), JSON.stringify(board, null, 2) + '\n');
  const n = Object.keys(board.state.dots).length;
  const q = Object.values(board.state.dots).filter(d => E.askable(d.assessment)).length;
  writeFileSync(join(dir, 'README.md'), `# ${p.title}\n\n${p.about}\n\n- Categories: ${p.categories.join(', ')}.\n- Its word for a star-dot: “${content.terms.stardot}”.\n- The starter board: ${n} ${content.terms.stardots}${q ? `, ${q} with questions` : ''}.\n- Rules: ${Object.entries(p.rules).map(([k, v]) => `${k} ${v}`).join(', ') || 'the defaults (a hierarchy, kites on every star, questions off)'}.\n\nOpen it from **States ▾ › New from a blueprint…**. Its content is original, written for Star Lattice.\n`);
  index.packs.push({ id: p.id, title: p.title, about: p.about, content: `${p.id}/pack.json`, board: `${p.id}/board.json` });
  console.log(`${p.id}: ${n} ${content.terms.stardots}${q ? ` (${q} with questions)` : ''}`);
}
writeFileSync(join(ROOT, 'packs', 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log('wrote packs/index.json');
