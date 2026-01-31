/**
 * Git Utilities
 * Functions for working with git diffs and file changes
 */

import { spawn } from 'node:child_process';

/**
 * Validate a git ref (commit hash, branch name, HEAD, etc.)
 * Prevents potential injection of malicious arguments
 */
function isValidGitRef(ref: string): boolean {
  if (!ref || ref.length === 0 || ref.length > 256) {
    return false;
  }
  // Allow: alphanumeric, /, _, -, ., ^, ~, @, :
  // This covers: SHA hashes, branch names, HEAD, HEAD~1, HEAD^, origin/main, etc.
  return /^[a-zA-Z0-9/_.\-^~@:]+$/.test(ref);
}

export interface GitDiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string; // For renamed files
}

export interface GitDiffResult {
  success: boolean;
  files: GitDiffFile[];
  error?: string;
}

/**
 * Execute a git command and return stdout
 */
async function execGit(args: string[], cwd: string): Promise<{ stdout: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', error: err.message });
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout });
      } else {
        resolve({ stdout: '', error: stderr || `git exited with code ${code}` });
      }
    });
  });
}

/**
 * Check if we're in a git repository
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execGit(['rev-parse', '--git-dir'], cwd);
  return !result.error;
}

/**
 * Get list of staged files
 */
export async function getStagedFiles(cwd: string): Promise<GitDiffResult> {
  const result = await execGit(['diff', '--cached', '--name-status'], cwd);

  if (result.error) {
    return { success: false, files: [], error: result.error };
  }

  return { success: true, files: parseNameStatus(result.stdout) };
}

/**
 * Get list of files changed in a commit
 */
export async function getCommitFiles(commit: string, cwd: string): Promise<GitDiffResult> {
  if (!isValidGitRef(commit)) {
    return { success: false, files: [], error: `Invalid git ref: ${commit}` };
  }

  const result = await execGit(['diff-tree', '--no-commit-id', '--name-status', '-r', commit], cwd);

  if (result.error) {
    return { success: false, files: [], error: result.error };
  }

  return { success: true, files: parseNameStatus(result.stdout) };
}

/**
 * Get list of files changed between two refs
 */
export async function getDiffFiles(
  fromRef: string,
  toRef: string,
  cwd: string
): Promise<GitDiffResult> {
  if (!isValidGitRef(fromRef)) {
    return { success: false, files: [], error: `Invalid git ref: ${fromRef}` };
  }
  if (!isValidGitRef(toRef)) {
    return { success: false, files: [], error: `Invalid git ref: ${toRef}` };
  }

  const result = await execGit(['diff', '--name-status', fromRef, toRef], cwd);

  if (result.error) {
    return { success: false, files: [], error: result.error };
  }

  return { success: true, files: parseNameStatus(result.stdout) };
}

/**
 * Get list of unstaged changed files (working tree)
 */
export async function getUnstagedFiles(cwd: string): Promise<GitDiffResult> {
  const result = await execGit(['diff', '--name-status'], cwd);

  if (result.error) {
    return { success: false, files: [], error: result.error };
  }

  return { success: true, files: parseNameStatus(result.stdout) };
}

/**
 * Get all changed files (staged + unstaged)
 */
export async function getAllChangedFiles(cwd: string): Promise<GitDiffResult> {
  const [staged, unstaged] = await Promise.all([getStagedFiles(cwd), getUnstagedFiles(cwd)]);

  if (!staged.success) {
    return staged;
  }
  if (!unstaged.success) {
    return unstaged;
  }

  // Merge and deduplicate
  const fileMap = new Map<string, GitDiffFile>();
  for (const file of [...staged.files, ...unstaged.files]) {
    fileMap.set(file.path, file);
  }

  return { success: true, files: Array.from(fileMap.values()) };
}

/**
 * Parse git diff --name-status output
 */
function parseNameStatus(output: string): GitDiffFile[] {
  const files: GitDiffFile[] = [];
  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const parts = line.split('\t');
    const statusCode = parts[0];
    const path = parts[1];

    if (!path) continue;

    let status: GitDiffFile['status'];
    let oldPath: string | undefined;

    if (statusCode.startsWith('R')) {
      // Renamed: R100	old-path	new-path
      status = 'renamed';
      oldPath = path;
      // The new path is in parts[2] for renames
      if (parts[2]) {
        files.push({ path: parts[2], status, oldPath });
        continue;
      }
    } else if (statusCode === 'A') {
      status = 'added';
    } else if (statusCode === 'D') {
      status = 'deleted';
    } else {
      status = 'modified';
    }

    files.push({ path, status, oldPath });
  }

  return files;
}

/**
 * Get the commit message for a commit
 */
export async function getCommitMessage(commit: string, cwd: string): Promise<string | null> {
  if (!isValidGitRef(commit)) {
    return null;
  }
  const result = await execGit(['log', '-1', '--format=%B', commit], cwd);
  return result.error ? null : result.stdout.trim();
}
