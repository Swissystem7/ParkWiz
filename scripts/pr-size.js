#!/usr/bin/env node
// Report how many lines a branch changes and, when it is over the auto_merger
// budget, print a split plan.
//
//   node scripts/pr-size.js                      # HEAD vs origin/master
//   node scripts/pr-size.js --base master --check # exit 1 when over budget
//   git diff --numstat master...HEAD | node scripts/pr-size.js --stdin
const { execFileSync } = require('node:child_process');
const prSize = require('../src/lib/pr-size');

function flag(argv, name) {
  return argv.includes('--' + name);
}

function option(argv, name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function defaultBase() {
  try {
    git(['rev-parse', '--verify', '--quiet', 'origin/master']);
    return 'origin/master';
  } catch {
    return 'master';
  }
}

function main(argv) {
  const limit = Number(option(argv, 'limit', process.env.PR_SIZE_LIMIT || prSize.LIMIT));
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('pr-size: --limit must be a positive number');
    return 2;
  }

  let numstat;
  if (flag(argv, 'stdin')) {
    numstat = require('node:fs').readFileSync(0, 'utf8');
  } else {
    const base = option(argv, 'base', defaultBase());
    const head = option(argv, 'head', 'HEAD');
    try {
      numstat = git(['diff', '--numstat', `${base}...${head}`]);
    } catch (err) {
      console.error(`pr-size: cannot diff ${base}...${head} — ${err.message.trim()}`);
      return 2;
    }
    console.log(`Comparing ${base}...${head}`);
  }

  const plan = prSize.planSplit(prSize.parseNumstat(numstat), { limit });
  console.log(prSize.formatPlan(plan));
  return flag(argv, 'check') && plan.total > limit ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
