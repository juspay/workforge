# Git Worktree Creator - Installation Guide

## Quick Installation Options

### 🚀 Option 1: Global NPM Package (Recommended)

**Best for**: Regular use across multiple projects

```bash
# Install globally
npm install -g git-worktree-creator

# Use anywhere in any Git repository
create-worktree --type feat --name my-feature
# or
git-worktree --type feat --name my-feature
```

**Advantages:**
- ✅ Available system-wide
- ✅ Automatic updates via `npm update -g`
- ✅ Full TypeScript support
- ✅ All dependencies managed

---

### 📦 Option 2: Standalone Executable

**Best for**: No npm dependencies, single file solution

#### Download and Install:

```bash
# Download the standalone script
curl -L -o create-worktree https://raw.githubusercontent.com/yourusername/git-worktree-creator/main/create-worktree-standalone.js

# Make it executable
chmod +x create-worktree

# Move to a directory in your PATH
sudo mv create-worktree /usr/local/bin/

# Test installation
create-worktree --help
```

#### Or manual installation:

1. **Copy the standalone script** from `/Users/sachinsharma/Developer/temp/create-worktree-standalone.js`
2. **Save it** as `create-worktree` (without extension)
3. **Make executable**: `chmod +x create-worktree`
4. **Move to PATH**: `mv create-worktree /usr/local/bin/`

**Advantages:**
- ✅ Zero dependencies
- ✅ Single file solution
- ✅ No npm required
- ✅ Works anywhere Node.js is installed

---

### 🏠 Option 3: Project-Specific Installation

**Best for**: Team projects with consistent tooling

```bash
# In your project directory
npm install --save-dev git-worktree-creator

# Add to package.json scripts
{
  "scripts": {
    "worktree": "create-worktree",
    "feat": "create-worktree --type feat --name",
    "fix": "create-worktree --type fix --name"
  }
}

# Usage
npm run worktree -- --type feat --name user-auth
npm run feat user-auth
npm run fix memory-leak
```

**Advantages:**
- ✅ Version locked per project
- ✅ Team consistency
- ✅ Easy npm script integration
- ✅ No global installation needed

---

### 🔧 Option 4: Development Installation

**Best for**: Contributing to the tool or customization

```bash
# Clone/copy the source
mkdir git-worktree-creator
cd git-worktree-creator

# Copy package.json and source files from:
# /Users/sachinsharma/Developer/temp/git-worktree-creator/

# Install dependencies
npm install

# Build
npm run build

# Link globally for development
npm link

# Test
create-worktree --help
```

---

## Platform-Specific Instructions

### macOS

```bash
# Option 1: NPM (recommended)
npm install -g git-worktree-creator

# Option 2: Homebrew (if you create a formula)
# brew install git-worktree-creator

# Option 3: Manual
curl -L -o /usr/local/bin/create-worktree https://example.com/create-worktree-standalone.js
chmod +x /usr/local/bin/create-worktree
```

### Linux

```bash
# Option 1: NPM
npm install -g git-worktree-creator

# Option 2: Manual install to /usr/local/bin
sudo curl -L -o /usr/local/bin/create-worktree https://example.com/create-worktree-standalone.js
sudo chmod +x /usr/local/bin/create-worktree

# Option 3: User-specific install
mkdir -p ~/.local/bin
curl -L -o ~/.local/bin/create-worktree https://example.com/create-worktree-standalone.js
chmod +x ~/.local/bin/create-worktree
# Add ~/.local/bin to PATH if not already
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

### Windows

```bash
# Option 1: NPM (in PowerShell/CMD)
npm install -g git-worktree-creator

# Option 2: Manual (PowerShell as Administrator)
Invoke-WebRequest -Uri "https://example.com/create-worktree-standalone.js" -OutFile "C:\Windows\System32\create-worktree.js"
# Create batch wrapper
echo '@node "C:\Windows\System32\create-worktree.js" %*' > C:\Windows\System32\create-worktree.bat
```

---

## Verification

After installation, verify it works:

```bash
# Check version and help
create-worktree --help

# Test in a Git repository
cd /path/to/your/git/repo
create-worktree --type test --name installation-check --yes

# Clean up test
git worktree remove ../test/installation-check
git branch -d test/installation-check
```

---

## Shell Integration

### Bash Aliases

Add to `~/.bashrc` or `~/.bash_profile`:

```bash
# Quick aliases for common workflows
alias wt-feat='create-worktree --type feat --name'
alias wt-fix='create-worktree --type fix --name'
alias wt-doc='create-worktree --type doc --name'

# Usage:
# wt-feat user-authentication
# wt-fix memory-leak
```

### Zsh Functions

Add to `~/.zshrc`:

```zsh
# Quick worktree creation
function wtf() { create-worktree --type feat --name "$1" }
function wtx() { create-worktree --type fix --name "$1" }
function wtd() { create-worktree --type doc --name "$1" }

# With base branch
function wtfb() { create-worktree --type feat --name "$1" --base "$2" }

# Usage:
# wtf user-authentication
# wtfb new-feature develop
```

### Fish Shell

Add to `~/.config/fish/config.fish`:

```fish
# Quick aliases
alias wt-feat='create-worktree --type feat --name'
alias wt-fix='create-worktree --type fix --name'

# Functions
function wtf
    create-worktree --type feat --name $argv[1]
end
```

---

## IDE Integration

### VS Code

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Create Feature Worktree",
      "type": "shell",
      "command": "create-worktree",
      "args": [
        "--type", "feat", 
        "--name", "${input:featureName}"
      ],
      "group": "build",
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      }
    }
  ],
  "inputs": [
    {
      "id": "featureName",
      "description": "Feature name",
      "default": "new-feature",
      "type": "promptString"
    }
  ]
}
```

### JetBrains IDEs

1. **Settings** → **Tools** → **External Tools**
2. **Add new tool**:
   - Name: `Create Feature Worktree`
   - Program: `create-worktree`
   - Arguments: `--type feat --name $Prompt$`
   - Working Directory: `$ProjectFileDir$`

---

## Troubleshooting Installation

### NPM Issues

```bash
# Permission errors (macOS/Linux)
sudo npm install -g git-worktree-creator

# Or use nvm for user-level global installs
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g git-worktree-creator

# Clear npm cache if needed
npm cache clean --force
```

### Path Issues

```bash
# Check if installation directory is in PATH
echo $PATH

# Add to PATH if needed (bash/zsh)
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For npm global installs, find npm global bin
npm config get prefix
# Add that path/bin to your PATH
```

### Node.js Version

```bash
# Check Node.js version (requires >= 16.0.0)
node --version

# Update if needed
npm install -g n
n latest
```

### Permissions

```bash
# Fix executable permissions
chmod +x /usr/local/bin/create-worktree

# Fix ownership (if needed)
sudo chown $(whoami) /usr/local/bin/create-worktree
```

---

## Uninstallation

### NPM Global Package

```bash
npm uninstall -g git-worktree-creator
```

### Standalone Script

```bash
# Remove the file
sudo rm /usr/local/bin/create-worktree
# or
rm ~/.local/bin/create-worktree
```

### Project-Specific

```bash
npm uninstall git-worktree-creator
# Remove from package.json scripts
```

---

## Next Steps

1. **Read the usage guide** in the main README
2. **Test with a simple worktree**: `create-worktree -t test -n hello-world`
3. **Set up shell aliases** for your workflow
4. **Configure your team** to use consistent branch types

Happy worktree management! 🌿