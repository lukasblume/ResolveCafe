const fs = require('fs');
const path = require('path');
const { PAGE_NAME } = process.env;

const directoryPath = path.join(process.env.GITHUB_WORKSPACE, `docs/_includes/${PAGE_NAME}`);
const outputFile = path.join(process.env.GITHUB_WORKSPACE, `docs/_includes/generated-${PAGE_NAME}.md`);

try {
    fs.readdir(directoryPath, function (err, files) {
        if (err) {
            throw new Error('Unable to scan directory: ' + err);
        }

        let fileContent = '';
        let lastInitial = '';

        // Sort files array to guarantee alphabetical order
        files.sort();

        files.forEach(function (file, index) {
            // Ignore if not a markdown file
            if(path.extname(file) !== '.md') return;

            // Removing file extension for include command
            const fileNameWithoutExtension = path.parse(file).name;

            // Extract first character of the file name
            const currentInitial = fileNameWithoutExtension.charAt(0).toUpperCase();

            // If current initial is different from last initial, then add a new section
            if (currentInitial !== lastInitial) {
                // Add '---' for the new section except the first
                if (lastInitial !== '') {
                    fileContent += '\n---\n\n';
                }

                fileContent += `## ${currentInitial}\n\n`;
                lastInitial = currentInitial;
            }

            fileContent += `{{ include "${PAGE_NAME}/${fileNameWithoutExtension}" }}\n`;

            // Add '---' separator if the next file is not of the same initial
            if (index !== files.length - 1) {
                const nextFileNameWithoutExtension = path.parse(files[index+1]).name;
                const nextInitial = nextFileNameWithoutExtension.charAt(0).toUpperCase();

                if (currentInitial === nextInitial) {
                    fileContent += '\n---\n\n';
                }
            }
        });

        // Remove the last extra lines
        fileContent = fileContent.replace(/\n$/, '');

        // Write to the output file
        try {
            fs.writeFileSync(outputFile, fileContent);
            console.log(`Successfully written to ${outputFile}`);
        } catch (err) {
            throw new Error('Unable to write to file: ' + err);
        }
    });
} catch (err) {
    console.error(err);
}