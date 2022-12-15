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

const commitIdFromMessage = (commitMessage, gitLogLines) => {
    for (const gitLogLine of gitLogLines) {
        if (gitLogLine.toLowerCase().includes(commitMessage)) {
            return commitIdFromFromLine(gitLogLine);
        }
    }
}

const writeIndexHtml = (gitLogLines) => {
    const graphString = gitLogLines.map(gitLogLine => `<p id="${commitIdFromFromLine(gitLogLine)}">${gitLogLine}</p>`).join('\n');
    let htmlContent = fs.readFileSync('index.html');
    htmlContent.replace('GRAPH_STRING', graphString);
    if (fs.existsSync('docs')) {
        fs.rmSync('docs', {recursive: true, force: true});
    }
    fs.mkdirSync('docs');
    fs.writeFileSync('docs/index.html', htmlContent);
}

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  const gitLogFile = 'git.log';
  console.log(`Hello ${nameToGreet}!`);
  bash.execSync(`git log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all > ${gitLogFile}`);
  const gitLog = bash.execSync(`cat ${gitLogFile}`).toString().trim();
  bash.execSync(`rm ${gitLogFile}`);
  console.log(`Your Mermaid string:\n${mermaidGitGraphString}`);
  writeIndexHtml(gitLog.split('\n'));
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
