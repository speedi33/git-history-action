const core = require('@actions/core');
const bash = require('child_process');
const fs = require('fs');

const COLUMN_COLORS = {
    0: 'black',
    1: 'red',
    3: 'blue',
    5: 'green',
    7: 'yellow',
    'branchName': 'purple'
};

const gitLogLineMapper = (gitLogLine) => {
    const commitLine = gitLogLine.split(' - ');
    let gitLogLineHtml = '<div class="commit">';

    if (commitLine.length === 1) {
        const graphLine = commitLine[0];
        gitLogLineHtml += '<p>';
        for (let i = 0; i < graphLine.length; i++) {
            const currentChar = graphLine.charAt(i);
            console.log(`currentChar <${currentChar}>`);
            if (currentChar === '/' || currentChar === '\\') {
                gitLogLineHtml += `<span style="color:${COLUMN_COLORS[i]}">${currentChar}</span>`;
            } else {
                gitLogLineHtml += currentChar;
            }
        }
        gitLogLineHtml += '</p>';
    } else {
        const lastSpaceIndex = commitLine[0].trim().lastIndexOf(' ');
        let graph = commitLine[0].trim().substring(0, lastSpaceIndex);
        const commitId = commitLine[0].trim().substring(lastSpaceIndex + 1);
        const commitMessage = commitLine[1].trim();
        let commitAuthorAndDecoration = commitLine[2].trim();

        if (graph.length > 1) {
            // commit on branch
            const asteriskIndex = graph.indexOf('*');

            const graphWithoutAsterisk = graph.substring(0, asteriskIndex);
            // asterisk is always one column moved to the right, so -1 to get the actual index
            graph = `${graphWithoutAsterisk}<span style="color:${COLUMN_COLORS[asteriskIndex - 1]};">*</span>`;
        }

        gitLogLineHtml += `<p>${graph} </p>`;
        gitLogLineHtml += `<p>${commitId}</p>`;
        gitLogLineHtml += '<p> - </p>';
        gitLogLineHtml += `<p>${commitMessage}</p>`;
        gitLogLineHtml += '<p> - </p>';

        if (commitAuthorAndDecoration.includes(' ')) {
            // decoration (branch name) present
            const firstSpaceIndex = commitAuthorAndDecoration.indexOf(' ');
            const commitAuthor = commitAuthorAndDecoration.substring(0, firstSpaceIndex);
            const commitBranchName = commitAuthorAndDecoration.substring(firstSpaceIndex + 1);
            commitAuthorAndDecoration = `${commitAuthor} <span style="color: ${COLUMN_COLORS['branchName']};">${commitBranchName}</span>`;
        }
        gitLogLineHtml += `<p>${commitAuthorAndDecoration}</p>`;
    }
    gitLogLineHtml += '</div>';
    return gitLogLineHtml;
}

const writeIndexHtml = (gitLogLines, gitLogGraphDirectory) => {
    const graphString = gitLogLines.map(gitLogLineMapper).join('\n');
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<style>
h1 {
  color: blue;
  font-family: verdana;
  font-size: 300%;
}
.git-graph {
  font-weight: bold;
  font-family: courier;
  font-size: 160%;
}
.commit p {
    margin: 2px 0;
    display: inline;
}
</style>
</head>
<body>
<h1>Git Log Graph</h1>

<div class="git-graph">
${graphString}
</div>

</body>
</html>
    `;
    if (fs.existsSync(gitLogGraphDirectory)) {
        fs.rmSync(gitLogGraphDirectory, {recursive: true, force: true});
    }
    fs.mkdirSync(gitLogGraphDirectory);
    fs.writeFileSync(`${gitLogGraphDirectory}/index.html`, htmlContent);
}

const generateGitLogGraph = () => {
    const gitLogFile = 'git.log';
    bash.execSync(`git log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all > ${gitLogFile}`);
    const gitLog = bash.execSync(`cat ${gitLogFile}`).toString().trim();
    bash.execSync(`rm ${gitLogFile}`);
    return gitLog;
}

const main = () => {
    try {
        const gitLogGraphDirectory = core.getInput('upload-path');
        const gitLogGraph = generateGitLogGraph();
        writeIndexHtml(gitLogGraph.split('\n'), gitLogGraphDirectory);
    } catch (error) {
        core.setFailed(error.message);
    }
}

main();
