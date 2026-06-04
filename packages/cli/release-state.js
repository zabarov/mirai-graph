#!/usr/bin/env node

const fs = require("fs");
const https = require("https");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8"
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim()
  };
}

function getJson(url) {
  return new Promise((resolve) => {
    const request = https.get(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "mirai-graph-release-state"
      }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode === 404) {
          resolve({ status_code: 404, found: false, body: null });
          return;
        }
        if ((response.statusCode || 0) >= 400) {
          resolve({
            status_code: response.statusCode,
            found: false,
            error: `http_${response.statusCode}`
          });
          return;
        }
        try {
          resolve({
            status_code: response.statusCode,
            found: true,
            body: JSON.parse(body)
          });
        } catch (error) {
          resolve({
            status_code: response.statusCode,
            found: false,
            error: "invalid_json"
          });
        }
      });
    });
    request.on("error", (error) => {
      resolve({ status_code: null, found: false, error: error.code || error.message });
    });
    request.setTimeout(15000, () => {
      request.destroy();
      resolve({ status_code: null, found: false, error: "timeout" });
    });
  });
}

function loadPackage() {
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return {
    name: packageJson.name,
    version: packageJson.version,
    repository: packageJson.repository && packageJson.repository.url,
    path: "package.json"
  };
}

function parseGitHubRepo(repositoryUrl) {
  if (!repositoryUrl) {
    return null;
  }
  const match = repositoryUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, "")
  };
}

async function buildState(options = {}) {
  const pkg = loadPackage();
  const tag = `v${pkg.version}`;
  const requireGitTag = Boolean(options.requireGitTag || options.requireGithubRelease || options.requireNpmPublished);
  const requireGithubRelease = Boolean(options.requireGithubRelease || options.requireNpmPublished);
  const blockers = [];
  const warnings = [];

  const head = run("git", ["rev-parse", "HEAD"]);
  const tagCommit = run("git", ["rev-parse", `${tag}^{}`]);
  const status = run("git", ["status", "--short", "--branch", "--untracked-files=all"]);

  const npmAuth = run("npm", ["whoami"]);
  const npmRegistry = await getJson(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`);
  const npmPackage = {
    registry_url: `https://registry.npmjs.org/${pkg.name}`,
    found: npmRegistry.found,
    status_code: npmRegistry.status_code,
    latest: null,
    version_published: false,
    error: npmRegistry.error || null
  };

  if (npmRegistry.found && npmRegistry.body) {
    npmPackage.latest = npmRegistry.body["dist-tags"] && npmRegistry.body["dist-tags"].latest || null;
    npmPackage.version_published = Boolean(npmRegistry.body.versions && npmRegistry.body.versions[pkg.version]);
  }

  const npm = {
    authenticated: npmAuth.status === 0,
    whoami: npmAuth.status === 0 ? npmAuth.stdout : null,
    auth_error: npmAuth.status === 0 ? null : classifyNpmAuthError(npmAuth.stderr || npmAuth.stdout),
    package: npmPackage
  };

  if (!npm.authenticated) {
    blockers.push({
      id: "npm_auth_missing",
      severity: "publish_blocker",
      message: "npm publish requires npm login or an owner-approved npm token."
    });
  }
  if (!npmPackage.version_published) {
    blockers.push({
      id: "npm_package_version_not_published",
      severity: options.requireNpmPublished ? "release_blocker" : "publication_pending",
      message: `${pkg.name}@${pkg.version} is not published on npm.`
    });
  }

  const githubRepo = parseGitHubRepo(pkg.repository);
  let githubRelease = {
    repository: githubRepo,
    tag,
    found: false,
    url: null,
    draft: null,
    prerelease: null,
    error: githubRepo ? null : "repository_not_github"
  };

  if (githubRepo) {
    const release = await getJson(`https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}/releases/tags/${tag}`);
    githubRelease = {
      repository: githubRepo,
      tag,
      found: release.found,
      status_code: release.status_code,
      url: release.body && release.body.html_url || null,
      name: release.body && release.body.name || null,
      draft: release.body ? Boolean(release.body.draft) : null,
      prerelease: release.body ? Boolean(release.body.prerelease) : null,
      error: release.error || null
    };
  }

  if (head.status !== 0) {
    blockers.push({ id: "git_head_unavailable", severity: "release_blocker", message: "Cannot resolve git HEAD." });
  }
  if (tagCommit.status !== 0) {
    blockers.push({
      id: "git_tag_missing",
      severity: requireGitTag ? "release_blocker" : "release_pending",
      message: `Local tag ${tag} is missing.`
    });
  }
  if (!githubRelease.found) {
    blockers.push({
      id: "github_release_missing",
      severity: requireGithubRelease ? "release_blocker" : "release_pending",
      message: `GitHub Release ${tag} is missing.`
    });
  }
  if (status.stdout.includes("\n")) {
    warnings.push({
      id: "working_tree_has_changes",
      message: "Working tree has local changes; release state is still reportable but should not be published until clean."
    });
  }

  const fatalBlockers = blockers.filter((blocker) => blocker.severity === "release_blocker");
  const valid = fatalBlockers.length === 0;

  return {
    report_type: "mirai_graph_release_state",
    valid,
    generated_at: new Date().toISOString(),
    package: pkg,
    git: {
      head: head.status === 0 ? head.stdout : null,
      tag,
      tag_commit: tagCommit.status === 0 ? tagCommit.stdout : null,
      tag_exists: tagCommit.status === 0,
      status: status.stdout
    },
    github_release: githubRelease,
    npm,
    blockers,
    warnings,
    boundary: [
      "This report does not publish npm packages, create tags or mutate GitHub releases.",
      "Pre-tag release-state checks may report git tag and GitHub Release as release_pending.",
      "Missing npm authentication is a publish blocker, not a reason to expose tokens.",
      "A release-state report is evidence, not release authorization."
    ]
  };
}

