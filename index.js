const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');

const splitAtFirstOccurrence = (string, delimiter) => {
    return string.substring(string.indexOf(delimiter) + 1);
}

const generateMermaidGitGraphString = (gitLogString) => {
    const gitLogLines = gitLogString.split('\n');
    let mermaidGitGraphString = 'gitGraph\n';
    for (const gitLogLine in gitLogLines) {
        const commitId = splitAtFirstOccurrence(gitLogLine, ' ');
        mermaidGitGraphString += `commit id: "${commitId}"\n`;
    }
    return mermaidGitGraphString;
}

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  const gitLogFile = 'git.log';
  console.log(`Hello ${nameToGreet}!`);
  bash.execSync(`git log --pretty=oneline --all --reflog --decorate --reverse --pretty=format:"%h %s @%d"> ${gitLogFile}`);
  const gitLog = bash.execSync(`cat ${gitLogFile}`).toString().trim();
  bash.execSync(`rm ${gitLogFile}`);
  console.log(`Your Git Log:\n${gitLog}`);
  console.log(`Your Mermaid string:\n${generateMermaidGitGraphString(gitLog)}`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
