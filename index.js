const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');
const fs = require('fs');

const generateMermaidGitGraphString = (gitLogString) => {
    const gitLogLines = gitLogString.split('\n');
    let mermaidGitGraphString = 'gitGraph\n';
    for (const gitLogLine of gitLogLines) {
        const commitDetails = gitLogLine.split('||');
        console.log(`gitLogLine: <<<<${gitLogLine}>>>>`);
        console.log(`mermaidString: <<<<${mermaidGitGraphString}>>>>`);
        const commitId = commitDetails[0];
        const commitParentIds = commitDetails[1];
        if (commitParentIds && commitParentIds.includes(' ')) {
            const firstParentCommitId = commitParentIds.split(' ')[0];
            mermaidGitGraphString = mermaidGitGraphString.replace(
                `  commit id: "${firstParentCommitId}"\n`, 
                `  commit id: "${firstParentCommitId}"\n  branch feature_branch\n  checkout feature_branch\n`);
            mermaidGitGraphString += `  merge feature_branch id: "${commitId}"\n`
        } else {
            mermaidGitGraphString += `  commit id: "${commitId}"\n`;
        }
    }
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
  bash.execSync(`git log --pretty=oneline --all --reflog --decorate --reverse --pretty=format:"%h||%p||%s||%d" > ${gitLogFile}`);
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
