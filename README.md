# Git Log Graph action

This action creates a HTML page of your repository's Git log. 
It is intended to be used in a workflow that automatically deploys a static HTML page to GitHub Pages. 
See also example usage below.

**Note** Your checkout action must specify `fetch-depth: 0`!

## Inputs

### `upload-path`

**Required** The path where the HTML file is generated. Should match the path specified in the `Upload artifacts` step. Default `"git-log-path"`.

## Example usage

```yaml
# Simple workflow for deploying static content to GitHub Pages
name: Publish Git Log Graph to GitHub Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches: ["master"]

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment
concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  # Single deploy job since we're just deploying
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - name: Provide Git Log Graph
        uses: speedi33/git-log-graph-action@main
        with:
          upload-path: './git-log-graph'
      - name: Setup Pages
        uses: actions/configure-pages@v2
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v1
        with:
          path: './git-log-graph'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v1
```
