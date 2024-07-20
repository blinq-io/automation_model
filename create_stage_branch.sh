#!/bin/bash

# Function to print usage
usage() {
  exit 1
}


# Get the current branch name if not provided
SOURCE_BRANCH=$(git symbolic-ref --short HEAD)

# Set default target branch if not provided
TARGET_BRANCH="${SOURCE_BRANCH}_stage"

# Check if on a branch
if [ -z "$SOURCE_BRANCH" ]; then
  echo "You are not on any branch. Please switch to a branch and try again."
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "You have uncommitted changes. Please commit or stash them before running this script."
  exit 1
fi

# Fetch the latest branches
git fetch origin || { echo "Failed to fetch from origin"; exit 1; }

# Check if 'stage' branch exists
if ! git show-ref --verify --quiet refs/heads/stage; then
  echo "Branch 'stage' does not exist. Exiting."
  exit 1
fi

# Create a new branch from 'stage'
git checkout stage || { echo "Failed to checkout 'stage'"; exit 1; }
git checkout -b $TARGET_BRANCH || { echo "Failed to create and checkout '$TARGET_BRANCH'"; exit 1; }

# Switch to the 'dev' branch and update it
git checkout dev || { echo "Failed to checkout 'dev'"; exit 1; }
git pull origin dev || { echo "Failed to pull 'dev'"; exit 1; }
git rebase origin/dev || { echo "Failed to rebase 'dev'"; exit 1; }

# Check if the source branch exists
if ! git show-ref --verify --quiet refs/heads/$SOURCE_BRANCH; then
  echo "Branch $SOURCE_BRANCH does not exist. Exiting."
  exit 1
fi

# Get the list of commits to cherry-pick
COMMITS=$(git log --pretty=format:"%h" dev..$SOURCE_BRANCH)

# Cherry-pick the commits to the new branch
git checkout $TARGET_BRANCH || { echo "Failed to checkout '$TARGET_BRANCH'"; exit 1; }
for commit in $COMMITS; do
  git cherry-pick $commit
  if [ $? -ne 0 ]; then
    echo "Conflict occurred during cherry-pick of commit $commit."
    echo "Please resolve the conflict manually, then run:"
    echo "  git cherry-pick --continue"
    echo "If you want to abort the cherry-pick, run:"
    echo "  git cherry-pick --abort"
    exit 1
  fi
done

echo "All commits from $SOURCE_BRANCH have been cherry-picked to $TARGET_BRANCH."
