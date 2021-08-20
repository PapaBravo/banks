const DateTime = luxon.DateTime;


/**
 * @typedef {Object} Condition
 * @property {string} field
 * @property {string} operator
 * @property {RegExp} pattern
 * 
 * @typedef {Object} Rule
 * @property {string} categoryName
 * @property  {Condition[]} conditions
 * 
 * @returns {Promise<Rule[]>}
 */
async function buildRules() {
    const response = await fetch('./data/patterns.json');
    const rawPatterns = await response.json();
    return Object.entries(rawPatterns)
        .map(([category, patterns]) => {
            return patterns.map(pattern => ({
                categoryName: category,
                conditions: [{
                    field: 'sender',
                    pattern: new RegExp(pattern)
                }]
            }))
        })
        .flat();
}

/**
 * @typedef {Object} Config
 * @property {Rule[]} rules
 * 
 * @returns {Promise<Config>}
 */
async function loadConfig() {
    const response = await fetch('./data/config.json')
    let config = await response.json();

    config.rules = config.rules.concat(await buildRules());
    return config;
}

/**
 * Parsing number strings like -1.500,00
 * @param {*} numberString 
 */
function parseGermanNumber(numberString) {
    return Number.parseFloat(numberString
        .replaceAll('.', '')
        .replaceAll(',', '.')
    );
}

/**
 * @typedef {Object} Entry
 * @property {luxon.DateTime} date
 * @property {string} sender
 * @property {string} subject
 * @property {number} value
 * 
 * @returns {Promise<Entry[]>}
 */
async function loadData() {
    const response = await fetch('./data/example_diba.csv');
    const rawData = await response.text();

    const lines = rawData.split('\n');

    return lines.slice(1)
        .filter(line => line)
        .map(line => {
            const [date, , sender, , , subject, , , value,] = line.split(';');
            return {
                date: DateTime.fromFormat(date, 'dd.MM.yyyy'),
                sender: sender,
                subject: subject,
                value: -parseGermanNumber(value) // reversing sign
            }
        });
}

/**
 * 
 * @param {Entry[]} entries 
 * @returns {Entry[]} 
 */
function filterEntries(entries) {
    return entries
        .filter(e => e.value > 0);
}

/**
 * 
 * @param {Entry} entry 
 * @param {Config} config 
 * 
 * @returns {string} The category of the entry or the default category
 */
function categoriseEnry(entry, config) {
    const firstMatchingRule = config.rules
        .find(r => r.conditions
            .some(c => c.pattern.test(entry[c.field]))
        );
    return firstMatchingRule?.categoryName ?? '_default';
}

/**
 * @typedef {Entry & {categoryName: string}} CategorisedEntry
 * 
 * @param {Entry[]} entries 
 * @param {Config} config
 * 
 * @returns {CategorisedEntry[]} 
 */
function categoriseEntries(entries, config) {
    entries.forEach(e => e.categoryName = categoriseEnry(e, config));
    return entries;
}

/**
 * @typedef {Object} Statistic
 * @property {number} cnt
 * @property {number} total
 * 
 * @typedef {Map<string, Statistic>} Categorisation
 * 
 * @param {CategorisedEntry[]} entries 
 * @param {luxon.Interval} interval
 * 
 * @returns {Categorisation} 
 */
function calculateStatisticForInterval(entries, interval) {
    let result = {};

    entries
        .filter(e => interval.contains(e.date))
        .forEach(e => {
            const { categoryName: c, value: v } = e;
            if (!result[c]) {
                result[c] = {
                    cnt: 0,
                    total: 0
                };
            }
            result[c].cnt += 1;
            result[c].total += v;
        });
    return result;
}

async function main() {
    const config = await loadConfig();
    let entries = await loadData();
    entries = filterEntries(entries);
    entries = categoriseEntries(entries, config);

    const testInterval = luxon.Interval.before(DateTime.now(), { months: 2 });
    const res = calculateStatisticForInterval(entries, testInterval);
    console.log(res);
}

main();