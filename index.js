const core = require('@actions/core');
const github = require('@actions/github');
const bash = require('child_process');

try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
  const gitLogFile = 'git.log';
  console.log(`Hello ${nameToGreet}!`);
  bash.execSync(`git log --pretty=oneline --all --reflog > ${gitLogFile}`);
  const gitLog = bash.execSync(`cat ${gitLogFile}`).toString().trim();
  bash.execSync(`rm ${gitLogFile}`);
  console.log(`Your Git Log:\n${gitLog}`);
  const time = (new Date()).toTimeString();
  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