function classifyNpmAuthError(output) {
  if (output.includes("ENEEDAUTH")) {
    return "ENEEDAUTH";
  }
  if (output.includes("E401")) {
    return "E401";
  }
  if (output.includes("not logged in")) {
    return "not_logged_in";
  }
  return "unknown";
}

function renderMarkdown(state) {
  const lines = [];
  lines.push("# Mirai Graph Release State");
  lines.push("");
  lines.push(`Generated: ${state.generated_at}`);
  lines.push(`Valid for release-state check: \`${state.valid}\``);
  lines.push("");
  lines.push("## Package");
  lines.push("");
  lines.push(`- Name: \`${state.package.name}\``);
  lines.push(`- Version: \`${state.package.version}\``);
  lines.push(`- Repository: \`${state.package.repository}\``);
  lines.push("");
  lines.push("## Git");
  lines.push("");
  lines.push(`- HEAD: \`${state.git.head || "unavailable"}\``);
  lines.push(`- Tag: \`${state.git.tag}\``);
  lines.push(`- Tag exists: \`${state.git.tag_exists}\``);
  lines.push("");
  lines.push("## GitHub Release");
  lines.push("");
  lines.push(`- Found: \`${state.github_release.found}\``);
  lines.push(`- URL: ${state.github_release.url || "n/a"}`);
  lines.push(`- Draft: \`${state.github_release.draft}\``);
  lines.push(`- Prerelease: \`${state.github_release.prerelease}\``);
  lines.push("");
  lines.push("## NPM Package");
  lines.push("");
  lines.push(`- Registry found: \`${state.npm.package.found}\``);
  lines.push(`- Version published: \`${state.npm.package.version_published}\``);
  lines.push(`- Latest: \`${state.npm.package.latest || "n/a"}\``);
  lines.push(`- Authenticated: \`${state.npm.authenticated}\``);
  lines.push(`- Auth error: \`${state.npm.auth_error || "n/a"}\``);
  lines.push("");
  lines.push("## Blockers");
  lines.push("");
  if (state.blockers.length === 0) {
    lines.push("- None.");
  } else {
    for (const blocker of state.blockers) {
      lines.push(`- \`${blocker.id}\` (${blocker.severity}): ${blocker.message}`);
    }
  }
  lines.push("");
  lines.push("## Warnings");
  lines.push("");
  if (state.warnings.length === 0) {
    lines.push("- None.");
  } else {
    for (const warning of state.warnings) {
      lines.push(`- \`${warning.id}\`: ${warning.message}`);
    }
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  for (const item of state.boundary) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const markdown = args.includes("--markdown");
  const requireNpmPublished = args.includes("--require-npm-published");
  const requireGitTag = args.includes("--require-git-tag");
  const requireGithubRelease = args.includes("--require-github-release");
  const state = await buildState({ requireNpmPublished, requireGitTag, requireGithubRelease });
  if (markdown) {
    process.stdout.write(renderMarkdown(state));
  } else {
    process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  }
  if (!state.valid || (requireNpmPublished && !state.npm.package.version_published)) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildState,
  renderMarkdown
};
