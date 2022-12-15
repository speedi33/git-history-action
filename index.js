const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');
const fs = require('fs');

let featureBranchCounter = 0;

const isSpecialLine = (gitLogLine, indicator) => {
    if (gitLogLine.startsWith(indicator)) {
        return true;
    } else if (gitLogLine.startsWith('| ')) {
        return isSpecialLine(gitLogLine.substring(2), indicator);
    } else {
        return false;
    }
}

const isCommitLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '*');
}

const isBranchLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '|\\');
}

const isMergeLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '|/');
}

const getBranchNameFromNextLine = (nextGitLogLine) => {
    const branchNamePrefix = '(';
    const branchNameSuffix = ')';
    if (nextGitLogLine.includes(branchNamePrefix) && nextGitLogLine.includes(branchNameSuffix)) {
        const branchNameStartIndex = nextGitLogLine.lastIndexOf(branchNamePrefix) + 1;
        const branchNameEndIndex = nextGitLogLine.lastIndexOf(branchNameSuffix);
        return nextGitLogLine.substring(branchNameStartIndex, branchNameEndIndex);
    } else {
        featureBranchCounter++;
        return `feature_branch_${featureBranchCounter}`;
    }
}

const reverseLogLines = (gitLogLines) => {
    const reversedLogLines = [];
    for (let i = gitLogLines.length - 1; i >= 0; i--) {
        const gitLogLine = gitLogLines[i];
        if (gitLogLine.startsWith('|')) {
            reversedLogLines.push(gitLogLine.includes('/') ? gitLogLine.replace('/', '\\') : gitLogLine.replace('\\', '/'));
        } else {
            reversedLogLines.push(gitLogLine);
        }
    }
    return reversedLogLines;
}

const branchIndexOfLine = (gitLogLine) => {
    return gitLogLine.indexOf('*');
}

const branchNameOfLine = (gitLogLine) => {
    const gitLogLineElements = gitLogLine.split(' - ');
    const commitAuthorAndDecoration = gitLogLineElements[gitLogLineElements.length - 1];
    const branchNamePrefix = '(';
    const branchNameSuffix = ')';
    let branchName;
    if (commitAuthorAndDecoration.includes(branchNamePrefix) && commitAuthorAndDecoration.includes(branchNameSuffix)) {
        const branchNameStartIndex = commitAuthorAndDecoration.lastIndexOf(branchNamePrefix) + 1;
        const branchNameEndIndex = commitAuthorAndDecoration.lastIndexOf(branchNameSuffix);
        branchName = commitAuthorAndDecoration.substring(branchNameStartIndex, branchNameEndIndex);
    }
    return branchName;
}

const searchBranchNameForBranchLine = (branchLine, gitLogLines) => {
    let branchName = 'feature_branch';
    let branchIndex = branchLine.indexOf('\\') + 1; // since '\' opens a branch, branch index is 1 more
    
    let nextLine = gitLogLines[gitLogLines.indexOf(branchLine) + 1];
    while (!isMergeLine(nextLine) && branchIndexOfLine(nextLine) === branchIndex) {
        branchName = branchNameOfLine(nextLine);
        nextLine = gitLogLines[gitLogLines.indexOf(nextLine) + 1];
    }
    return branchName;
}

const generateMermaidGitGraphString = (gitLogString) => {
    const gitLogLines = reverseLogLines(gitLogString.split('\n'));
    let mermaidGitGraphString = 'gitGraph\n';
    let branchName;
    let previousBranchIndex;



    gitLogLines.forEach((gitLogLine, index) => {
        console.log(`>>>${gitLogLine}<<< commit line? ${isCommitLine(gitLogLine)}`);
        if (isCommitLine(gitLogLine)) {
            const branchIndex = gitLogLine.indexOf('*');
            const gitLogLineWithoutAsterisk = gitLogLine.split('*')[1];
            const commitDetails = gitLogLineWithoutAsterisk.split('-');
            const commitId = commitDetails[0].trim();
            if (index > 0 && isMergeLine(gitLogLines[index - 1])) {
                mermaidGitGraphString += `merge ${branchName} id: "${commitId}"\n`;
            } else {
                if (previousBranchIndex && previousBranchIndex !== branchIndex) {
                    mermaidGitGraphString += 'checkout main\n';
                }
                mermaidGitGraphString += `commit id: "${commitId}"\n`;
            }
            previousBranchIndex = gitLogLine.indexOf('*');
        } else if (isBranchLine(gitLogLine)) {
            branchName = searchBranchNameForBranchLine(gitLogLine, gitLogLines);
            if (!branchName.includes('HEAD -> master')) { // feature branch commits newer than master commits
                const gitLogLineWithoutAsterisk = nextGitLogLine.split('*')[1];
                const commitDetails = gitLogLineWithoutAsterisk.split('-');
                const commitId = commitDetails[0].trim();
                mermaidGitGraphString += `commit id: "${commitId}"\n`;
            }
            mermaidGitGraphString += `branch ${branchName}\ncheckout ${branchName}\n`;
        } else if (isMergeLine(gitLogLine)) {
            mermaidGitGraphString += 'checkout main\n';
        } else {
            console.error(`Could not parse Git log line: <${gitLogLine}>`);
        }
    });

    /*
    for (let i = gitLogLines.length - 1; i >= 0; i--) {
        const gitLogLine = gitLogLines[i];
        console.log(`>>>${gitLogLine}<<<`);
        if (isCommitLine(gitLogLine)) {
            const gitLogLineWithoutAsterisk = gitLogLine.split('*')[1];
            const commitDetails = gitLogLineWithoutAsterisk.split('-');
            const commitId = commitDetails[0].trim();
            if (i < gitLogLines.length - 1 && isMergeLine(gitLogLines[i + 1])) {
                mermaidGitGraphString += `  merge ${branchName} id: "${commitId}"\n`;
            } else {
                mermaidGitGraphString += `  commit id: "${commitId}"\n`;
            }
        } else {
            const reversedGitLogLine = gitLogLine.includes('/') ? gitLogLine.replace('/', '\\') : gitLogLine.replace('\\', '/');
            if (isBranchLine(reversedGitLogLine)) {
                branchName = tryToGetBranchNameFromNextLine(gitLogLines[i + 1]);
                mermaidGitGraphString += `  branch ${branchName}\n  checkout ${branchName}\n`;
            } else if (isMergeLine(reversedGitLogLine)) {
                mermaidGitGraphString += '  checkout main\n';
            }
        }
    }
    */
    return mermaidGitGraphString;
}

const commitIdFromFromLine = (gitLogLine) => {
    let commitId = 'none'; // for none-commit lines
    if (gitLogLine.includes('*')) {
        commitId = gitLogLine.split('*')[1].split(' - ')[0].trim();
    }
    return commitId;
}

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

const writeIndexHtml = (gitLogLines) => {
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
    const gitLogGraphDirectory = 'git-log-graph';
    if (fs.existsSync(gitLogGraphDirectory)) {
        fs.rmSync(gitLogGraphDirectory, {recursive: true, force: true});
    }
    fs.mkdirSync(gitLogGraphDirectory);
    fs.writeFileSync(`${gitLogGraphDirectory}/index.html`, htmlContent);
}

try {
  const gitLogFile = 'git.log';
  bash.execSync(`git log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all > ${gitLogFile}`);
  const gitLog = bash.execSync(`cat ${gitLogFile}`).toString().trim();
  bash.execSync(`rm ${gitLogFile}`);
  writeIndexHtml(gitLog.split('\n'));
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
