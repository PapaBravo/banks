const DateTime = luxon.DateTime;

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

async function main() {
    const config = await loadConfig();
    const data = await loadData();
    console.log(data);
}

main();



