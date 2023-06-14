const fs = require('fs');
const path = require('path');
const RSS = require('rss');
const MarkdownIt = require('markdown-it');
const FeedParser = require('feedparser-promised');
const glob = require('glob');
const md = new MarkdownIt({html: true});

function convertDateToRFC822(dateString) {
    dateString = dateString.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
    let date = new Date(dateString);
    return date.toUTCString();
}

function generateUrl(title) {
    return 'https://fcp.cafe/#' + title.toLowerCase().replace(/ /g, '-');
}

function entriesAreEqual(entry1, entry2) {
    return entry1.title === entry2.title &&
           entry1.guid === entry2.guid &&
           entry1.description === entry2.description &&
           entry1.url === entry2.url;
}

const feedparser = require('feedparser-promised');

let oldFeedItems = [];

if (fs.existsSync('docs/rss.xml')) {
    feedparser.parse(fs.createReadStream('docs/rss.xml'))
        .then(items => {
            for (let item of items) {
                oldFeedItems.push(item);
            }

            pubDate = items[0].pubDate || new Date();
            lastBuildDate = items[0].date || new Date();
        })
        .catch(err => console.error(err));
}

const filePath = path.resolve('docs/rss.xml');
const fileContent = fs.readFileSync(filePath).toString();
const newsDir = path.join(__dirname, 'docs/_includes/news');

feedparser.parseString(fileContent).then(items => {
    items.forEach(item => {
        oldFeedItems.push(item);
    });

    const feed = new RSS({
        title: 'FCP Cafe',
        description: 'Latest News from FCP Cafe',
        feed_url: 'https://fcp.cafe/rss.xml',
        site_url: 'https://fcp.cafe',
        generator: 'FCP Cafe',
        pubDate: items[0].pubdate
    });

    let isContentChanged = false;

    // Find all markdown files in newsDir
    const files = glob.sync(newsDir + '/*.md');

    for (const file of files) {
        const data = fs.readFileSync(file, 'utf8');

        const entries = data.split('\n---\n');
        let currentTitle = '';
        let currentDate = '';

        for (const entry of entries) {
            const lines = entry.trim().split('\n');

            if (lines[0].startsWith('### ')) {
                currentTitle = lines[0].substring(4);
                currentDate = convertDateToRFC822(currentTitle);
                lines.shift();
            }

            if (lines.length === 0 || lines[0].startsWith('{{ include')) {
                continue;
            }

            let content = lines.join('\n').trim();

            content = md.render(content);

            content = content.replace(/{{ include ".*" }}/g, '')
                .replace(/\!\[([^\]]*)\]\(([^)]*)\)/g, (match, alt, src) => {
                    if (src.startsWith('../')) {
                        src = `https://fcp.cafe/${src.substring(3)}`;
                    }
                    return `<img src="${src}" alt="${alt}">`;
                })
                .replace(/\[\!button text="([^"]*)" target="([^"]*)" variant="([^"]*)"\]\(([^)]*)\)/g, '<a href="$4">$1</a>')
                .replace(/\{target="[^"]*"\}/g, '')
                .replace(/{target="_blank"}/g, '');

            const url = generateUrl(currentTitle);

            const newEntry = {
                title: currentTitle,
                guid: currentTitle,
                description: content,
                url: url,
                date: currentDate
            };

            const existingEntryIndex = oldFeedItems.findIndex(item => item.guid === newEntry.guid);

            if (existingEntryIndex === -1 || !entriesAreEqual(oldFeedItems[existingEntryIndex], newEntry)) {
                isContentChanged = true;
                feed.item(newEntry);

                if (existingEntryIndex !== -1) {
                    oldFeedItems.splice(existingEntryIndex, 1);
                }
            }
        }
    }

    // Write to file only if content has changed
    if (isContentChanged) {
        let newXMLContent = feed.xml({indent: true});
        const newLastBuildDate = new Date().toUTCString();
        newXMLContent = newXMLContent.replace(/<lastBuildDate>.*<\/lastBuildDate>/, `<lastBuildDate>${newLastBuildDate}</lastBuildDate>`);
        newXMLContent = newXMLContent.replace(/{target=&quot;_blank&quot;}/g, '');
        newXMLContent = newXMLContent.replace(/\.\.\/static\//g, 'https://fcp.cafe/static/');
        fs.writeFileSync('docs/rss.xml', newXMLContent);
    }
});