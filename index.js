const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');
const fs = require('fs');

const generateMermaidGitGraphString = (gitLogString) => {
    const gitLogLines = gitLogString.split('\n');
    let mermaidGitGraphString = 'gitGraph\n';
    for (const gitLogLine of gitLogLines) {
        const commitId = gitLogLine.substring(0, gitLogLine.indexOf(' '));
        mermaidGitGraphString += `  commit id: "${commitId}"\n`;
    }
    return mermaidGitGraphString;
}

const writeIndexHtml = (mermaidString) => {
    const htmlContent = `
    <h1>Hello</h1>

<pre class="mermaid">
%%{init: { 'logLevel': 'debug', 'theme': 'base', 'gitGraph': {'rotateCommitLabel': true}} }%%
gitGraph
  commit id: "feat(api): ..."
  commit id: "a"
  commit id: "b"
  commit id: "fix(client): .extra long label.."
  branch c2
  commit id: "feat(modules): ..."
  commit id: "test(client): ..."
  checkout main
  commit id: "fix(api): ..."
  commit id: "ci: ..."
  branch b1
  commit
  branch b2
  commit
</pre>

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
  bash.execSync(`git log --pretty=oneline --all --reflog --decorate --reverse --pretty=format:"%h %s @%d"> ${gitLogFile}`);
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
