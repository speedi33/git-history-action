const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');
const fs = require('fs');

let featureBranchCounter = 0;

const isSpecialLine = (gitLogLine, indicator) => {
    if (gitLogLine.startsWith(indicator)) {
        return true;
    } else if (gitLogLine.startsWith('| ')) {
        return isCommitLine(gitLogLine.substring(2));
    } else {
        return false;
    }
}

const isCommitLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '*');
}

const isBranchLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '|/');
}

const isMergeLine = (gitLogLine) => {
    return isSpecialLine(gitLogLine, '|\\');
}

const tryToGetBranchNameFromNextLine = (nextGitLogLine) => {
    const branchNamePrefix = '(';
    const branchNameSuffix = ')';
    if (nextGitLogLine.includes(branchNamePrefix) && nextGitLogLine.includes(branchNameSuffix)) {
        const branchNameStartIndex = nextGitLogLine.lastIndexOf(branchNamePrefix) + 1;
        const branchNameEndIndex = nextGitLogLine.lastIndexOf(branchNameSuffix);
        return nextGitLogLine.substring(branchNameStartIndex, branchNameEndIndex);
    } else {
        return 'feature_branch';
    }
}

const generateMermaidGitGraphString = (gitLogString) => {
    const gitLogLines = gitLogString.split('\n').slice().reverse();
    let mermaidGitGraphString = 'gitGraph\n';
    let branchName;
    gitLogLines.forEach((gitLogLine, index) => {
        console.log(`>>>${gitLogLine}<<<`);
        if (isCommitLine(gitLogLine)) {
            const gitLogLineWithoutAsterisk = gitLogLine.split('*')[1];
            const commitDetails = gitLogLineWithoutAsterisk.split('-');
            const commitId = commitDetails[0].trim();
            if (index > 0 && isMergeLine(gitLogLines[index - 1])) {
                mermaidGitGraphString += `  merge ${branchName} id: "${commitId}"\n`;
            } else {
                mermaidGitGraphString += `  commit id: "${commitId}"\n`;
            }
        } else if (isBranchLine(gitLogLine)) {
            branchName = tryToGetBranchNameFromNextLine(gitLogLines[index + 1]);
            mermaidGitGraphString += `  branch ${branchName}\n  checkout ${branchName}\n`;
        } else if (isMergeLine(gitLogLine)) {
            mermaidGitGraphString += '  checkout main';
        }
    });
    return mermaidGitGraphString;
}

const writeIndexHtml = (mermaidString) => {
    const htmlContent = `
    <h1>Hello</h1>
<pre class="mermaid">
%%{init: { 'logLevel': 'debug', 'theme': 'base', 'gitGraph': {'rotateCommitLabel': true}} }%%
${mermaidString}
</pre>

<script type="module">
  import mermaid from 'https://unpkg.com/mermaid@9/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>
    `;

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
  console.log(`Your Git Log:\n${gitLog}`);
  const mermaidGitGraphString = generateMermaidGitGraphString(gitLog);
  console.log(`Your Mermaid string:\n${mermaidGitGraphString}`);
  writeIndexHtml(mermaidGitGraphString);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
